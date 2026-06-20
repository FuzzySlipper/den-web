import { useCallback, useMemo, useState } from 'react';
import { getCachedConfig } from '@den-web/api/config';
import { getPiCrewDiagnosticsOverview, postPiCrewControl, type PiCrewControlResponse, type PiCrewDiagnosticsConfig, type PiCrewDiagnosticsOverview, type PiCrewSessionProjection } from '@den-web/api/piCrewDiagnostics';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import { formatTimeAgo } from '@den-web/shared';
import {
  PI_CREW_SAFE_CONTROL_PATHS,
  buildControlRequest,
  classificationTone,
  conversationalSessions,
  piCrewConfigMissing,
  safeSessionControlPath,
  safeWorkerStalePath,
  summarizePiCrewOverview,
  validateControlRequest,
  workerSessions,
  type PiCrewGlobalControl,
  type PiCrewAdminAuthMode,
} from '@den-web/models/piCrew/piCrewDiagnostics';

const STORAGE_KEY = 'den-web.piCrewDiagnostics.config';
const LEGACY_LOCAL_ADMIN_BASES = new Set([
  'http://127.0.0.1:9237',
  'http://localhost:9237',
  // Current Pi Crew admin target behind Den Web. The service does not answer
  // browser CORS preflights directly, so the browser must use the same-origin
  // Den Web proxy instead of this LAN URL.
  'http://192.168.1.22:9237',
]);

interface StoredConfig { baseUrl: string; operator: string; authMode: PiCrewAdminAuthMode }

function defaultPiCrewAdminBaseUrl(): string {
  return getCachedConfig()?.piCrewAdminApiBase ?? import.meta.env?.VITE_PI_CREW_ADMIN_API_BASE ?? '/pi-crew-admin-api';
}

export function normalizeStoredPiCrewAdminBaseUrl(value: unknown, fallback = '/pi-crew-admin-api'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;
  return LEGACY_LOCAL_ADMIN_BASES.has(trimmed) ? fallback : trimmed;
}

function readStoredConfig(): StoredConfig {
  const defaultBaseUrl = defaultPiCrewAdminBaseUrl();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredConfig> & { bearerToken?: unknown };
      const authMode: PiCrewAdminAuthMode = parsed.authMode === 'none' ? 'none' : 'bearer';
      const sanitized: StoredConfig = {
        baseUrl: normalizeStoredPiCrewAdminBaseUrl(parsed.baseUrl, defaultBaseUrl),
        operator: typeof parsed.operator === 'string' ? parsed.operator : 'patch',
        authMode,
      };
      if (parsed.bearerToken !== undefined || sanitized.baseUrl !== parsed.baseUrl) persistConfig(sanitized);
      return sanitized;
    }
  } catch {
    // Ignore storage failures; the panel remains manually configurable.
  }
  return {
    baseUrl: defaultBaseUrl,
    operator: 'patch',
    authMode: 'bearer',
  };
}

function persistConfig(config: StoredConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Best effort only.
  }
}

export function PiCrewDiagnosticsPanel() {
  const [storedConfig, setStoredConfig] = useState(readStoredConfig);
  const [bearerToken, setBearerToken] = useState('');
  const [reason, setReason] = useState('operator-requested safe dry-run from Den Web');
  const [idempotencyKey, setIdempotencyKey] = useState(() => `den-web-${Date.now()}`);
  const [candidateConfig, setCandidateConfig] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [controlTarget, setControlTarget] = useState<string | null>(null);
  const [controlResult, setControlResult] = useState<PiCrewControlResponse | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const config: PiCrewDiagnosticsConfig = useMemo(() => ({
    baseUrl: storedConfig.baseUrl,
    bearerToken,
    authMode: storedConfig.authMode,
  }), [bearerToken, storedConfig.authMode, storedConfig.baseUrl]);
  const missingConfig = piCrewConfigMissing(config.baseUrl, config.bearerToken, config.authMode);

  const fetchOverview = useCallback(
    () => missingConfig ? Promise.resolve(null) : getPiCrewDiagnosticsOverview(config),
    [config, missingConfig],
  );
  const { data: overview, loading, error, refresh } = useLiveData<PiCrewDiagnosticsOverview | null>(fetchOverview, { interval: 10000 });

  const updateConfig = (patch: Partial<StoredConfig>) => {
    setStoredConfig(current => {
      const next = { ...current, ...patch };
      persistConfig(next);
      return next;
    });
  };

  const executeControl = async (path: string, label: string) => {
    const request = buildControlRequest({
      operator: storedConfig.operator,
      reason,
      idempotencyKey,
      dryRun,
      candidateConfig,
    });
    const validationError = validateControlRequest(request) ?? missingConfig;
    if (validationError) {
      setControlError(validationError);
      return;
    }
    const confirmed = dryRun || window.confirm(`Run real Pi Crew control “${label}”?\n\nReason: ${request.reason}\nIdempotency key: ${request.idempotencyKey}`);
    if (!confirmed) return;
    setControlTarget(label);
    setControlError(null);
    setControlResult(null);
    try {
      const result = await postPiCrewControl(config, path, request);
      setControlResult(result);
      setIdempotencyKey(`den-web-${Date.now()}`);
      refresh();
    } catch (err) {
      setControlError(err instanceof Error ? err.message : String(err));
    } finally {
      setControlTarget(null);
    }
  };

  return (
    <div className="pi-crew-diagnostics-panel">
      <div className="pi-crew-diagnostics-header">
        <div>
          <h2>Pi Crew diagnostics</h2>
          <p>Local runtime diagnostics and safe remediation controls. Den Core/Channels remain workflow authority.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading || Boolean(missingConfig)}>Refresh</button>
      </div>

      <section className="pi-crew-config-card">
        <label>
          Admin endpoint
          <input value={storedConfig.baseUrl} onChange={event => updateConfig({ baseUrl: event.target.value })} placeholder="http://127.0.0.1:9237" />
        </label>
        <label>
          Bearer token
          <input value={bearerToken} onChange={event => setBearerToken(event.target.value)} type="password" placeholder={storedConfig.authMode === 'none' ? 'Disabled by explicit no-auth mode' : 'Required for bearer-token mode (not persisted)'} disabled={storedConfig.authMode === 'none'} />
        </label>
        <label>
          Admin auth mode
          <select value={storedConfig.authMode} onChange={event => updateConfig({ authMode: event.target.value === 'none' ? 'none' : 'bearer' })}>
            <option value="bearer">Bearer token</option>
            <option value="none">No auth / disabled token</option>
          </select>
        </label>
        <label>
          Operator
          <input value={storedConfig.operator} onChange={event => updateConfig({ operator: event.target.value })} placeholder="patch" />
        </label>
        {storedConfig.authMode === 'none' && (
          <div className="pi-crew-status pi-crew-status-warn">
            No-auth mode selected. Den Web will call the Pi Crew admin endpoint without an Authorization header; use only when the installed service intentionally has admin auth disabled.
          </div>
        )}
        {missingConfig && <div className="pi-crew-status pi-crew-status-unknown">{missingConfig}</div>}
      </section>

      {error && <div className="pi-crew-status pi-crew-status-error">{error.message}</div>}
      {loading && !overview && !missingConfig && <div className="pi-crew-status">Loading Pi Crew diagnostics…</div>}
      {overview && <Overview overview={overview} />}

      <section className="pi-crew-control-card">
        <h3>Safe remediation controls</h3>
        <div className="pi-crew-control-form">
          <label>
            Reason
            <input value={reason} onChange={event => setReason(event.target.value)} />
          </label>
          <label>
            Idempotency key
            <input value={idempotencyKey} onChange={event => setIdempotencyKey(event.target.value)} />
          </label>
          <label className="pi-crew-checkbox">
            <input type="checkbox" checked={dryRun} onChange={event => setDryRun(event.target.checked)} />
            Dry-run preview
          </label>
          <label>
            Candidate config (optional JSON/text for validate/reload)
            <textarea value={candidateConfig} onChange={event => setCandidateConfig(event.target.value)} rows={3} />
          </label>
        </div>
        <div className="pi-crew-control-buttons">
          {Object.entries(PI_CREW_SAFE_CONTROL_PATHS).map(([key, path]) => (
            <button key={key} type="button" disabled={Boolean(controlTarget) || Boolean(missingConfig)} onClick={() => executeControl(path, controlLabel(key as PiCrewGlobalControl))}>
              {controlTarget === controlLabel(key as PiCrewGlobalControl) ? 'Running…' : controlLabel(key as PiCrewGlobalControl)}
            </button>
          ))}
        </div>
        <SessionControls sessions={overview?.sessions ?? []} disabled={Boolean(controlTarget) || Boolean(missingConfig)} onControl={executeControl} />
        {controlError && <div className="pi-crew-status pi-crew-status-error">{controlError}</div>}
        {controlResult && <ControlResult result={controlResult} />}
      </section>
    </div>
  );
}

function Overview({ overview }: { overview: PiCrewDiagnosticsOverview }) {
  const tone = classificationTone(overview.classification.kind);
  const workers = workerSessions(overview);
  const conversations = conversationalSessions(overview);
  return (
    <>
      <section className={`pi-crew-overview-card pi-crew-status-${tone}`}>
        <h3>{overview.classification.kind}</h3>
        <p>{overview.classification.summary}</p>
        <p>{summarizePiCrewOverview(overview)}</p>
        <div className="pi-crew-status-grid">
          <Status label="Den Core" status={overview.denCore.status} at={overview.denCore.lastOkAt} />
          <Status label="Den Channels" status={overview.denChannels.status} at={overview.denChannels.lastOkAt} />
          <Status label="MCP" status={overview.mcp.status} at={overview.mcp.lastOkAt} />
          <Status label="Runtime DB" status={overview.runtimeDb.status} at={null} />
        </div>
      </section>
      <section className="pi-crew-session-card">
        <h3>Session ↔ assignment inventory</h3>
        <SessionTable title="Workers" sessions={workers} empty="No local worker sessions." />
        <SessionTable title="Conversational sessions" sessions={conversations} empty="No conversational sessions." />
      </section>
      <section className="pi-crew-events-card">
        <h3>Recent audit/lifecycle evidence</h3>
        <pre>{JSON.stringify(overview.recentEvents.slice(0, 8), null, 2)}</pre>
      </section>
    </>
  );
}

function Status({ label, status, at }: { label: string; status: string; at: string | null }) {
  return <span><strong>{label}</strong><span>{status}{at ? ` · last ok ${formatTimeAgo(at)}` : ''}</span></span>;
}

function SessionTable({ title, sessions, empty }: { title: string; sessions: PiCrewSessionProjection[]; empty: string }) {
  return (
    <div className="pi-crew-session-table-wrap">
      <h4>{title}</h4>
      {sessions.length === 0 ? <p>{empty}</p> : (
        <table className="pi-crew-session-table">
          <thead><tr><th>Session</th><th>State</th><th>Assignment</th><th>Lifecycle</th><th>Last activity</th><th>Evidence</th></tr></thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.sessionId}>
                <td><code>{session.sessionId}</code><br /><span>{session.profileId}</span></td>
                <td>{session.kind} · {session.sessionState}<br />{session.classification}</td>
                <td>{session.workerBinding ? <><code>{session.workerBinding.assignmentId}</code><br />run {session.workerBinding.runId}<br />task #{session.workerBinding.taskId} · {session.workerBinding.role}</> : '—'}</td>
                <td>{session.localLifecycleState}<br />drain {session.drainState}</td>
                <td>{session.lastActivityAt ? formatTimeAgo(session.lastActivityAt) : 'unknown'}</td>
                <td>{session.evidenceRefs.length ? session.evidenceRefs.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SessionControls({ sessions, disabled, onControl }: { sessions: PiCrewSessionProjection[]; disabled: boolean; onControl: (path: string, label: string) => void }) {
  const conversational = sessions.filter(session => safeSessionControlPath(session));
  const workers = sessions.filter(session => safeWorkerStalePath(session));
  return (
    <div className="pi-crew-session-controls">
      {conversational.map(session => (
        <button key={`recreate-${session.sessionId}`} type="button" disabled={disabled} onClick={() => onControl(safeSessionControlPath(session)!, `recreate ${session.sessionId}`)}>
          Recreate conversational instance · {session.sessionId}
        </button>
      ))}
      {workers.map(session => (
        <button key={`stale-${session.sessionId}`} type="button" disabled={disabled} onClick={() => onControl(safeWorkerStalePath(session)!, `mark local stale ${session.workerBinding?.assignmentId ?? session.sessionId}`)}>
          Mark worker local-stale · {session.workerBinding?.assignmentId}
        </button>
      ))}
    </div>
  );
}

function ControlResult({ result }: { result: PiCrewControlResponse }) {
  return (
    <div className={`pi-crew-control-result ${result.accepted ? 'pi-crew-status-ok' : 'pi-crew-status-error'}`}>
      <strong>{result.action} {result.dryRun ? 'dry-run' : 'executed'} · {result.accepted ? 'accepted' : 'rejected'}</strong>
      <span>local audit {String(result.localAuditId ?? 'none')} · control {result.controlId}</span>
      {result.warnings.length > 0 && <span>warnings: {result.warnings.join(', ')}</span>}
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

function controlLabel(control: PiCrewGlobalControl): string {
  switch (control) {
    case 'drain': return 'Drain';
    case 'resume': return 'Resume';
    case 'configValidate': return 'Config validate';
    case 'configReload': return 'Config reload';
  }
}

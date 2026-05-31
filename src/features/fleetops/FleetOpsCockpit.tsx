import { useState, useCallback, useMemo } from 'react';
import type { FleetOpsResponse, FleetOpsAction, FleetOpsRunSummary } from '../../api/types';
import { getFleetOps, postFleetOpsActionRun, getFleetOpsRun } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo } from '../../utils';
import {
  unitStatusLabel,
  unitStatusClass,
  isActionExecutable,
  extractProfileNames,
  sanitizeProfileName,
  diagnosticStatusClass,
  runStatusClass,
  runStatusLabel,
  buildFleetSummary,
  groupActionsByCategory,
  formatUptime,
} from './fleetOpsModel';

// =============================================================================
// Main Fleet Ops Cockpit View
// =============================================================================

export function FleetOpsCockpit() {
  const fetchFleetOps = useCallback(() => getFleetOps(), []);
  const { data: fleetData, loading, error, refresh } = usePolling<FleetOpsResponse>(fetchFleetOps, 10000);

  // Track action runs in progress
  const [runningActionRunIds, setRunningActionRunIds] = useState<Set<string>>(new Set());

  // Profile selector for restart-profile
  const [selectedProfile, setSelectedProfile] = useState<string>('');

  // Dry-run toggle
  const [dryRunEnabled, setDryRunEnabled] = useState(false);

  // Confirmation dialog state
  const [pendingAction, setPendingAction] = useState<FleetOpsAction | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Action feedback
  const [lastActionResult, setLastActionResult] = useState<{ actionId: string; success: boolean; message: string } | null>(null);

  const profileNames = useMemo(
    () => fleetData ? extractProfileNames(fleetData.serviceUnits) : [],
    [fleetData],
  );

  const summaryLine = useMemo(
    () => fleetData ? buildFleetSummary(fleetData) : '',
    [fleetData],
  );

  const actionGroups = useMemo(
    () => fleetData ? groupActionsByCategory(fleetData.actions) : [],
    [fleetData],
  );

  const handleExecuteAction = useCallback(async (action: FleetOpsAction) => {
    // Cannot execute disabled or high-risk actions
    if (!isActionExecutable(action) && !action.highRisk) return;

    // High-risk actions need confirmation flow even if "enabled" is true
    if (action.highRisk) return;

    // Actions requiring confirmation need explicit user approval
    if (action.requiresConfirmation) {
      setPendingAction(action);
      setConfirmText('');
      return;
    }

    // Actions requiring args (restart-profile) need a profile selected
    if (action.requiresArgs && action.actionId === 'restart-profile') {
      if (!selectedProfile) return;
    }

    try {
      const args = action.actionId === 'restart-profile' && selectedProfile
        ? { profile: sanitizeProfileName(selectedProfile) }
        : undefined;

      const result = await postFleetOpsActionRun({
        actionId: action.actionId,
        dryRun: dryRunEnabled || undefined,
        args,
      });

      setLastActionResult({ actionId: action.actionId, success: true, message: `Run ${result.run.runId} started` });

      // If the run is still running/pending, poll for completion
      if (result.run.status === 'running' || result.run.status === 'pending') {
        const runId = result.run.runId;
        setRunningActionRunIds(prev => new Set(prev).add(runId));

        const timer = setInterval(async () => {
          try {
            const detail = await getFleetOpsRun(runId);
            if (!detail.run || detail.run.status === 'completed' || detail.run.status === 'failed') {
              // Stop polling
              clearInterval(timer);
              setRunningActionRunIds(prev => {
                const next = new Set(prev);
                next.delete(runId);
                return next;
              });
              // Refresh fleet data when run completes
              refresh();
            }
          } catch {
            // Poll errors are non-fatal; next tick will retry
          }
        }, 3000);
      }

      // Refresh fleet data after triggering
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastActionResult({ actionId: action.actionId, success: false, message });
    }
  }, [dryRunEnabled, selectedProfile, refresh]);

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setConfirmText('');

    try {
      const args = action.actionId === 'restart-profile' && selectedProfile
        ? { profile: sanitizeProfileName(selectedProfile) }
        : undefined;

      const result = await postFleetOpsActionRun({
        actionId: action.actionId,
        dryRun: dryRunEnabled || undefined,
        args,
        confirmation: confirmText || undefined,
      });

      setLastActionResult({ actionId: action.actionId, success: true, message: `Run ${result.run.runId} started` });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastActionResult({ actionId: action.actionId, success: false, message });
    }
  }, [pendingAction, confirmText, dryRunEnabled, selectedProfile, refresh]);

  const handleCancelConfirm = useCallback(() => {
    setPendingAction(null);
    setConfirmText('');
  }, []);

  return (
    <div className="fops-cockpit">
      {/* Header */}
      {fleetData && (
        <div className="fops-header">
          <div className="fops-header-summary">
            <span className="fops-service-name">{fleetData.service}</span>
            <span className="fops-summary-line">{summaryLine}</span>
          </div>
          <div className="fops-header-actions">
            <span className="fops-generated-at">
              Updated: {formatTimeAgo(fleetData.generatedAt)}
            </span>
            <button className="fops-refresh-button" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Loading / Error / Empty */}
      {loading && !fleetData && (
        <div className="fops-loading">Loading fleet ops...</div>
      )}
      {error && (
        <div className="fops-error">
          Failed to load fleet ops: {error.message}
          <div className="fops-error-hint">
            This requires the Gateway /api/gateway/fleet-ops endpoint.
            If unavailable, the UI gracefully shows this error.
          </div>
        </div>
      )}
      {!loading && !error && !fleetData && (
        <div className="fops-empty">No fleet ops data available.</div>
      )}

      {fleetData && (
        <>
          {/* Discovery Diagnostics */}
          {fleetData.discoveryDiagnostics.length > 0 && (
            <FleetDiagnostics diagnostics={fleetData.discoveryDiagnostics} />
          )}

          {/* Service Units */}
          <FleetServiceUnits units={fleetData.serviceUnits} />

          {/* Actions */}
          <FleetActions
            actionGroups={actionGroups}
            profileNames={profileNames}
            selectedProfile={selectedProfile}
            onProfileChange={setSelectedProfile}
            dryRunEnabled={dryRunEnabled}
            onDryRunToggle={setDryRunEnabled}
            onExecute={handleExecuteAction}
            runningActionRunIds={runningActionRunIds}
          />

          {/* Recent Runs */}
          <FleetRecentRuns runs={fleetData.recentRuns} />

          {/* Last Action Result */}
          {lastActionResult && (
            <div className={`fops-action-result ${lastActionResult.success ? 'fops-action-result-ok' : 'fops-action-result-err'}`}>
              <span className="fops-action-result-action">{lastActionResult.actionId}</span>
              <span className="fops-action-result-msg">{lastActionResult.message}</span>
              <button className="fops-action-result-dismiss" onClick={() => setLastActionResult(null)}>Dismiss</button>
            </div>
          )}
        </>
      )}

      {/* Confirmation dialog */}
      {pendingAction && (
        <div className="fops-confirm-overlay" role="dialog" aria-label={`Confirm ${pendingAction.label}`}>
          <div className="fops-confirm-dialog">
            <h3>Confirm: {pendingAction.label}</h3>
            {pendingAction.description && (
              <p className="fops-confirm-desc">{pendingAction.description}</p>
            )}
            <label className="fops-confirm-label">
              Type <strong>confirm</strong> to proceed:
              <input
                className="fops-confirm-input"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="confirm"
                autoFocus
              />
            </label>
            <div className="fops-confirm-buttons">
              <button
                className="fops-confirm-ok"
                onClick={handleConfirmAction}
                disabled={confirmText.toLowerCase() !== 'confirm'}
              >
                Execute
              </button>
              <button className="fops-confirm-cancel" onClick={handleCancelConfirm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function FleetDiagnostics({ diagnostics }: { diagnostics: FleetOpsResponse['discoveryDiagnostics'] }) {
  return (
    <div className="fops-section">
      <h3 className="fops-section-title">Discovery Diagnostics</h3>
      <div className="fops-diag-list">
        {diagnostics.map((diag, i) => (
          <div key={i} className={`fops-diag-item ${diagnosticStatusClass(diag.status)}`}>
            <span className="fops-diag-check">{diag.check}</span>
            <span className={`fops-diag-status ${diagnosticStatusClass(diag.status)}`}>
              {diag.status.toUpperCase()}
            </span>
            {diag.detail && <span className="fops-diag-detail">{diag.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FleetServiceUnits({ units }: { units: FleetOpsResponse['serviceUnits'] }) {
  return (
    <div className="fops-section">
      <h3 className="fops-section-title">Service Units ({units.length})</h3>
      <div className="fops-units-table-wrapper">
        <table className="fops-units-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Status</th>
              <th>Profile</th>
              <th>PID</th>
              <th>Uptime</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {units.map(unit => (
              <tr key={unit.name} className={`fops-unit-row ${unitStatusClass(unit.status)}`}>
                <td className="fops-unit-name">
                  {unit.name}
                  {unit.description && (
                    <span className="fops-unit-desc">{unit.description}</span>
                  )}
                </td>
                <td>
                  <span className={`fops-status-chip ${unitStatusClass(unit.status)}`}>
                    {unitStatusLabel(unit.status)}
                  </span>
                </td>
                <td className="fops-unit-profile">{unit.profile ?? '—'}</td>
                <td className="fops-unit-pid">{unit.pid != null ? String(unit.pid) : '—'}</td>
                <td className="fops-unit-uptime">{formatUptime(unit.uptimeSeconds ?? null)}</td>
                <td className="fops-unit-enabled">{unit.enabled ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FleetActionsProps {
  actionGroups: ReturnType<typeof groupActionsByCategory>;
  profileNames: string[];
  selectedProfile: string;
  onProfileChange: (profile: string) => void;
  dryRunEnabled: boolean;
  onDryRunToggle: (enabled: boolean) => void;
  onExecute: (action: FleetOpsAction) => void;
  runningActionRunIds: Set<string>;
}

function FleetActions({
  actionGroups,
  profileNames,
  selectedProfile,
  onProfileChange,
  dryRunEnabled,
  onDryRunToggle,
  onExecute,
  runningActionRunIds,
}: FleetActionsProps) {
  return (
    <div className="fops-section">
      <h3 className="fops-section-title">
        Actions
        {runningActionRunIds.size > 0 && (
          <span className="fops-running-badge">
            {runningActionRunIds.size} running
          </span>
        )}
      </h3>

      {/* Global controls */}
      <div className="fops-actions-controls">
        <label className="fops-dry-run-toggle" title="Run actions in dry-run mode when supported">
          <input
            type="checkbox"
            checked={dryRunEnabled}
            onChange={e => onDryRunToggle(e.target.checked)}
          />
          Dry Run
        </label>

        {profileNames.length > 0 && (
          <label className="fops-profile-selector">
            Profile:
            <select
              className="fops-profile-select"
              value={selectedProfile}
              onChange={e => onProfileChange(e.target.value)}
            >
              <option value="">— select profile —</option>
              {profileNames.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Action groups */}
      {actionGroups.map(group => (
        <div key={group.category} className={`fops-action-group ${group.cssClass}`}>
          <div className="fops-action-group-label">{group.label}</div>
          <div className="fops-action-buttons">
            {group.actions.map(action => {
              const executable = action.enabled;
              const isHighRisk = Boolean(action.highRisk);
              const needsProfile = action.actionId === 'restart-profile' && !selectedProfile;
              const disabled = !executable || isHighRisk || needsProfile;

              return (
                <button
                  key={action.actionId}
                  className={`fops-action-button ${executable ? 'fops-action-enabled' : 'fops-action-disabled'} ${isHighRisk ? 'fops-action-highrisk' : ''}`}
                  onClick={() => onExecute(action)}
                  disabled={disabled}
                  title={[
                    action.description,
                    action.supportsDryRun ? 'supports dry-run' : '',
                    action.requiresConfirmation ? 'requires confirmation' : '',
                    isHighRisk ? 'HIGH RISK — disabled by policy' : '',
                    needsProfile ? 'select a profile first' : '',
                  ].filter(Boolean).join('\n')}
                >
                  {action.label}
                  {action.supportsDryRun && <span className="fops-action-dry-badge">DRY</span>}
                  {isHighRisk && <span className="fops-action-risk-badge">HIGH RISK</span>}
                  {!executable && !isHighRisk && <span className="fops-action-disabled-badge">DISABLED</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FleetRecentRuns({ runs }: { runs: FleetOpsRunSummary[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="fops-section">
      <h3 className="fops-section-title">Recent Runs ({runs.length})</h3>
      <table className="fops-runs-table">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Action</th>
            <th>Status</th>
            <th>Dry Run</th>
            <th>Started</th>
            <th>Duration</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.runId} className={`fops-run-row ${runStatusClass(run.status)}`}>
              <td className="fops-run-id">{run.runId}</td>
              <td className="fops-run-action">{run.actionId}</td>
              <td>
                <span className={`fops-run-status-chip ${runStatusClass(run.status)}`}>
                  {runStatusLabel(run.status)}
                </span>
              </td>
              <td className="fops-run-dry">{run.dryRun ? 'Yes' : ''}</td>
              <td className="fops-run-started">{run.startedAt ? formatTimeAgo(run.startedAt) : '—'}</td>
              <td className="fops-run-duration">
                {run.startedAt && run.completedAt
                  ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                  : '—'}
              </td>
              <td className="fops-run-summary">
                {run.error ? (
                  <span className="fops-run-error">{run.error}</span>
                ) : (
                  run.summary ?? '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

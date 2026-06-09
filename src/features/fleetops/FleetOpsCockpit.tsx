import { useState, useCallback, useMemo } from 'react';
import type { FleetOpsResponse, FleetOpsAction, FleetOpsActionRun } from '../../api/types';
import { getFleetOps, postFleetOpsActionRun, getFleetOpsRun } from '../../api/client';
import { useLiveData } from '../../hooks/useLiveData';
import { formatTimeAgo } from '../../utils';
import {
  unitStatusLabel,
  unitStatusClass,
  isActionDisabled,
  actionNeedsConfirmation,
  actionConfirmationPrompt,
  riskLevelClass,
  extractProfileNames,
  sanitizeProfileName,
  runStatusClass,
  runStatusLabel,
  buildFleetSummary,
  groupActionsByRisk,
  formatRunDuration,
} from './fleetOpsModel';

// =============================================================================
// Main Fleet Ops Cockpit View
// =============================================================================

export function FleetOpsCockpit() {
  const fetchFleetOps = useCallback(() => getFleetOps(), []);
  const { data: fleetData, loading, error, refresh } = useLiveData<FleetOpsResponse>(fetchFleetOps, { interval: 10000 });

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
    () => fleetData ? groupActionsByRisk(fleetData.actions) : [],
    [fleetData],
  );

  const handleExecuteAction = useCallback(async (action: FleetOpsAction) => {
    // Cannot execute disabled actions
    if (isActionDisabled(action)) return;

    // Actions needing confirmation go through the confirmation flow
    if (actionNeedsConfirmation(action)) {
      setPendingAction(action);
      setConfirmText('');
      return;
    }

    // Actions with argsSchema requiring profile (restart-profile) need a profile selected
    if (action.actionId === 'restart-profile' && !selectedProfile) return;

    try {
      const args = action.actionId === 'restart-profile' && selectedProfile
        ? { profile: sanitizeProfileName(selectedProfile) }
        : undefined;

      const run = await postFleetOpsActionRun({
        actionId: action.actionId,
        dryRun: dryRunEnabled || undefined,
        args,
      });

      // POST returns FleetOpsActionRun directly (not wrapped)
      setLastActionResult({ actionId: action.actionId, success: true, message: `Run ${run.runId} started` });

      // If the run is still running/pending, poll for completion
      if (run.status === 'running' || run.status === 'pending') {
        const runId = run.runId;
        setRunningActionRunIds(prev => new Set(prev).add(runId));

        const timer = setInterval(async () => {
          try {
            const detail = await getFleetOpsRun(runId);
            if (!detail.run || detail.run.status === 'completed' || detail.run.status === 'failed') {
              clearInterval(timer);
              setRunningActionRunIds(prev => {
                const next = new Set(prev);
                next.delete(runId);
                return next;
              });
              refresh();
            }
          } catch {
            // Poll errors are non-fatal; next tick will retry
          }
        }, 3000);
      }

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

      const run = await postFleetOpsActionRun({
        actionId: action.actionId,
        dryRun: dryRunEnabled || undefined,
        args,
        confirmation: confirmText || undefined,
      });

      setLastActionResult({ actionId: action.actionId, success: true, message: `Run ${run.runId} started` });
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

  // Determine the confirmation prompt from the pending action
  const confirmPrompt = pendingAction ? actionConfirmationPrompt(pendingAction) : '';

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
            This requires Den Host at /den-host-api/fleet-ops.
            If unavailable, verify den-host.service and DEN_HOST_TARGET on the static server.
          </div>
        </div>
      )}
      {!loading && !error && !fleetData && (
        <div className="fops-empty">No fleet ops data available.</div>
      )}

      {fleetData && (
        <>
          {/* Discovery Diagnostics (plain text from Den Host) */}
          {fleetData.discoveryDiagnostics && (
            <FleetDiagnostics text={fleetData.discoveryDiagnostics} />
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
          {(fleetData.recentRuns ?? []).length > 0 && (
            <FleetRecentRuns runs={fleetData.recentRuns!} />
          )}

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
            <p className="fops-confirm-desc">{confirmPrompt}</p>
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

function FleetDiagnostics({ text }: { text: string }) {
  return (
    <div className="fops-section">
      <h3 className="fops-section-title">Discovery Diagnostics</h3>
      <pre className="fops-diag-text">{text}</pre>
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
              <th>State</th>
              <th>Sub</th>
              <th>Profile</th>
              <th>PID</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {units.map(unit => (
              <tr key={unit.unitName} className={`fops-unit-row ${unitStatusClass(unit.activeState)}`}>
                <td className="fops-unit-name">
                  {unit.unitName}
                  {unit.description && (
                    <span className="fops-unit-desc">{unit.description}</span>
                  )}
                </td>
                <td>
                  <span className={`fops-status-chip ${unitStatusClass(unit.activeState)}`}>
                    {unitStatusLabel(unit.activeState)}
                  </span>
                </td>
                <td className="fops-unit-substate">{unit.subState}</td>
                <td className="fops-unit-profile">{unit.profileName || '\u2014'}</td>
                <td className="fops-unit-pid">{unit.pid != null ? String(unit.pid) : '\u2014'}</td>
                <td className="fops-unit-summary">{unit.statusSummary ?? '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FleetActionsProps {
  actionGroups: ReturnType<typeof groupActionsByRisk>;
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
        <div key={group.riskLevel} className={`fops-action-group ${group.cssClass}`}>
          <div className="fops-action-group-label">{group.label}</div>
          <div className="fops-action-buttons">
            {group.actions.map(action => {
              const disabled = isActionDisabled(action);
              const needsProfile = action.actionId === 'restart-profile' && !selectedProfile;
              const buttonDisabled = disabled || needsProfile;

              return (
                <button
                  key={action.actionId}
                  className={`fops-action-button ${!disabled ? 'fops-action-enabled' : 'fops-action-disabled'} ${riskLevelClass(action.riskLevel)}`}
                  onClick={() => onExecute(action)}
                  disabled={buttonDisabled}
                  title={[
                    `Risk: ${action.riskLevel}`,
                    action.mutating ? 'mutating' : 'read-only',
                    action.supportsDryRun ? 'supports dry-run' : '',
                    action.needsConfirmation ? 'requires confirmation' : '',
                    action.disabledReason ?? '',
                    needsProfile ? 'select a profile first' : '',
                  ].filter(Boolean).join('\n')}
                >
                  {action.label}
                  {action.supportsDryRun && <span className="fops-action-dry-badge">DRY</span>}
                  {!disabled && action.riskLevel === 'high' && <span className="fops-action-risk-badge">HIGH RISK</span>}
                  {disabled && <span className="fops-action-disabled-badge">DISABLED: {action.disabledReason}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FleetRecentRuns({ runs }: { runs: FleetOpsActionRun[] }) {
  return (
    <div className="fops-section">
      <h3 className="fops-section-title">Recent Runs ({runs.length})</h3>
      <table className="fops-runs-table">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Action</th>
            <th>Status</th>
            <th>Exit</th>
            <th>Dry Run</th>
            <th>Created</th>
            <th>Duration</th>
            <th>Output</th>
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
              <td className="fops-run-exit">{run.exitCode != null ? String(run.exitCode) : '\u2014'}</td>
              <td className="fops-run-dry">{run.wasDryRun ? 'Yes' : ''}</td>
              <td className="fops-run-created">{run.createdAt ? formatTimeAgo(run.createdAt) : '\u2014'}</td>
              <td className="fops-run-duration">{formatRunDuration(run.startedAt, run.finishedAt)}</td>
              <td className="fops-run-output">
                {run.errorMessage ? (
                  <span className="fops-run-error">{run.errorMessage}</span>
                ) : (
                  <span className="fops-run-stdout" title={run.stderrTail ?? undefined}>
                    {run.stdoutTail ?? '\u2014'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

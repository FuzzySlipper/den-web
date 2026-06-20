import { useState, useCallback, useMemo } from 'react';
import type { FleetOpsResponse, FleetOpsAction } from '@den-web/api/types';
import { getFleetOps, postFleetOpsActionRun, getFleetOpsRun } from '@den-web/api/client';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import { formatTimeAgo } from '@den-web/shared';
import {
  isActionDisabled,
  actionNeedsConfirmation,
  actionConfirmationPrompt,
  extractProfileNames,
  sanitizeProfileName,
  buildFleetSummary,
  groupActionsByRisk,
} from '@den-web/models/fleetops/fleetOps';
import { FleetActions, FleetDiagnostics, FleetRecentRuns, FleetServiceUnits } from './FleetOpsSections';

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

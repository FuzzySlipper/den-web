import type { FleetOpsAction, FleetOpsActionRun, FleetOpsResponse } from '@den-web/api/types';
import { formatTimeAgo } from '@den-web/shared';
import {
  actionNeedsConfirmation,
  formatRunDuration,
  groupActionsByRisk,
  isActionDisabled,
  riskLevelClass,
  runStatusClass,
  runStatusLabel,
  unitStatusClass,
  unitStatusLabel,
} from '@den-web/models/fleetops/fleetOps';

export function FleetDiagnostics({ text }: { text: string }) {
  return (
    <div className="fops-section">
      <h3 className="fops-section-title">Discovery Diagnostics</h3>
      <pre className="fops-diag-text">{text}</pre>
    </div>
  );
}

export function FleetServiceUnits({ units }: { units: FleetOpsResponse['serviceUnits'] }) {
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

export function FleetActions({
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
                    actionNeedsConfirmation(action) ? 'requires confirmation' : '',
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

export function FleetRecentRuns({ runs }: { runs: FleetOpsActionRun[] }) {
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

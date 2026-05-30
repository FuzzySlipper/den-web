import { useCallback, useMemo } from 'react';
import type { WorkerPoolLobbyPresence, WorkerPoolMemberPresence } from '../../api/types';
import { getWorkerPoolLobbyPresence } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo } from '../../utils';
import {
  availabilityLabel,
  availabilityClass,
  groupByRole,
  filterArchivedMembers,
  buildLobbySummary,
  formatObservedAt,
} from './workerPoolModel';

interface Props {
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}

export function WorkerPoolLobbyView({ onOpenAssignmentTrace }: Props) {
  const fetchLobby = useCallback(() => getWorkerPoolLobbyPresence(), []);
  const { data: presence, loading, error, refresh } = usePolling<WorkerPoolLobbyPresence>(fetchLobby, 10000);

  const roleGroups = useMemo(() => presence ? groupByRole(presence.members) : [], [presence]);
  const archivedMembers = useMemo(() => presence ? filterArchivedMembers(presence.members) : [], [presence]);

  const summaryLine = useMemo(() => presence ? buildLobbySummary(presence) : '', [presence]);

  return (
    <div className="wpool-lobby-view">
      {/* Header */}
      {presence && (
        <div className="wpool-lobby-header">
          <div className="wpool-lobby-header-summary">
            <span className="wpool-lobby-available-badge">
              {presence.availableCount} available
            </span>
            <span className="wpool-lobby-summary-line">{summaryLine}</span>
          </div>
          <div className="wpool-lobby-header-actions">
            <span className="wpool-lobby-observed">
              Observed: {formatObservedAt(presence.observedAt)}
            </span>
            <button className="wpool-refresh-button" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Loading / Error / Empty */}
      {loading && !presence && (
        <div className="wpool-loading">Loading worker-pool lobby presence...</div>
      )}
      {error && (
        <div className="wpool-error">
          Failed to load worker-pool lobby: {error.message}
          <div className="wpool-error-hint">
            This requires the Channels /api/worker-pool/lobby/presence endpoint (#1771).
            If unavailable, the UI gracefully shows this error.
          </div>
        </div>
      )}
      {!loading && !error && !presence && (
        <div className="wpool-empty">No worker-pool lobby data available.</div>
      )}

      {presence && (
        <>
          {/* Role-grouped worker table */}
          {roleGroups.filter(g => g.candidateCount > 0).length > 0 && (
            <div className="wpool-section">
              <h3 className="wpool-section-title">Candidate Workers by Role</h3>
              {roleGroups.filter(g => g.candidateCount > 0).map(group => (
                <div key={group.role} className="wpool-role-group">
                  <div className="wpool-role-header">
                    <strong className="wpool-role-name">{group.role}</strong>
                    <span className="wpool-role-count">
                      {group.members.length} member{group.members.length === 1 ? '' : 's'}
                      {group.quarantinedCount > 0 && ` (${group.quarantinedCount} quarantined)`}
                    </span>
                  </div>
                  <table className="wpool-member-table">
                    <thead>
                      <tr>
                        <th>Identity</th>
                        <th>Status</th>
                        <th>Assignments</th>
                        <th>Last Seen</th>
                        {onOpenAssignmentTrace && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.members
                        .filter(m => !m.isLegacyPilot)
                        .map(member => (
                          <WorkerPoolMemberRow
                            key={member.identity}
                            member={member}
                            onOpenAssignmentTrace={onOpenAssignmentTrace}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Archived / quarantined section */}
          {archivedMembers.length > 0 && (
            <div className="wpool-section wpool-section-archived">
              <h3 className="wpool-section-title">
                Archived / Legacy Members ({archivedMembers.length})
              </h3>
              <div className="wpool-archived-note">
                These entries contain old pilot members, quarantined workers, or
                other legacy records not available for new assignments.
              </div>
              <table className="wpool-member-table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedMembers.map(member => (
                    <tr key={member.identity} className="wpool-member-row wpool-member-row-archived">
                      <td className="wpool-member-identity">{member.identity}</td>
                      <td className="wpool-member-role">{member.role}</td>
                      <td>
                        <span className={`wpool-avail-chip ${availabilityClass(member.availabilityState)}`}>
                          {availabilityLabel(member.availabilityState)}
                        </span>
                      </td>
                      <td className="wpool-member-detail">
                        {member.statusDetail ?? '—'}
                        {member.isQuarantined && <span className="wpool-quarantine-chip">Quarantined</span>}
                        {member.isLegacyPilot && <span className="wpool-legacy-chip">Legacy Pilot</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function WorkerPoolMemberRow({
  member,
  onOpenAssignmentTrace,
}: {
  member: WorkerPoolMemberPresence;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}) {
  const isBusy = member.availabilityState === 'leased' || member.availabilityState === 'busy';
  const assignmentText = isBusy
    ? `${member.activeAssignmentCount} active / ${member.completedAssignmentCount} completed`
    : `0 active / ${member.completedAssignmentCount} completed`;

  return (
    <tr className={`wpool-member-row ${isBusy ? 'wpool-member-row-busy' : ''}`}>
      <td className="wpool-member-identity">{member.identity}</td>
      <td>
        <span className={`wpool-avail-chip ${availabilityClass(member.availabilityState)}`}>
          {availabilityLabel(member.availabilityState)}
        </span>
        {isBusy && member.statusDetail && (
          <span className="wpool-status-detail">{member.statusDetail}</span>
        )}
      </td>
      <td className="wpool-member-assignments">
        <span>{assignmentText}</span>
        {isBusy && member.activeAssignmentIds.length > 0 && (
          <div className="wpool-active-assignment-ids">
            {member.activeAssignmentIds.map(id => (
              <span key={id} className="wpool-assignment-id">
                {onOpenAssignmentTrace ? (
                  <button
                    className="wpool-assignment-trace-link"
                    onClick={() => onOpenAssignmentTrace(id)}
                    title="Open assignment trace"
                  >
                    {id}
                  </button>
                ) : (
                  id
                )}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="wpool-member-seen">
        {member.lastSeenAt ? formatTimeAgo(member.lastSeenAt) : '—'}
      </td>
      {onOpenAssignmentTrace && (
        <td className="wpool-member-action">
          {isBusy && member.activeAssignmentIds[0] && (
            <button
              className="wpool-trace-button"
              onClick={() => onOpenAssignmentTrace(member.activeAssignmentIds[0])}
            >
              Trace
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

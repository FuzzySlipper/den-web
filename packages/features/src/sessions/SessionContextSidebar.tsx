import type { ActiveWorkRoute, DesktopSessionEvent, DesktopSessionSnapshot, GatewayMember } from '@den-web/api/types';
import {
  activeOwnerLabel,
  activeRouteKey,
  activeWorkTargetLabel,
  resetScopeLabel,
  sourceContextLabel,
  type ResetScope,
  type SourceContextSelection,
} from './sessionPolicy';
import {
  currentToolLabel,
  displayTime,
  eventPayloadPreview,
  sessionModelProfile,
  statusDetail,
  type FocusedLaneState,
} from '@den-web/models/sessions/sessionDisplay';

interface Props {
  projectId: string | null;
  viewState: FocusedLaneState;
  selectedActiveRoute: ActiveWorkRoute | null;
  selectedSnapshot: DesktopSessionSnapshot | null;
  selectedSourceContext: SourceContextSelection;
  selectedTarget: GatewayMember | null;
  selectedResetScope: ResetScope;
  routePreview: string;
  selectedRouteAllowsReset: boolean;
  orderedEvents: DesktopSessionEvent[];
  evidenceEvents: DesktopSessionEvent[];
  eventsLoading: boolean;
  activeRoutes: ActiveWorkRoute[];
  activeRoutesLoading: boolean;
  activeRouteGroups: Map<string, ActiveWorkRoute[]>;
  members: GatewayMember[];
  activeAgentMembers: GatewayMember[];
  membershipsLoading: boolean;
  targetMemberIdentity: string;
  onSelectRoute: (routeKey: string) => void;
  onSelectTarget: (identity: string) => void;
}

/** Den-context sidebar: context summary, status/tool evidence, policy refs, active routes, participants. */
export function SessionContextSidebar({
  projectId,
  viewState,
  selectedActiveRoute,
  selectedSnapshot,
  selectedSourceContext,
  selectedTarget,
  selectedResetScope,
  routePreview,
  selectedRouteAllowsReset,
  orderedEvents,
  evidenceEvents,
  eventsLoading,
  activeRoutes,
  activeRoutesLoading,
  activeRouteGroups,
  members,
  activeAgentMembers,
  membershipsLoading,
  targetMemberIdentity,
  onSelectRoute,
  onSelectTarget,
}: Props) {
  return (
    <aside className="focused-session-sidebar" aria-label="Den context">
      <section className="focused-session-card">
        <h3>Den context</h3>
        <dl className="focused-session-context-list">
          <dt>Target work</dt><dd>{selectedActiveRoute ? activeWorkTargetLabel(selectedActiveRoute) : selectedSnapshot?.task_id != null ? `project ${projectId} · task #${selectedSnapshot.task_id}` : `project ${projectId ?? 'Select a project'}`}</dd>
          <dt>Active owner</dt><dd>{selectedActiveRoute ? activeOwnerLabel(selectedActiveRoute) : selectedSnapshot?.source_instance_id ?? 'No active owner route'}</dd>
          <dt>Source context</dt><dd>{sourceContextLabel(selectedActiveRoute, selectedSourceContext)}</dd>
          <dt>Runtime session</dt><dd>{selectedActiveRoute?.sessionId ?? selectedSnapshot?.session_id ?? 'No runtime session evidence'}</dd>
          <dt>Task</dt><dd>{selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id != null ? `#${selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id}` : 'No task metadata'}</dd>
          <dt>Assignment/run</dt><dd>{[selectedActiveRoute?.assignmentId, selectedActiveRoute?.workerRunId].filter(Boolean).join(' / ') || 'No assignment/run metadata'}</dd>
          <dt>Agent instance</dt><dd>{selectedActiveRoute?.agentInstanceId ?? selectedSnapshot?.source_instance_id ?? 'Not reported'}</dd>
          <dt>Pool/profile</dt><dd>{[selectedActiveRoute?.poolMemberId, selectedActiveRoute?.profileIdentity, selectedTarget?.memberIdentity].filter(Boolean).join(' / ') || 'Not reported'}</dd>
          <dt>Model/Profile</dt><dd>{sessionModelProfile(selectedSnapshot) ?? 'Not reported'}</dd>
        </dl>
      </section>

      <section className="focused-session-card focused-session-status-card">
        <h3>Status evidence</h3>
        <div className={`focused-session-status-pill focused-session-state-${viewState}`}>{viewState}</div>
        <p>{statusDetail(selectedSnapshot)}</p>
        <div className="focused-session-routing-preview">
          <strong>Route preview</strong>
          <span>{routePreview}</span>
          <span>Reset scope: {resetScopeLabel(selectedResetScope)}{selectedRouteAllowsReset ? '' : ' (route does not advertise reset action)'}</span>
        </div>
        {selectedSnapshot?.warnings?.length ? (
          <ul className="focused-session-warning-list">
            {selectedSnapshot.warnings.slice(0, 4).map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        ) : null}
        {selectedSnapshot?.is_stale && <div className="focused-session-warning">Stale binding warning: desktop snapshot is outside freshness bounds.</div>}
      </section>

      <section className="focused-session-card">
        <h3>Tool evidence</h3>
        <p>{currentToolLabel(selectedSnapshot, orderedEvents)}</p>
        <div className="focused-session-subtitle">{eventsLoading ? 'loading session events…' : `${evidenceEvents.length} bounded event previews`}</div>
        <div className="focused-session-event-list">
          {evidenceEvents.length === 0 ? (
            <div className="focused-session-empty">No status/tool events for this lane.</div>
          ) : evidenceEvents.map(event => (
            <div key={event.id} className="focused-session-event">
              <span>{displayTime(event.created_at)}</span>
              <strong>{event.event_type}</strong>
              <p>{eventPayloadPreview(event)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="focused-session-card">
        <h3>Policy refs</h3>
        <p className="focused-session-subtitle">
          Copy follows the accepted session-owner policy; source channels are metadata, while concrete agent instances or assignment runs own active work.
        </p>
        <div className="focused-session-ref-list">
          <a href="/api/v1/projects/_global/documents/agent-session-boundary-policy" target="_blank" rel="noreferrer">_global/agent-session-boundary-policy</a>
          <a href="/api/v1/projects/den-channels/tasks/1873" target="_blank" rel="noreferrer">den-channels #1873 active-work routing</a>
          <a href="/api/v1/projects/den-hermes-bridge/tasks/1890" target="_blank" rel="noreferrer">den-hermes-bridge #1890 Hermes session behavior</a>
        </div>
      </section>

      <section className="focused-session-card">
        <h3>Active-work routes</h3>
        <div className="focused-session-subtitle">
          {activeRoutesLoading ? 'resolving routes…' : `${activeRoutes.length} route(s), ${activeRouteGroups.size} concrete owner group(s)`}
        </div>
        <div className="focused-session-route-list">
          {activeRoutes.length === 0 ? (
            <div className="focused-session-empty">No active route for this target project. Source-channel messages will remain ordinary channel context.</div>
          ) : activeRoutes.map(route => {
            const key = activeRouteKey(route);
            const selected = selectedActiveRoute ? activeRouteKey(selectedActiveRoute) === key : false;
            return (
              <button
                key={key}
                type="button"
                className={`focused-session-route ${selected ? 'selected' : ''}`}
                onClick={() => onSelectRoute(key)}
                title={`${activeWorkTargetLabel(route)} · ${sourceContextLabel(route, selectedSourceContext)}`}
              >
                <strong>{activeWorkTargetLabel(route)}</strong>
                <span>{activeOwnerLabel(route)}</span>
                <span>{sourceContextLabel(route, selectedSourceContext)} · actions {route.allowedActions.join(', ') || 'none'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="focused-session-card">
        <h3>Participants</h3>
        <div className="focused-session-subtitle">{membershipsLoading ? 'loading…' : `${activeAgentMembers.length} active agent(s)`}</div>
        <div className="focused-session-member-list">
          {members.length === 0 ? (
            <div className="focused-session-empty">No gateway membership metadata.</div>
          ) : members.map(member => (
            <button
              key={member.id}
              type="button"
              className={`focused-session-member ${member.memberIdentity === targetMemberIdentity ? 'selected' : ''}`}
              disabled={member.memberType !== 'agent' || member.membershipStatus !== 'active'}
              onClick={() => onSelectTarget(member.memberIdentity)}
            >
              <strong>{member.memberIdentity}</strong>
              <span>{member.memberType} · {member.membershipStatus} · {member.wakePolicy}</span>
              {member.settingsLabel && <span>{member.settingsLabel}</span>}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

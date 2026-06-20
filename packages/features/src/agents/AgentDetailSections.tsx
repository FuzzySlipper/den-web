import type { AgentDetailResponse } from '@den-web/api/types';
import {
  bindingHasStaleControlChannel,
  membershipLaneLabel,
} from './agentAttribution';
import {
  chipClass,
  deliveryStateClass,
  formatTimestamp,
} from './agentsOverviewFormat';
import {
  DetailLine,
} from './AgentDetailShared';
import { copyableDiagnosticPacket, type FullDetailItem } from './AgentDetailSharedUtils';

export function AgentMembershipsSection({
  agent,
  projectId,
}: {
  agent: AgentDetailResponse;
  projectId: string | null;
}) {
  if (!agent.memberships || agent.memberships.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-header">
        <h3>Channel Memberships ({agent.memberships.length})</h3>
      </div>
      <div className="agents-membership-list">
        {agent.memberships.map(m => (
          <div key={m.channelId} className="agents-membership-card">
            <div className="agents-membership-channel">
              <strong>{m.channelDisplayName}</strong>
              <span className="agents-channel-slug">#{m.channelSlug}</span>
              <span className={`agents-binding-status ${chipClass(m.membershipStatus, 'agents-binding')}`}>
                {m.membershipStatus}
              </span>
            </div>
            <div className="agents-membership-details">
              <span className="agents-lane-source">{membershipLaneLabel(m, projectId)}</span>
              <span>Wake: {m.wakePolicy}</span>
              {m.projectId && <span>Project: {m.projectId}</span>}
              <span>Send: {m.canSend ? 'yes' : 'no'}</span>
              {m.settingsLabel && <span>Settings: {m.settingsLabel}</span>}
              {m.channelId === 5 && <span className="agents-control-channel-note">hidden control-channel; not active visible residency</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentGatewayBindingsSection({ agent }: { agent: AgentDetailResponse }) {
  if (!agent.bindings || agent.bindings.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-header">
        <h3>Gateway Bindings ({agent.bindings.length})</h3>
      </div>
      {agent.bindings.map((b, i) => (
        <div key={i} className="agents-binding-card">
          <div className="agents-binding-header">
            <strong>{b.agentKey ?? 'unnamed binding'}</strong>
            {b.role && <span className="agents-binding-role">{b.role}</span>}
            {b.bindingFreshness && (
              <span className={`agents-binding-freshness-chip ${chipClass(b.bindingFreshness, 'agents-freshness')}`}>
                {b.bindingFreshness}
              </span>
            )}
            {b.deliveryState && (
              <span className={`agents-delivery-badge ${deliveryStateClass(b.deliveryState)}`}>
                {b.deliveryState}
              </span>
            )}
          </div>
          {bindingHasStaleControlChannel(b.adapterInstances) && (
            <div className="agents-control-channel-note">
              Stale channel_id=5 gateway binding is a hidden control-channel remnant, not active visible channel residency.
            </div>
          )}
          {b.deliveryCounts && (
            <div className="agents-binding-counts">
              <span>Active: {b.deliveryCounts.active}</span>
              <span>Completed: {b.deliveryCounts.completed}</span>
              <span>Failed: {b.deliveryCounts.failed}</span>
              <span>Suppressed: {b.deliveryCounts.suppressed}</span>
              <span>Total: {b.deliveryCounts.total}</span>
            </div>
          )}
          {b.adapterInstances && b.adapterInstances.length > 0 && (
            <details className="agents-binding-adapters">
              <summary>Adapter Instances ({b.adapterInstances.length})</summary>
              {b.adapterInstances.map((inst, j) => (
                <div key={j} className="agents-adapter-instance">
                  <div className="agents-adapter-header">
                    <strong>{inst.adapterInstanceId ?? inst.adapterKind ?? 'instance'}</strong>
                    <span className={`agents-binding-status ${chipClass(inst.status, 'agents-binding')}`}>
                      {inst.status}
                    </span>
                    {inst.isStale && <span className="agents-stale-badge">stale</span>}
                  </div>
                  <div className="agents-adapter-meta">
                    {inst.lastSeenAt && <span>Last seen: {formatTimestamp(inst.lastSeenAt)}</span>}
                    {inst.expiresAt && <span>Expires: {formatTimestamp(inst.expiresAt)}</span>}
                    {inst.stalenessReason && <span className="agents-adapter-warning">{inst.stalenessReason}</span>}
                  </div>
                </div>
              ))}
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

export function AgentActivitySection({
  agent,
  onOpen,
}: {
  agent: AgentDetailResponse;
  onOpen: (item: FullDetailItem) => void;
}) {
  if (!agent.activityEvents || agent.activityEvents.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-header">
        <h3>Recent Activity ({agent.activityEvents.length})</h3>
        <span className="detail-subtle">Grouped by delivery/session/display block</span>
      </div>
      <div className="agents-activity-list">
        {agent.activityEvents.map(a => (
          <div key={a.id} className="agents-activity-card">
            <div className="agents-activity-header">
              <span className={`agents-binding-status ${chipClass(a.eventType, 'agents-event')}`}>
                {a.eventType}
              </span>
              <span className="agents-activity-time">{formatTimestamp(a.createdAt)}</span>
              {a.terminal && <span className="agents-terminal-badge">terminal</span>}
            </div>
            <div className="agents-activity-ids">
              {a.deliveryRequestId && <span>Delivery: {a.deliveryRequestId}</span>}
              {a.hermesSessionKey && <span>Session: {a.hermesSessionKey}</span>}
              {a.displayBlockId && <span>Block: {a.displayBlockId}</span>}
              {a.taskId != null && <span>Task: #{a.taskId}</span>}
              {a.workerRunId && <span>Run: {a.workerRunId}</span>}
              {a.workerRole && <span>Role: {a.workerRole}</span>}
            </div>
            <div className="agents-activity-status">
              <span>Status: {a.status}</span>
              <span>Stage: {a.deliveryStage}</span>
            </div>
            {(a.title || a.summary) && (
              <div className="agents-activity-preview">
                {a.title && <DetailLine label="Title" value={a.title} onOpen={onOpen} />}
                {a.summary && <DetailLine label="Summary" value={a.summary} onOpen={onOpen} />}
              </div>
            )}
            <DetailLine label="Full activity event" value={a} onOpen={item => onOpen({ ...item, title: `${a.eventType} #${a.id}` })} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentTaskAssociationsSection({ agent }: { agent: AgentDetailResponse }) {
  if (!agent.taskAssociations || agent.taskAssociations.length === 0) return null;

  return (
    <div className="detail-section">
      <div className="detail-section-header">
        <h3>Task / Session / Worker Associations ({agent.taskAssociations.length})</h3>
      </div>
      <div className="agents-task-list">
        {agent.taskAssociations.map(t => (
          <div key={`${t.taskId}:${t.projectId}`} className="agents-task-card">
            <div className="agents-task-header">
              {t.taskId != null && <span>Task #{t.taskId}</span>}
              {t.projectId && <span className="agents-task-project">{t.projectId}</span>}
              <span className={`agents-binding-status ${chipClass(t.status, 'agents-binding')}`}>
                {t.status ?? '—'}
              </span>
            </div>
            {t.title && <div className="agents-task-title">{t.title}</div>}
            <div className="agents-task-meta">
              <span>Activity count: {t.activityCount}</span>
              {t.latestActivityAt && <span>Latest: {formatTimestamp(t.latestActivityAt)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentDiagnosticPacketSection({
  agent,
  showDiagnostic,
  onCopy,
  onToggle,
}: {
  agent: AgentDetailResponse | null;
  showDiagnostic: boolean;
  onCopy: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="detail-section">
      <div className="detail-section-header">
        <h3>Copyable Diagnostic Packet</h3>
        <button className="detail-action" onClick={onToggle}>
          {showDiagnostic ? 'Hide' : 'Show'}
        </button>
      </div>
      {showDiagnostic && agent && (
        <div className="detail-pre agents-diagnostic-packet">
          {copyableDiagnosticPacket(agent)}
        </div>
      )}
      {agent && (
        <button className="detail-action" onClick={onCopy} style={{ marginTop: 4 }}>
          Copy to clipboard
        </button>
      )}
    </div>
  );
}

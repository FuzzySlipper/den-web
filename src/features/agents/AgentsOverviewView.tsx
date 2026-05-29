import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgentDetailResponse,
  AgentsOverviewResponse,
  SourceHealthDto,
  ChannelMembershipOverviewDto,
  DeliveryOverviewDto,
} from '../../api/types';
import { listAgentsOverview, getAgentDetail } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo } from '../../utils';

interface Props {
  projectId: string | null;
  isAggregate: boolean;
  closePanelKey?: string;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}

interface FullDetailItem {
  title: string;
  subtitle?: string;
  value: unknown;
}

function severityClass(severity: string | null): string {
  switch (severity) {
    case 'error': return 'agents-severity-error';
    case 'warning': return 'agents-severity-warning';
    case 'info': return 'agents-severity-info';
    case 'success': return 'agents-severity-success';
    default: return 'agents-severity-idle';
  }
}

function chipClass(value: string | null | undefined, prefix: string): string {
  if (!value) return `${prefix}-unknown`;
  const normalized = value.toLowerCase().replace(/[\s_]+/g, '_');
  return `${prefix}-${normalized}`;
}

function deliveryStateClass(state: string | null | undefined): string {
  if (!state) return '';
  const s = state.toLowerCase();
  if (s === 'delivered' || s === 'delivered_waiting_completion') return 'agents-delivery-delivered';
  if (s === 'completed') return 'agents-delivery-completed';
  if (s === 'failed') return 'agents-delivery-failed';
  if (s === 'pending' || s === 'delivering') return 'agents-delivery-active';
  return '';
}

function sourceIsHealthy(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase();
  return normalized === 'available' || normalized === 'ready' || normalized === 'ok';
}

function renderWakePolicy(memberships: ChannelMembershipOverviewDto[] | null): string {
  if (!memberships || memberships.length === 0) return '—';
  const policies = new Set(memberships.map(m => m.wakePolicy));
  return Array.from(policies).join(', ');
}

function renderLastActivity(summary: { latestActivityAt: string | null; recentActivityCount: number } | null): string {
  if (!summary || !summary.latestActivityAt) return '—';
  return `${formatTimeAgo(summary.latestActivityAt)} (${summary.recentActivityCount})`;
}

function renderDeliveryId(deliveries: DeliveryOverviewDto[] | null): string {
  if (!deliveries || deliveries.length === 0) return '—';
  const nonTerminal = deliveries.filter(d => !d.terminal);
  if (nonTerminal.length > 0) {
    return nonTerminal[0].deliveryRequestId ?? 'active';
  }
  const terminalDelivered = deliveries.filter(d => d.status === 'delivered' || d.status === 'delivered_waiting_completion');
  if (terminalDelivered.length > 0) {
    return terminalDelivered[0].deliveryRequestId ?? 'delivered';
  }
  return deliveries[0].deliveryRequestId ?? '—';
}

function renderDeliveryState(deliveries: DeliveryOverviewDto[] | null): string {
  if (!deliveries || deliveries.length === 0) return '—';
  const nonTerminal = deliveries.filter(d => !d.terminal);
  const terminalDelivered = deliveries.filter(d => d.status === 'delivered' || d.status === 'delivered_waiting_completion');
  const terminalCompleted = deliveries.filter(d => d.terminal && d.status === 'completed');
  if (nonTerminal.length > 0) return nonTerminal[0].state ?? 'active';
  if (terminalDelivered.length > 0) return 'delivered';
  if (terminalCompleted.length > 0) return 'completed';
  return deliveries[0]?.state ?? '—';
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    const ago = formatTimeAgo(ts);
    const date = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
    return `${date.toLocaleString()} (${ago})`;
  } catch {
    return ts;
  }
}

export function AgentsOverviewView({ projectId, isAggregate, closePanelKey = 'Escape', onOpenAssignmentTrace }: Props) {
  const [selectedAgentIdentity, setSelectedAgentIdentity] = useState<string | null>(null);

  const fetchOverview = useCallback(
    () => listAgentsOverview({
      projectId: isAggregate ? undefined : projectId ?? undefined,
      scope: isAggregate ? 'all' : undefined,
      activityLimit: 3,
      includeGateway: true,
    }),
    [projectId, isAggregate],
  );
  const { data: overview, loading, error } = usePolling<AgentsOverviewResponse>(fetchOverview, 10000);

  const agents = useMemo(() => overview?.agents ?? [], [overview]);
  const sourceHealth = overview?.sourceHealth ?? null;

  const handleSelect = useCallback((agentIdentity: string) => {
    setSelectedAgentIdentity(agentIdentity === selectedAgentIdentity ? null : agentIdentity);
  }, [selectedAgentIdentity]);

  const handleCloseDetail = useCallback(() => {
    setSelectedAgentIdentity(null);
  }, []);

  // Source health warnings banner
  const healthWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (sourceHealth?.gateway && !sourceIsHealthy(sourceHealth.gateway.status)) {
      warnings.push(`Gateway: ${sourceHealth.gateway.warning ?? sourceHealth.gateway.status}`);
    }
    if (sourceHealth?.channels && !sourceIsHealthy(sourceHealth.channels.status)) {
      warnings.push(`Channels: ${sourceHealth.channels.warning ?? sourceHealth.channels.status}`);
    }
    return warnings;
  }, [sourceHealth]);

  return (
    <div className="agents-overview-view">
      {healthWarnings.length > 0 && (
        <div className="agents-health-warnings">
          {healthWarnings.map((w, i) => (
            <div key={i} className="agents-health-warning">{w}</div>
          ))}
        </div>
      )}

      {loading && agents.length === 0 && (
        <div className="agents-loading">Loading agents...</div>
      )}

      {error && (
        <div className="agents-error">Failed to load agents overview: {error.message}</div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="agents-empty">
          No agent memberships, bindings, or activity matched the current scope.
        </div>
      )}

      {agents.length > 0 && (
        <div className="agents-table-wrapper">
          <table className="agents-table">
            <thead>
              <tr>
                <th>Agent / Role / Project</th>
                <th>Binding</th>
                <th>Work State</th>
                <th>Delivery</th>
                <th>Last Activity</th>
                <th>Wake Policy</th>
                <th>Flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr
                  key={agent.agentIdentity}
                  className={`agents-table-row ${selectedAgentIdentity === agent.agentIdentity ? 'selected' : ''}`}
                  onClick={() => handleSelect(agent.agentIdentity)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelect(agent.agentIdentity);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open details for ${agent.agentIdentity}`}
                >
                  <td className="agents-cell-agent">
                    <div className="agents-agent-identity">{agent.agentIdentity}</div>
                    {agent.bindings && agent.bindings.length > 0 && (
                      <div className="agents-agent-role">
                        {agent.bindings.map((b, i) => (
                          <span key={i}>
                            {b.role ?? '—'}
                            {i < agent.bindings!.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {agent.memberships && agent.memberships.length > 0 && (
                      <div className="agents-agent-projects">
                        {Array.from(new Set(agent.memberships.map(m => m.projectId).filter(Boolean))).join(', ')}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`agents-binding-status ${chipClass(agent.operatorStatus, 'agents-binding')}`}>
                      {agent.operatorStatus ?? '—'}
                    </span>
                    {agent.bindings && agent.bindings.length > 0 && agent.bindings[0].bindingFreshness && (
                      <span className="agents-binding-freshness"> ({agent.bindings[0].bindingFreshness})</span>
                    )}
                  </td>
                  <td>
                    <span className={`agents-work-state ${severityClass(agent.severity)}`}>
                      {agent.workState ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`agents-delivery-badge ${deliveryStateClass(agent.deliverySummaries?.[0]?.state)}`}>
                      {renderDeliveryState(agent.deliverySummaries)}
                    </span>
                    {agent.deliverySummaries && agent.deliverySummaries.length > 0 && (
                      <span className="agents-delivery-id">
                        {renderDeliveryId(agent.deliverySummaries)}
                      </span>
                    )}
                  </td>
                  <td className="agents-cell-activity">
                    {agent.summary && (
                      <span className="agents-activity-summary">
                        {renderLastActivity(agent.summary)}
                      </span>
                    )}
                    {agent.recentActivity && agent.recentActivity.length > 0 && (
                      <span className="agents-activity-preview">
                        {agent.recentActivity[0].summary ?? agent.recentActivity[0].eventType}
                      </span>
                    )}
                  </td>
                  <td className="agents-cell-wake">
                    {renderWakePolicy(agent.memberships)}
                  </td>
                  <td className="agents-cell-flags">
                    {agent.flags.length > 0 ? (
                      <span className="agents-flags-count">{agent.flags.length}</span>
                    ) : '—'}
                  </td>
                  <td className="agents-cell-action">
                    <button
                      className="agents-detail-button"
                      onClick={event => {
                        event.stopPropagation();
                        handleSelect(agent.agentIdentity);
                      }}
                    >
                      {selectedAgentIdentity === agent.agentIdentity ? 'Close' : 'Detail'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAgentIdentity && (
        <AgentDetailOverlay
          agentIdentity={selectedAgentIdentity}
          projectId={projectId}
          isAggregate={isAggregate}
          closePanelKey={closePanelKey}
          onClose={handleCloseDetail}
          onOpenAssignmentTrace={onOpenAssignmentTrace}
        />
      )}
    </div>
  );
}

// =============================================================================
// Agent Detail Overlay
// =============================================================================

function renderHealthWarnings(sourceHealth: SourceHealthDto | null): string[] {
  const warnings: string[] = [];
  if (!sourceHealth) return warnings;
  if (sourceHealth.gateway && !sourceIsHealthy(sourceHealth.gateway.status)) {
    warnings.push(`Gateway: ${sourceHealth.gateway.warning ?? sourceHealth.gateway.status}`);
  }
  if (sourceHealth.channels && !sourceIsHealthy(sourceHealth.channels.status)) {
    warnings.push(`Channels: ${sourceHealth.channels.warning ?? sourceHealth.channels.status}`);
  }
  return warnings;
}

function copyableDiagnosticPacket(agent: AgentDetailResponse): string {
  const lines: string[] = [];
  lines.push(`=== Agent Diagnostic Packet ===`);
  lines.push(`Agent Identity: ${agent.agentIdentity}`);
  lines.push(`Memberships: ${agent.memberships?.length ?? 0}`);
  lines.push(`Bindings: ${agent.bindings?.length ?? 0}`);
  lines.push(`Current Deliveries: ${agent.currentDeliveries?.length ?? 0}`);
  lines.push(`Recent Deliveries: ${agent.recentDeliveries?.length ?? 0}`);
  lines.push(`Activity Events: ${agent.activityEvents?.length ?? 0}`);
  lines.push(`Task Associations: ${agent.taskAssociations?.length ?? 0}`);
  lines.push(`Flags: ${agent.flags.join(', ')}`);
  lines.push(`Summary: ${JSON.stringify(agent.summary, null, 2)}`);
  lines.push(`Source Health: ${JSON.stringify(agent.sourceHealth, null, 2)}`);
  return lines.join('\n');
}

function detailText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DetailLine({ label, value, onOpen }: { label: string; value: unknown; onOpen: (item: FullDetailItem) => void }) {
  return (
    <button
      type="button"
      className="agents-detail-line"
      onClick={() => onOpen({ title: label, value })}
      title="Open full detail"
    >
      <span className="agents-detail-line-label">{label}</span>
      <span className="agents-detail-line-value">{detailText(value)}</span>
    </button>
  );
}

function FullDetailPanel({ item, onClose }: { item: FullDetailItem; onClose: () => void }) {
  return (
    <div className="detail-overlay agents-full-detail-panel" role="dialog" aria-label={`Full detail: ${item.title}`} aria-modal="true">
      <div className="detail-header">
        <div className="detail-title-block">
          <h2>{item.title}</h2>
          {item.subtitle && <span className="detail-subtle">{item.subtitle}</span>}
        </div>
        <button className="detail-close" onClick={onClose}>Close</button>
      </div>
      <div className="detail-body">
        <pre className="detail-pre agents-full-detail-pre">{detailText(item.value)}</pre>
      </div>
    </div>
  );
}

function AgentDetailOverlay({
  agentIdentity,
  projectId,
  isAggregate,
  closePanelKey,
  onClose,
  onOpenAssignmentTrace,
}: {
  agentIdentity: string;
  projectId: string | null;
  isAggregate: boolean;
  closePanelKey: string;
  onClose: () => void;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}) {
  const fetchDetail = useCallback(
    () => getAgentDetail(agentIdentity, {
      projectId: isAggregate ? undefined : projectId ?? undefined,
      activityLimit: 50,
      deliveryLimit: 50,
    }),
    [agentIdentity, projectId, isAggregate],
  );
  const { data: agent, loading, error, refresh } = usePolling<AgentDetailResponse>(fetchDetail, 10000);

  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [fullDetailItem, setFullDetailItem] = useState<FullDetailItem | null>(null);

  useEffect(() => {
    const closeKey = closePanelKey.trim();
    if (!closeKey) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== closeKey) return;
      event.preventDefault();
      if (fullDetailItem) {
        setFullDetailItem(null);
      } else {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePanelKey, fullDetailItem, onClose]);

  const healthWarnings = useMemo(() => agent ? renderHealthWarnings(agent.sourceHealth) : [], [agent]);

  const handleCopyDiagnostic = useCallback(async () => {
    if (!agent) return;
    const packet = copyableDiagnosticPacket(agent);
    try {
      await navigator.clipboard.writeText(packet);
    } catch {
      // fallback: select text programmatically
    }
  }, [agent]);

  const flags = agent?.flags ?? [];

  return (
    <div className="detail-overlay detail-overlay-wide">
      <div className="detail-header">
        <div className="detail-title-block">
          <h2>{agentIdentity}</h2>
          {agent?.summary && (
            <span className={`agents-summary-line ${severityClass(agent.summary.highestSeverity)}`}>
              {agent.summary.activeMembershipCount} active memberships · {agent.summary.activeDeliveryCount} active deliveries
              {(agent.summary.staleDeliveryCount ?? 0) > 0
                ? ` · ${agent.summary.staleDeliveryCount} stale`
                : ''}
               · {agent.summary.recentActivityCount} recent activities
            </span>
          )}
        </div>
        <div className="detail-actions">
          <button className="detail-action" onClick={refresh} disabled={loading}>
            Refresh
          </button>
          <button className="detail-close" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="detail-body">
        {healthWarnings.length > 0 && (
          <div className="agents-health-warnings">
            {healthWarnings.map((w, i) => (
              <div key={i} className="agents-health-warning">{w}</div>
            ))}
          </div>
        )}

        {loading && !agent && (
          <div className="agents-loading">Loading agent detail...</div>
        )}
        {error && (
          <div className="detail-error">
            Failed to load agent detail: {error.message}
          </div>
        )}

        {flags.length > 0 && (
          <div className="detail-section">
            <h3>Flags / Diagnostics</h3>
            <div className="agents-flags-list">
              {flags.map((f, i) => (
                <span key={i} className="agents-flag-chip">{f.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
        )}

        {agent?.memberships && agent.memberships.length > 0 && (
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
                    <span>Wake: {m.wakePolicy}</span>
                    {m.projectId && <span>Project: {m.projectId}</span>}
                    <span>Send: {m.canSend ? 'yes' : 'no'}</span>
                    {m.settingsLabel && <span>Settings: {m.settingsLabel}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {agent?.bindings && agent.bindings.length > 0 && (
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
        )}

        {agent?.currentDeliveries && agent.currentDeliveries.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-header">
              <h3>Current / Recent Delivery Requests ({agent.currentDeliveries.length})</h3>
            </div>
            <div className="agents-delivery-list">
              {agent.currentDeliveries.map((d, index) => (
                <div key={d.deliveryRequestId ?? `current-${index}-${d.createdAt ?? ''}`} className="agents-delivery-card">
                  <div className="agents-delivery-header">
                    <span className={`agents-delivery-badge ${deliveryStateClass(d.state)}`}>
                      {d.state ?? d.status ?? '—'}
                    </span>
                    {d.deliveryRequestId && (
                      <span className="agents-delivery-id">ID: {d.deliveryRequestId}</span>
                    )}
                    {d.terminal && <span className="agents-terminal-badge">terminal</span>}
                    {d.isStale && <span className="agents-stale-badge">stale debt</span>}
                  </div>
                  <div className="agents-delivery-lines">
                    {d.deliveryRequestId && <DetailLine label="Delivery request" value={d.deliveryRequestId} onOpen={setFullDetailItem} />}
                    {d.summary && <DetailLine label="Summary" value={d.summary} onOpen={setFullDetailItem} />}
                    {d.evidenceSummary && <DetailLine label="Evidence" value={d.evidenceSummary} onOpen={setFullDetailItem} />}
                    <DetailLine label="Full delivery record" value={d} onOpen={item => setFullDetailItem({ ...item, title: d.deliveryRequestId ?? item.title })} />
                  </div>
                  <div className="agents-delivery-timestamps">
                    {d.createdAt && <span>Created: {formatTimestamp(d.createdAt)}</span>}
                    {d.updatedAt && <span>Updated: {formatTimestamp(d.updatedAt)}</span>}
                  </div>
                  {onOpenAssignmentTrace && d.deliveryRequestId && (
                    <button
                      className="trace-open-button"
                      onClick={event => {
                        event.stopPropagation();
                        onOpenAssignmentTrace(d.deliveryRequestId!);
                      }}
                    >
                      Open assignment trace
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {agent?.recentDeliveries && agent.recentDeliveries.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-header">
              <h3>Recent Deliveries ({agent.recentDeliveries.length})</h3>
            </div>
            <div className="agents-delivery-list">
              {agent.recentDeliveries.map((d, index) => (
                <div key={d.deliveryRequestId ?? `recent-${index}-${d.createdAt ?? ''}`} className="agents-delivery-card">
                  <div className="agents-delivery-header">
                    <span className={`agents-delivery-badge ${deliveryStateClass(d.state)}`}>
                      {d.state ?? d.status ?? '—'}
                    </span>
                    {d.deliveryRequestId && (
                      <span className="agents-delivery-id">ID: {d.deliveryRequestId}</span>
                    )}
                    {d.terminal && <span className="agents-terminal-badge">terminal</span>}
                  </div>
                  <div className="agents-delivery-lines">
                    {d.deliveryRequestId && <DetailLine label="Delivery request" value={d.deliveryRequestId} onOpen={setFullDetailItem} />}
                    {d.summary && <DetailLine label="Summary" value={d.summary} onOpen={setFullDetailItem} />}
                    {d.evidenceSummary && <DetailLine label="Evidence" value={d.evidenceSummary} onOpen={setFullDetailItem} />}
                    <DetailLine label="Full delivery record" value={d} onOpen={item => setFullDetailItem({ ...item, title: d.deliveryRequestId ?? item.title })} />
                  </div>
                  <div className="agents-delivery-timestamps">
                    {d.createdAt && <span>Created: {formatTimestamp(d.createdAt)}</span>}
                    {d.updatedAt && <span>Updated: {formatTimestamp(d.updatedAt)}</span>}
                  </div>
                  {onOpenAssignmentTrace && d.deliveryRequestId && (
                    <button
                      className="trace-open-button"
                      onClick={event => {
                        event.stopPropagation();
                        onOpenAssignmentTrace(d.deliveryRequestId!);
                      }}
                    >
                      Open assignment trace
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {agent?.activityEvents && agent.activityEvents.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-header">
              <h3>Recent Activity ({agent.activityEvents.length})</h3>
              <span className="detail-subtle">
                Grouped by delivery/session/display block
              </span>
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
                      {a.title && <DetailLine label="Title" value={a.title} onOpen={setFullDetailItem} />}
                      {a.summary && <DetailLine label="Summary" value={a.summary} onOpen={setFullDetailItem} />}
                    </div>
                  )}
                  <DetailLine label="Full activity event" value={a} onOpen={item => setFullDetailItem({ ...item, title: `${a.eventType} #${a.id}` })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {agent?.taskAssociations && agent.taskAssociations.length > 0 && (
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
        )}

        {/* Copyable diagnostic packet */}
        <div className="detail-section">
          <div className="detail-section-header">
            <h3>Copyable Diagnostic Packet</h3>
            <button
              className="detail-action"
              onClick={() => setShowDiagnostic(!showDiagnostic)}
            >
              {showDiagnostic ? 'Hide' : 'Show'}
            </button>
          </div>
          {showDiagnostic && agent && (
            <div className="detail-pre agents-diagnostic-packet">
              {copyableDiagnosticPacket(agent)}
            </div>
          )}
          {agent && (
            <button className="detail-action" onClick={handleCopyDiagnostic} style={{ marginTop: 4 }}>
              Copy to clipboard
            </button>
          )}
        </div>
      </div>
      {fullDetailItem && (
        <FullDetailPanel item={fullDetailItem} onClose={() => setFullDetailItem(null)} />
      )}
    </div>
  );
}

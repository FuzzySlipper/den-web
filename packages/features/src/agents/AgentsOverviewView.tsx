import { useCallback, useMemo, useState } from 'react';
import type { AgentsOverviewResponse } from '@den-web/api/types';
import { listAgentsOverview } from '@den-web/api/client';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import { agentProjectAttributions, bindingHasStaleControlChannel } from './agentAttribution';
import { StaleWorkerDiagnosticsPanel } from './StaleWorkerDiagnosticsPanel';
import { AgentDetailOverlay } from './AgentDetailOverlay';
import {
  chipClass,
  deliveryStateClass,
  renderDeliveryId,
  renderDeliveryProject,
  renderDeliveryState,
  renderLastActivity,
  renderWakePolicy,
  severityClass,
  sourceIsHealthy,
} from './agentsOverviewFormat';

interface Props {
  projectId: string | null;
  isAggregate: boolean;
  closePanelKey?: string;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
  onOpenDmTranscript?: (agentIdentity: string) => void;
}

export function AgentsOverviewView({ projectId, isAggregate, closePanelKey = 'Escape', onOpenAssignmentTrace, onOpenDmTranscript }: Props) {
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
  const { data: overview, loading, error } = useLiveData<AgentsOverviewResponse>(fetchOverview, { interval: 10000 });

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
      <StaleWorkerDiagnosticsPanel
        projectId={isAggregate ? null : projectId}
        compact
        onOpenAssignmentTrace={onOpenAssignmentTrace}
      />

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
                    {agentProjectAttributions(agent).length > 0 && (
                      <div className="agents-agent-projects" title="Project attribution from memberships, deliveries, and activity">
                        {agentProjectAttributions(agent).join(', ')}
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
                    {agent.bindings?.some(binding => bindingHasStaleControlChannel(binding.adapterInstances)) && (
                      <span className="agents-control-channel-note" title="Stale channel_id=5 gateway binding is a hidden control-channel binding, not an active visible channel residency.">
                        hidden stale control binding
                      </span>
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
                    {renderDeliveryProject(agent.deliverySummaries) && (
                      <span className="agents-project-attribution-badge" title="Worker-pool delivery project attribution">
                        {renderDeliveryProject(agent.deliverySummaries)}
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
          onOpenDmTranscript={onOpenDmTranscript}
        />
      )}
    </div>
  );
}

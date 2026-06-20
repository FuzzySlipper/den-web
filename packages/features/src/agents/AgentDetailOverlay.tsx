import { useCallback } from 'react';
import type { AgentDetailResponse } from '@den-web/api/types';
import { getAgentDetail } from '@den-web/api/client';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import { severityClass } from './agentsOverviewFormat';
import { AgentDetailBody } from './AgentDetailBody';

interface Props {
  agentIdentity: string;
  projectId: string | null;
  isAggregate: boolean;
  closePanelKey: string;
  onClose: () => void;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
  onOpenDmTranscript?: (agentIdentity: string) => void;
}

export function AgentDetailOverlay({
  agentIdentity,
  projectId,
  isAggregate,
  closePanelKey,
  onClose,
  onOpenAssignmentTrace,
  onOpenDmTranscript,
}: Props) {
  const fetchDetail = useCallback(
    () => getAgentDetail(agentIdentity, {
      projectId: isAggregate ? undefined : projectId ?? undefined,
      activityLimit: 50,
      deliveryLimit: 50,
    }),
    [agentIdentity, projectId, isAggregate],
  );
  const { data: agent, loading, error, refresh } = useLiveData<AgentDetailResponse>(fetchDetail, { interval: 10000 });

  return (
    <div className="detail-overlay detail-overlay-wide">
      <div className="detail-header">
        <div className="detail-title-block">
          <h2>{agentIdentity}</h2>
          {agent?.summary && (
            <span className={`agents-summary-line ${severityClass(agent.summary.highestSeverity)}`}>
              {agent.summary.activeMembershipCount} active memberships · {agent.summary.activeDeliveryCount} active deliveries
              {(agent.summary.staleDeliveryCount ?? 0) > 0 ? ` · ${agent.summary.staleDeliveryCount} stale` : ''}
               · {agent.summary.recentActivityCount} recent activities
            </span>
          )}
        </div>
        <div className="detail-actions">
          {onOpenDmTranscript && (
            <button className="detail-action dm-open-button" onClick={() => onOpenDmTranscript(agentIdentity)}>
              Open DM Transcript
            </button>
          )}
          <button className="detail-action" onClick={refresh} disabled={loading}>
            Refresh
          </button>
          <button className="detail-close" onClick={onClose}>Close</button>
        </div>
      </div>

      <AgentDetailBody
        agent={agent}
        loading={loading}
        error={error}
        projectId={projectId}
        isAggregate={isAggregate}
        closePanelKey={closePanelKey}
        onClose={onClose}
        onOpenAssignmentTrace={onOpenAssignmentTrace}
      />
    </div>
  );
}

import type { AgentDetailResponse } from '@den-web/api/types';
import { deliveryProjectAttribution } from './agentAttribution';
import { deliveryStateClass, formatTimestamp } from './agentsOverviewFormat';
import { DetailLine } from './AgentDetailShared';
import type { FullDetailItem } from './AgentDetailSharedUtils';

export function AgentDeliverySection({
  title,
  deliveries,
  keyPrefix,
  onOpen,
  onOpenAssignmentTrace,
}: {
  title: string;
  deliveries: NonNullable<AgentDetailResponse['currentDeliveries']>;
  keyPrefix: string;
  onOpen: (item: FullDetailItem) => void;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}) {
  return (
    <div className="detail-section">
      <div className="detail-section-header">
        <h3>{title}</h3>
      </div>
      <div className="agents-delivery-list">
        {deliveries.map((d, index) => (
          <div key={d.deliveryRequestId ?? `${keyPrefix}-${index}-${d.createdAt ?? ''}`} className="agents-delivery-card">
            <div className="agents-delivery-header">
              <span className={`agents-delivery-badge ${deliveryStateClass(d.state)}`}>
                {d.state ?? d.status ?? '—'}
              </span>
              {d.deliveryRequestId && <span className="agents-delivery-id">ID: {d.deliveryRequestId}</span>}
              {deliveryProjectAttribution(d) && (
                <span className="agents-project-attribution-badge">Project: {deliveryProjectAttribution(d)}</span>
              )}
              {d.terminal && <span className="agents-terminal-badge">terminal</span>}
              {d.isStale && <span className="agents-stale-badge">stale debt</span>}
            </div>
            <div className="agents-delivery-lines">
              {d.deliveryRequestId && <DetailLine label="Delivery request" value={d.deliveryRequestId} onOpen={onOpen} />}
              {d.summary && <DetailLine label="Summary" value={d.summary} onOpen={onOpen} />}
              {d.evidenceSummary && <DetailLine label="Evidence" value={d.evidenceSummary} onOpen={onOpen} />}
              <DetailLine label="Full delivery record" value={d} onOpen={item => onOpen({ ...item, title: d.deliveryRequestId ?? item.title })} />
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
  );
}

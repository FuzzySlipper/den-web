import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentDetailResponse } from '@den-web/api/types';
import { StaleWorkerDiagnosticsPanel } from './StaleWorkerDiagnosticsPanel';
import { AgentDeliverySection } from './AgentDeliverySection';
import {
  FullDetailPanel,
} from './AgentDetailShared';
import { copyableDiagnosticPacket, renderHealthWarnings, type FullDetailItem } from './AgentDetailSharedUtils';
import {
  AgentActivitySection,
  AgentDiagnosticPacketSection,
  AgentGatewayBindingsSection,
  AgentMembershipsSection,
  AgentTaskAssociationsSection,
} from './AgentDetailSections';

interface Props {
  agent: AgentDetailResponse | null;
  loading: boolean;
  error: Error | null;
  projectId: string | null;
  isAggregate: boolean;
  closePanelKey: string;
  onClose: () => void;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
}

export function AgentDetailBody({
  agent,
  loading,
  error,
  projectId,
  isAggregate,
  closePanelKey,
  onClose,
  onOpenAssignmentTrace,
}: Props) {
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [fullDetailItem, setFullDetailItem] = useState<FullDetailItem | null>(null);
  const flags = agent?.flags ?? [];
  const healthWarnings = useMemo(() => agent ? renderHealthWarnings(agent.sourceHealth) : [], [agent]);

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

  const handleCopyDiagnostic = useCallback(async () => {
    if (!agent) return;
    try {
      await navigator.clipboard.writeText(copyableDiagnosticPacket(agent));
    } catch {
      // The visible diagnostic packet remains selectable if clipboard is unavailable.
    }
  }, [agent]);

  return (
    <div className="detail-body">
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

      {loading && !agent && <div className="agents-loading">Loading agent detail...</div>}
      {error && <div className="detail-error">Failed to load agent detail: {error.message}</div>}

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

      {agent && <AgentMembershipsSection agent={agent} projectId={projectId} />}
      {agent && <AgentGatewayBindingsSection agent={agent} />}

      {agent?.currentDeliveries && agent.currentDeliveries.length > 0 && (
        <AgentDeliverySection
          title={`Current / Recent Delivery Requests (${agent.currentDeliveries.length})`}
          deliveries={agent.currentDeliveries}
          keyPrefix="current"
          onOpen={setFullDetailItem}
          onOpenAssignmentTrace={onOpenAssignmentTrace}
        />
      )}

      {agent?.recentDeliveries && agent.recentDeliveries.length > 0 && (
        <AgentDeliverySection
          title={`Recent Deliveries (${agent.recentDeliveries.length})`}
          deliveries={agent.recentDeliveries}
          keyPrefix="recent"
          onOpen={setFullDetailItem}
          onOpenAssignmentTrace={onOpenAssignmentTrace}
        />
      )}

      {agent && <AgentActivitySection agent={agent} onOpen={setFullDetailItem} />}
      {agent && <AgentTaskAssociationsSection agent={agent} />}
      <AgentDiagnosticPacketSection
        agent={agent}
        showDiagnostic={showDiagnostic}
        onCopy={handleCopyDiagnostic}
        onToggle={() => setShowDiagnostic(!showDiagnostic)}
      />

      {fullDetailItem && <FullDetailPanel item={fullDetailItem} onClose={() => setFullDetailItem(null)} />}
    </div>
  );
}

import { useCallback, useEffect, useMemo } from 'react';
import type { AssignmentTraceResponse, ChannelActivityEvent, ChannelMessage } from '../../api/types';
import { getAssignmentTrace } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo } from '../../utils';
import {
  sourceLabel,
  sourceClass,
  classifyPhase,
  phaseLabel,
  phaseClass,
  classifyDeliveryStatus,
  deliveryStatusLabel,
  deliveryStatusClass,
  checkpointStatusClass,
  isCoreAvailable,
  isDeliveryEvidenceAvailable,
  hasMessages,
  hasActivityEvents,
  formatTraceTimestamp,
  buildTraceSummary,
} from './assignmentTraceModel';

interface Props {
  assignmentId: string;
  projectId?: string | null;
  channelId?: number | null;
  closePanelKey?: string;
  onClose: () => void;
}

export function AssignmentTraceView({ assignmentId, projectId, channelId, closePanelKey = 'Escape', onClose }: Props) {
  const fetchTrace = useCallback(
    () => getAssignmentTrace(assignmentId, {
      projectId: projectId ?? undefined,
      channelId: channelId ? String(channelId) : undefined,
    }),
    [assignmentId, projectId, channelId],
  );
  const { data: trace, loading, error, refresh } = usePolling<AssignmentTraceResponse>(fetchTrace, 10000);

  // Handle close on Escape
  useEffect(() => {
    const key = closePanelKey.trim();
    if (!key) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== key) return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePanelKey, onClose]);

  const summaryLine = useMemo(() => trace ? buildTraceSummary(trace) : '', [trace]);

  return (
    <div className="detail-overlay detail-overlay-wide assignment-trace-overlay" role="dialog" aria-label={`Assignment trace: ${assignmentId}`} aria-modal="true">
      <div className="detail-header">
        <div className="detail-title-block">
          <h2>Assignment Trace</h2>
          <span className="trace-header-id">{assignmentId}</span>
          {summaryLine && <span className="trace-header-summary">{summaryLine}</span>}
        </div>
        <div className="detail-actions">
          <button className="detail-action" onClick={refresh} disabled={loading}>Refresh</button>
          <button className="detail-close" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="detail-body">
        {loading && !trace && (
          <div className="trace-loading">Loading assignment trace...</div>
        )}
        {error && (
          <div className="trace-error">Failed to load assignment trace: {error.message}</div>
        )}

        {trace && (
          <>
            {/* Identity section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <h3>Identities</h3>
              </div>
              <div className="trace-identity-grid">
                <div className="trace-identity-item">
                  <span className="trace-identity-label">Assignment ID</span>
                  <span className="trace-identity-value">{trace.assignmentId}</span>
                </div>
                <div className="trace-identity-item">
                  <span className="trace-identity-label">Project</span>
                  <span className="trace-identity-value">{trace.projectName ?? trace.projectId ?? '—'}</span>
                </div>
                <div className="trace-identity-item">
                  <span className="trace-identity-label">Task</span>
                  <span className="trace-identity-value">{trace.taskId != null ? `#${trace.taskId} ${trace.taskTitle ?? ''}`.trim() : '—'}</span>
                </div>
                <div className="trace-identity-item">
                  <span className="trace-identity-label">Agent</span>
                  <span className="trace-identity-value">{trace.agentIdentity ?? '—'}</span>
                </div>
                <div className="trace-identity-item">
                  <span className="trace-identity-label">Worker Role</span>
                  <span className="trace-identity-value">{trace.workerRole ?? '—'}</span>
                </div>
                <div className="trace-identity-item">
                  <span className="trace-identity-label">Worker Run ID</span>
                  <span className="trace-identity-value">{trace.workerRunId ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Source availability section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <h3>Source States</h3>
              </div>
              <div className="trace-source-grid">
                <SourceChip label="Core" availability={trace.coreAvailability} />
                <SourceChip label="Delivery" availability={trace.gatewayAvailability} />
                <SourceChip label="Channel Messages" availability={trace.messagesAvailability} />
                <SourceChip label="Activity Events" availability={trace.activityAvailability} />
              </div>
            </div>

            {/* Core state section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <h3>Core State</h3>
                <span className="detail-subtle">Canonical assignment lifecycle</span>
              </div>
              {!isCoreAvailable(trace) ? (
                <div className="trace-unavailable">
                  {sourceLabel(trace.coreAvailability)}
                </div>
              ) : trace.coreState ? (
                <>
                  {/* Phase badge */}
                  <div className="trace-core-phase">
                    {(() => {
                      const p = classifyPhase(trace.coreState.phase);
                      return (
                        <span className={`trace-badge ${phaseClass(p)}`}>
                          {phaseLabel(p)}
                          {trace.coreState.quarantined && <span className="trace-quarantine-badge">Quarantined</span>}
                        </span>
                      );
                    })()}
                    <span className="trace-core-assigned-agent">{trace.coreState.assignedAgent}</span>
                  </div>

                  {/* Timeline */}
                  <div className="trace-core-timeline">
                    <TimeLineRow label="Assigned" ts={trace.coreState.assignedAt} />
                    <TimeLineRow label="Lease Acquired" ts={trace.coreState.leaseAcquiredAt} />
                    <TimeLineRow label="Lease Expires" ts={trace.coreState.leaseExpiresAt} />
                    <TimeLineRow label="Final Status" ts={trace.coreState.finalStatusAt} value={trace.coreState.finalStatus} />
                  </div>

                  {/* Checkpoints */}
                  {trace.coreState.checkpoints && trace.coreState.checkpoints.length > 0 && (
                    <>
                      <h4 className="trace-subsection-heading">Checkpoints ({trace.coreState.checkpoints.length})</h4>
                      <div className="trace-checkpoints-list">
                        {trace.coreState.checkpoints.map(cp => (
                          <div key={cp.sequence} className="trace-checkpoint-card">
                            <div className="trace-checkpoint-header">
                              <span className={`trace-checkpoint-status ${checkpointStatusClass(cp.status)}`}>
                                {cp.status ?? '—'}
                              </span>
                              <span className="trace-checkpoint-seq">Checkpoint #{cp.sequence}</span>
                            </div>
                            <div className="trace-checkpoint-times">
                              <TimeLineRow label="Requested" ts={cp.checkpointRequestAt} />
                              <TimeLineRow label="Responded" ts={cp.checkpointResponseAt} />
                            </div>
                            {cp.snapshotPreview && (
                              <div className="trace-checkpoint-preview">{cp.snapshotPreview}</div>
                            )}
                            {cp.error && (
                              <div className="trace-checkpoint-error">{cp.error}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Cleanup */}
                  {(trace.coreState.cleanupState || trace.coreState.releaseState) && (
                    <>
                      <h4 className="trace-subsection-heading">Cleanup & Release</h4>
                      <div className="trace-core-timeline">
                        <TimeLineRow label="Cleanup State" value={trace.coreState.cleanupState} />
                        <TimeLineRow label="Cleanup Triggered" ts={trace.coreState.cleanupTriggeredAt} />
                        <TimeLineRow label="Cleanup Completed" ts={trace.coreState.cleanupCompletedAt} />
                        <TimeLineRow label="Release State" value={trace.coreState.releaseState} />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="trace-unavailable">No core state data</div>
              )}
            </div>

            {/* Delivery evidence section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <h3>Delivery Evidence</h3>
                <span className="detail-subtle">Channels delivery pipeline state</span>
              </div>
              {!isDeliveryEvidenceAvailable(trace) ? (
                <div className="trace-unavailable">
                  {sourceLabel(trace.gatewayAvailability)}
                </div>
              ) : trace.gatewayEvidence ? (
                <>
                  <div className="trace-gateway-header">
                    <span className={`trace-badge ${deliveryStatusClass(classifyDeliveryStatus(trace.gatewayEvidence.deliveryStatus))}`}>
                      {deliveryStatusLabel(classifyDeliveryStatus(trace.gatewayEvidence.deliveryStatus))}
                    </span>
                    <span className="trace-gateway-id">Request: {trace.gatewayEvidence.deliveryRequestId}</span>
                  </div>
                  <div className="trace-gateway-detail">
                    <div className="trace-core-timeline">
                      <TimeLineRow label="Delivery" value={trace.gatewayEvidence.deliveryStatus} />
                      <TimeLineRow label="Claim" value={trace.gatewayEvidence.claimStatus} />
                      <TimeLineRow label="Completion" value={trace.gatewayEvidence.completionStatus} />
                      <TimeLineRow label="Suppression" value={trace.gatewayEvidence.suppressionStatus} />
                      <TimeLineRow label="Requested" ts={trace.gatewayEvidence.requestedAt} />
                      <TimeLineRow label="Delivered" ts={trace.gatewayEvidence.deliveredAt} />
                      <TimeLineRow label="Claimed" ts={trace.gatewayEvidence.claimedAt} />
                      <TimeLineRow label="Completed" ts={trace.gatewayEvidence.completedAt} />
                    </div>
                    {trace.gatewayEvidence.evidenceSummary && (
                      <div className="trace-evidence-summary">{trace.gatewayEvidence.evidenceSummary}</div>
                    )}
                    <div className="trace-gateway-links">
                      {trace.gatewayEvidence.gatewayMessageUrl && (
                        <a href={trace.gatewayEvidence.gatewayMessageUrl} target="_blank" rel="noreferrer">Message Record</a>
                      )}
                      {trace.gatewayEvidence.gatewayEventsUrl && (
                        <a href={trace.gatewayEvidence.gatewayEventsUrl} target="_blank" rel="noreferrer">Event Records</a>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="trace-unavailable">No delivery evidence</div>
              )}
            </div>

            {/* Channel messages section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <h3>Assignment-Filtered Channel Messages</h3>
                <span className="detail-subtle">{trace.channelMessages.length} message{trace.channelMessages.length === 1 ? '' : 's'}</span>
              </div>
              {!hasMessages(trace) ? (
                <div className="trace-unavailable">{sourceLabel(trace.messagesAvailability)}</div>
              ) : (
                <div className="trace-messages-list">
                  {trace.channelMessages.map(msg => (
                    <ChannelMessageRow key={msg.id} message={msg} />
                  ))}
                </div>
              )}
            </div>

            {/* Non-waking activity section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <h3>Activity Events</h3>
                <span className="detail-subtle">Non-waking checkpoint/activity evidence</span>
              </div>
              {!hasActivityEvents(trace) ? (
                <div className="trace-unavailable">{sourceLabel(trace.activityAvailability)}</div>
              ) : (
                <div className="trace-activity-list">
                  {trace.activityEvents.map(event => (
                    <ActivityEventRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SourceChip({ label, availability }: { label: string; availability: string }) {
  return (
    <div className={`trace-source-chip ${sourceClass(availability as Parameters<typeof sourceClass>[0])}`}>
      <span className="trace-source-label">{label}</span>
      <span className="trace-source-status">{sourceLabel(availability as Parameters<typeof sourceLabel>[0])}</span>
    </div>
  );
}

function TimeLineRow({ label, ts, value }: { label: string; ts?: string | null; value?: string | null }) {
  if (value) {
    return (
      <div className="trace-timeline-row">
        <span className="trace-timeline-label">{label}</span>
        <span className="trace-timeline-value">{value}</span>
      </div>
    );
  }
  return (
    <div className="trace-timeline-row">
      <span className="trace-timeline-label">{label}</span>
      <span className="trace-timeline-value">{formatTraceTimestamp(ts)}</span>
    </div>
  );
}

function ChannelMessageRow({ message }: { message: ChannelMessage }) {
  return (
    <div className="trace-message-row">
      <div className="trace-message-header">
        <span className="message-time">{formatTimeAgo(message.createdAt)}</span>
        <span className={`channel-chat-sender channel-chat-sender-${message.senderType}`}>
          {message.senderIdentity || message.senderType}
        </span>
        <span className="trace-message-id">msg #{message.id}</span>
      </div>
      <div className="trace-message-body">{message.body}</div>
      <div className="trace-message-meta">
        {message.sourceKind && <span className="trace-meta-chip">source: {message.sourceKind}</span>}
        {message.deliveryRequestId && <span className="trace-meta-chip">delivery: {message.deliveryRequestId}</span>}
        {message.messageKind && <span className="trace-meta-chip">kind: {message.messageKind}</span>}
      </div>
    </div>
  );
}

function ActivityEventRow({ event }: { event: ChannelActivityEvent }) {
  const eventTypeClass = event.eventType.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return (
    <div className={`trace-activity-row trace-activity-${event.terminal ? 'terminal' : 'active'}`}>
      <div className="trace-activity-header">
        <span className="message-time">{formatTimeAgo(event.createdAt)}</span>
        <span className={`trace-activity-type trace-activity-type-${eventTypeClass}`}>
          {event.eventType}
        </span>
        <span className="trace-activity-agent">{event.agentIdentity}</span>
        {event.terminal && <span className="trace-activity-terminal-badge">terminal</span>}
      </div>
      {(event.title || event.summary) && (
        <div className="trace-activity-preview">{event.title ?? event.summary}</div>
      )}
      <div className="trace-activity-meta">
        {event.deliveryRequestId && <span className="trace-meta-chip">delivery: {event.deliveryRequestId}</span>}
        <span className="trace-meta-chip">status: {event.status}</span>
        <span className="trace-meta-chip">stage: {event.deliveryStage}</span>
        {event.workerRunId && <span className="trace-meta-chip">run: {event.workerRunId}</span>}
        {event.workerRole && <span className="trace-meta-chip">role: {event.workerRole}</span>}
      </div>
    </div>
  );
}

/**
 * Assignment Trace Render Model — task #1729
 *
 * Pure-model helpers for the assignment trace view. All source-availability
 * labels, phase classes, status classification, and formatting live here
 * so the TSX component stays focused on layout.
 */

import type {
  AssignmentTraceResponse,
  AssignmentCoreState,
  AssignmentGatewayEvidence,
  TraceSourceAvailability,
} from '@den-web/api/types';

// Re-export for convenience
export type { TraceSourceAvailability };

// =============================================================================
// Source availability helpers
// =============================================================================

export function sourceLabel(availability: TraceSourceAvailability): string {
  switch (availability) {
    case 'available': return 'Available';
    case 'core_unavailable': return 'Core Unavailable';
    case 'gateway_unavailable': return 'Delivery Evidence Unavailable';
    case 'no_assignment_messages': return 'No Channel Messages';
    case 'no_activity_events': return 'No Activity Events';
    case 'delivery_missing': return 'Delivery Record Missing';
    case 'pending': return 'Pending';
    default: return availability satisfies never;
  }
}

export function sourceClass(availability: TraceSourceAvailability): string {
  switch (availability) {
    case 'available': return 'trace-source-available';
    case 'core_unavailable':
    case 'gateway_unavailable': return 'trace-source-unavailable';
    case 'no_assignment_messages':
    case 'no_activity_events':
    case 'delivery_missing': return 'trace-source-missing';
    case 'pending': return 'trace-source-pending';
    default: return 'trace-source-unknown';
  }
}

// =============================================================================
// Phase helpers
// =============================================================================

export type AssignmentPhase =
  | 'assigned'
  | 'leased'
  | 'working'
  | 'checkpointing'
  | 'releasing'
  | 'quarantined'
  | 'completed'
  | 'unknown';

export function classifyPhase(phase: string | null): AssignmentPhase {
  if (!phase) return 'unknown';
  const p = phase.toLowerCase().replace(/[\s_-]+/g, '');
  if (p === 'assigned') return 'assigned';
  if (p === 'leased') return 'leased';
  if (p === 'working') return 'working';
  if (p.startsWith('checkpoint')) return 'checkpointing';
  if (p.startsWith('releas')) return 'releasing';
  if (p === 'quarantined' || p === 'quarantine') return 'quarantined';
  if (p === 'completed' || p === 'done' || p === 'complete') return 'completed';
  return 'unknown';
}

export function phaseLabel(phase: AssignmentPhase): string {
  switch (phase) {
    case 'assigned': return 'Assigned';
    case 'leased': return 'Leased';
    case 'working': return 'Working';
    case 'checkpointing': return 'Checkpointing';
    case 'releasing': return 'Releasing';
    case 'quarantined': return 'Quarantined';
    case 'completed': return 'Completed';
    case 'unknown': return 'Unknown';
  }
}

export function phaseClass(phase: AssignmentPhase): string {
  return `trace-phase-${phase}`;
}

// =============================================================================
// Delivery evidence status helpers
// =============================================================================

export type DeliveryStatusClass = 'pending' | 'delivered' | 'completed' | 'failed' | 'missing';

export function classifyDeliveryStatus(status: string | null): DeliveryStatusClass {
  if (!status) return 'missing';
  const s = status.toLowerCase();
  if (s === 'delivered' || s === 'delivered_waiting_completion') return 'delivered';
  if (s === 'completed') return 'completed';
  if (s === 'failed' || s === 'error' || s === 'timeout') return 'failed';
  if (s === 'pending' || s === 'delivering' || s === 'claimed' || s === 'preparing') return 'pending';
  return 'missing';
}

export function deliveryStatusLabel(statusClass: DeliveryStatusClass): string {
  switch (statusClass) {
    case 'delivered': return 'Delivered';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'pending': return 'Pending';
    case 'missing': return 'No Evidence';
  }
}

export function deliveryStatusClass(statusClass: DeliveryStatusClass): string {
  return `trace-delivery-${statusClass}`;
}

// =============================================================================
// Checkpoint helpers
// =============================================================================

export function checkpointStatusClass(status: string | null): string {
  if (!status) return 'checkpoint-unknown';
  const s = status.toLowerCase();
  if (s === 'success' || s === 'ok' || s === 'completed') return 'checkpoint-success';
  if (s === 'error' || s === 'failed') return 'checkpoint-error';
  if (s === 'progress' || s === 'in_progress' || s === 'pending') return 'checkpoint-pending';
  return 'checkpoint-unknown';
}

// =============================================================================
// Availability check helpers
// =============================================================================

export function isCoreAvailable(trace: AssignmentTraceResponse): boolean {
  return trace.coreAvailability === 'available' && trace.coreState !== null;
}

export function isDeliveryEvidenceAvailable(trace: AssignmentTraceResponse): boolean {
  return trace.gatewayAvailability === 'available' && trace.gatewayEvidence !== null;
}

export function hasMessages(trace: AssignmentTraceResponse): boolean {
  return trace.channelMessages.length > 0;
}

export function hasActivityEvents(trace: AssignmentTraceResponse): boolean {
  return trace.activityEvents.length > 0;
}

// =============================================================================
// Timestamp formatting
// =============================================================================

export function formatTraceTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    const date = new Date(ts.endsWith('Z') ? ts : `${ts}Z`);
    return date.toLocaleString();
  } catch {
    return ts ?? '—';
  }
}

// =============================================================================
// Assignment trace summary builder
// =============================================================================

export function buildTraceSummary(trace: AssignmentTraceResponse): string {
  const parts: string[] = [];

  if (trace.projectName || trace.projectId) {
    parts.push(trace.projectName ?? trace.projectId!);
  }
  if (trace.taskId != null) {
    parts.push(`Task #${trace.taskId}`);
  }
  if (trace.workerRole || trace.agentIdentity) {
    parts.push(trace.workerRole ?? trace.agentIdentity!);
  }

  if (trace.coreState) {
    const phase = classifyPhase(trace.coreState.phase);
    parts.push(phaseLabel(phase));
    if (trace.coreState.quarantined) {
      parts.push('⚠ Quarantined');
    }
  }

  if (trace.gatewayEvidence) {
    const deliveryClass = classifyDeliveryStatus(trace.gatewayEvidence.deliveryStatus);
    parts.push(deliveryStatusLabel(deliveryClass));
  }

  return parts.join(' · ') || `Assignment ${trace.assignmentId}`;
}

// =============================================================================
// Fake fixture factory for testing
// =============================================================================

export interface AssignmentTraceFixtureOpts {
  assignmentId?: string;
  projectId?: string;
  projectName?: string;
  taskId?: number | null;
  taskTitle?: string | null;
  agentIdentity?: string | null;
  workerRunId?: string | null;
  workerRole?: string | null;
  coreState?: Partial<AssignmentCoreState> | null;
  gatewayEvidence?: Partial<AssignmentGatewayEvidence> | null;
  coreAvailability?: TraceSourceAvailability;
  gatewayAvailability?: TraceSourceAvailability;
  messagesAvailability?: TraceSourceAvailability;
  activityAvailability?: TraceSourceAvailability;
  channelMessages?: number;
  activityEvents?: number;
}

export function fakeAssignmentTrace(opts: AssignmentTraceFixtureOpts = {}): AssignmentTraceResponse {
  const coreState: AssignmentCoreState | null = opts.coreState === null ? null : {
    phase: 'working',
    assignedAt: '2026-05-29T10:00:00Z',
    assignedAgent: opts.agentIdentity ?? 'hermes-coder',
    leaseAcquiredAt: '2026-05-29T10:00:05Z',
    leaseExpiresAt: '2026-05-29T11:00:00Z',
    checkpoints: [
      {
        sequence: 1,
        checkpointRequestAt: '2026-05-29T10:01:00Z',
        checkpointResponseAt: '2026-05-29T10:01:02Z',
        status: 'success',
        snapshotPreview: 'commit 3 files, 120 lines changed',
        error: null,
      },
    ],
    finalStatus: null,
    finalStatusAt: null,
    cleanupState: null,
    cleanupTriggeredAt: null,
    cleanupCompletedAt: null,
    releaseState: null,
    quarantined: false,
    quarantinedAt: null,
    ...(opts.coreState ?? {}),
  };

  const gatewayEvidence: AssignmentGatewayEvidence | null = opts.gatewayEvidence === null ? null : {
    deliveryRequestId: opts.assignmentId ?? 'del-abc-123',
    deliveryStatus: 'delivered',
    claimStatus: 'claimed',
    completionStatus: null,
    suppressionStatus: null,
    requestedAt: '2026-05-29T10:00:00Z',
    deliveredAt: '2026-05-29T10:00:03Z',
    claimedAt: '2026-05-29T10:00:06Z',
    completedAt: null,
    evidenceSummary: 'Delivery recorded, agent claimed',
    gatewayMessageUrl: '/gateway/messages/42',
    gatewayEventsUrl: '/gateway/events/42',
    ...(opts.gatewayEvidence ?? {}),
  };

  const channelMessages = Array.from({ length: opts.channelMessages ?? 2 }, (_, i) => ({
    id: 100 + i,
    channelId: 10,
    senderType: 'agent' as const,
    senderIdentity: opts.agentIdentity ?? 'hermes-coder',
    body: `Assignment progress message ${i + 1}`,
    messageKind: 'agent_text' as const,
    sourceKind: 'gateway_delivery' as const,
    sourceId: opts.assignmentId ?? 'del-abc-123',
    sourceProjectId: opts.projectId ?? 'den-core',
    summary: null,
    deepLink: null,
    threadRootMessageId: null,
    replyToMessageId: null,
    metadataJson: null,
    deliveryRequestId: opts.assignmentId ?? 'del-abc-123',
    dedupeKey: null,
    finalChannelMessageId: null,
    createdAt: `2026-05-29T10:0${i}:00Z`,
    editedAt: null,
    deletedAt: null,
  }));

  const activityEvents = Array.from({ length: opts.activityEvents ?? 3 }, (_, i) => ({
    id: 200 + i,
    channelId: 10,
    projectId: opts.projectId ?? 'den-core',
    agentIdentity: opts.agentIdentity ?? 'hermes-coder',
    deliveryRequestId: opts.assignmentId ?? 'del-abc-123',
    hermesSessionKey: 'sess-001',
    displayBlockId: null,
    parentHermesSessionKey: null,
    parentAgentIdentity: null,
    workerRunId: opts.workerRunId ?? null,
    workerRole: opts.workerRole ?? null,
    taskId: opts.taskId ?? null,
    threadId: null,
    anchorMessageId: null,
    eventType: i === 0 ? 'delivery_started' as const : i === 1 ? 'tool_call' as const : 'checkpoint' as const,
    status: i === 2 ? 'completed' as const : 'progress' as const,
    deliveryStage: i === 2 ? 'final' as const : 'active' as const,
    terminal: i === 2,
    sequence: i + 1,
    updateVersion: 1,
    title: i === 0 ? 'Delivery Started' : i === 1 ? 'Tool Call' : 'Checkpoint Complete',
    summary: null,
    previewJson: null,
    metadataJson: null,
    dedupeKey: null,
    finalChannelMessageId: i === 2 ? 102 : null,
    createdAt: `2026-05-29T10:0${i}:30Z`,
    updatedAt: `2026-05-29T10:0${i}:30Z`,
  }));

  return {
    assignmentId: opts.assignmentId ?? 'del-abc-123',
    projectId: opts.projectId ?? 'den-core',
    projectName: opts.projectName ?? 'Worker Pool Core',
    taskId: opts.taskId ?? 1729,
    taskTitle: opts.taskTitle ?? 'Worker-Pool Assignment Trace',
    agentIdentity: opts.agentIdentity ?? 'hermes-coder',
    workerRunId: opts.workerRunId ?? 't1729-coder-001',
    workerRole: opts.workerRole ?? 'coder',
    coreAvailability: opts.coreAvailability ?? 'available',
    gatewayAvailability: opts.gatewayAvailability ?? 'available',
    messagesAvailability: opts.messagesAvailability ?? 'available',
    activityAvailability: opts.activityAvailability ?? 'available',
    coreState,
    gatewayEvidence,
    channelMessages,
    activityEvents,
    summary: null,
  };
}

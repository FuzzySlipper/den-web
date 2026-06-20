import type {
  ChannelActivityEvent,
  ObservationActiveWorkItem,
  ObservationAgentActivityPayload,
  ObservationLaneEvent,
  ObservationResultRef,
  ObservationWorkRef,
} from '@den-web/api/types';
import { firstPositiveInteger, firstString, humanizeEventType, parseJsonValue } from './activityUtils';

export interface ObservationActivityScope {
  channelId?: number | null;
  projectId?: string | null;
  hideDebug?: boolean;
}

export function observationEventsToChannelActivityEvents(
  events: ObservationLaneEvent[] | null | undefined,
  scope: ObservationActivityScope = {},
): ChannelActivityEvent[] {
  return (events ?? []).flatMap(event => {
    const payload = normalizeObservationPayload(event.payload);
    if (!payload) return [];
    if ((scope.hideDebug ?? true) && payload.visibility === 'debug') return [];
    if (!observationMatchesScope(payload.work_ref ?? null, scope)) return [];
    return [observationEventToChannelActivityEvent(event, payload, scope)];
  });
}

export function observationActiveWorkIncludesMember(
  items: ObservationActiveWorkItem[] | null | undefined,
  memberIdentity: string,
): boolean {
  const normalized = memberIdentity.trim();
  if (!normalized) return false;
  return (items ?? []).some(item => {
    if (isTerminalObservationWorkState(item.state)) return false;
    return item.target_identity.profile === normalized
      || item.target_identity.instance_id === normalized
      || item.claimed_by?.profile === normalized
      || item.claimed_by?.instance_id === normalized;
  });
}

export function normalizeObservationPayload(raw: ObservationLaneEvent['payload']): ObservationAgentActivityPayload | null {
  const value = typeof raw === 'string' ? parseJsonValue(raw) : raw;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as ObservationAgentActivityPayload;
  return {
    ...record,
    summary: firstString(record.summary) ?? humanizeEventType(firstString(record.kind) ?? 'observation_event'),
    severity: observationSeverity(record.severity),
    visibility: observationVisibility(record.visibility),
  };
}

function observationEventToChannelActivityEvent(
  event: ObservationLaneEvent,
  payload: ObservationAgentActivityPayload,
  scope: ObservationActivityScope,
): ChannelActivityEvent {
  const workRef = payload.work_ref ?? null;
  const resultRef = payload.result_ref ?? null;
  const sequence = stableObservationSequence(event.event_id);
  const channelId = firstPositiveInteger(workRef?.channel_id, scope.channelId) ?? 0;
  const agentIdentity = firstString(
    event.agent_identity?.profile,
    event.agent_identity?.instance_id,
    event.runtime_instance_id,
  ) ?? 'unknown-agent';
  const sessionKey = firstString(payload.session_key, event.agent_identity?.session_key);
  const runtimeInstanceId = firstString(event.runtime_instance_id, event.agent_identity?.instance_id);
  const workerRunId = firstString(workRef?.run_id, runtimeInstanceId, sessionKey);
  const summary = firstString(payload.summary) ?? humanizeEventType(event.event_type);
  const metadata = {
    source: 'observation',
    observationEventId: event.event_id,
    sourceDomain: event.source_domain,
    eventType: event.event_type,
    severity: payload.severity,
    visibility: payload.visibility,
    displayOnly: event.display_only,
    adapter: payload.adapter ?? null,
    surface: payload.surface ?? null,
    sessionKey,
    toolName: payload.tool_name ?? null,
    model: payload.model ?? null,
    reasonCode: payload.reason_code ?? null,
    runtimeInstanceId,
    workRef,
    resultRef,
  };

  return {
    id: -2_000_000 - sequence,
    channelId,
    projectId: firstString(workRef?.project_id, scope.projectId),
    agentIdentity,
    deliveryRequestId: null,
    hermesSessionKey: sessionKey,
    displayBlockId: observationDisplayBlockId(event, payload, workRef),
    parentHermesSessionKey: null,
    parentAgentIdentity: null,
    workerRunId,
    workerRole: firstString(payload.surface),
    assignmentId: firstString(workRef?.assignment_id),
    agentInstanceId: runtimeInstanceId,
    poolMemberId: null,
    taskId: firstPositiveInteger(workRef?.task_id),
    threadId: null,
    anchorMessageId: firstPositiveInteger(workRef?.channel_message_id),
    eventType: event.event_type || 'observation_event',
    status: observationSeverity(payload.severity),
    deliveryStage: observationVisibility(payload.visibility),
    terminal: observationEventIsTerminal(event.event_type, payload),
    sequence,
    updateVersion: 1,
    title: humanizeEventType(event.event_type || 'observation_event'),
    summary,
    previewJson: JSON.stringify({ preview: summary }),
    metadataJson: JSON.stringify(metadata),
    dedupeKey: `observation:${event.event_id}`,
    finalChannelMessageId: firstPositiveInteger(resultRef?.message_id),
    createdAt: event.created_at,
    updatedAt: event.created_at,
  };
}

function observationMatchesScope(workRef: ObservationWorkRef | null, scope: ObservationActivityScope): boolean {
  if (scope.channelId != null && workRef?.channel_id != null) return workRef.channel_id === scope.channelId;
  if (scope.projectId && workRef?.project_id) return workRef.project_id === scope.projectId;
  if (scope.projectId && workRef?.task_id != null) return false;
  return true;
}

function observationDisplayBlockId(
  event: ObservationLaneEvent,
  payload: ObservationAgentActivityPayload,
  workRef: ObservationWorkRef | null,
): string {
  return firstString(
    workRef?.run_id,
    workRef?.assignment_id ? `assignment:${workRef.assignment_id}` : null,
    payload.session_key,
    event.runtime_instance_id,
    event.agent_identity?.instance_id,
    event.agent_identity?.profile,
    event.event_id,
  ) ?? event.event_id;
}

function observationSeverity(value: unknown): string {
  const severity = firstString(value)?.toLowerCase();
  if (severity === 'success' || severity === 'warning' || severity === 'error') return severity;
  return 'info';
}

function observationVisibility(value: unknown): string {
  const visibility = firstString(value)?.toLowerCase();
  if (visibility === 'task' || visibility === 'agent' || visibility === 'debug') return visibility;
  return 'channel';
}

function observationEventIsTerminal(eventType: string, payload: ObservationAgentActivityPayload): boolean {
  const normalizedType = eventType.toLowerCase();
  return observationSeverity(payload.severity) === 'success'
    || observationSeverity(payload.severity) === 'error'
    || normalizedType.endsWith('_completed')
    || normalizedType.endsWith('_failed')
    || normalizedType.endsWith('_stopped');
}

function isTerminalObservationWorkState(state: string): boolean {
  const normalized = state.toLowerCase();
  return normalized === 'completed' || normalized === 'failed' || normalized === 'cancelled' || normalized === 'resolved';
}

function stableObservationSequence(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return Math.max(1, hash % 900_000_000);
}

export function observationResultLabels(resultRef: ObservationResultRef | null | undefined): string[] {
  if (!resultRef) return [];
  return [
    resultRef.message_id != null ? `message #${resultRef.message_id}` : null,
    resultRef.document_slug ? `doc ${resultRef.document_slug}` : null,
    resultRef.commit ? `commit ${resultRef.commit.slice(0, 12)}` : null,
    resultRef.artifact_path ? `artifact ${resultRef.artifact_path}` : null,
  ].filter((value): value is string => Boolean(value));
}

import type { AgentWorkCurrentResponse, AgentWorkCurrentItem, AgentWorkEventsResponse, AgentWorkLifecycleEvent, ChannelActivityEvent, DirectAgentEvent } from '../../api/types';

export type AgentWorkEvidenceMode = 'lifecycle' | 'composed' | 'activity_fallback' | 'direct_agent_fallback' | 'none';

export interface AgentWorkOpsRow {
  key: string;
  agentIdentity: string;
  state: string;
  stateReason: string;
  lastActivityAt: string | null;
  projectId: string | null;
  taskId: number | null;
  assignmentId: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  deliveryRequestId: string | null;
  sessionId: string | null;
  evidenceLinks: string[];
  evidenceProvenance: string[];
  stalenessDiagnostic: string | null;
  flags: string[];
}

export interface AgentWorkOpsTimelineItem {
  key: string;
  source: 'lifecycle' | 'activity' | 'direct_agent';
  agentIdentity: string;
  title: string;
  status: string;
  createdAt: string;
  detail: string | null;
  projectId: string | null;
  taskId: number | null;
  assignmentId: string | null;
  workerRunId: string | null;
  deliveryRequestId: string | null;
  evidenceLink: string | null;
}

export interface AgentWorkOpsModel {
  mode: AgentWorkEvidenceMode;
  headingDetail: string;
  diagnostic: string;
  currentRows: AgentWorkOpsRow[];
  timelineItems: AgentWorkOpsTimelineItem[];
  staleCount: number;
  migrationNote: string | null;
}

export function buildAgentWorkOpsModel(
  current: AgentWorkCurrentResponse | null,
  lifecycle: AgentWorkEventsResponse | null,
  activityEvents: ChannelActivityEvent[],
  directAgentEvents: DirectAgentEvent[],
): AgentWorkOpsModel {
  const lifecycleItems = lifecycle?.items ?? [];
  const currentRows = (current?.items ?? []).map(currentItemToRow).sort(compareRows);
  const directFallbackRows = currentRows.length === 0 ? directAgentEvents.slice(0, 6).map(directAgentEventToRow) : [];
  const rows = currentRows.length > 0 ? currentRows : directFallbackRows;

  const timelineItems = [
    ...lifecycleItems.map(lifecycleEventToTimelineItem),
    ...(lifecycleItems.length === 0 ? activityEvents.slice(0, 8).map(activityEventToTimelineItem) : []),
    ...(lifecycleItems.length === 0 && activityEvents.length === 0 ? directAgentEvents.slice(0, 8).map(directAgentEventToTimelineItem) : []),
  ].sort(compareTimelineItems).slice(0, 12);

  const hasLifecycleEvidence = lifecycleItems.length > 0 || currentRows.some(row => row.evidenceProvenance.includes('agent_work_lifecycle'));
  const hasComposedCurrent = currentRows.some(row => row.evidenceProvenance.some(source => source !== 'agent_work_lifecycle'));
  const staleCount = rows.filter(row => row.stalenessDiagnostic || row.flags.includes('stale') || row.flags.includes('possibly_stale')).length
    || current?.stalenessSummary?.stale
    || 0;

  let mode: AgentWorkEvidenceMode = 'none';
  let diagnostic = 'No producer telemetry for this channel: no lifecycle rows, no activity events, and no direct-agent delivery evidence.';

  if (hasLifecycleEvidence) {
    mode = 'lifecycle';
    diagnostic = 'Showing canonical agent-work lifecycle evidence.';
  } else if (currentRows.length > 0 && hasComposedCurrent) {
    mode = 'composed';
    diagnostic = current?.migrationNote ?? 'No lifecycle events yet; showing current work composed from activity, direct-agent, and gateway-delivery evidence.';
  } else if (activityEvents.length > 0) {
    mode = 'activity_fallback';
    diagnostic = 'No lifecycle events yet; showing legacy channel activity breadcrumbs as fallback evidence.';
  } else if (directAgentEvents.length > 0) {
    mode = 'direct_agent_fallback';
    diagnostic = 'No lifecycle/activity rows yet; showing recorded direct-agent delivery requests.';
  }

  return {
    mode,
    headingDetail: describeHeading(rows.length, timelineItems.length, staleCount),
    diagnostic,
    currentRows: rows,
    timelineItems,
    staleCount,
    migrationNote: current?.migrationNote ?? null,
  };
}

function currentItemToRow(item: AgentWorkCurrentItem): AgentWorkOpsRow {
  return {
    key: [item.agentIdentity, item.workerRunId, item.assignmentId, item.deliveryRequestId, item.directAgentEventId].filter(Boolean).join(':') || item.agentIdentity,
    agentIdentity: item.agentIdentity,
    state: item.currentWorkState || item.state,
    stateReason: item.stateReason || 'Current work projection row',
    lastActivityAt: item.lastActivityAt,
    projectId: item.projectId,
    taskId: item.taskId,
    assignmentId: item.assignmentId,
    workerRunId: item.workerRunId,
    workerRole: item.workerRole,
    deliveryRequestId: item.deliveryRequestId,
    sessionId: item.sessionId,
    evidenceLinks: uniqueStrings([item.evidenceLink, ...item.evidenceLinks]),
    evidenceProvenance: item.evidenceProvenance,
    stalenessDiagnostic: item.stalenessDiagnostic,
    flags: item.flags,
  };
}

function directAgentEventToRow(event: DirectAgentEvent): AgentWorkOpsRow {
  const target = directAgentTarget(event) ?? event.profileIdentity ?? event.senderIdentity;
  return {
    key: `direct:${event.id}`,
    agentIdentity: target,
    state: 'recorded_only',
    stateReason: event.summary ?? 'Direct-agent request recorded; no lifecycle/current-work row yet.',
    lastActivityAt: event.createdAt,
    projectId: event.targetProjectId ?? event.sourceProjectId,
    taskId: event.targetTaskId,
    assignmentId: event.assignmentId ?? null,
    workerRunId: event.workerRunId,
    workerRole: event.workerRole,
    deliveryRequestId: event.deliveryRequestId ?? String(event.id),
    sessionId: event.sessionId,
    evidenceLinks: [`/api/direct-agent-events/${event.id}`],
    evidenceProvenance: ['direct_agent_event'],
    stalenessDiagnostic: 'recorded-only: no lifecycle/current-work row',
    flags: ['recorded_only', 'no_lifecycle'],
  };
}

function lifecycleEventToTimelineItem(event: AgentWorkLifecycleEvent): AgentWorkOpsTimelineItem {
  return {
    key: `lifecycle:${event.id}`,
    source: 'lifecycle',
    agentIdentity: event.agentIdentity,
    title: event.eventType,
    status: event.state ?? event.eventType,
    createdAt: event.createdAt,
    detail: event.summary,
    projectId: event.projectId,
    taskId: event.taskId,
    assignmentId: event.assignmentId ?? null,
    workerRunId: event.workerRunId,
    deliveryRequestId: event.deliveryRequestId,
    evidenceLink: event.evidenceLink,
  };
}

function activityEventToTimelineItem(event: ChannelActivityEvent): AgentWorkOpsTimelineItem {
  return {
    key: `activity:${event.id}`,
    source: 'activity',
    agentIdentity: event.agentIdentity,
    title: event.title ?? event.eventType,
    status: event.status,
    createdAt: event.createdAt,
    detail: event.summary,
    projectId: event.projectId,
    taskId: event.taskId,
    assignmentId: event.assignmentId ?? null,
    workerRunId: event.workerRunId,
    deliveryRequestId: event.deliveryRequestId,
    evidenceLink: `/api/channels/${event.channelId}/activity-events?limit=10`,
  };
}

function directAgentEventToTimelineItem(event: DirectAgentEvent): AgentWorkOpsTimelineItem {
  return {
    key: `direct:${event.id}`,
    source: 'direct_agent',
    agentIdentity: directAgentTarget(event) ?? event.senderIdentity,
    title: event.sourceKind ?? 'direct-agent',
    status: event.summary ?? 'recorded direct-agent request',
    createdAt: event.createdAt,
    detail: event.body,
    projectId: event.targetProjectId ?? event.sourceProjectId,
    taskId: event.targetTaskId,
    assignmentId: event.assignmentId ?? null,
    workerRunId: event.workerRunId,
    deliveryRequestId: event.deliveryRequestId,
    evidenceLink: `/api/direct-agent-events/${event.id}`,
  };
}

function directAgentTarget(event: DirectAgentEvent): string | null {
  const match = /^direct-agent-message:\d+:([^:]+):/.exec(event.sourceId ?? '');
  return match?.[1] ?? null;
}

function describeHeading(rows: number, timeline: number, stale: number): string {
  const parts = [`${rows} current`, `${timeline} recent`];
  if (stale > 0) parts.push(`${stale} stale`);
  return parts.join(' · ');
}

function compareRows(left: AgentWorkOpsRow, right: AgentWorkOpsRow): number {
  return compareIsoishDesc(left.lastActivityAt, right.lastActivityAt) || left.agentIdentity.localeCompare(right.agentIdentity);
}

function compareTimelineItems(left: AgentWorkOpsTimelineItem, right: AgentWorkOpsTimelineItem): number {
  return compareIsoishDesc(left.createdAt, right.createdAt) || left.key.localeCompare(right.key);
}

function compareIsoishDesc(left: string | null, right: string | null): number {
  return parseTime(right) - parseTime(left);
}

function parseTime(value: string | null): number {
  if (!value) return 0;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

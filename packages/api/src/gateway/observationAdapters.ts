import type {
  ActivityEventOverviewDto,
  AgentDetailResponse,
  AgentOverviewItem,
  AgentsOverviewResponse,
  DeliveryOverviewDto,
  SourceHealthDto,
  TaskAssociationDto,
  AssignmentTraceResponse,
} from './types';
import type {
  ObservationActiveWorkItem,
  ObservationActiveWorkResponse,
  ObservationAgentActivityPayload,
  ObservationAgentOverviewResponse,
  ObservationLaneEvent,
  ObservationLaneResponse,
} from './observationTypes';

const OBSERVATION_ONLY_HEALTH: SourceHealthDto = {
  channels: {
    status: 'degraded',
    warning: 'Legacy den-channels agents overview is retired for this view; channel memberships and binding aggregates are omitted until den-services exposes successor parity.',
  },
  gateway: { status: 'ok' },
};

interface AgentAccumulator {
  identity: string;
  activity: ActivityEventOverviewDto[];
  activeWork: ObservationActiveWorkItem[];
  taskAssociations: Map<string, TaskAssociationDto>;
}

export function observationOverviewFromLane(
  lane: ObservationLaneResponse,
  activeWork: ObservationActiveWorkResponse,
  opts: { projectId?: string; agentIdentity?: string; activityLimit?: number } = {},
): AgentsOverviewResponse {
  const agents = new Map<string, AgentAccumulator>();

  for (const event of lane.events ?? []) {
    const payload = observationPayload(event.payload);
    const identity = event.agent_identity?.profile ?? event.agent_identity?.instance_id;
    if (!identity) continue;
    if (opts.agentIdentity && identity !== opts.agentIdentity) continue;
    if (!matchesProject(payload, opts.projectId)) continue;
    const accumulator = ensureAgent(agents, identity);
    const activity = observationEventToActivity(event, payload);
    accumulator.activity.push(activity);
    addTaskAssociation(accumulator, activity);
  }

  for (const work of activeWork.items ?? []) {
    const target = work.target_identity.profile;
    const claimed = work.claimed_by?.profile;
    for (const identity of [target, claimed].filter((value): value is string => Boolean(value))) {
      if (opts.agentIdentity && identity !== opts.agentIdentity) continue;
      const accumulator = ensureAgent(agents, identity);
      accumulator.activeWork.push(work);
    }
  }

  const activityLimit = opts.activityLimit ?? 3;
  return {
    agents: [...agents.values()].map(agent => agentOverviewFromDetail(agentDetailFromAccumulator(agent, activityLimit))),
    totalCount: agents.size,
    sourceHealth: OBSERVATION_ONLY_HEALTH,
  };
}

export function observationAgentDetail(
  agentIdentity: string,
  overview: ObservationAgentOverviewResponse,
  activityLimit = 50,
): AgentDetailResponse {
  const accumulator = ensureAgent(new Map(), agentIdentity);
  for (const event of overview.activity_events ?? []) {
    const activity = observationEventToActivity(event, observationPayload(event.payload));
    accumulator.activity.push(activity);
    addTaskAssociation(accumulator, activity);
  }
  accumulator.activeWork.push(...(overview.active_work ?? []));
  const detail = agentDetailFromAccumulator(accumulator, activityLimit);
  return {
    ...detail,
    operatorStatus: overview.runtime_instances.length > 0 ? 'observed' : detail.operatorStatus,
    workState: overview.active_work.length > 0 ? 'active' : detail.workState,
    flags: [
      ...detail.flags,
      'observation_only',
      ...(overview.runtime_instances.length === 0 ? ['no_runtime_instances'] : []),
    ],
  };
}

export function degradedAgentDetail(agentIdentity: string, warning: string): AgentDetailResponse {
  return {
    agentIdentity,
    operatorStatus: 'degraded',
    workState: null,
    severity: 'warning',
    flags: ['observation_unavailable'],
    summary: {
      channelCount: 0,
      activeMembershipCount: 0,
      activeDeliveryCount: 0,
      recentActivityCount: 0,
      latestActivityAt: null,
      highestSeverity: 'warning',
      staleDeliveryCount: 0,
    },
    memberships: [],
    bindings: [],
    deliverySummaries: [],
    recentActivity: [],
    currentDeliveries: [],
    recentDeliveries: [],
    activityEvents: [],
    taskAssociations: [],
    sourceHealth: {
      channels: OBSERVATION_ONLY_HEALTH.channels,
      gateway: { status: 'degraded', warning },
    },
  };
}

export function degradedAssignmentTrace(assignmentId: string, opts: { projectId?: string; channelId?: string } = {}): AssignmentTraceResponse {
  return {
    assignmentId,
    projectId: opts.projectId ?? null,
    projectName: null,
    taskId: null,
    taskTitle: null,
    agentIdentity: null,
    workerRunId: null,
    workerRole: null,
    coreAvailability: 'core_unavailable',
    gatewayAvailability: 'gateway_unavailable',
    messagesAvailability: 'no_assignment_messages',
    activityAvailability: 'no_activity_events',
    coreState: null,
    gatewayEvidence: null,
    channelMessages: [],
    activityEvents: [],
    summary: 'Assignment trace successor is not available yet. Den Web no longer calls the retired den-channels assignment trace aggregate.',
  };
}

function ensureAgent(agents: Map<string, AgentAccumulator>, identity: string): AgentAccumulator {
  const existing = agents.get(identity);
  if (existing) return existing;
  const created: AgentAccumulator = {
    identity,
    activity: [],
    activeWork: [],
    taskAssociations: new Map(),
  };
  agents.set(identity, created);
  return created;
}

function agentDetailFromAccumulator(agent: AgentAccumulator, activityLimit: number): AgentDetailResponse {
  const sortedActivity = agent.activity
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const recentActivity = sortedActivity.slice(0, activityLimit);
  const currentDeliveries = agent.activeWork.map(activeWorkToDelivery);
  const latestActivityAt = sortedActivity[0]?.createdAt ?? currentDeliveries[0]?.createdAt ?? null;
  const highestSeverity = highestActivitySeverity(sortedActivity);
  return {
    agentIdentity: agent.identity,
    operatorStatus: currentDeliveries.length > 0 ? 'active' : 'observed',
    workState: currentDeliveries.length > 0 ? 'active' : (recentActivity.length > 0 ? 'recent' : null),
    severity: highestSeverity,
    flags: ['observation_only'],
    summary: {
      channelCount: 0,
      activeMembershipCount: 0,
      activeDeliveryCount: currentDeliveries.length,
      recentActivityCount: sortedActivity.length,
      latestActivityAt,
      highestSeverity,
      staleDeliveryCount: 0,
    },
    memberships: [],
    bindings: [],
    deliverySummaries: currentDeliveries,
    recentActivity,
    currentDeliveries,
    recentDeliveries: currentDeliveries,
    activityEvents: recentActivity,
    taskAssociations: [...agent.taskAssociations.values()],
    sourceHealth: OBSERVATION_ONLY_HEALTH,
  };
}

function agentOverviewFromDetail(detail: AgentDetailResponse): AgentOverviewItem {
  return {
    agentIdentity: detail.agentIdentity,
    operatorStatus: detail.operatorStatus,
    workState: detail.workState,
    severity: detail.severity,
    summary: detail.summary,
    flags: detail.flags,
    links: null,
    memberships: detail.memberships,
    bindings: detail.bindings,
    deliverySummaries: detail.deliverySummaries,
    recentActivity: detail.recentActivity,
  };
}

function observationPayload(raw: ObservationLaneEvent['payload']): ObservationAgentActivityPayload {
  const parsed = typeof raw === 'string' ? parseJson(raw) : raw;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as ObservationAgentActivityPayload
    : {};
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function matchesProject(payload: ObservationAgentActivityPayload, projectId?: string): boolean {
  if (!projectId) return true;
  const workRef = payload.work_ref;
  return workRef?.project_id === projectId;
}

function observationEventToActivity(
  event: ObservationLaneEvent,
  payload: ObservationAgentActivityPayload,
): ActivityEventOverviewDto {
  const workRef = payload.work_ref;
  const metadata = JSON.stringify({
    source: 'observation',
    eventId: event.event_id,
    payload,
  });
  return {
    id: negativeStableId(event.event_id),
    channelId: workRef?.channel_id ?? 0,
    projectId: workRef?.project_id ?? null,
    sourceProjectId: workRef?.project_id ?? null,
    targetProjectId: workRef?.project_id ?? null,
    metadataJson: metadata,
    agentIdentity: event.agent_identity?.profile ?? event.agent_identity?.instance_id ?? 'unknown-agent',
    deliveryRequestId: null,
    hermesSessionKey: payload.session_key ?? event.agent_identity?.session_key ?? null,
    displayBlockId: workRef?.run_id ?? workRef?.assignment_id ?? event.event_id,
    workerRunId: workRef?.run_id ?? event.runtime_instance_id ?? null,
    workerRole: payload.surface ?? null,
    taskId: workRef?.task_id ?? null,
    eventType: event.event_type || 'observation_event',
    status: payload.severity ?? 'info',
    deliveryStage: payload.visibility ?? 'channel',
    terminal: event.display_only && (payload.severity === 'success' || payload.severity === 'error'),
    title: event.event_type || 'Observation event',
    summary: payload.summary ?? event.event_type,
    createdAt: event.created_at,
    updatedAt: event.created_at,
  };
}

function activeWorkToDelivery(item: ObservationActiveWorkItem): DeliveryOverviewDto {
  return {
    deliveryRequestId: String(item.intent_id),
    deliveryMode: 'successor_intent',
    deliveryState: item.state,
    requestedAt: item.created_at,
    targetAgentIdentity: item.target_identity.profile,
    channelSlug: null,
    channelId: null,
    projectId: null,
    sourceProjectId: null,
    targetProjectId: null,
    metadataJson: JSON.stringify({ source: 'observation_active_work', item }),
    taskId: null,
    isTerminal: false,
    latestActivityAt: item.created_at,
    evidenceSummary: item.source_ref ?? null,
    state: item.state,
    status: item.state,
    terminal: false,
    createdAt: item.created_at,
    updatedAt: item.created_at,
    summary: item.source_ref ?? `Intent ${item.intent_id}`,
    isStale: false,
  };
}

function addTaskAssociation(agent: AgentAccumulator, activity: ActivityEventOverviewDto): void {
  if (activity.taskId == null && !activity.projectId) return;
  const key = `${activity.projectId ?? ''}:${activity.taskId ?? ''}`;
  const existing = agent.taskAssociations.get(key);
  if (existing) {
    existing.activityCount += 1;
    if (!existing.latestActivityAt || Date.parse(activity.createdAt) > Date.parse(existing.latestActivityAt)) {
      existing.latestActivityAt = activity.createdAt;
    }
    return;
  }
  agent.taskAssociations.set(key, {
    taskId: activity.taskId,
    projectId: activity.projectId,
    title: null,
    status: activity.status,
    activityCount: 1,
    latestActivityAt: activity.createdAt,
  });
}

function highestActivitySeverity(activity: ActivityEventOverviewDto[]): string | null {
  if (activity.some(item => item.status === 'error')) return 'error';
  if (activity.some(item => item.status === 'warning')) return 'warning';
  if (activity.some(item => item.status === 'success')) return 'success';
  return activity.length > 0 ? 'info' : null;
}

function negativeStableId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return -1_000_000 - (hash % 900_000_000);
}

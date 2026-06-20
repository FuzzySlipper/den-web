
import type { AgentWorkLifecycleEvent, ChannelActivityEvent } from '@den-web/api/types';
import { firstAnyNumber, firstPositiveInteger, firstString, matchFirst } from './activityUtils';
import { piCrewDelegationPreview, piCrewDelegationTitle } from './piCrewMessageActivity';

export function piCrewAgentWorkActivityEventsFromLifecycleEvents(events: AgentWorkLifecycleEvent[]): ChannelActivityEvent[] {
  return events.flatMap(event => {
    if (!isPiCrewStructuredAgentWorkEvent(event)) return [];
    const eventFamily = firstString(event.eventFamily, event.metadata?.eventFamily, event.metadata?.event_family) ?? inferPiCrewEventFamily(event);
    if (eventFamily === 'delegation') return [piCrewStructuredDelegationActivityEvent(event)];
    if (eventFamily === 'tool') return [piCrewStructuredToolActivityEvent(event)];
    return [piCrewStructuredParentActivityEvent(event)];
  });
}

type PiCrewActivityOverrides = {
  agentIdentity?: string;
  hermesSessionKey?: string | null;
  displayBlockId?: string | null;
  parentHermesSessionKey?: string | null;
  parentAgentIdentity?: string | null;
  workerRunId?: string | null;
  workerRole?: string | null;
  anchorMessageId?: number | null;
  status?: string;
  deliveryStage?: string;
  terminal?: boolean;
  title?: string;
  previewJson?: string | null;
  metadata: Record<string, unknown>;
};

function buildPiCrewLifecycleActivityEvent(
  event: AgentWorkLifecycleEvent,
  overrides: PiCrewActivityOverrides,
): ChannelActivityEvent {
  const hasOverride = (key: keyof PiCrewActivityOverrides): boolean => Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    id: piCrewSyntheticLifecycleId(event),
    channelId: piCrewLifecycleChannelId(event),
    projectId: event.projectId,
    agentIdentity: hasOverride('agentIdentity') ? overrides.agentIdentity ?? piCrewLifecycleAgentIdentity(event) : piCrewLifecycleAgentIdentity(event),
    deliveryRequestId: null,
    hermesSessionKey: hasOverride('hermesSessionKey') ? overrides.hermesSessionKey ?? null : firstString(event.sessionId, event.evidence?.sessionId),
    displayBlockId: hasOverride('displayBlockId') ? overrides.displayBlockId ?? null : piCrewAgentDisplayBlockId(event),
    parentHermesSessionKey: hasOverride('parentHermesSessionKey') ? overrides.parentHermesSessionKey ?? null : null,
    parentAgentIdentity: hasOverride('parentAgentIdentity') ? overrides.parentAgentIdentity ?? null : null,
    workerRunId: hasOverride('workerRunId') ? overrides.workerRunId ?? null : event.workerRunId,
    workerRole: hasOverride('workerRole') ? overrides.workerRole ?? null : null,
    assignmentId: event.assignmentId,
    taskId: event.taskId,
    threadId: null,
    anchorMessageId: hasOverride('anchorMessageId') ? overrides.anchorMessageId ?? null : null,
    eventType: event.eventType,
    status: overrides.status ?? lifecycleEventState(event) ?? event.eventType,
    deliveryStage: overrides.deliveryStage ?? lifecycleDeliveryStage(event),
    terminal: overrides.terminal ?? lifecycleEventIsTerminal(event),
    sequence: piCrewLifecycleSequence(event),
    updateVersion: 1,
    title: overrides.title ?? lifecycleTitle(event.eventType),
    summary: event.summary,
    previewJson: overrides.previewJson ?? null,
    metadataJson: JSON.stringify(overrides.metadata),
    dedupeKey: null,
    finalChannelMessageId: null,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
  };
}

function piCrewStructuredParentActivityEvent(event: AgentWorkLifecycleEvent): ChannelActivityEvent {
  const sourceMessageId = firstPositiveInteger(sourceMessageIdFromEvidence(event.evidenceLink), evidenceString(event, 'sourceMessageId'), evidenceString(event, 'source_message_id'));
  const agentIdentity = piCrewLifecycleAgentIdentity(event);
  const metadata = {
    ...(event.metadata ?? {}),
    eventFamily: firstString(event.eventFamily) ?? 'parent',
    eventType: event.eventType,
    sourceMessageId,
    evidenceLink: event.evidenceLink,
    severity: event.severity,
    profileId: firstString(event.profileId, event.metadata?.profileId, event.metadata?.profile_id),
    sessionId: firstString(event.sessionId, event.evidence?.sessionId),
    provider: event.provider,
    model: event.model,
    turnId: event.turnId,
  };
  return buildPiCrewLifecycleActivityEvent(event, {
    agentIdentity,
    anchorMessageId: sourceMessageId,
    status: lifecycleEventState(event) ?? event.eventType,
    deliveryStage: lifecycleDeliveryStage(event),
    terminal: lifecycleEventIsTerminal(event),
    title: lifecycleTitle(event.eventType),
    metadata,
  });
}

function piCrewStructuredDelegationActivityEvent(event: AgentWorkLifecycleEvent): ChannelActivityEvent {
  const childSessionId = firstString(event.childSessionId, event.evidence?.childSessionId, event.metadata?.childSessionId, event.metadata?.child_session_id);
  const parentSessionId = firstString(event.parentSessionId, event.metadata?.parentSessionId, event.metadata?.parent_session_id);
  const rootSessionId = firstString(event.rootSessionId, event.metadata?.rootSessionId, event.metadata?.root_session_id);
  const profileId = firstString(event.profileId, event.metadata?.profileId, event.metadata?.profile_id);
  const outcome = firstString(event.outcome, event.metadata?.outcome, event.state);
  const durationMs = firstAnyNumber(event.durationMs, event.metadata?.durationMs, event.metadata?.duration_ms);
  const metadata = {
    ...(event.metadata ?? {}),
    eventFamily: 'delegation',
    eventType: event.eventType,
    childSessionId,
    parentSessionId,
    rootSessionId,
    profileId,
    provider: event.provider,
    model: event.model,
    policyId: event.policyId,
    depth: event.depth,
    outcome,
    durationMs,
    turnsUsed: event.turnsUsed,
    tokensConsumed: event.tokensConsumed,
    evidenceChecked: event.evidenceChecked,
    artifactCount: event.artifactCount,
  };
  const eventName = firstString(event.piCrewEventType, event.metadata?.piCrewEventType, event.metadata?.pi_crew_event_type)
    ?? event.eventType.replace(/^pi_crew\./, '').replace(/_/g, '.');
  const terminal = lifecycleEventIsTerminal(event) || eventName.includes('completed') || eventName.includes('failed');
  return buildPiCrewLifecycleActivityEvent(event, {
    agentIdentity: profileId ?? event.parentAgentIdentity ?? piCrewLifecycleAgentIdentity(event),
    hermesSessionKey: childSessionId ?? rootSessionId,
    displayBlockId: childSessionId ? `pi-crew-delegation:${childSessionId}` : piCrewAgentDisplayBlockId(event),
    parentHermesSessionKey: parentSessionId ?? rootSessionId,
    parentAgentIdentity: event.parentAgentIdentity ?? piCrewLifecycleAgentIdentity(event),
    workerRunId: childSessionId,
    workerRole: childSessionId ? 'subagent' : null,
    anchorMessageId: firstPositiveInteger(sourceMessageIdFromEvidence(event.evidenceLink)),
    status: piCrewStructuredStatus(event, eventName, outcome),
    deliveryStage: terminal ? 'final' : 'progress',
    terminal,
    title: piCrewDelegationTitle(eventName, { childSessionId, toolName: null, phase: firstString(event.phase), outcome, toolsUsed: null }),
    previewJson: JSON.stringify({ preview: piCrewDelegationPreview({ childSessionId, parentSessionId, rootSessionId, toolName: null, toolCallId: null, phase: firstString(event.phase), outcome, durationMs, toolsUsed: null }) }),
    metadata,
  });
}

function piCrewStructuredToolActivityEvent(event: AgentWorkLifecycleEvent): ChannelActivityEvent {
  const ownerSessionId = firstString(event.ownerSessionId, event.evidence?.childSessionId, event.evidence?.sessionId, event.metadata?.childSessionId, event.metadata?.sessionId, event.sessionId);
  const childSessionId = ownerSessionId?.startsWith('delegated-session-') ? ownerSessionId : firstString(event.childSessionId, event.metadata?.childSessionId, event.metadata?.child_session_id);
  const parentSessionId = firstString(event.parentSessionId, event.metadata?.parentSessionId, event.metadata?.parent_session_id);
  const rootSessionId = firstString(event.rootSessionId, event.metadata?.rootSessionId, event.metadata?.root_session_id);
  const toolName = firstString(event.toolName, event.evidence?.toolName, event.metadata?.toolName, event.metadata?.tool_name);
  const toolCallId = firstString(event.toolCallId, event.evidence?.toolCallId, event.metadata?.toolCallId, event.metadata?.tool_call_id);
  const phase = firstString(event.phase, event.metadata?.phase, lifecycleEventState(event));
  const durationMs = firstAnyNumber(event.durationMs, event.metadata?.durationMs, event.metadata?.duration_ms);
  const isChildTool = Boolean(childSessionId);
  const displayBlockId = isChildTool
    ? `pi-crew-delegation:${childSessionId}`
    : piCrewAgentDisplayBlockId({ ...event, sessionId: ownerSessionId ?? event.sessionId });
  const metadata = {
    ...(event.metadata ?? {}),
    eventFamily: 'tool',
    eventType: event.eventType,
    childSessionId,
    parentSessionId,
    rootSessionId,
    toolName,
    toolCallId,
    phase,
    durationMs,
    isError: event.isError,
    resultClass: event.resultClass,
    ownerSessionId,
  };
  return buildPiCrewLifecycleActivityEvent(event, {
    agentIdentity: isChildTool ? (event.profileId ?? event.parentAgentIdentity ?? piCrewLifecycleAgentIdentity(event)) : piCrewLifecycleAgentIdentity(event),
    hermesSessionKey: ownerSessionId,
    displayBlockId,
    parentHermesSessionKey: parentSessionId ?? rootSessionId,
    parentAgentIdentity: event.parentAgentIdentity ?? piCrewLifecycleAgentIdentity(event),
    workerRunId: childSessionId,
    workerRole: childSessionId ? 'subagent' : null,
    anchorMessageId: firstPositiveInteger(sourceMessageIdFromEvidence(event.evidenceLink)),
    status: event.isError || phase === 'denied' || lifecycleEventState(event) === 'denied' ? 'tool_denied' : (phase === 'completed' || lifecycleEventState(event) === 'completed' ? 'tool_completed' : 'tool_called'),
    deliveryStage: 'progress',
    terminal: false,
    title: piCrewDelegationTitle('delegation.tool_visible', { childSessionId, toolName, phase, outcome: null, toolsUsed: null }),
    previewJson: JSON.stringify({ preview: piCrewDelegationPreview({ childSessionId, parentSessionId, rootSessionId, toolName, toolCallId, phase, outcome: firstString(event.resultClass), durationMs, toolsUsed: null }) }),
    metadata,
  });
}

function isPiAgentIdentity(agentIdentity: string): boolean {
  const normalized = agentIdentity.toLowerCase();
  return normalized.startsWith('pi-') || normalized === 'pi';
}

function isPiCrewStructuredAgentWorkEvent(event: AgentWorkLifecycleEvent): boolean {
  const source = firstString(event.source, event.metadata?.source)?.toLowerCase();
  const projectId = firstString(event.projectId)?.toLowerCase();
  const eventType = event.eventType.toLowerCase();
  const family = firstString(event.eventFamily, event.metadata?.eventFamily, event.metadata?.event_family);
  return source === 'pi-crew'
    || projectId === 'pi-crew'
    || eventType.startsWith('pi_crew.')
    || Boolean(family && (isPiAgentIdentity(piCrewLifecycleAgentIdentity(event)) || firstString(event.childSessionId, event.ownerSessionId, event.evidence?.childSessionId)));
}

function inferPiCrewEventFamily(event: AgentWorkLifecycleEvent): 'parent' | 'delegation' | 'tool' {
  const piCrewEventType = firstString(event.piCrewEventType, event.metadata?.piCrewEventType, event.metadata?.pi_crew_event_type) ?? event.eventType;
  if (piCrewEventType.includes('.tool') || firstString(event.toolName, event.toolCallId, event.metadata?.toolName, event.metadata?.toolCallId)) return 'tool';
  if (piCrewEventType.includes('.delegation.') || firstString(event.childSessionId, event.evidence?.childSessionId, event.metadata?.childSessionId)) return 'delegation';
  return 'parent';
}

function piCrewLifecycleAgentIdentity(event: AgentWorkLifecycleEvent): string {
  return firstString(
    event.agentIdentity,
    event.parentAgentIdentity,
    event.profileId,
    event.metadata?.agentIdentity,
    event.metadata?.agent_identity,
    event.metadata?.profileId,
    event.metadata?.profile_id,
    event.evidence?.agentIdentity,
  ) ?? 'pi-crew';
}

function piCrewLifecycleChannelId(event: AgentWorkLifecycleEvent): number {
  return firstPositiveInteger(event.channelId) ?? 0;
}

function piCrewLifecycleSequence(event: AgentWorkLifecycleEvent): number {
  return firstPositiveInteger(event.id) ?? stableSyntheticSequence(String(event.id));
}

function piCrewSyntheticLifecycleId(event: AgentWorkLifecycleEvent): number {
  return -1_000_000 - piCrewLifecycleSequence(event);
}

function stableSyntheticSequence(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return Math.max(1, hash % 900_000_000);
}

function piCrewAgentDisplayBlockId(event: AgentWorkLifecycleEvent): string {
  const sourceMessageId = firstString(sourceMessageIdFromEvidence(event.evidenceLink));
  const session = firstString(event.sessionId, event.evidence?.sessionId, event.workerRunId, event.deliveryRequestId, sourceMessageId);
  const agentIdentity = piCrewLifecycleAgentIdentity(event);
  return session ? `pi-crew-agent:${agentIdentity}:${session}` : `pi-crew-agent:${agentIdentity}`;
}

function piCrewStructuredStatus(event: AgentWorkLifecycleEvent, eventName: string, outcome: string | null): string {
  const state = lifecycleEventState(event);
  if (eventName.includes('spawned')) return 'spawned';
  if (eventName.includes('tool')) return state === 'completed' ? 'tool_completed' : 'tool_called';
  if (eventName.includes('turn')) return state === 'completed' ? 'turn_completed' : 'turn_started';
  if (eventName.includes('completed')) return outcome === 'failure' || outcome === 'failed' ? 'failed' : 'completed';
  return state ?? eventName.replace(/^pi_crew\./, '').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
}

function evidenceString(event: AgentWorkLifecycleEvent, key: string): string | null {
  return firstString(event.evidence?.[key], event.metadata?.[key]);
}

function sourceMessageIdFromEvidence(evidenceLink: string | null): string | null {
  return matchFirst(evidenceLink ?? '', /messages\/(\d+)/) ?? matchFirst(evidenceLink ?? '', /messageId=(\d+)/);
}

function lifecycleDeliveryStage(event: AgentWorkLifecycleEvent): string {
  return lifecycleEventIsTerminal(event) ? 'final' : 'progress';
}

function lifecycleEventIsTerminal(event: AgentWorkLifecycleEvent): boolean {
  const state = lifecycleEventState(event)?.toLowerCase();
  const type = event.eventType.toLowerCase();
  return state === 'completed' || state === 'failed' || type === 'completed' || type === 'failed';
}

function lifecycleEventState(event: AgentWorkLifecycleEvent): string | null {
  return firstString(event.state, event.status);
}

function lifecycleTitle(eventType: string): string {
  return eventType.replace(/_/g, ' ');
}

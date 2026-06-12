import type { AgentWorkLifecycleEvent, ChannelActivityEvent, ChannelMessage, GatewayMember } from '../../api/types';

export type MessageBodySegment =
  | { type: 'text'; text: string }
  | { type: 'details'; summary: string; body: string };

export interface AssignmentBadgeInfo {
  /** The delivery/assignment ID found on this message */
  assignmentId: string;
  /** Whether this message has checkpoint-related metadata */
  hasCheckpointMetadata: boolean;
  /** Whether the message source suggests it is a final/terminal delivery message */
  isFinalDelivery: boolean;
  /** Short label for the badge */
  label: string;
}

export interface DirectAgentMessageDisplay {
  primaryBody: string;
  deliverySummary: string | null;
  isDirectAgentWake: boolean;
}

const detailsPattern = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;

export function parseMessageBodySegments(body: string): MessageBodySegment[] {
  const segments: MessageBodySegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(detailsPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const text = body.slice(lastIndex, index);
      if (text.length > 0) segments.push({ type: 'text', text });
    }
    segments.push({
      type: 'details',
      summary: cleanInlineMarkdownArtifact(match[1] ?? 'Details') || 'Details',
      body: cleanDetailsBody(match[2] ?? ''),
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) {
    const text = body.slice(lastIndex);
    if (text.length > 0) segments.push({ type: 'text', text });
  }
  return segments.length > 0 ? segments : [{ type: 'text', text: body }];
}

export function directAgentMessageDisplay(
  message: Pick<ChannelMessage, 'body' | 'summary' | 'sourceKind' | 'sourceId' | 'metadataJson'>,
): DirectAgentMessageDisplay {
  const metadata = parseJsonObject(message.metadataJson);
  const isDirectAgentWake = isDirectAgentWakeMessage(message, metadata);
  const body = firstString(message.body);
  const metadataBody = firstString(
    metadata.body,
    metadata.requestBody,
    metadata.request_body,
    metadata.messageBody,
    metadata.message_body,
    metadata.humanBody,
    metadata.human_body,
    metadata.originalBody,
    metadata.original_body,
  );
  const summary = firstString(message.summary);
  const primaryBody = body ?? (isDirectAgentWake ? metadataBody : metadataBody ?? summary) ?? '';
  const deliverySummary = isDirectAgentWake ? null : summary && summary !== primaryBody ? summary : null;
  return { primaryBody, deliverySummary, isDirectAgentWake };
}

export function channelMessagePrimaryBody(
  message: Pick<ChannelMessage, 'body' | 'summary' | 'sourceKind' | 'sourceId' | 'metadataJson'>,
): string {
  return directAgentMessageDisplay(message).primaryBody;
}

function isDirectAgentWakeMessage(
  message: Pick<ChannelMessage, 'summary' | 'sourceKind' | 'sourceId'>,
  metadata: Record<string, unknown>,
): boolean {
  if (message.sourceKind !== 'wake_event') return false;
  const sourceId = firstString(message.sourceId)?.toLowerCase() ?? '';
  if (sourceId.startsWith('direct-agent-message:')) return true;
  if (metadata.deliveryMode === 'direct_agent_message' || metadata.delivery_mode === 'direct_agent_message') return true;
  return (firstString(message.summary)?.toLowerCase() ?? '').startsWith('direct agent request to ');
}

function cleanInlineMarkdownArtifact(value: string): string {
  return value.replace(/<\/?summary>/gi, '').replace(/<\/?details>/gi, '').trim();
}

function cleanDetailsBody(value: string): string {
  return value.replace(/^\n+|\n+$/g, '').replace(/<\/?summary>/gi, '').replace(/<\/?details>/gi, '').trim();
}

export interface ActivityDisplayModel {
  id: number;
  agentIdentity: string;
  displayBlockId: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  parentAgentIdentity: string | null;
  parentHermesSessionKey: string | null;
  status: string;
  deliveryStage: string;
  terminal: boolean;
  title: string;
  preview: string | null;
  count: number | null;
  taskId: number | null;
  anchorMessageId: number | null;
  finalChannelMessageId: number | null;
  childSessionId: string | null;
  parentSessionId: string | null;
  rootSessionId: string | null;
  profileId: string | null;
  toolName: string | null;
  toolCallId: string | null;
  durationMs: number | null;
  outcome: string | null;
  sourceMessageId: number | null;
  createdAt: string;
}

export function toActivityDisplayModel(event: ChannelActivityEvent): ActivityDisplayModel {
  const metadata = parseJsonObject(event.metadataJson);
  const preview = parseJsonValue(event.previewJson);
  const title = firstString(
    event.title,
    metadata.toolName,
    metadata.tool_name,
    metadata.name,
    humanizeEventType(event.eventType),
  ) ?? humanizeEventType(event.eventType);
  const count = firstNumber(metadata.count, metadata.coalescedCount, metadata.coalesced_count);
  const childSessionId = firstString(metadata.childSessionId, metadata.child_session_id);
  const parentSessionId = firstString(metadata.parentSessionId, metadata.parent_session_id);
  const rootSessionId = firstString(metadata.rootSessionId, metadata.root_session_id);
  const profileId = firstString(metadata.profileId, metadata.profile_id);
  const toolCallId = firstString(metadata.toolCallId, metadata.tool_call_id);
  const durationMs = firstAnyNumber(metadata.durationMs, metadata.duration_ms);
  return {
    id: event.id,
    agentIdentity: event.agentIdentity,
    displayBlockId: event.displayBlockId,
    workerRunId: event.workerRunId,
    workerRole: event.workerRole,
    parentAgentIdentity: event.parentAgentIdentity,
    parentHermesSessionKey: event.parentHermesSessionKey,
    status: event.status || event.eventType,
    deliveryStage: event.deliveryStage || 'progress',
    terminal: Boolean(event.terminal),
    title,
    preview: summarizePreview(preview, event.summary),
    count,
    taskId: event.taskId,
    anchorMessageId: event.anchorMessageId,
    finalChannelMessageId: event.finalChannelMessageId,
    childSessionId,
    parentSessionId,
    rootSessionId,
    profileId,
    toolName: firstString(metadata.toolName, metadata.tool_name),
    toolCallId,
    durationMs,
    outcome: firstString(metadata.outcome, metadata.result, metadata.status),
    sourceMessageId: firstPositiveInteger(metadata.sourceMessageId, metadata.source_message_id),
    createdAt: event.createdAt,
  };
}


export function piCrewAgentWorkActivityEventsFromLifecycleEvents(events: AgentWorkLifecycleEvent[]): ChannelActivityEvent[] {
  return events.flatMap(event => {
    if (!isPiAgentIdentity(event.agentIdentity)) return [];
    const sourceMessageId = firstPositiveInteger(sourceMessageIdFromEvidence(event.evidenceLink));
    return [{
      id: -1_000_000 - event.id,
      channelId: event.channelId,
      projectId: event.projectId,
      agentIdentity: event.agentIdentity,
      deliveryRequestId: null,
      hermesSessionKey: event.sessionId,
      displayBlockId: piCrewAgentDisplayBlockId(event),
      parentHermesSessionKey: null,
      parentAgentIdentity: null,
      workerRunId: event.workerRunId,
      workerRole: null,
      assignmentId: event.assignmentId,
      taskId: event.taskId,
      threadId: null,
      anchorMessageId: sourceMessageId,
      eventType: event.eventType,
      status: event.state ?? event.eventType,
      deliveryStage: lifecycleDeliveryStage(event),
      terminal: lifecycleEventIsTerminal(event),
      sequence: event.id,
      updateVersion: 1,
      title: lifecycleTitle(event.eventType),
      summary: event.summary,
      previewJson: null,
      metadataJson: JSON.stringify({
        eventType: event.eventType,
        sourceMessageId,
        evidenceLink: event.evidenceLink,
      }),
      dedupeKey: null,
      finalChannelMessageId: null,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    } satisfies ChannelActivityEvent];
  });
}

export function piCrewDelegationActivityEventsFromMessages(messages: ChannelMessage[]): ChannelActivityEvent[] {
  return messages.flatMap(message => {
    const event = piCrewDelegationActivityEventFromMessage(message) ?? piCrewDelegationSummaryActivityEventFromMessage(message);
    return event ? [event] : [];
  });
}

export function piCrewDelegationActivityEventFromMessage(message: ChannelMessage): ChannelActivityEvent | null {
  if (!isPiCrewProjectionMessage(message)) return null;
  const metadata = { ...parsePiCrewDelegationBody(message.body), ...parseJsonObject(message.metadataJson) };
  const eventName = firstString(metadata.eventName, metadata.event_name, metadata.type, metadata.eventType, metadata.event_type);
  if (!eventName?.startsWith('delegation.')) return null;

  const childSessionId = firstString(metadata.childSessionId, metadata.child_session_id);
  const parentSessionId = firstString(metadata.parentSessionId, metadata.parent_session_id);
  const rootSessionId = firstString(metadata.rootSessionId, metadata.root_session_id);
  const toolName = firstString(metadata.toolName, metadata.tool_name);
  const toolCallId = firstString(metadata.toolCallId, metadata.tool_call_id);
  const phase = firstString(metadata.phase);
  const outcome = firstString(metadata.outcome, metadata.result, metadata.status);
  const profileId = firstString(metadata.profileId, metadata.profile_id);
  const durationMs = firstAnyNumber(metadata.durationMs, metadata.duration_ms);
  const toolsUsed = firstString(
    Array.isArray(metadata.toolsUsed) ? metadata.toolsUsed.join(', ') : metadata.toolsUsed,
    Array.isArray(metadata.tools_used) ? metadata.tools_used.join(', ') : metadata.tools_used,
  );
  const displayBlockId = childSessionId ? `pi-crew-delegation:${childSessionId}` : (rootSessionId ? `pi-crew-delegation:${rootSessionId}` : `pi-crew-delegation-message:${message.id}`);
  const status = piCrewDelegationStatus(eventName, phase, outcome);
  const terminal = eventName === 'delegation.completed' || status === 'failed';
  const metadataWithSource = {
    ...metadata,
    sourceMessageId: message.id,
    childSessionId,
    parentSessionId,
    rootSessionId,
    profileId,
    toolName,
    toolCallId,
    phase,
    outcome,
    durationMs,
    toolsUsed,
  };

  return {
    id: -message.id,
    channelId: message.channelId,
    projectId: messageProjectId(message),
    agentIdentity: profileId ?? message.senderIdentity,
    deliveryRequestId: null,
    hermesSessionKey: childSessionId ?? rootSessionId,
    displayBlockId,
    parentHermesSessionKey: parentSessionId ?? rootSessionId,
    parentAgentIdentity: message.senderIdentity,
    workerRunId: childSessionId,
    workerRole: childSessionId ? 'subagent' : null,
    assignmentId: message.assignmentId,
    agentInstanceId: message.agentInstanceId,
    poolMemberId: message.poolMemberId,
    taskId: message.targetTaskId ?? null,
    threadId: message.threadRootMessageId,
    anchorMessageId: null,
    eventType: eventName,
    status,
    deliveryStage: terminal ? 'final' : 'progress',
    terminal,
    sequence: message.id,
    updateVersion: 1,
    title: piCrewDelegationTitle(eventName, { childSessionId, toolName, phase, outcome, toolsUsed }),
    summary: message.summary,
    previewJson: JSON.stringify({ preview: piCrewDelegationPreview({ childSessionId, parentSessionId, rootSessionId, toolName, toolCallId, phase, outcome, durationMs, toolsUsed }) }),
    metadataJson: JSON.stringify(metadataWithSource),
    dedupeKey: message.dedupeKey,
    finalChannelMessageId: null,
    createdAt: message.createdAt,
    updatedAt: message.editedAt ?? message.createdAt,
  };
}


export function piCrewDelegationSummaryActivityEventFromMessage(message: ChannelMessage): ChannelActivityEvent | null {
  if (!isPiCrewProjectionMessage(message)) return null;
  const body = firstString(message.body);
  if (!body || body.startsWith('**delegation.')) return null;
  const childSessionId = firstString(
    matchFirst(body, /childSessionId:\*\*\s*`([^`]+)`/i),
    matchFirst(body, /childSessionId:\s*`([^`]+)`/i),
    matchFirst(body, /Delegated child session:\*\*\s*`([^`]+)`/i),
    matchFirst(body, /Delegated child used:\s*`([^`]+)`/i),
    matchFirst(body, /Delegated child:\s*`([^`]+)`/i),
    matchFirst(body, /Delegated child[^`\n]*`([^`]+)`/i),
  );
  if (!childSessionId) return null;
  const outcome = firstString(
    matchFirst(body, /outcome:\*\*\s*`?([A-Za-z0-9_.-]+)`?/i),
    matchFirst(body, /Child outcome[^\n:]*:\s*`?([A-Za-z0-9_.-]+)`?/i),
  );
  const toolsUsed = parseToolsUsedFromPiCrewSummary(body);
  const metadataWithSource = {
    eventName: 'delegation.completed',
    sourceMessageId: message.id,
    childSessionId,
    profileId: message.senderIdentity,
    outcome,
    toolsUsed,
  };
  return {
    id: -message.id,
    channelId: message.channelId,
    projectId: messageProjectId(message),
    agentIdentity: message.senderIdentity,
    deliveryRequestId: null,
    hermesSessionKey: childSessionId,
    displayBlockId: `pi-crew-delegation:${childSessionId}`,
    parentHermesSessionKey: null,
    parentAgentIdentity: message.senderIdentity,
    workerRunId: childSessionId,
    workerRole: 'subagent',
    assignmentId: message.assignmentId,
    agentInstanceId: message.agentInstanceId,
    poolMemberId: message.poolMemberId,
    taskId: message.targetTaskId ?? null,
    threadId: message.threadRootMessageId,
    anchorMessageId: null,
    eventType: 'delegation.completed',
    status: outcome === 'failed' ? 'failed' : 'completed',
    deliveryStage: 'final',
    terminal: true,
    sequence: message.id,
    updateVersion: 1,
    title: `Subagent result · ${childSessionId}`,
    summary: message.summary,
    previewJson: JSON.stringify({ preview: piCrewDelegationPreview({ childSessionId, parentSessionId: null, rootSessionId: null, toolName: null, toolCallId: null, phase: null, outcome, durationMs: null, toolsUsed }) }),
    metadataJson: JSON.stringify(metadataWithSource),
    dedupeKey: message.dedupeKey,
    finalChannelMessageId: null,
    createdAt: message.createdAt,
    updatedAt: message.editedAt ?? message.createdAt,
  };
}

export function sortActivityEvents(events: ChannelActivityEvent[]): ChannelActivityEvent[] {
  return [...events].sort((left, right) => {
    const createdAtDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (createdAtDiff !== 0 && Number.isFinite(createdAtDiff)) return createdAtDiff;
    if (left.workerRunId && left.workerRunId === right.workerRunId && left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    return left.id - right.id;
  });
}

export interface ActivityDisplayBlock {
  displayBlockId: string;
  events: ChannelActivityEvent[];
}

export interface GroupedChannelActivityEvents {
  byMessageId: Map<number, ChannelActivityEvent[]>;
  displayBlocks: ActivityDisplayBlock[];
  unanchoredEvents: ChannelActivityEvent[];
}

export function groupActivityEventsForChannelMessages(
  messages: ChannelMessage[],
  events: ChannelActivityEvent[],
): GroupedChannelActivityEvents {
  const byMessageId = new Map<number, ChannelActivityEvent[]>();
  const interimBlocksById = new Map<string, ChannelActivityEvent[]>();
  const unanchoredEvents: ChannelActivityEvent[] = [];

  for (const event of events) {
    const forcedDisplayBlockId = standalonePiCrewActivityDisplayBlockId(event);
    if (forcedDisplayBlockId) {
      const current = interimBlocksById.get(forcedDisplayBlockId) ?? [];
      current.push(event);
      interimBlocksById.set(forcedDisplayBlockId, current);
      continue;
    }

    const message = messages.find(candidate => activityMatchesChannelMessage(event, candidate));
    if (message) {
      const current = byMessageId.get(message.id) ?? [];
      current.push(event);
      byMessageId.set(message.id, current);
      continue;
    }

    if (event.displayBlockId) {
      const current = interimBlocksById.get(event.displayBlockId) ?? [];
      current.push(event);
      interimBlocksById.set(event.displayBlockId, current);
      continue;
    }

    unanchoredEvents.push(event);
  }

  for (const [messageId, messageEvents] of byMessageId.entries()) {
    byMessageId.set(messageId, sortActivityEvents(messageEvents));
  }

  return {
    byMessageId,
    displayBlocks: [...interimBlocksById.entries()]
      .map(([displayBlockId, blockEvents]) => ({ displayBlockId, events: sortActivityEvents(blockEvents) }))
      .sort((left, right) => compareActivityEventArrays(left.events, right.events) || left.displayBlockId.localeCompare(right.displayBlockId)),
    unanchoredEvents: sortActivityEvents(unanchoredEvents),
  };
}

export function activityMatchesChannelMessage(event: ChannelActivityEvent, message: ChannelMessage): boolean {
  if (event.anchorMessageId === message.id) return true;
  if (activityFinalChannelMessageId(event) === message.id) return true;

  const messageDeliveryRequestId = channelMessageDeliveryRequestId(message);
  if (!messageDeliveryRequestId) return false;

  return event.deliveryRequestId === messageDeliveryRequestId || event.displayBlockId === messageDeliveryRequestId;
}

export function channelMessageDeliveryRequestId(
  message: Pick<ChannelMessage, 'metadataJson' | 'sourceKind' | 'sourceId' | 'dedupeKey'> & Partial<Pick<ChannelMessage, 'deliveryRequestId'>>,
): string | null {
  const firstClass = firstString(message.deliveryRequestId);
  if (firstClass) return firstClass;

  const metadata = parseJsonObject(message.metadataJson);
  const metadataDeliveryRequestId = firstIdentifier(
    metadata.deliveryRequestId,
    metadata.delivery_request_id,
    metadata.channelMessageDeliveryRequestId,
    metadata.channel_message_delivery_request_id,
    metadata.deliveryId,
    metadata.delivery_id,
    metadata.requestId,
    metadata.request_id,
  );
  if (metadataDeliveryRequestId) return metadataDeliveryRequestId;

  const dedupeKey = firstString(message.dedupeKey);
  const dedupeDeliveryRequestId = dedupeKey ? legacyDeliveryRequestIdFromDedupeKey(dedupeKey) : null;
  if (dedupeDeliveryRequestId) return dedupeDeliveryRequestId;

  if (message.sourceKind === 'gateway_delivery' || message.sourceKind === 'external_adapter_message') {
    const sourceId = firstString(message.sourceId);
    if (sourceId) return sourceId;
  }

  return null;
}

export interface MentionSuggestion {
  identity: string;
  label: string;
  memberType: string;
  membershipStatus: string;
  wakePolicy: string;
}

export interface MentionQuery {
  start: number;
  end: number;
  query: string;
}

export function findActiveMentionQuery(draft: string, cursorPosition = draft.length): MentionQuery | null {
  const prefix = draft.slice(0, cursorPosition);
  const match = /(^|\s)@([A-Za-z0-9_.-]*)$/.exec(prefix);
  if (!match || match.index == null) return null;
  const start = match.index + match[1].length;
  return { start, end: cursorPosition, query: match[2] ?? '' };
}

export function getMentionSuggestions(members: GatewayMember[], query: string, limit = 8): MentionSuggestion[] {
  const normalized = query.trim().toLowerCase();
  return members
    .filter(member => member.membershipStatus === 'active')
    .filter(member => normalized.length === 0 || member.memberIdentity.toLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftAgent = left.memberType === 'agent' ? 0 : 1;
      const rightAgent = right.memberType === 'agent' ? 0 : 1;
      return leftAgent - rightAgent || left.memberIdentity.localeCompare(right.memberIdentity);
    })
    .slice(0, limit)
    .map(member => ({
      identity: member.memberIdentity,
      label: `@${member.memberIdentity} · ${member.memberType} · ${member.membershipStatus} · ${member.wakePolicy}`,
      memberType: member.memberType,
      membershipStatus: member.membershipStatus,
      wakePolicy: member.wakePolicy,
    }));
}

export function insertMentionToken(draft: string, mention: MentionQuery, identity: string): string {
  const before = draft.slice(0, mention.start);
  const after = draft.slice(mention.end);
  const spacer = after.startsWith(' ') || after.length === 0 ? '' : ' ';
  return `${before}@${identity} ${spacer}${after}`;
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

function parseJsonValue(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


function parsePiCrewDelegationBody(body: string | null | undefined): Record<string, unknown> {
  const text = firstString(body);
  if (!text) return {};
  const eventMatch = /^\*\*(delegation\.[^*]+)\*\*/.exec(text.trim());
  if (!eventMatch?.[1]) return {};
  const parsed: Record<string, unknown> = { eventName: eventMatch[1] };
  for (const line of text.split(/\r?\n/)) {
    const match = /^-\s*([A-Za-z0-9_]+):\s*(.+?)\s*$/.exec(line.trim());
    if (!match?.[1] || match[2] === undefined) continue;
    parsed[match[1]] = parsePiCrewBodyValue(match[2]);
  }
  return parsed;
}

function parsePiCrewBodyValue(raw: string): unknown {
  const unwrapped = raw.trim().replace(/^`|`$/g, '').trim();
  if (/^-?\d+(?:\.\d+)?$/.test(unwrapped)) return Number(unwrapped);
  if (unwrapped === 'true') return true;
  if (unwrapped === 'false') return false;
  return unwrapped;
}

function isPiCrewProjectionMessage(message: Pick<ChannelMessage, 'senderIdentity' | 'sourceProjectId'>): boolean {
  const senderIdentity = message.senderIdentity.toLowerCase();
  return senderIdentity.startsWith('pi-') || message.sourceProjectId === 'pi-crew';
}

function isPiAgentIdentity(agentIdentity: string): boolean {
  const normalized = agentIdentity.toLowerCase();
  return normalized.startsWith('pi-') || normalized === 'pi';
}

function piCrewAgentDisplayBlockId(event: AgentWorkLifecycleEvent): string {
  const sourceMessageId = firstString(sourceMessageIdFromEvidence(event.evidenceLink));
  const session = firstString(event.sessionId, event.workerRunId, event.deliveryRequestId, sourceMessageId);
  return session ? `pi-crew-agent:${event.agentIdentity}:${session}` : `pi-crew-agent:${event.agentIdentity}`;
}

function sourceMessageIdFromEvidence(evidenceLink: string | null): string | null {
  return matchFirst(evidenceLink ?? '', /messages\/(\d+)/) ?? matchFirst(evidenceLink ?? '', /messageId=(\d+)/);
}

function lifecycleDeliveryStage(event: AgentWorkLifecycleEvent): string {
  return lifecycleEventIsTerminal(event) ? 'final' : 'progress';
}

function lifecycleEventIsTerminal(event: AgentWorkLifecycleEvent): boolean {
  const state = event.state?.toLowerCase();
  const type = event.eventType.toLowerCase();
  return state === 'completed' || state === 'failed' || type === 'completed' || type === 'failed';
}

function lifecycleTitle(eventType: string): string {
  return eventType.replace(/_/g, ' ');
}

function matchFirst(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1]?.trim() ?? null;
}

function parseToolsUsedFromPiCrewSummary(body: string): string | null {
  const inline = matchFirst(body, /toolsUsed:\*\*\s*`([^`]+)`/i) ?? matchFirst(body, /toolsUsed:\s*`([^`]+)`/i);
  if (inline) return inline;
  const tools: string[] = [];
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/tools\s*used|toolsUsed/i.test(lines[index])) continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (/^\s*$/.test(line)) break;
      const tool = matchFirst(line, /^\s*-\s*`([^`]+)`/) ?? matchFirst(line, /^\s*-\s*([A-Za-z0-9_.:-]+)/);
      if (tool) tools.push(tool);
      else if (!/^\s*-/.test(line)) break;
    }
    if (tools.length > 0) break;
  }
  return tools.length > 0 ? tools.join(', ') : null;
}

function standalonePiCrewActivityDisplayBlockId(event: ChannelActivityEvent): string | null {
  if (event.displayBlockId?.startsWith('pi-crew-')) return event.displayBlockId;
  const agentIdentity = event.agentIdentity.toLowerCase();
  if (!(agentIdentity.startsWith('pi-') || agentIdentity === 'pi')) return null;
  const metadata = parseJsonObject(event.metadataJson);
  const session = firstString(
    metadata.childSessionId,
    metadata.child_session_id,
    event.workerRunId,
    event.hermesSessionKey,
    event.deliveryRequestId,
  );
  return session ? `pi-crew-agent:${event.agentIdentity}:${session}` : `pi-crew-agent:${event.agentIdentity}`;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function firstIdentifier(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 1) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 1) return parsed;
    }
  }
  return null;
}

function firstAnyNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function firstPositiveInteger(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

function summarizePreview(preview: unknown, fallback: string | null): string | null {
  const direct = firstString(
    typeof preview === 'string' ? preview : null,
    preview && typeof preview === 'object' && !Array.isArray(preview) ? (preview as Record<string, unknown>).preview : null,
    preview && typeof preview === 'object' && !Array.isArray(preview) ? (preview as Record<string, unknown>).command : null,
    preview && typeof preview === 'object' && !Array.isArray(preview) ? (preview as Record<string, unknown>).result : null,
    fallback,
  );
  if (direct) return truncate(direct);
  if (preview && typeof preview === 'object') return truncate(JSON.stringify(preview));
  return null;
}

function truncate(value: string, max = 180): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > max ? `${singleLine.slice(0, max - 1)}…` : singleLine;
}

function humanizeEventType(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function activityFinalChannelMessageId(event: ChannelActivityEvent): number | null {
  const metadata = parseJsonObject(event.metadataJson);
  return firstPositiveInteger(event.finalChannelMessageId, metadata.finalChannelMessageId, metadata.final_channel_message_id);
}

function messageProjectId(message: ChannelMessage): string | null {
  return message.targetProjectId ?? message.sourceProjectId ?? null;
}

function piCrewDelegationStatus(eventName: string, phase: string | null, outcome: string | null): string {
  if (eventName === 'delegation.spawned') return 'spawned';
  if (eventName === 'delegation.completed') return outcome === 'failure' || outcome === 'failed' ? 'failed' : 'completed';
  if (eventName === 'delegation.tool_visible') return phase === 'completed' ? 'tool_completed' : 'tool_called';
  if (eventName === 'delegation.turn_visible') return phase === 'completed' ? 'turn_completed' : 'turn_started';
  return eventName.replace(/^delegation\./, '').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
}

function piCrewDelegationTitle(eventName: string, details: { childSessionId: string | null; toolName: string | null; phase: string | null; outcome: string | null; toolsUsed: string | null }): string {
  if (eventName === 'delegation.spawned') return `Subagent spawned${details.childSessionId ? ` · ${details.childSessionId}` : ''}`;
  if (eventName === 'delegation.completed') return `Subagent completed${details.outcome ? ` · ${details.outcome}` : ''}`;
  if (eventName === 'delegation.tool_visible') return `Tool ${details.phase === 'completed' ? 'completed' : 'called'}${details.toolName ? ` · ${details.toolName}` : ''}`;
  if (eventName === 'delegation.turn_visible') return `Subagent turn ${details.phase === 'completed' ? 'completed' : 'started'}`;
  if (details.toolsUsed) return `Parent result · ${details.toolsUsed}`;
  return humanizeEventType(eventName);
}

function piCrewDelegationPreview(details: { childSessionId: string | null; parentSessionId: string | null; rootSessionId: string | null; toolName: string | null; toolCallId: string | null; phase: string | null; outcome: string | null; durationMs: number | null; toolsUsed: string | null }): string {
  return [
    details.childSessionId ? `child ${details.childSessionId}` : null,
    details.parentSessionId ? `parent ${details.parentSessionId}` : null,
    details.rootSessionId ? `root ${details.rootSessionId}` : null,
    details.toolName ? `tool ${details.toolName}` : null,
    details.toolCallId ? `call ${details.toolCallId}` : null,
    details.phase ? `phase ${details.phase}` : null,
    details.durationMs !== null ? `${details.durationMs}ms` : null,
    details.outcome ? `outcome ${details.outcome}` : null,
    details.toolsUsed ? `tools used ${details.toolsUsed}` : null,
  ].filter(Boolean).join(' · ');
}

function legacyDeliveryRequestIdFromDedupeKey(dedupeKey: string): string | null {
  const gatewayDelivery = /^gateway-delivery:(.+):final$/i.exec(dedupeKey);
  if (gatewayDelivery?.[1]) return gatewayDelivery[1];
  const named = /(?:^|[:|;,\s])(?:deliveryRequestId|delivery_request_id|channelMessageDeliveryRequestId|channel_message_delivery_request_id)=([^:|;,\s]+)/i.exec(dedupeKey);
  return named?.[1] ?? null;
}

function compareActivityEventArrays(left: ChannelActivityEvent[], right: ChannelActivityEvent[]): number {
  const leftFirst = left[0];
  const rightFirst = right[0];
  if (!leftFirst || !rightFirst) return left.length - right.length;
  const sorted = sortActivityEvents([leftFirst, rightFirst]);
  return sorted[0] === leftFirst ? -1 : 1;
}

// =============================================================================
// Assignment/checkpoint badge helpers (task #1729)
// =============================================================================

/**
 * Check whether a message's metadataJson contains checkpoint-related keys.
 */
export function messageHasCheckpointMetadata(
  message: Pick<ChannelMessage, 'metadataJson'>,
): boolean {
  const metadata = parseJsonObject(message.metadataJson);
  return (
    metadata.checkpoint !== undefined ||
    metadata.checkpoint_id !== undefined ||
    metadata.checkpoint_request !== undefined ||
    metadata.checkpoint_response !== undefined ||
    metadata.checkpoint_sequence !== undefined ||
    metadata.checkpoint_status !== undefined ||
    metadata.assignment_checkpoint !== undefined
  );
}

/**
 * Derive an assignment badge from a channel message.
 * Returns null if no assignment/delivery ID can be found.
 */
export function deriveAssignmentBadge(
  message: Pick<ChannelMessage, 'deliveryRequestId' | 'sourceKind' | 'sourceId' | 'dedupeKey' | 'metadataJson'>,
): AssignmentBadgeInfo | null {
  const assignmentId = channelMessageDeliveryRequestId(message);
  if (!assignmentId) return null;

  const hasCheckpoint = messageHasCheckpointMetadata(message);

  const isFinalDelivery =
    message.sourceKind === 'gateway_delivery' &&
    (message.dedupeKey?.includes(':final') ?? false);

  const label = isFinalDelivery
    ? 'final'
    : hasCheckpoint
      ? 'checkpoint'
      : 'delivery';

  return { assignmentId, hasCheckpointMetadata: hasCheckpoint, isFinalDelivery, label };
}

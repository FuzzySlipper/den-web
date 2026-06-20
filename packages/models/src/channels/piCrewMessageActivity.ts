
import type { ChannelActivityEvent, ChannelMessage } from '@den-web/api/types';
import { firstAnyNumber, firstString, humanizeEventType, matchFirst, parseJsonObject } from './activityUtils';

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
    matchFirst(body, /Delegated child:\s*`(delegated-session-[^`]+)`/i),
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

function parseToolsUsedFromPiCrewSummary(body: string): string | null {
  const inline = matchFirst(body, /toolsUsed:\*\*\s*`([^`]+)`/i) ?? matchFirst(body, /toolsUsed:\s*`([^`]+)`/i);
  if (inline) return inline;
  const lines = body.split(/\r?\n/);
  let tools: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/tools\s*used|toolsUsed/i.test(lines[index])) continue;
    tools = parseToolList(lines, index + 1);
    if (tools.length > 0) break;
  }
  return tools.length > 0 ? tools.join(', ') : null;
}

function parseToolList(lines: string[], startIndex: number): string[] {
  const tools: string[] = [];
  for (let cursor = startIndex; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (/^\s*$/.test(line)) break;
    const tool = matchFirst(line, /^\s*-\s*`([^`]+)`/) ?? matchFirst(line, /^\s*-\s*([A-Za-z0-9_.:-]+)/);
    if (tool) tools.push(tool);
    else if (!/^\s*-/.test(line)) break;
  }
  return tools;
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

export function piCrewDelegationTitle(eventName: string, details: { childSessionId: string | null; toolName: string | null; phase: string | null; outcome: string | null; toolsUsed: string | null }): string {
  if (eventName === 'delegation.spawned') return `Subagent spawned${details.childSessionId ? ` · ${details.childSessionId}` : ''}`;
  if (eventName === 'delegation.completed') return `Subagent completed${details.outcome ? ` · ${details.outcome}` : ''}`;
  if (eventName === 'delegation.tool_visible') return `Tool ${details.phase === 'completed' ? 'completed' : 'called'}${details.toolName ? ` · ${details.toolName}` : ''}`;
  if (eventName === 'delegation.turn_visible') return `Subagent turn ${details.phase === 'completed' ? 'completed' : 'started'}`;
  if (details.toolsUsed) return `Parent result · ${details.toolsUsed}`;
  return humanizeEventType(eventName);
}

export function piCrewDelegationPreview(details: { childSessionId: string | null; parentSessionId: string | null; rootSessionId: string | null; toolName: string | null; toolCallId: string | null; phase: string | null; outcome: string | null; durationMs: number | null; toolsUsed: string | null }): string {
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

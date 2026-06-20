
import type { ChannelActivityEvent, ChannelMessage } from '@den-web/api/types';
import { firstString, parseJsonObject } from './activityUtils';
import { activityFinalChannelMessageId, channelMessageDeliveryRequestId } from './deliveryRequests';

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

function compareActivityEventArrays(left: ChannelActivityEvent[], right: ChannelActivityEvent[]): number {
  const leftFirst = left[0];
  const rightFirst = right[0];
  if (!leftFirst || !rightFirst) return left.length - right.length;
  const sorted = sortActivityEvents([leftFirst, rightFirst]);
  return sorted[0] === leftFirst ? -1 : 1;
}

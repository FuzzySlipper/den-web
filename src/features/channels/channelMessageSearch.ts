import type { ChannelMessage } from '../../api/types';

function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

export function channelMessageSearchHaystack(message: ChannelMessage): string {
  return [
    message.id,
    message.senderType,
    message.senderIdentity,
    message.body,
    message.summary,
    message.messageKind,
    message.sourceKind,
    message.sourceId,
    message.sourceProjectId,
    message.targetProjectId,
    message.targetTaskId,
    message.assignmentId,
    message.workerRunId,
    message.workerRole,
    message.profileIdentity,
    message.agentInstanceId,
    message.poolMemberId,
    message.sessionOwnerId,
    message.sessionId,
    message.deliveryRequestId,
    message.dedupeKey,
    message.deepLink,
    message.metadataJson,
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(' ');
}

export function filterLoadedChannelMessages(messages: ChannelMessage[], query: string): ChannelMessage[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return messages;

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return messages;

  return messages.filter(message => {
    const haystack = channelMessageSearchHaystack(message);
    return terms.every(term => haystack.includes(term));
  });
}

import type { DenChannelMessage, DenConversationChannel, DenConversationMembership, DenTimelineItem, DenTimelineResponse } from '@den-web/protocol';
import { extractArtifactReferences, type ArtifactReference } from './artifacts';

export type MessageBodySegment =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'details'; readonly summary: string; readonly body: string };

export interface TimelineItemView {
  readonly id: string;
  readonly cursor: string | null;
  readonly sourceDomain: string | null;
  readonly sourceId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly createdAt: string | null;
  readonly body: string;
  readonly sender: string;
  readonly artifactRefs: readonly ArtifactReference[];
}

export type ConversationFeedItem =
  | {
      readonly id: string;
      readonly source: 'message';
      readonly kind: string;
      readonly sender: string;
      readonly body: string;
      readonly createdAt: string | null;
      readonly artifactRefs: readonly ArtifactReference[];
    }
  | {
      readonly id: string;
      readonly source: 'timeline';
      readonly kind: string;
      readonly sender: string;
      readonly body: string;
      readonly createdAt: string | null;
      readonly artifactRefs: readonly ArtifactReference[];
    };

const detailsPattern = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;

export function conversationChannelLabel(channel: DenConversationChannel | null | undefined, fallback = '#select-project'): string {
  if (!channel) return fallback;
  const slug = channel.slug ?? channel.name;
  return slug ? `#${slug}` : `#channel-${channel.id}`;
}

export function messageSender(message: DenChannelMessage): string {
  return message.sender_identity ?? message.sender ?? message.sender_type ?? 'unknown';
}

export function channelMessagePrimaryBody(message: DenChannelMessage): string {
  return message.body || stringMetadata(message, 'request_body') || message.summary || '';
}

export function channelMessageKind(message: DenChannelMessage): string {
  return stringMetadata(message, 'message_kind') || stringMetadata(message, 'source_kind') || 'message';
}

export function conversationFeedItems(
  messages: readonly DenChannelMessage[],
  timeline: readonly TimelineItemView[],
): readonly ConversationFeedItem[] {
  const timelineMessageIds = new Set(
    timeline
      .filter((item) => item.sourceDomain === 'conversation' && item.sourceId !== null)
      .map((item) => item.sourceId),
  );
  return [
    ...messages.filter((message) => !timelineMessageIds.has(String(message.id))).map((message) => ({
      id: `message:${message.id}`,
      source: 'message' as const,
      kind: channelMessageKind(message),
      sender: messageSender(message),
      body: channelMessagePrimaryBody(message),
      createdAt: message.created_at ?? null,
      artifactRefs: extractArtifactReferences(message.metadata),
    })),
    ...timeline.map((item) => ({
      id: `timeline:${item.id}`,
      source: 'timeline' as const,
      kind: item.kind,
      sender: item.sender,
      body: item.body || item.title,
      createdAt: item.createdAt,
      artifactRefs: item.artifactRefs,
    })),
  ].sort(compareFeedItems);
}

export function membershipIdentity(member: DenConversationMembership): string {
  return member.member_identity ?? member.memberIdentity ?? 'unknown';
}

export function membershipType(member: DenConversationMembership): string {
  return member.member_type ?? member.memberType ?? 'member';
}

export function membershipStatus(member: DenConversationMembership): string {
  return member.membership_status ?? member.membershipStatus ?? 'active';
}

export function membershipWakePolicy(member: DenConversationMembership): string {
  return member.wake_policy ?? member.wakePolicy ?? 'normal';
}

export function parseMessageBodySegments(body: string): readonly MessageBodySegment[] {
  const segments: MessageBodySegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(detailsPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: 'text', text: body.slice(lastIndex, index) });
    segments.push({
      type: 'details',
      summary: cleanDetailText(match[1] ?? 'Details') || 'Details',
      body: cleanDetailText(match[2] ?? ''),
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ type: 'text', text: body.slice(lastIndex) });
  return segments.length > 0 ? segments : [{ type: 'text', text: body }];
}

export function timelineItems(response: DenTimelineResponse): readonly TimelineItemView[] {
  return (response.items ?? []).map(timelineItemView);
}

export function timelineItemView(item: DenTimelineItem, index = 0): TimelineItemView {
  const record = asRecord(item);
  const payload = asRecord(record['payload']);
  const actor = asRecord(record['actor']);
  const sourceDomain = stringValue(record['source_domain'] ?? record['sourceDomain']);
  const sourceId = stringValue(record['source_id'] ?? record['sourceId']);
  return {
    id: String(record['timeline_id'] ?? record['timelineId'] ?? record['id'] ?? index),
    cursor: stringValue(record['cursor']),
    sourceDomain,
    sourceId,
    kind: stringValue(record['event_kind'] ?? record['eventKind'] ?? record['kind'] ?? record['type'] ?? payload['kind'] ?? payload['type']) ?? 'event',
    title: stringValue(record['title'] ?? record['summary'] ?? payload['title'] ?? payload['summary'] ?? record['body'] ?? payload['body']) ?? 'Untitled event',
    body: stringValue(record['body'] ?? payload['body'] ?? record['summary'] ?? payload['summary'] ?? record['title'] ?? payload['title']) ?? '',
    sender: stringValue(
      actor['identity']
        ?? record['sender_identity']
        ?? record['sender']
        ?? record['agent_identity']
        ?? payload['sender_identity']
        ?? payload['sender']
        ?? payload['agent_identity']
        ?? record['source'],
    ) ?? 'unknown',
    createdAt: stringValue(record['occurred_at'] ?? record['occurredAt'] ?? record['created_at'] ?? record['createdAt']),
    artifactRefs: extractArtifactReferences(record),
  };
}

function compareFeedItems(left: ConversationFeedItem, right: ConversationFeedItem): number {
  const leftTime = feedTimestamp(left.createdAt);
  const rightTime = feedTimestamp(right.createdAt);
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id.localeCompare(right.id);
}

function feedTimestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function stringMetadata(message: DenChannelMessage, key: string): string | null {
  const value = message.metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function cleanDetailText(value: string): string {
  return value.replace(/<\/?summary>/gi, '').replace(/<\/?details>/gi, '').trim();
}

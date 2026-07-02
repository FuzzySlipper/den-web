import type { DenChannelMessage, DenConversationChannel, DenTimelineResponse } from '@den-web/protocol';

export type MessageBodySegment =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'details'; readonly summary: string; readonly body: string };

export interface TimelineItemView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly createdAt: string | null;
}

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
  return (response.items ?? []).map((item, index) => {
    const record = asRecord(item);
    return {
      id: String(record['id'] ?? index),
      kind: String(record['kind'] ?? record['type'] ?? 'event'),
      title: String(record['title'] ?? record['summary'] ?? record['body'] ?? 'Untitled event'),
      createdAt: typeof record['created_at'] === 'string' ? record['created_at'] : null,
    };
  });
}

function stringMetadata(message: DenChannelMessage, key: string): string | null {
  const value = message.metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

function cleanDetailText(value: string): string {
  return value.replace(/<\/?summary>/gi, '').replace(/<\/?details>/gi, '').trim();
}

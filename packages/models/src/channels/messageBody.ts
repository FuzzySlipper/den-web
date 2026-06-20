
import type { ChannelMessage } from '@den-web/api/types';
import { firstString, parseJsonObject } from './activityUtils';

export type MessageBodySegment =
  | { type: 'text'; text: string }
  | { type: 'details'; summary: string; body: string };

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

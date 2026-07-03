import type { DenMessage } from '@den-web/protocol';
import { extractArtifactReferences, type ArtifactReference } from './artifacts';

export const MESSAGE_INTENT_LABELS: Readonly<Record<string, string>> = {
  answer: 'Answer',
  general: 'General',
  handoff: 'Handoff',
  note: 'Note',
  notification: 'Notification',
  question: 'Question',
  review_approval: 'Approved',
  review_feedback: 'Feedback',
  review_request: 'Review',
  status_update: 'Status',
  task_blocked: 'Blocked',
  task_ready: 'Ready',
};

export interface MessageViewItem {
  readonly id: number;
  readonly sender: string;
  readonly body: string;
  readonly intentLabel: string;
  readonly createdAt: string;
  readonly artifactRefs: readonly ArtifactReference[];
}

export function messageIntentLabel(intent: string | null | undefined): string {
  if (!intent) return 'General';
  return MESSAGE_INTENT_LABELS[intent] ?? titleCase(intent.replace(/_/g, ' '));
}

export function messageViewItem(message: DenMessage): MessageViewItem {
  return {
    id: message.id,
    sender: message.sender || 'unknown',
    body: message.content || message.summary || '',
    intentLabel: messageIntentLabel(message.intent),
    createdAt: message.created_at ?? '',
    artifactRefs: extractArtifactReferences(message.metadata),
  };
}

export function sortMessagesChronologically(messages: readonly DenMessage[]): readonly DenMessage[] {
  return [...messages].sort((left, right) => Date.parse(left.created_at ?? '') - Date.parse(right.created_at ?? '') || left.id - right.id);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

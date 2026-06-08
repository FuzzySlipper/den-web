import type {
  DirectConversation,
  DirectConversationEntry,
  DmDirection,
} from '../../api/channels/types';

/** Stable human identity for the DM viewer. */
export const DM_HUMAN_IDENTITY = 'patch';

/**
 * Derive the direction label for display in the transcript.
 * human_to_agent → sent, agent_to_human → received
 */
export function dmDirectionLabel(direction: DmDirection): 'sent' | 'received' | 'system' {
  switch (direction) {
    case 'human_to_agent': return 'sent';
    case 'agent_to_human': return 'received';
    case 'system_note': return 'system';
  }
}

/**
 * Build source badge text from an entry's source fields.
 * Shows the most specific attribution: project+task, or project, or channel.
 */
export function dmSourceBadge(entry: DirectConversationEntry): string | null {
  const parts: string[] = [];
  if (entry.sourceProjectId) {
    if (entry.sourceTaskId != null) {
      parts.push(`${entry.sourceProjectId}#${entry.sourceTaskId}`);
    } else {
      parts.push(entry.sourceProjectId);
    }
  }
  if (entry.sourceChannelId != null) parts.push(`ch:${entry.sourceChannelId}`);
  if (entry.channelMessageId != null) parts.push(`msg:${entry.channelMessageId}`);
  if (entry.sourceWorkerRunId) parts.push(`run:${entry.sourceWorkerRunId}`);
  if (entry.sourceSessionOwnerId) parts.push(`session:${entry.sourceSessionOwnerId}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Sort conversations by lastEntryAt descending, then id descending.
 */
export function sortConversationsByRecent(convs: DirectConversation[]): DirectConversation[] {
  return [...convs].sort((a, b) => {
    const aTime = a.lastEntryAt ? new Date(a.lastEntryAt).getTime() : new Date(a.createdAt).getTime();
    const bTime = b.lastEntryAt ? new Date(b.lastEntryAt).getTime() : new Date(b.createdAt).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return b.id - a.id;
  });
}

/**
 * Safe truncated preview text.
 */
export function dmPreviewText(entry: DirectConversationEntry, maxLen = 80): string {
  const text = entry.bodyPreview ?? '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

/**
 * Conversation-level project fields are attribution only. DM conversations are
 * global human↔agent transcripts, not separate per-project sessions.
 */
export function dmConversationSourceLabel(conversation: DirectConversation): string | null {
  return conversation.scopeProjectId ? `source: ${conversation.scopeProjectId}` : null;
}

/**
 * Header meta copy that makes global scope explicit while preserving origin.
 */
export function dmConversationHeaderMeta(conversation: DirectConversation): string {
  const sourceLabel = dmConversationSourceLabel(conversation);
  return sourceLabel ? `global DM · ${sourceLabel}` : 'global DM';
}

/**
 * Live direct-conversation entries are paged newest-first; render oldest→newest.
 */
export function sortEntriesChronological(entries: DirectConversationEntry[]): DirectConversationEntry[] {
  return [...entries].sort((a, b) => a.id - b.id);
}

/**
 * Highest entry id is the newest read-cursor position regardless of render order.
 */
export function latestEntryId(entries: DirectConversationEntry[]): number | null {
  return entries.reduce<number | null>((max, entry) => (max == null || entry.id > max ? entry.id : max), null);
}

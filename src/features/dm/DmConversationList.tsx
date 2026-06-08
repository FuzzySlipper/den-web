import { useCallback, useEffect, useState } from 'react';
import type { DirectConversation } from '../../api/channels/types';
import {
  listDirectConversations,
  createDirectConversation,
} from '../../api/channels/client';
import {
  DM_HUMAN_IDENTITY,
  dmConversationSourceLabel,
  sortConversationsByRecent,
} from './dmTranscriptModel';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo } from '../../utils';

interface Props {
  /** Called when the user selects a conversation to open the transcript. */
  onSelectConversation: (conversation: DirectConversation) => void;
  /** Currently selected conversation id, if any. */
  selectedId?: number | null;
  /** Optional agent identity to auto-create a conversation for on open. */
  initialAgentIdentity?: string | null;
  /** Optional project scope used when auto-creating a conversation and sending messages. */
  scopeProjectId?: string | null;
}

export function DmConversationList({ onSelectConversation, selectedId, initialAgentIdentity, scopeProjectId }: Props) {
  const fetchConversations = useCallback(
    () => listDirectConversations({ humanIdentity: DM_HUMAN_IDENTITY, limit: 50 }),
    [],
  );
  const { data: conversations, loading, error, refresh } = usePolling<DirectConversation[]>(
    fetchConversations,
    10000,
  );

  const [creating, setCreating] = useState(false);

  // Auto-create conversation for initial agent identity
  useEffect(() => {
    if (!initialAgentIdentity) return;
    let cancelled = false;
    async function ensure() {
      setCreating(true);
      try {
        const conv = await createDirectConversation({
          humanIdentity: DM_HUMAN_IDENTITY,
          agentIdentity: initialAgentIdentity!,
          scopeProjectId: scopeProjectId ?? undefined,
        });
        if (!cancelled) {
          onSelectConversation(conv);
          refresh();
        }
      } catch {
        // ignore — conversation may not exist if backend unavailable
      } finally {
        if (!cancelled) setCreating(false);
      }
    }
    ensure();
    return () => { cancelled = true; };
  }, [initialAgentIdentity, scopeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = conversations ? sortConversationsByRecent(conversations) : [];

  return (
    <div className="dm-conversation-list">
      <div className="dm-conversation-list-header">
        <h3>Direct Messages</h3>
        <button className="dm-refresh-button" onClick={refresh} disabled={loading || creating}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      {loading && sorted.length === 0 && (
        <div className="dm-loading">Loading conversations…</div>
      )}
      {error && (
        <div className="dm-error">Failed to load conversations.</div>
      )}
      {creating && (
        <div className="dm-loading">Opening conversation…</div>
      )}

      {!loading && !error && sorted.length === 0 && !creating && (
        <div className="dm-empty">
          No direct messages yet. Open an agent to start a DM transcript.
        </div>
      )}

      <div className="dm-conversation-items">
        {sorted.map(conv => {
          const sourceLabel = dmConversationSourceLabel(conv);
          return (
            <button
              key={conv.id}
              className={`dm-conversation-item ${selectedId === conv.id ? 'dm-conversation-selected' : ''}`}
              onClick={() => onSelectConversation(conv)}
              type="button"
            >
              <div className="dm-conversation-agent">
                <span className="dm-agent-identity">{conv.agentIdentity}</span>
                {conv.unreadCount > 0 && (
                  <span className="dm-unread-badge">{conv.unreadCount}</span>
                )}
              </div>
              {conv.lastEntryPreview && (
                <div className="dm-conversation-preview">{conv.lastEntryPreview}</div>
              )}
              <div className="dm-conversation-meta">
                {conv.lastEntryAt && (
                  <span className="dm-conversation-time">{formatTimeAgo(conv.lastEntryAt)}</span>
                )}
                {sourceLabel && (
                  <span className="dm-conversation-source">{sourceLabel}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

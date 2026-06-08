import { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectConversation, DirectConversationEntry } from '../../api/channels/types';
import {
  listDirectConversationEntries,
  sendDirectMessage,
  updateReadCursor,
} from '../../api/channels/client';
import { DM_HUMAN_IDENTITY, dmDirectionLabel, dmSourceBadge } from './dmTranscriptModel';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo } from '../../utils';

interface Props {
  conversation: DirectConversation;
  onBack: () => void;
  readIdentity?: string;
}

/**
 * Renders a single DM transcript entry with source badges and body-first layout.
 */
function DmEntry({ entry }: { entry: DirectConversationEntry }) {
  const direction = dmDirectionLabel(entry.direction);
  const sourceBadge = dmSourceBadge(entry);

  return (
    <div className={`dm-entry dm-entry-${direction}`}>
      <div className="dm-entry-header">
        <span className="dm-entry-sender">{entry.senderIdentity}</span>
        <span className="dm-entry-direction">{direction}</span>
        <span className="dm-entry-time">{formatTimeAgo(entry.createdAt)}</span>
      </div>
      <div className="dm-entry-body">{entry.bodyPreview ?? ''}</div>
      {sourceBadge && (
        <div className="dm-entry-source-badge">{sourceBadge}</div>
      )}
    </div>
  );
}

/**
 * Full DM transcript view: entries, composer, and focused-readback warning.
 */
export function DmTranscriptView({ conversation, onBack, readIdentity }: Props) {
  const reader = readIdentity ?? DM_HUMAN_IDENTITY;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const fetchEntries = useCallback(
    () => listDirectConversationEntries(conversation.id, { limit: 100 }),
    [conversation.id],
  );
  const { data: entriesResp, loading, error, refresh } = usePolling(
    fetchEntries,
    5000,
  );

  const entries = entriesResp?.entries ?? [];

  // Mark read on mount and when new entries arrive
  useEffect(() => {
    const latestId = entries.length > 0 ? entries[entries.length - 1].id : null;
    if (latestId) {
      updateReadCursor(conversation.id, {
        readerIdentity: reader,
        lastReadEntryId: latestId,
      }).catch(() => { /* best-effort */ });
    }
  }, [conversation.id, reader, entries.length > 0 ? entries[entries.length - 1]?.id : null]);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const handleSend = useCallback(async () => {
    const body = composing.trim();
    if (!body || sending) return;
    setSending(true);
    setSendStatus(null);
    try {
      const resp = await sendDirectMessage(conversation.id, {
        senderIdentity: DM_HUMAN_IDENTITY,
        body,
        sourceProjectId: conversation.scopeProjectId ?? undefined,
      });
      setComposing('');
      setSendStatus(
        `Sent → ch:${resp.channelId} event:${resp.eventId} entry:${resp.entryId} req:${resp.requestId} — ${resp.status}.`,
      );
      refresh();
    } catch (err: unknown) {
      setSendStatus(`Failed to send: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSending(false);
    }
  }, [composing, conversation.id, conversation.scopeProjectId, refresh, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="dm-transcript-view">
      {/* Header */}
      <div className="dm-transcript-header">
        <button className="dm-back-button" onClick={onBack}>← Back</button>
        <div className="dm-transcript-title">
          <h3>{conversation.agentIdentity}</h3>
          <span className="dm-transcript-meta">
            {conversation.scopeProjectId ? `project: ${conversation.scopeProjectId}` : 'no linked project'}
          </span>
        </div>
        <button className="dm-refresh-button" onClick={refresh} disabled={loading}>↻</button>
      </div>

      {/* Focused-readback warning */}
      <div className="dm-warning-banner">
        This is a focused direct-message transcript. The agent's actual context may include
        project channels, task packets, tool output, and other durable state not shown here.
      </div>

      {/* Loading / error */}
      {loading && entries.length === 0 && (
        <div className="dm-loading">Loading transcript…</div>
      )}
      {error && (
        <div className="dm-error">Failed to load transcript: {error.message}</div>
      )}

      {/* Entries */}
      <div className="dm-entries-scroll" ref={scrollRef}>
        {entries.length === 0 && !loading && (
          <div className="dm-empty">No messages yet. Send a message to start the DM transcript.</div>
        )}
        {entries.map(entry => (
          <DmEntry key={entry.id} entry={entry} />
        ))}

        {/* Send status */}
        {sendStatus && (
          <div className={`dm-send-status ${sendStatus.startsWith('Failed') ? 'dm-send-error' : 'dm-send-ok'}`}>
            {sendStatus}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="dm-composer">
        <textarea
          className="dm-composer-input"
          placeholder={`Message ${conversation.agentIdentity}…`}
          value={composing}
          onChange={e => setComposing(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={2}
        />
        <button
          className="dm-send-button"
          onClick={handleSend}
          disabled={sending || !composing.trim()}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

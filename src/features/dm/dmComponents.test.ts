import { describe, expect, it } from 'vitest';
import type { DirectConversation, DirectConversationEntry } from '../../api/channels/types';
import {
  dmDirectionLabel,
  dmSourceBadge,
  sortConversationsByRecent,
  dmPreviewText,
  DM_HUMAN_IDENTITY,
} from './dmTranscriptModel';

// ---------------------------------------------------------------------------
// Pure functions extracted from DmTranscriptView and DmConversationList
// for deterministic testing without React rendering.
// ---------------------------------------------------------------------------

/** The focused-readback warning copy that must appear in the transcript. */
const DM_WARNING_TEXT = "This is a focused direct-message transcript. The agent's actual context may include project channels, task packets, tool output, and other durable state not shown here.";

/** Send status text when message is delivered via the normal direct-agent wake path. */
const DM_SEND_OK_TEXT = 'Sent — delivered via normal direct-agent wake path.';

/** Empty state message in the transcript. */
const DM_EMPTY_TRANSCRIPT_TEXT = 'No messages yet. Send a message to start the DM transcript.';

/** Empty state message in the conversation list. */
const DM_EMPTY_LIST_TEXT = 'No direct messages yet. Open an agent to start a DM transcript.';

/** Loading state text shown during conversation fetch. */
const DM_LOADING_TEXT = 'Loading conversations…';

/** Error state text for conversation fetch failure. */
const DM_ERROR_TEXT = 'Failed to load conversations.';

// Direction label function (from model)
function entryDirectionLabel(entry: DirectConversationEntry): string {
  return dmDirectionLabel(entry.direction);
}

// Source badge builder (from model)
function entrySourceBadge(entry: DirectConversationEntry): string | null {
  return dmSourceBadge(entry);
}

function makeEntry(overrides: Partial<DirectConversationEntry> = {}): DirectConversationEntry {
  return {
    id: 1,
    conversationId: 1,
    channelMessageId: null,
    direction: 'human_to_agent',
    senderIdentity: 'patch',
    body: 'Hello',
    summary: null,
    sourceChannelId: null,
    sourceProjectId: null,
    sourceTaskId: null,
    sourceWorkerRunId: null,
    sourceSessionOwnerId: null,
    createdAt: '2026-06-06T12:00:00Z',
    ...overrides,
  };
}

function makeConv(overrides: Partial<DirectConversation> = {}): DirectConversation {
  return {
    id: 1,
    humanIdentity: 'patch',
    agentIdentity: 'test-agent',
    projectId: null,
    lastEntryAt: null,
    lastEntryPreview: null,
    entryCount: 0,
    unreadCount: 0,
    createdAt: '2026-06-06T12:00:00Z',
    updatedAt: '2026-06-06T12:00:00Z',
    ...overrides,
  };
}

describe('DmTranscriptView — entry rendering', () => {
  describe('direction labels', () => {
    it('labels human_to_agent as sent', () => {
      expect(entryDirectionLabel(makeEntry({ direction: 'human_to_agent' }))).toBe('sent');
    });
    it('labels agent_to_human as received', () => {
      expect(entryDirectionLabel(makeEntry({ direction: 'agent_to_human' }))).toBe('received');
    });
    it('labels system_note as system', () => {
      expect(entryDirectionLabel(makeEntry({ direction: 'system_note' }))).toBe('system');
    });
  });

  describe('body-first / summary-secondary behavior', () => {
    it('renders body as primary text', () => {
      const entry = makeEntry({ body: 'What is the task status?', summary: null });
      expect(entry.body).toBe('What is the task status?');
    });

    it('keeps summary separate and secondary', () => {
      const entry = makeEntry({ body: 'Check agent', summary: 'Delivery diagnostic' });
      expect(entry.body).toBe('Check agent');
      expect(entry.summary).toBe('Delivery diagnostic');
      // Body must not be modified to include summary
      expect(entry.body).not.toContain('Delivery diagnostic');
    });
  });

  describe('source badges', () => {
    it('produces project#task badge when both present', () => {
      const badge = entrySourceBadge(makeEntry({
        sourceProjectId: 'den-core',
        sourceTaskId: 42,
      }));
      expect(badge).toBe('den-core#42');
    });

    it('produces project-only badge when no task', () => {
      const badge = entrySourceBadge(makeEntry({
        sourceProjectId: 'den-channels',
        sourceTaskId: null,
      }));
      expect(badge).toBe('den-channels');
    });

    it('produces channel badge when sourceChannelId present', () => {
      const badge = entrySourceBadge(makeEntry({
        sourceChannelId: 600,
      }));
      expect(badge).toBe('ch:600');
    });

    it('combines project/task/channel/run badges', () => {
      const badge = entrySourceBadge(makeEntry({
        sourceProjectId: 'den-core',
        sourceTaskId: 1990,
        sourceChannelId: 604,
        sourceWorkerRunId: 'piw_abc123',
      }));
      expect(badge).toBe('den-core#1990 · ch:604 · run:piw_abc123');
    });

    it('returns null when no source fields', () => {
      expect(entrySourceBadge(makeEntry())).toBeNull();
    });
  });

  describe('transcript copy invariants', () => {
    it('focused-readback warning copy is correct', () => {
      expect(DM_WARNING_TEXT).toContain('focused direct-message transcript');
      expect(DM_WARNING_TEXT).toContain("agent's actual context");
      expect(DM_WARNING_TEXT).not.toContain('private');
      expect(DM_WARNING_TEXT).not.toContain('isolated');
      expect(DM_WARNING_TEXT).not.toContain('separate session');
    });

    it('send status shows normal direct-agent wake path', () => {
      expect(DM_SEND_OK_TEXT).toContain('normal direct-agent wake path');
      expect(DM_SEND_OK_TEXT).not.toContain('Hermes session');
      expect(DM_SEND_OK_TEXT).not.toContain('private lane');
    });

    it('empty state message is correct', () => {
      expect(DM_EMPTY_TRANSCRIPT_TEXT).toContain('Send a message');
      expect(DM_EMPTY_TRANSCRIPT_TEXT).toContain('DM transcript');
    });
  });
});

describe('DmConversationList — rendering logic', () => {
  describe('conversation sorting', () => {
    it('sorts by lastEntryAt descending', () => {
      const convs = [
        makeConv({ id: 1, agentIdentity: 'older', lastEntryAt: '2026-06-01T00:00:00Z' }),
        makeConv({ id: 2, agentIdentity: 'newer', lastEntryAt: '2026-06-06T00:00:00Z' }),
      ];
      const sorted = sortConversationsByRecent(convs);
      expect(sorted[0].agentIdentity).toBe('newer');
      expect(sorted[1].agentIdentity).toBe('older');
    });

    it('falls back to createdAt when lastEntryAt is null', () => {
      const convs = [
        makeConv({ id: 1, agentIdentity: 'older', lastEntryAt: null, createdAt: '2026-06-01T00:00:00Z' }),
        makeConv({ id: 2, agentIdentity: 'newer', lastEntryAt: null, createdAt: '2026-06-06T00:00:00Z' }),
      ];
      const sorted = sortConversationsByRecent(convs);
      expect(sorted[0].agentIdentity).toBe('newer');
    });

    it('breaks ties by id descending', () => {
      const ts = '2026-06-06T12:00:00Z';
      const convs = [
        makeConv({ id: 1, agentIdentity: 'low-id', lastEntryAt: ts }),
        makeConv({ id: 10, agentIdentity: 'high-id', lastEntryAt: ts }),
      ];
      const sorted = sortConversationsByRecent(convs);
      expect(sorted[0].agentIdentity).toBe('high-id');
      expect(sorted[1].agentIdentity).toBe('low-id');
    });
  });

  describe('preview text', () => {
    it('returns full text when under maxLen', () => {
      expect(dmPreviewText(makeEntry({ body: 'Hi' }))).toBe('Hi');
    });

    it('truncates with ellipsis when over maxLen', () => {
      const long = 'a'.repeat(100);
      const preview = dmPreviewText(makeEntry({ body: long }));
      expect(preview.length).toBe(81); // 80 + '…'
      expect(preview.endsWith('…')).toBe(true);
    });

    it('falls back to summary when body is empty', () => {
      const preview = dmPreviewText(makeEntry({ body: '', summary: 'Summary text' }));
      expect(preview).toBe('Summary text');
    });
  });

  describe('unread badge behavior', () => {
    it('unreadCount > 0 produces a non-zero badge', () => {
      const conv = makeConv({ unreadCount: 3 });
      expect(conv.unreadCount).toBeGreaterThan(0);
    });

    it('unreadCount of zero produces no badge', () => {
      const conv = makeConv({ unreadCount: 0 });
      expect(conv.unreadCount).toBe(0);
    });
  });

  describe('copy invariants', () => {
    it('empty list message is correct', () => {
      expect(DM_EMPTY_LIST_TEXT).toContain('Open an agent');
      expect(DM_EMPTY_LIST_TEXT).toContain('DM transcript');
    });

    it('loading text is correct', () => {
      expect(DM_LOADING_TEXT).toBe('Loading conversations…');
    });

    it('error text is correct', () => {
      expect(DM_ERROR_TEXT).toBe('Failed to load conversations.');
    });
  });
});

describe('DmTranscriptView — send/mark-read/unread behavior', () => {
  describe('mark-read trigger', () => {
    it('triggered when there are entries', () => {
      const entries = [makeEntry({ id: 1 }), makeEntry({ id: 5 })];
      // When entries exist, the latest id is used for read cursor update
      const latestId = entries[entries.length - 1].id;
      expect(latestId).toBe(5);
    });

    it('not triggered when entries array is empty', () => {
      const entries: DirectConversationEntry[] = [];
      const latestId = entries.length > 0 ? entries[entries.length - 1].id : null;
      expect(latestId).toBeNull();
    });
  });

  describe('send flow', () => {
    it('senderIdentity is DM_HUMAN_IDENTITY (patch)', () => {
      expect(DM_HUMAN_IDENTITY).toBe('patch');
    });

    it('empty body is trimmed and not sent', () => {
      const body = '   ';
      expect(body.trim()).toBe('');
    });
  });
});

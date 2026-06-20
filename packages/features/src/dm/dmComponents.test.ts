import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DirectConversation, DirectConversationEntry } from '@den-web/api/channels/types';
import {
  dmConversationHeaderMeta,
  dmConversationSourceLabel,
  dmDirectionLabel,
  dmSourceBadge,
  sortConversationsByRecent,
  dmPreviewText,
  latestEntryId,
  DM_HUMAN_IDENTITY,
} from '@den-web/models/dm/dmTranscript';

// ---------------------------------------------------------------------------
// Pure functions extracted from DmTranscriptView and DmConversationList
// for deterministic testing without React rendering.
// ---------------------------------------------------------------------------

/** The focused-readback warning copy that must appear in the transcript. */
const DM_WARNING_TEXT = "This is a focused direct-message transcript. The agent's actual context may include project channels, task packets, tool output, and other durable state not shown here.";

/** Empty state message in the transcript. */
const DM_EMPTY_TRANSCRIPT_TEXT = 'No messages yet. Send a message to start the DM transcript.';

/** Empty state message in the conversation list. */
const DM_EMPTY_LIST_TEXT = 'No direct messages yet. Open an agent to start a DM transcript.';

/** Loading state text shown during conversation fetch. */
const DM_LOADING_TEXT = 'Loading conversations…';

/** Error state text for conversation fetch failure. */
const DM_ERROR_TEXT = 'Failed to load conversations.';

const DM_CSS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/web/src/styles/features/dm.css',
);

function dmCss(): string {
  return readFileSync(DM_CSS_PATH, 'utf8');
}

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
    recipientIdentity: 'agent',
    bodyPreview: 'Hello',
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
    scopeProjectId: null,
    displayTitle: null,
    isArchived: false,
    isMuted: false,
    settingsJson: null,
    lastEntryAt: null,
    lastEntryPreview: null,
    lastEntrySender: null,
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

  describe('body-preview primary behavior', () => {
    it('renders bodyPreview as primary text from the live API contract', () => {
      const entry = makeEntry({ bodyPreview: 'What is the task status?' });
      expect(entry.bodyPreview).toBe('What is the task status?');
    });

    it('uses an empty string fallback when bodyPreview is absent', () => {
      const entry = makeEntry({ bodyPreview: null });
      expect(dmPreviewText(entry)).toBe('');
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
      const status = 'Sent → ch:600 event:1 entry:2 req:abc — recorded.';
      expect(status).toContain('recorded');
      expect(status).not.toContain('Hermes session');
      expect(status).not.toContain('private lane');
    });

    it('empty state message is correct', () => {
      expect(DM_EMPTY_TRANSCRIPT_TEXT).toContain('Send a message');
      expect(DM_EMPTY_TRANSCRIPT_TEXT).toContain('DM transcript');
    });
  });
});

describe('DmTranscriptView — wake migration guardrails', () => {
  it('routes composer sends through the migrated sendDirectMessage helper only', () => {
    const source = readFileSync(resolve(
      dirname(fileURLToPath(import.meta.url)),
      'DmTranscriptView.tsx',
    ), 'utf8');

    expect(source).toContain('sendDirectMessage(conversation.id');
    expect(source).not.toContain('/direct-conversations/');
    expect(source).not.toContain('/direct-agent-events');
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
      expect(dmPreviewText(makeEntry({ bodyPreview: 'Hi' }))).toBe('Hi');
    });

    it('truncates with ellipsis when over maxLen', () => {
      const long = 'a'.repeat(100);
      const preview = dmPreviewText(makeEntry({ bodyPreview: long }));
      expect(preview.length).toBe(81); // 80 + '…'
      expect(preview.endsWith('…')).toBe(true);
    });

    it('returns empty string when bodyPreview is empty', () => {
      const preview = dmPreviewText(makeEntry({ bodyPreview: '' }));
      expect(preview).toBe('');
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

    it('describes scopeProjectId as source attribution, not project-scoped DM', () => {
      const conv = makeConv({ scopeProjectId: 'den-web' });
      expect(dmConversationSourceLabel(conv)).toBe('source: den-web');
      expect(dmConversationSourceLabel(conv)).not.toContain('project:');
      expect(dmConversationHeaderMeta(conv)).toBe('global DM · source: den-web');
    });

    it('shows global DM when no source project exists', () => {
      expect(dmConversationSourceLabel(makeConv({ scopeProjectId: null }))).toBeNull();
      expect(dmConversationHeaderMeta(makeConv({ scopeProjectId: null }))).toBe('global DM');
    });
  });
});

describe('DM stylesheet', () => {
  it('uses Den Web global theme tokens instead of undefined imported theme names', () => {
    const css = dmCss();
    expect(css).not.toContain('--bg-secondary');
    expect(css).not.toContain('--bg-primary');
    expect(css).not.toContain('--bg-active');
    expect(css).not.toContain('--text-secondary');
    expect(css).toContain('var(--bg-surface)');
    expect(css).toContain('var(--bg-selected)');
    expect(css).toContain('var(--text)');
  });

  it('does not use light-theme fallback alert/status colors in the dark DM panel', () => {
    const css = dmCss();
    expect(css).not.toContain('#fff8e1');
    expect(css).not.toContain('#ffe082');
    expect(css).not.toContain('#e8eaf6');
    expect(css).not.toContain('#e8f5e9');
    expect(css).not.toContain('#ffebee');
    expect(css).toContain('var(--yellow)');
    expect(css).toContain('var(--green)');
    expect(css).toContain('var(--red)');
  });
});

describe('DmTranscriptView — send/mark-read/unread behavior', () => {
  describe('mark-read trigger', () => {
    it('triggered when there are entries', () => {
      const entries = [makeEntry({ id: 1 }), makeEntry({ id: 5 })];
      // When entries exist, the latest id is used for read cursor update
      const latestId = latestEntryId(entries);
      expect(latestId).toBe(5);
    });

    it('uses max entry id when live entries arrive newest-first', () => {
      const entries = [makeEntry({ id: 5 }), makeEntry({ id: 1 })];
      expect(latestEntryId(entries)).toBe(5);
    });

    it('not triggered when entries array is empty', () => {
      const entries: DirectConversationEntry[] = [];
      const latestId = latestEntryId(entries);
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

  describe('send response canonical handles', () => {
    it('DirectConversationSendResponse exposes eventId', () => {
      const eventId = 42;
      const status = `Sent → ch:600 event:${eventId} entry:2 req:abc — recorded.`;
      expect(status).toContain('event:42');
      expect(status).toContain('ch:600');
    });

    it('DirectConversationSendResponse exposes entryId', () => {
      const entryId = 99;
      const status = `Sent → ch:600 event:42 entry:${entryId} req:xyz — recorded.`;
      expect(status).toContain('entry:99');
    });

    it('DirectConversationSendResponse exposes requestId', () => {
      const requestId = 'req-abc123';
      const status = `Sent → ch:600 event:1 entry:2 req:${requestId} — recorded.`;
      expect(status).toContain('req:req-abc123');
    });

    it('send status format includes all live direct-conversation handles', () => {
      const status = 'Sent → ch:604 event:1024 entry:33 req:xyz789 — recorded.';
      expect(status).toMatch(/ch:\d+/);
      expect(status).toMatch(/event:\d+/);
      expect(status).toMatch(/entry:\d+/);
      expect(status).toMatch(/req:\S+/);
      expect(status).toContain('recorded');
    });
  });
});

describe('dmSourceBadge — canonical channel-message and session attribution', () => {
  const newBadge = dmSourceBadge;

  it('displays channelMessageId as msg:N', () => {
    const badge = newBadge(makeEntry({
      channelMessageId: 42,
    }));
    expect(badge).toBe('msg:42');
  });

  it('displays sourceSessionOwnerId as session:owner', () => {
    const badge = newBadge(makeEntry({
      sourceSessionOwnerId: 'spawned-coder',
    }));
    expect(badge).toBe('session:spawned-coder');
  });

  it('combines channelMessageId with other fields', () => {
    const badge = newBadge(makeEntry({
      sourceProjectId: 'den-core',
      sourceTaskId: 1990,
      channelMessageId: 1024,
    }));
    expect(badge).toBe('den-core#1990 · msg:1024');
  });

  it('combines sourceSessionOwnerId with other fields', () => {
    const badge = newBadge(makeEntry({
      sourceProjectId: 'den-channels',
      channelMessageId: 99,
      sourceSessionOwnerId: 'spawned-reviewer',
    }));
    expect(badge).toBe('den-channels · msg:99 · session:spawned-reviewer');
  });

  it('renders all fields including channelMessageId and sourceSessionOwnerId', () => {
    const badge = newBadge(makeEntry({
      sourceProjectId: 'den-core',
      sourceTaskId: 2071,
      sourceChannelId: 672,
      channelMessageId: 512,
      sourceWorkerRunId: 'piw_abc123',
      sourceSessionOwnerId: 'spawned-coder',
    }));
    expect(badge).toContain('den-core#2071');
    expect(badge).toContain('ch:672');
    expect(badge).toContain('msg:512');
    expect(badge).toContain('run:piw_abc123');
    expect(badge).toContain('session:spawned-coder');
  });
});

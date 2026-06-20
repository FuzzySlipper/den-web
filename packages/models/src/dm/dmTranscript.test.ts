import { describe, it, expect } from 'vitest';
import {
  dmDirectionLabel,
  dmSourceBadge,
  sortConversationsByRecent,
  dmPreviewText,
  sortEntriesChronological,
  latestEntryId,
  DM_HUMAN_IDENTITY,
} from './dmTranscript';
import type { DirectConversation, DirectConversationEntry } from '@den-web/api/channels/types';

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

describe('dmTranscriptModel', () => {
  describe('DM_HUMAN_IDENTITY', () => {
    it('is "patch"', () => {
      expect(DM_HUMAN_IDENTITY).toBe('patch');
    });
  });

  describe('dmDirectionLabel', () => {
    it('returns "sent" for human_to_agent', () => {
      expect(dmDirectionLabel('human_to_agent')).toBe('sent');
    });
    it('returns "received" for agent_to_human', () => {
      expect(dmDirectionLabel('agent_to_human')).toBe('received');
    });
    it('returns "system" for system_note', () => {
      expect(dmDirectionLabel('system_note')).toBe('system');
    });
  });

  describe('dmSourceBadge', () => {
    it('returns null for entry with no source fields', () => {
      expect(dmSourceBadge(makeEntry())).toBeNull();
    });
    it('shows project+task when both present', () => {
      expect(dmSourceBadge(makeEntry({
        sourceProjectId: 'den-core',
        sourceTaskId: 1848,
      }))).toBe('den-core#1848');
    });
    it('shows project only when no task', () => {
      expect(dmSourceBadge(makeEntry({
        sourceProjectId: 'den-channels',
      }))).toBe('den-channels');
    });
    it('shows channel id', () => {
      expect(dmSourceBadge(makeEntry({
        sourceChannelId: 5,
      }))).toBe('ch:5');
    });
    it('shows worker run', () => {
      expect(dmSourceBadge(makeEntry({
        sourceWorkerRunId: 'run-abc',
      }))).toBe('run:run-abc');
    });
    it('shows combined badges', () => {
      expect(dmSourceBadge(makeEntry({
        sourceProjectId: 'den-core',
        sourceTaskId: 2004,
        sourceChannelId: 7,
        sourceWorkerRunId: 'run-xyz',
      }))).toBe('den-core#2004 · ch:7 · run:run-xyz');
    });
  });

  describe('sortConversationsByRecent', () => {
    it('sorts by lastEntryAt descending', () => {
      const convs = [
        makeConv({ id: 1, lastEntryAt: '2026-06-06T10:00:00Z' }),
        makeConv({ id: 2, lastEntryAt: '2026-06-06T12:00:00Z' }),
      ];
      const sorted = sortConversationsByRecent(convs);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });
    it('falls back to createdAt when no lastEntryAt', () => {
      const convs = [
        makeConv({ id: 1, lastEntryAt: null, createdAt: '2026-06-06T10:00:00Z' }),
        makeConv({ id: 2, lastEntryAt: null, createdAt: '2026-06-06T14:00:00Z' }),
      ];
      const sorted = sortConversationsByRecent(convs);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });
    it('sorts by id descending when times equal', () => {
      const convs = [
        makeConv({ id: 1, lastEntryAt: '2026-06-06T12:00:00Z' }),
        makeConv({ id: 3, lastEntryAt: '2026-06-06T12:00:00Z' }),
      ];
      const sorted = sortConversationsByRecent(convs);
      expect(sorted[0].id).toBe(3);
      expect(sorted[1].id).toBe(1);
    });
    it('returns empty array for empty input', () => {
      expect(sortConversationsByRecent([])).toEqual([]);
    });
  });

  describe('dmPreviewText', () => {
    it('returns body text under max length', () => {
      expect(dmPreviewText(makeEntry({ bodyPreview: 'Hi' }))).toBe('Hi');
    });
    it('truncates long body', () => {
      const long = 'A'.repeat(100);
      expect(dmPreviewText(makeEntry({ bodyPreview: long }), 80)).toBe('A'.repeat(80) + '…');
    });
    it('falls back to empty string for empty bodyPreview', () => {
      expect(dmPreviewText(makeEntry({ bodyPreview: '' }))).toBe('');
    });
  });

  describe('entry ordering and read cursor helpers', () => {
    it('sorts live newest-first entries into chronological render order', () => {
      const entries = [makeEntry({ id: 9 }), makeEntry({ id: 3 }), makeEntry({ id: 7 })];
      expect(sortEntriesChronological(entries).map(entry => entry.id)).toEqual([3, 7, 9]);
    });

    it('uses the max entry id as latest read cursor', () => {
      const entries = [makeEntry({ id: 9 }), makeEntry({ id: 3 }), makeEntry({ id: 7 })];
      expect(latestEntryId(entries)).toBe(9);
    });

    it('returns null latest id for an empty transcript', () => {
      expect(latestEntryId([])).toBeNull();
    });
  });
});

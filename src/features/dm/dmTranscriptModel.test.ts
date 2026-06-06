import { describe, it, expect } from 'vitest';
import {
  dmDirectionLabel,
  dmSourceBadge,
  sortConversationsByRecent,
  dmPreviewText,
  DM_HUMAN_IDENTITY,
} from './dmTranscriptModel';
import type { DirectConversation, DirectConversationEntry } from '../../api/channels/types';

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
      expect(dmPreviewText(makeEntry({ body: 'Hi' }))).toBe('Hi');
    });
    it('truncates long body', () => {
      const long = 'A'.repeat(100);
      expect(dmPreviewText(makeEntry({ body: long }), 80)).toBe('A'.repeat(80) + '…');
    });
    it('falls back to empty string for empty body and summary', () => {
      expect(dmPreviewText(makeEntry({ body: '', summary: null }))).toBe('');
    });
    it('uses summary when body is empty', () => {
      expect(dmPreviewText(makeEntry({ body: '', summary: 'Summary text' }))).toBe('Summary text');
    });
  });
});

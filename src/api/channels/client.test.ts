import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listDirectConversations,
  createDirectConversation,
  getDirectConversation,
  listDirectConversationEntries,
  sendDirectMessage,
  updateReadCursor,
  getReadCursor,
} from './client';
import type {
  DirectConversation,
  DirectConversationEntriesResponse,
  DirectConversationSendResponse,
  ReadCursor,
} from './types';

function mockFetch(ok: boolean, data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
    status: ok ? 200 : 500,
  }));
}

describe('channels DM API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listDirectConversations', () => {
    it('calls GET /direct-conversations with humanIdentity', async () => {
      const conversations: DirectConversation[] = [{
        id: 1, humanIdentity: 'patch', agentIdentity: 'pi',
        scopeProjectId: null,
    displayTitle: null,
    isArchived: false,
    isMuted: false,
    settingsJson: null, lastEntryAt: null, lastEntryPreview: null,
        lastEntrySender: null, unreadCount: 0,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }];
      mockFetch(true, { conversations, nextCursor: null, hasMore: false });
      const result = await listDirectConversations({ humanIdentity: 'patch', limit: 50 });
      expect(result).toEqual(conversations);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/direct-conversations?humanIdentity=patch&limit=50'),
        expect.objectContaining({ cache: 'no-store' }),
      );
    });
  });

  describe('createDirectConversation', () => {
    it('calls POST /direct-conversations', async () => {
      const conv: DirectConversation = {
        id: 2, humanIdentity: 'patch', agentIdentity: 'pi',
        scopeProjectId: null,
    displayTitle: null,
    isArchived: false,
    isMuted: false,
    settingsJson: null, lastEntryAt: null, lastEntryPreview: null,
        lastEntrySender: null, unreadCount: 0,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch(true, conv);
      const result = await createDirectConversation({ humanIdentity: 'patch', agentIdentity: 'pi' });
      expect(result).toEqual(conv);
    });
  });

  describe('getDirectConversation', () => {
    it('calls GET /direct-conversations/:id', async () => {
      const conv: DirectConversation = {
        id: 3, humanIdentity: 'patch', agentIdentity: 'spawned-coder',
        scopeProjectId: null,
    displayTitle: null,
    isArchived: false,
    isMuted: false,
    settingsJson: null, lastEntryAt: null, lastEntryPreview: null,
        lastEntrySender: null, unreadCount: 0,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch(true, conv);
      const result = await getDirectConversation(3);
      expect(result).toEqual(conv);
    });
  });

  describe('listDirectConversationEntries', () => {
    it('calls GET /direct-conversations/:id/entries', async () => {
      const resp: DirectConversationEntriesResponse = {
        entries: [{
          id: 1, conversationId: 1, channelMessageId: null,
          direction: 'human_to_agent', senderIdentity: 'patch',
          recipientIdentity: 'agent', bodyPreview: 'Hello',
          sourceChannelId: null, sourceProjectId: null,
          sourceTaskId: null, sourceWorkerRunId: null,
          sourceSessionOwnerId: null,
          createdAt: '2026-01-01T00:00:00Z',
        }],
        nextCursor: null,
        hasMore: false,
      };
      mockFetch(true, resp);
      const result = await listDirectConversationEntries(1, { limit: 100 });
      expect(result).toEqual(resp);
    });
  });

  describe('sendDirectMessage', () => {
    it('calls POST /direct-conversations/:id/send', async () => {
      const resp: DirectConversationSendResponse = {
        status: 'recorded',
        eventId: 42,
        channelId: 600,
        conversationId: 1,
        entryId: 2,
        requestId: 'abc',
        memberIdentity: 'pi',
      };
      mockFetch(true, resp);
      const result = await sendDirectMessage(1, { senderIdentity: 'patch', body: 'Hi' });
      expect(result).toEqual(resp);
    });
  });

  describe('updateReadCursor', () => {
    it('calls PUT /direct-conversations/:id/read-cursor', async () => {
      const cursor: ReadCursor = {
        conversationId: 1,
        readerIdentity: 'patch',
        lastReadEntryId: 5,
        unreadCount: 0,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch(true, cursor);
      const result = await updateReadCursor(1, { readerIdentity: 'patch', lastReadEntryId: 5 });
      expect(result).toEqual(cursor);
    });
  });

  describe('getReadCursor', () => {
    it('calls GET /direct-conversations/:id/read-cursor', async () => {
      const cursor: ReadCursor = {
        conversationId: 1,
        readerIdentity: 'patch',
        lastReadEntryId: 3,
        unreadCount: 2,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch(true, cursor);
      const result = await getReadCursor(1, 'patch');
      expect(result).toEqual(cursor);
    });
  });
});

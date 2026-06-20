import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRequestCache } from '../requestCache';
import {
  listChannelMessages,
  listChannels,
  listDirectConversations,
  createDirectConversation,
  getDirectConversation,
  listDirectConversationEntries,
  sendDirectMessage,
  updateReadCursor,
  getReadCursor,
  listAgentWorkEvents,
  listProjectLinkedChannels,
  addChannelReaction,
  postChannelMessage,
  reinitChannelsRuntime,
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
    clearRequestCache();
    reinitChannelsRuntime({
      denChannelsApiBase: '/api',
      conversationSuccessorReads: {
        enabled: false,
        apiBase: '/api/v1/conversation',
        projectIds: [],
      },
    });
    vi.unstubAllGlobals();
  });

  describe('conversation successor read pilot', () => {
    it('uses legacy channel reads when the successor flag is disabled', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/legacy-api',
        conversationSuccessorReads: {
          enabled: false,
          apiBase: '/api/v1/conversation',
          projectIds: ['den-web'],
        },
      });

      await listChannels({ projectId: 'den-web', kind: 'project_default', limit: 2 });

      expect(fetchMock).toHaveBeenCalledWith(
        '/legacy-api/channels?projectId=den-web&kind=project_default&limit=2',
        { cache: 'no-store' },
      );
    });

    it('routes allowlisted channel reads through the successor canary path and normalizes snake_case DTOs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          channels: [{
            id: 701,
            slug: 'den-web-default',
            display_name: 'Den Web',
            kind: 'project_default',
            project_id: 'den-web',
            space_id: 'den-web',
            created_by: 'successor-canary',
            visibility: 'normal',
            settings: { color: 'blue' },
            created_at: '2026-06-20T00:00:00Z',
            updated_at: '2026-06-20T00:01:00Z',
            archived_at: null,
          }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/api',
        conversationSuccessorReads: {
          enabled: true,
          apiBase: '/api/v1/conversation',
          projectIds: ['den-web'],
        },
      });

      const channels = await listChannels({ projectId: 'den-web', kind: 'project_default', limit: 2 });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/conversation/channels?project_id=den-web&kind=project_default&limit=2',
        {
          cache: 'no-store',
          headers: { 'X-Den-Migrated-Functions': 'true' },
        },
      );
      expect(channels[0]).toMatchObject({
        id: 701,
        displayName: 'Den Web',
        projectId: 'den-web',
        settingsJson: '{"color":"blue"}',
        createdAt: '2026-06-20T00:00:00Z',
      });
    });

    it('routes messages for successor-discovered channels and translates afterId to after_id', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 702, slug: 'pilot', display_name: 'Pilot', project_id: 'pilot-project', created_at: 't0', updated_at: 't0' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            messages: [{
              id: 9001,
              channel_id: 702,
              sender_type: 'agent',
              sender_identity: 'den-mcp-runner',
              body: 'hello',
              message_kind: 'system_event',
              source_kind: 'synthetic_canary',
              metadata: { proof: true },
              created_at: '2026-06-20T00:02:00Z',
            }],
          }),
        });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/api',
        conversationSuccessorReads: {
          enabled: true,
          apiBase: '/api/v1/conversation',
          projectIds: ['pilot-project'],
        },
      });

      await listChannels({ projectId: 'pilot-project', limit: 1 });
      const messages = await listChannelMessages(702, { afterId: 12, limit: 20 });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/conversation/channels/702/messages?after_id=12&limit=20',
        {
          cache: 'no-store',
          headers: { 'X-Den-Migrated-Functions': 'true' },
        },
      );
      expect(messages[0]).toMatchObject({
        id: 9001,
        channelId: 702,
        senderIdentity: 'den-mcp-runner',
        messageKind: 'system_event',
        sourceKind: 'synthetic_canary',
        metadataJson: '{"proof":true}',
        deliveryRequestId: null,
      });
    });

    it('leaves unallowlisted projects, undiscovered message channels, and unsupported linked routes on legacy', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/legacy-api',
        conversationSuccessorReads: {
          enabled: true,
          apiBase: '/api/v1/conversation',
          projectIds: ['pilot-project'],
        },
      });

      await listChannels({ projectId: 'other-project', limit: 1 });
      await listChannelMessages(999, { limit: 5 });
      await listProjectLinkedChannels('pilot-project');

      expect(fetchMock).toHaveBeenNthCalledWith(1, '/legacy-api/channels?projectId=other-project&limit=1', { cache: 'no-store' });
      expect(fetchMock).toHaveBeenNthCalledWith(2, '/legacy-api/channels/999/messages?limit=5', { cache: 'no-store' });
      expect(fetchMock).toHaveBeenNthCalledWith(3, '/legacy-api/projects/pilot-project/linked-channels', { cache: 'no-store' });
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/conversation/projects'), expect.anything());
    });

    it('routes allowlisted successor channel writes through conversation with an idempotency key', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 702, slug: 'pilot', display_name: 'Pilot', project_id: 'pilot-project', created_at: 't0', updated_at: 't0' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 9100,
            channel_id: 702,
            sender_type: 'user',
            sender_identity: 'patch',
            body: 'hello successor',
            message_kind: 'human_text',
            dedupe_key: 'manual-key',
            created_at: '2026-06-20T00:03:00Z',
          }),
        });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/api',
        conversationSuccessorReads: {
          enabled: true,
          writeEnabled: true,
          apiBase: '/api/v1/conversation',
          projectIds: ['pilot-project'],
          writeProjectIds: ['pilot-project'],
        },
      });

      await listChannels({ projectId: 'pilot-project', limit: 1 });
      const message = await postChannelMessage(702, {
        senderType: 'user',
        senderIdentity: 'patch',
        messageKind: 'human_text',
        body: 'hello successor',
        dedupeKey: 'manual-key',
        metadataJson: '{"from":"test"}',
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/conversation/channels/702/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Den-Migrated-Functions': 'true',
            'Idempotency-Key': 'manual-key',
          }),
        }),
      );
      expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
        sender_type: 'user',
        sender_identity: 'patch',
        message_kind: 'human_text',
        dedupe_key: 'manual-key',
        metadata: { from: 'test' },
      });
      expect(message).toMatchObject({ id: 9100, channelId: 702, dedupeKey: 'manual-key' });
    });

    it('routes reactions through conversation only for write-allowlisted successor messages', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 702, slug: 'pilot', display_name: 'Pilot', project_id: 'pilot-project', created_at: 't0', updated_at: 't0' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            messages: [{
              id: 9001,
              channel_id: 702,
              sender_type: 'agent',
              sender_identity: 'den-mcp-runner',
              body: 'hello',
              message_kind: 'system_event',
              created_at: '2026-06-20T00:02:00Z',
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/api',
        conversationSuccessorReads: {
          enabled: true,
          writeEnabled: true,
          apiBase: '/api/v1/conversation',
          projectIds: ['pilot-project'],
          writeProjectIds: ['pilot-project'],
        },
      });

      await listChannels({ projectId: 'pilot-project', limit: 1 });
      await listChannelMessages(702, { limit: 1 });
      await addChannelReaction(9001, {
        reactorType: 'user',
        reactorIdentity: 'patch',
        reactionKey: 'eyes',
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        '/api/v1/conversation/messages/9001/reactions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Den-Migrated-Functions': 'true' }),
        }),
      );
      expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
        reactor_type: 'user',
        reactor_identity: 'patch',
        reaction: 'eyes',
      });
    });
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

  describe('listAgentWorkEvents', () => {
    it('normalizes canonical metadata fields for pi-crew lifecycle rows', async () => {
      mockFetch(true, {
        items: [{
          id: 1,
          channelId: 642,
          projectId: 'pi-crew',
          taskId: null,
          agentIdentity: 'pi-crew-service',
          eventType: 'heartbeat',
          status: 'completed',
          state: null,
          workerRunId: null,
          assignmentId: null,
          deliveryRequestId: null,
          sessionId: 'sess-parent',
          evidenceLink: null,
          summary: 'Tool completed',
          createdAt: '2026-06-15T00:00:00Z',
          metadata: {
            source: 'pi-crew',
            eventFamily: 'tool',
            piCrewEventType: 'tool.completed',
            toolName: 'list_assignments',
            durationMs: 77,
            isError: false,
            tokensConsumed: 123,
          },
        }],
        count: 1,
        channelId: 642,
        filters: {},
      });

      const result = await listAgentWorkEvents({ channelId: 642, limit: 10 });
      expect(result.items[0]).toMatchObject({
        state: 'completed',
        source: 'pi-crew',
        eventFamily: 'tool',
        piCrewEventType: 'tool.completed',
        toolName: 'list_assignments',
        durationMs: 77,
        isError: false,
        tokensConsumed: 123,
      });
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

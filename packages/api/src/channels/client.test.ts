import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRequestCache } from '../requestCache';
import {
  channelEventStreamUrl,
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
import { reinitTimelineSuccessor, timelineSuccessorEnabledForChannel } from '../timeline/client';

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
    reinitTimelineSuccessor({ enabled: false, apiBase: '/api/v1/timeline', projectIds: [] });
    vi.unstubAllGlobals();
  });

  it('passes debug preference through timeline successor stream URLs', () => {
    reinitTimelineSuccessor({ enabled: true, apiBase: '/api/v1/timeline', projectIds: ['den-web'] });
    timelineSuccessorEnabledForChannel({
      id: 7,
      slug: 'project-den-web',
      displayName: 'Den Web',
      kind: 'project_default',
      projectId: 'den-web',
      spaceId: null,
      createdBy: 'test',
      visibility: 'normal',
      settingsJson: null,
      createdAt: 't0',
      updatedAt: 't0',
      archivedAt: null,
    });

    expect(channelEventStreamUrl(7, { afterTimelineCursor: 'cursor-1', includeDebug: true })).toBe('/api/v1/timeline/channels/7/stream?after=cursor-1&include_debug=true');
  });

  describe('conversation successor read pilot', () => {
    it('returns an empty channel list when the successor flag is disabled', async () => {
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

      const channels = await listChannels({ projectId: 'den-web', kind: 'project_default', limit: 2 });

      expect(channels).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
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

    it('degrades unallowlisted projects, undiscovered message channels, and unsupported linked routes without legacy calls', async () => {
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

      await expect(listChannels({ projectId: 'other-project', limit: 1 })).resolves.toEqual([]);
      await expect(listChannelMessages(999, { limit: 5 })).resolves.toEqual([]);
      await expect(listProjectLinkedChannels('pilot-project')).resolves.toEqual([]);

      expect(fetchMock).not.toHaveBeenCalled();
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
        source_kind: 'den_web_channel_post',
        dedupe_key: 'manual-key',
        metadata: { from: 'test' },
      });
      expect(message).toMatchObject({ id: 9100, channelId: 702, dedupeKey: 'manual-key' });
    });

    it('routes allowlisted project writes through conversation even when reads used legacy channel ids', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 31, slug: 'project-den-web', display_name: 'Den Web', kind: 'project_default', project_id: 'den-web', created_at: 't0', updated_at: 't0' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 9101,
            channel_id: 31,
            sender_type: 'user',
            sender_identity: 'patch',
            body: 'hello from legacy-loaded channel',
            message_kind: 'human_text',
            dedupe_key: 'manual-key-2',
            created_at: '2026-06-20T00:03:00Z',
          }),
        });
      vi.stubGlobal('fetch', fetchMock);
      reinitChannelsRuntime({
        denChannelsApiBase: '/api',
        conversationSuccessorReads: {
          enabled: false,
          writeEnabled: true,
          apiBase: '/api/v1/conversation',
          projectIds: [],
          writeProjectIds: ['den-web'],
        },
      });

      const message = await postChannelMessage(584, {
        senderType: 'user',
        senderIdentity: 'patch',
        messageKind: 'human_text',
        body: 'hello from legacy-loaded channel',
        sourceProjectId: 'den-web',
        dedupeKey: 'manual-key-2',
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/v1/conversation/channels?project_id=den-web&kind=project_default&limit=5',
        {
          cache: 'no-store',
          headers: { 'X-Den-Migrated-Functions': 'true' },
        },
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/conversation/channels/31/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Den-Migrated-Functions': 'true',
            'Idempotency-Key': 'manual-key-2',
          }),
        }),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/channels/584/messages'), expect.anything());
      expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
        source_kind: 'den_web_channel_post',
      });
      expect(message).toMatchObject({ id: 9101, channelId: 31, dedupeKey: 'manual-key-2' });
    });

    it('prefers the registered successor channel over a surrounding project fallback', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 40, slug: 'project-asha', display_name: 'ASHA', kind: 'project_default', project_id: 'asha', created_at: 't0', updated_at: 't0' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 9102,
            channel_id: 40,
            sender_type: 'user',
            sender_identity: 'patch',
            body: 'hello linked successor channel',
            message_kind: 'human_text',
            dedupe_key: 'manual-key-3',
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
          projectIds: ['asha'],
          writeProjectIds: ['asha', 'den-services'],
        },
      });

      await listChannels({ projectId: 'asha', limit: 1 });
      const message = await postChannelMessage(40, {
        senderType: 'user',
        senderIdentity: 'patch',
        messageKind: 'human_text',
        body: 'hello linked successor channel',
        sourceProjectId: 'den-services',
        dedupeKey: 'manual-key-3',
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/conversation/channels/40/messages',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining('project_id=den-services'),
        expect.anything(),
      );
      expect(message).toMatchObject({ id: 9102, channelId: 40, dedupeKey: 'manual-key-3' });
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
    it('returns an empty retired transcript list without legacy calls', async () => {
      const result = await listDirectConversations({ humanIdentity: 'patch', limit: 50 });
      expect(result).toEqual([]);
    });
  });

  describe('createDirectConversation', () => {
    it('rejects legacy transcript creation', async () => {
      await expect(createDirectConversation({ humanIdentity: 'patch', agentIdentity: 'pi' })).rejects.toThrow(/retired/);
    });
  });

  describe('getDirectConversation', () => {
    it('rejects legacy transcript readback', async () => {
      await expect(getDirectConversation(3)).rejects.toThrow(/retired/);
    });
  });

  describe('listDirectConversationEntries', () => {
    it('returns an empty retired entry list without legacy calls', async () => {
      const result = await listDirectConversationEntries(1, { limit: 100 });
      expect(result).toEqual({ entries: [], nextCursor: null, hasMore: false });
    });
  });

  describe('sendDirectMessage', () => {
    it('rejects retired transcript sends instead of reading legacy conversations', async () => {
      await expect(sendDirectMessage(1, { senderIdentity: 'patch', body: 'Hi' })).rejects.toThrow(/retired/);
    });
  });

  describe('updateReadCursor', () => {
    it('returns a local retired read-cursor acknowledgement', async () => {
      const result = await updateReadCursor(1, { readerIdentity: 'patch', lastReadEntryId: 5 });
      expect(result).toMatchObject({ conversationId: 1, readerIdentity: 'patch', lastReadEntryId: 5 });
    });
  });

  describe('listAgentWorkEvents', () => {
    it('returns a degraded empty lifecycle projection without legacy calls', async () => {
      const result = await listAgentWorkEvents({ channelId: 642, limit: 10 });
      expect(result).toEqual({ items: [], count: 0, channelId: 642, filters: {} });
    });
  });

  describe('getReadCursor', () => {
    it('returns an empty retired read-cursor projection', async () => {
      const result = await getReadCursor(1, 'patch');
      expect(result).toMatchObject({ conversationId: 1, readerIdentity: 'patch', lastReadEntryId: null });
    });
  });
});

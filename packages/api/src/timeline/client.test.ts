import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRequestCache } from '../requestCache';
import {
  listChannelTimelineItems,
  reinitTimelineSuccessor,
  timelineChannelStreamUrl,
  timelineSuccessorEnabledForChannel,
} from './client';

describe('timeline successor client', () => {
  afterEach(() => {
    clearRequestCache();
    reinitTimelineSuccessor({ enabled: false, apiBase: '/api/v1/timeline', projectIds: [] });
    vi.unstubAllGlobals();
  });

  it('gates timeline usage by project allowlist and resolves stream URLs', () => {
    expect(timelineSuccessorEnabledForChannel({
      id: 7,
      slug: 'den-web',
      displayName: 'Den Web',
      kind: 'project_default',
      projectId: 'den-web',
      spaceId: null,
      createdBy: 'den-web',
      visibility: 'normal',
      settingsJson: null,
      createdAt: 't0',
      updatedAt: 't0',
      archivedAt: null,
    })).toBe(false);

    reinitTimelineSuccessor({ enabled: true, apiBase: '/api/v1/timeline', projectIds: ['den-web'] });
    expect(timelineSuccessorEnabledForChannel({
      id: 7,
      slug: 'den-web',
      displayName: 'Den Web',
      kind: 'project_default',
      projectId: 'den-web',
      spaceId: null,
      createdBy: 'den-web',
      visibility: 'normal',
      settingsJson: null,
      createdAt: 't0',
      updatedAt: 't0',
      archivedAt: null,
    })).toBe(true);
    expect(timelineChannelStreamUrl(7, { after: 'cursor-1' })).toBe('/api/v1/timeline/channels/7/stream?after=cursor-1');
  });

  it('normalizes timeline messages and breadcrumbs into existing channel render shapes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        scope: { kind: 'channel', channel_id: 7, project_id: 'den-web' },
        items: [
          {
            timeline_id: 'msg:42',
            cursor: 'cursor-msg',
            occurred_at: '2026-06-20T00:00:00Z',
            source_domain: 'conversation',
            source_id: '42',
            event_kind: 'channel_message',
            render_kind: 'message',
            display_only: true,
            channel_id: 7,
            project_id: 'den-web',
            task_id: 3012,
            actor: { type: 'user', identity: 'patch' },
            body: 'hello timeline',
            summary: null,
            severity: 'info',
            metadata: { message_kind: 'human_text', source_kind: 'den_web' },
            source_ref: { domain: 'conversation', table: 'den_channels.channel_messages', id: '42' },
          },
          {
            timeline_id: 'obs:evt-1',
            cursor: 'cursor-obs',
            occurred_at: '2026-06-20T00:00:01Z',
            source_domain: 'observation',
            source_id: 'evt-1',
            event_kind: 'agent_progress',
            render_kind: 'breadcrumb',
            display_only: true,
            channel_id: 7,
            project_id: 'den-web',
            task_id: 3012,
            actor: { type: 'agent', identity: 'den-mcp-runner', profile_identity: 'den-mcp-runner' },
            body: null,
            summary: 'running tests',
            severity: 'success',
            metadata: { visibility: 'channel', work_ref: { channel_id: 7, channel_message_id: 42, task_id: 3012 } },
            source_ref: { domain: 'observation', table: 'den_observation.activity_events', id: 'evt-1' },
          },
        ],
        next_cursor: 'cursor-obs',
        snapshot_at: '2026-06-20T00:00:02Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    reinitTimelineSuccessor({ enabled: true, apiBase: '/api/v1/timeline', projectIds: ['den-web'] });

    const projection = await listChannelTimelineItems(7, { limit: 2 });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/timeline/channels/7/items?limit=2', { cache: 'no-store' });
    expect(projection.nextCursor).toBe('cursor-obs');
    expect(projection.messages[0]).toMatchObject({
      id: 42,
      channelId: 7,
      senderIdentity: 'patch',
      body: 'hello timeline',
      messageKind: 'human_text',
      sourceKind: 'den_web',
      targetTaskId: 3012,
    });
    expect(projection.activityEvents[0]).toMatchObject({
      channelId: 7,
      agentIdentity: 'den-mcp-runner',
      anchorMessageId: 42,
      eventType: 'agent_progress',
      summary: 'running tests',
      taskId: 3012,
    });
  });
});


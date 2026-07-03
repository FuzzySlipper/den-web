import { describe, expect, it } from 'vitest';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { createDenTransportClients } from './clients';
import { DenHttpClient } from './http';

describe('Den transport clients', () => {
  it('constructs canonical successor route URLs', async () => {
    const calls: readonly string[] = [];
    const mutableCalls: string[] = [];
    const http = new DenHttpClient({
      fetchImpl: async (input) => {
        mutableCalls.push(String(input));
        return Response.json([]);
      },
    });
    const clients = createDenTransportClients(defaultRuntimeApiConfig, http);

    await clients.projects.listProjects();
    await clients.projects.listSpaces({ includeHidden: true, includeArchived: true });
    await clients.tasks.listTasks('den-web', { limit: 1, tree: true });
    await clients.tasks.getTask('den-web', 3991);
    await clients.tasks.updateTask('den-web', 3991, { status: 'in_progress' });
    await clients.messages.listMessages('den-web', { taskId: 3991, limit: 10 });
    await clients.notifications.listUserNotifications({ readForAgent: 'web-ui', limit: 5 });
    await clients.documents.updateDocument('den-web', 'successor-brief', { content_markdown: '# Updated' });
    await clients.documents.getDiscussion('den-web', 'successor-brief');
    await clients.librarian.query('den-web', { query: 'successor' });
    await clients.conversation.listChannels('den-web', { limit: 1 });
    await clients.conversation.listMemberships({ channelId: 7, limit: 10 });
    await clients.conversation.listMessages(7, { afterId: 2, limit: 20 });
    await clients.conversation.postMessage(7, { sender: 'web-ui', body: 'hello', idempotency_key: 'k1' });
    await clients.timeline.listChannelItems(7, { limit: 1 });
    await clients.observation.lane({ limit: 1 });
    await clients.observation.activeWork();
    await clients.delivery.createIntent({ kind: 'wake' });
    await clients.docPublish.preview({ source: { document_project_id: 'den-web', document_slug: 'successor-brief' }, requested_by: 'den-web' });
    await clients.docPublish.publish({ source: { document_project_id: 'den-web', document_slug: 'successor-brief' }, requested_by: 'den-web' });

    expect(calls).toEqual([]);
    expect(mutableCalls).toEqual([
      '/api/v1/projects',
      '/api/v1/spaces?include_hidden=true&include_archived=true',
      '/api/v1/projects/den-web/tasks?limit=1&tree=true',
      '/api/v1/projects/den-web/tasks/3991',
      '/api/v1/projects/den-web/tasks/3991',
      '/api/v1/projects/den-web/messages?task_id=3991&limit=10',
      '/api/v1/user-notifications?read_for_agent=web-ui&limit=5',
      '/api/v1/projects/den-web/documents/successor-brief',
      '/api/v1/projects/den-web/documents/successor-brief/discussion',
      '/api/v1/projects/den-web/librarian/query',
      '/api/v1/conversation/channels?project_id=den-web&limit=1',
      '/api/v1/conversation/memberships?channel_id=7&limit=10',
      '/api/v1/conversation/channels/7/messages?after_id=2&limit=20',
      '/api/v1/conversation/channels/7/messages',
      '/api/v1/timeline/channels/7/items?limit=1',
      '/api/v1/observation/lane?limit=1',
      '/api/v1/observation/active-work',
      '/api/v1/delivery/intents',
      '/api/v1/blog/publications/preview',
      '/api/v1/blog/publications',
    ]);
  });

  it('builds timeline stream URLs without opening EventSource in transport clients', () => {
    const clients = createDenTransportClients();

    expect(clients.timeline.streamUrl(7, { after: 'cursor-1', includeDebug: true })).toBe(
      '/api/v1/timeline/channels/7/stream?after=cursor-1&include_debug=true',
    );
  });
});

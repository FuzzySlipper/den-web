import type { Page, Route } from '@playwright/test';

const project = { id: 'den-web', name: 'Den Web', visibility: 'normal' };
const hiddenProject = { id: 'archive-mine', name: 'Archive Mine', visibility: 'hidden' };
const spaces = [
  { id: 'den-web', name: 'Den Web', kind: 'project', visibility: 'normal' },
  { id: 'asha', name: 'Asha Studio', kind: 'project', visibility: 'normal' },
];
const archivedSpace = { id: 'old-space', name: 'Old Space', kind: 'project', visibility: 'archived' };
const primaryTask = {
  id: 3993,
  project_id: 'den-web',
  title: 'Den Web Angular successor Phase 4: first vertical cockpit slice',
  status: 'in_progress',
  priority: 2,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['successor', 'angular', 'phase-4'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 1,
  description: 'Ship the first usable Angular successor slice.',
};
const nestedTask = {
  id: 4001,
  project_id: 'den-web',
  title: 'Nested fixture task',
  status: 'planned',
  priority: 3,
  assigned_to: 'codex',
  parent_id: 3993,
  tags: ['fixture'],
  availability: 'waiting_on_dependencies',
  dependency_count: 1,
  unfinished_dependency_count: 1,
  subtask_count: 0,
};
const longDescription = Array.from(
  { length: 44 },
  (_, index) => `Long detail paragraph ${index + 1}. This fixture gives the task detail panel enough content to require internal scrolling without moving the workspace shell.`,
).join('\n\n');
const longDetailTask = {
  id: 4177,
  project_id: 'den-web',
  title: 'Long detail fixture task',
  status: 'in_progress',
  priority: 2,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture', 'scroll'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
  description: `${longDescription}\n\nLong detail bottom sentinel.`,
};
const extraTasks = Array.from({ length: 80 }, (_, index) => ({
  id: 4300 + index,
  project_id: 'den-web',
  title: `Long task list fixture ${index + 1}`,
  status: 'planned',
  priority: 4,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture', 'scroll'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
}));
const tasks = [primaryTask, nestedTask, longDetailTask, ...extraTasks];
const ashaTask = {
  id: 4100,
  project_id: 'asha',
  title: 'Asha Studio space task',
  status: 'planned',
  priority: 2,
  assigned_to: 'codex',
  parent_id: null,
  tags: ['fixture'],
  availability: 'available',
  dependency_count: 0,
  unfinished_dependency_count: 0,
  subtask_count: 0,
  description: 'Loaded through space selection.',
};
const channels = [
  { id: 7, project_id: 'den-web', slug: 'den-web', name: 'den-web', kind: 'project_default' },
  { id: 8, project_id: 'den-web', slug: 'ops', name: 'ops', kind: 'project' },
];
const systemChannels = [
  { id: 99, slug: 'agent-commons', name: 'agent-commons', kind: 'system' },
];
const memberships = [
  {
    id: 701,
    channel_id: 7,
    member_identity: 'codex',
    member_type: 'agent',
    membership_status: 'active',
    wake_policy: 'normal',
    wake_target: { profile: 'codex', instance_id: 'codex@den-srv' },
  },
  { id: 702, channel_id: 7, member_identity: 'patch', member_type: 'user', membership_status: 'active', wake_policy: 'mentions_only' },
];
const channelMessages = [{ id: 71, channel_id: 7, sender_identity: 'codex', sender_type: 'agent', body: 'Conversation fixture loaded', created_at: '2026-07-02T00:00:00Z' }];
const agentCommonsMessages = [{ id: 990, channel_id: 99, sender_identity: 'codex', sender_type: 'agent', body: 'Agent commons fixture loaded', created_at: '2026-07-02T00:00:00Z' }];
const timeline = {
  items: [
    { timeline_id: 'tl-1', cursor: 'cursor-1', event_kind: 'channel_message', body: 'Timeline fixture loaded', actor: { identity: 'codex' }, occurred_at: '2026-07-02T00:01:00Z' },
    { timeline_id: 'tl-2', cursor: 'cursor-2', event_kind: 'observation_tool_call', body: 'Observation tool fixture loaded', actor: { identity: 'den-mcp-runner' }, occurred_at: '2026-07-02T00:02:00Z' },
  ],
  next_cursor: 'cursor-2',
};
const agentCommonsTimeline = {
  items: [{ timeline_id: 'tl-99', cursor: 'cursor-99', event_kind: 'channel_message', body: 'Agent commons timeline loaded', actor: { identity: 'codex' }, occurred_at: '2026-07-02T00:01:00Z' }],
  next_cursor: 'cursor-99',
};
const artifactRef = 'den-artifact://art_fixture_image';
const artifactMetadata = {
  artifact_id: 'art_fixture_image',
  artifact_ref: artifactRef,
  project_id: 'den-web',
  task_id: 3993,
  logical_name: 'visual-evidence-overview.png',
  mime_type: 'image/png',
  byte_count: 70,
  sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  width: 1,
  height: 1,
  sensitive: false,
  storage_backend: 'filesystem',
  storage_key: 'sha256/fixture',
  created_by: 'codex',
  created_at: '2026-07-02T00:00:00Z',
};
const artifactPacket = {
  packet_type: 'visual_inspect_result',
  schema_version: 'visual-inspect-review-packet/v0',
  artifact_refs: [{ screenshot_id: 'Visual evidence overview', ref: artifactRef, mime_type: 'image/png', sensitive: false }],
  result: { verdict: 'pass', confidence: 0.86 },
};
const artifactPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
const taskDetail = {
  task: primaryTask,
  dependencies: [],
  subtasks: [nestedTask, ashaTask],
  recent_messages: [],
};
const notifications = [{ id: 9, project_id: 'den-web', task_id: 3993, sender: 'den-services', content: 'Notification fixture loaded', urgency: 'normal', is_read: false, created_at: '2026-07-02T00:00:00Z', metadata: null }];
const taskMessages = [{ id: 2, project_id: 'den-web', task_id: 3993, thread_id: 1, sender: 'codex', intent: 'handoff', content: 'Phase 4 fixture loaded', metadata: artifactPacket, created_at: '2026-07-02T00:01:00Z' }];
const primaryMessage = { id: 10, project_id: 'den-web', task_id: 3993, thread_id: 1, sender: 'codex', intent: 'handoff', content: 'Message fixture loaded', metadata: artifactPacket, created_at: '2026-07-02T00:00:00Z' };
const extraMessages = Array.from({ length: 48 }, (_, index) => ({
  id: 100 + index,
  project_id: 'den-web',
  task_id: null,
  thread_id: 100 + index,
  sender: 'codex',
  intent: 'status_update',
  content: `Long inbox scroll fixture message ${index + 1} with enough body text to prove rows stay compact inside the panel.`,
  metadata: null,
  created_at: `2026-07-02T00:${String(index + 2).padStart(2, '0')}:00Z`,
}));
const messages = [primaryMessage, ...extraMessages];
const threadMessages = { root: primaryMessage, replies: [] };
const documents = [
  { project_id: 'den-web', slug: 'successor-brief', title: 'Successor Brief', updated_at: '2026-07-02T00:00:00Z' },
  {
    project_id: 'den-web',
    slug: 'a-very-long-document-slug-used-to-keep-the-list-row-height-stable',
    title: 'Long Fixture Document Title Used For Stable Row Layout',
    doc_type: 'reference',
    updated_at: '2026-07-02T00:00:00Z',
  },
];
const documentDetail = {
  ...documents[0],
  content_markdown: '# Successor Brief\n\nDocument fixture loaded.\n\n| Surface | Owner |\n|---|---|\n| Runtime | ASHA main |\n| Demo | asha-demo |',
  tags: ['successor'],
};
const longDocumentDetail = { ...documents[1], content_markdown: '# Stable Rows\n\nSecond fixture loaded.', tags: ['successor', 'layout'] };
const ashaDocuments = [{ project_id: 'asha', slug: 'asha-brief', title: 'Asha Brief', updated_at: '2026-07-02T00:00:00Z' }];
const ashaDocumentDetail = { ...ashaDocuments[0], content_markdown: '# Asha Brief\n\nAsha document fixture loaded.', tags: ['space'] };
const globalDocuments = [{ project_id: '_global', slug: 'global-brief', title: 'Global Brief', updated_at: '2026-07-02T00:00:00Z' }];
const globalDocumentDetail = { ...globalDocuments[0], content_markdown: '# Global Brief\n\nGlobal document fixture loaded.', tags: ['global'] };
const discussion = { comments: [{ id: 1, author_identity: 'codex', body_markdown: 'Discussion fixture loaded', parent_comment_id: null, created_at: '2026-07-02T00:00:00Z' }] };
const publication = {
  publication_id: 'pub-1',
  status: 'previewed',
  dry_run: true,
  title: 'Successor Brief',
  slug: 'successor-brief',
  post_path: '_posts/successor-brief.md',
  public_url: 'https://blog.example.test/successor-brief',
  git_commit: '1234567890abcdef',
  preview_markdown: '# Successor Brief\n\nDocument fixture loaded.',
  warnings: [],
};
const observation = {
  items: [{ id: 'agent-1', agent_identity: 'den-mcp-runner', title: 'Agent fixture loaded', summary: 'Observation-backed overview', status: 'active', project_id: 'den-web', task_id: 3993 }],
  source_health: [{ source: 'observation', status: 'degraded', detail: 'Fixture degraded state' }],
};

export async function mockDenServices(page: Page): Promise<void> {
  await page.route('**/api/v1/projects', (route) => json(route, [project]));
  await page.route('**/api/v1/projects?**', (route) => json(route, includeArchivedHidden(route) ? [project, hiddenProject] : [project]));
  await page.route('**/api/v1/spaces', (route) => json(route, spaces));
  await page.route('**/api/v1/spaces?**', (route) => json(route, includeArchivedHidden(route) ? [...spaces, archivedSpace] : spaces));
  await page.route('**/api/v1/projects/den-web/tasks?**', (route) => json(route, tasks));
  await page.route('**/api/v1/projects/asha/tasks?**', (route) => json(route, [ashaTask]));
  await page.route('**/api/v1/projects/den-web/tasks/3993', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { readonly status?: string };
      await json(route, { ...primaryTask, status: body.status ?? primaryTask.status });
      return;
    }
    await json(route, taskDetail);
  });
  await page.route('**/api/v1/projects/den-web/tasks/4001', (route) => json(route, {
    task: nestedTask,
    dependencies: [primaryTask],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/projects/den-web/tasks/4177', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { readonly status?: string };
      await json(route, {
        task: { ...longDetailTask, status: body.status ?? longDetailTask.status },
        dependencies: [],
        subtasks: [],
        recent_messages: [],
      });
      return;
    }
    await json(route, {
      task: longDetailTask,
      dependencies: [],
      subtasks: [],
      recent_messages: [],
    });
  });
  await page.route('**/api/v1/projects/asha/tasks/4100', (route) => json(route, {
    task: ashaTask,
    dependencies: [],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/conversation/channels?**', (route) => json(route, channelListFor(route)));
  await page.route('**/api/v1/conversation/memberships?**', (route) => json(route, membershipListFor(route)));
  await page.route('**/api/v1/conversation/channels/7/messages', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Readonly<Record<string, unknown>>;
      if ('sender' in body) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'bad_request', message: 'unknown field "sender"' } }),
        });
      }
      return json(route, {
        id: 72,
        channel_id: 7,
        sender_identity: typeof body['sender_identity'] === 'string' ? body['sender_identity'] : 'web-ui',
        sender_type: typeof body['sender_type'] === 'string' ? body['sender_type'] : 'user',
        body: typeof body['body'] === 'string' ? body['body'] : '',
        created_at: '2026-07-02T00:03:00Z',
      });
    }
    return json(route, channelMessages);
  });
  await page.route('**/api/v1/conversation/channels/7/messages?**', (route) => json(route, channelMessages));
  await page.route('**/api/v1/conversation/channels/8/messages', (route) => json(route, []));
  await page.route('**/api/v1/conversation/channels/8/messages?**', (route) => json(route, []));
  await page.route('**/api/v1/conversation/channels/99/messages', (route) => json(route, agentCommonsMessages));
  await page.route('**/api/v1/conversation/channels/99/messages?**', (route) => json(route, agentCommonsMessages));
  await page.route('**/api/v1/timeline/channels/7/items?**', (route) => json(route, timeline));
  await page.route('**/api/v1/timeline/channels/8/items?**', (route) => json(route, { items: [], next_cursor: null }));
  await page.route('**/api/v1/timeline/channels/99/items?**', (route) => json(route, agentCommonsTimeline));
  await page.route('**/api/v1/timeline/channels/7/stream', (route) => timelineStream(route));
  await page.route('**/api/v1/timeline/channels/7/stream?**', (route) => eventStream(route, [
    { type: 'stream_open', data: { channel_id: 7 } },
    {
      type: 'timeline_item',
      data: {
        timeline_id: 'tl-stream-1',
        cursor: 'cursor-stream-1',
        source_domain: 'conversation',
        source_id: '73',
        event_kind: 'channel_message',
        actor: { identity: 'patch' },
        body: 'Stream fixture loaded',
        occurred_at: '2026-07-02T00:04:00Z',
      },
    },
  ]));
  await page.route('**/api/v1/timeline/channels/8/stream', (route) => eventStream(route, [{ type: 'stream_open', data: { channel_id: 8 } }]));
  await page.route('**/api/v1/timeline/channels/8/stream?**', (route) => eventStream(route, [{ type: 'stream_open', data: { channel_id: 8 } }]));
  await page.route('**/api/v1/timeline/channels/99/stream', (route) => eventStream(route, [{ type: 'stream_open', data: { channel_id: 99 } }]));
  await page.route('**/api/v1/timeline/channels/99/stream?**', (route) => eventStream(route, [{ type: 'stream_open', data: { channel_id: 99 } }]));
  await page.route('**/api/v1/delivery/intents', (route) => json(route, { id: 'intent-1', state: 'pending' }));
  await page.route('**/api/v1/user-notifications?**', (route) => json(route, notifications));
  await page.route('**/api/v1/user-notifications/read', (route) => json(route, { marked: 1 }));
  await page.route('**/api/v1/projects/den-web/messages?**', (route) => json(route, messagesFor(route)));
  await page.route('**/api/v1/projects/den-web/messages/threads/1', (route) => json(route, threadMessages));
  await page.route('**/api/v1/artifacts/resolve?**', (route) => json(route, artifactMetadata));
  await page.route('**/api/v1/artifacts/art_fixture_image/metadata', (route) => json(route, artifactMetadata));
  await page.route('**/api/v1/artifacts/art_fixture_image/content', (route) => route.fulfill({
    contentType: 'image/png',
    body: artifactPng,
  }));
  await page.route('**/api/v1/projects/den-web/documents', (route) => json(route, documents));
  await page.route('**/api/v1/projects/_global/documents', (route) => json(route, globalDocuments));
  await page.route('**/api/v1/projects/den-web/documents/successor-brief', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { readonly content_markdown?: string };
      await json(route, { ...documentDetail, content_markdown: body.content_markdown ?? documentDetail.content_markdown });
      return;
    }
    await json(route, documentDetail);
  });
  await page.route('**/api/v1/projects/den-web/documents/a-very-long-document-slug-used-to-keep-the-list-row-height-stable', (route) => json(route, longDocumentDetail));
  await page.route('**/api/v1/projects/den-web/documents/successor-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/den-web/documents/a-very-long-document-slug-used-to-keep-the-list-row-height-stable/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/asha/documents', (route) => json(route, ashaDocuments));
  await page.route('**/api/v1/projects/asha/documents/asha-brief', (route) => json(route, ashaDocumentDetail));
  await page.route('**/api/v1/projects/asha/documents/asha-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/_global/documents/global-brief', (route) => json(route, globalDocumentDetail));
  await page.route('**/api/v1/projects/_global/documents/global-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/blog/publications/preview', (route) => json(route, publication));
  await page.route('**/api/v1/blog/publications', (route) => json(route, { ...publication, status: 'published', dry_run: false }));
  await page.route('**/api/v1/projects/den-web/librarian/query', (route) => json(route, { answer: 'Librarian fixture loaded', sources: [{ title: 'fixture' }] }));
  await page.route('**/api/v1/observation/lane?**', (route) => json(route, observation));
}

function includeArchivedHidden(route: Route): boolean {
  const url = new URL(route.request().url());
  return url.searchParams.get('include_archived') === 'true' && url.searchParams.get('include_hidden') === 'true';
}

function channelListFor(route: Route): unknown {
  const url = new URL(route.request().url());
  return url.searchParams.get('kind') === 'system' ? systemChannels : channels;
}

function membershipListFor(route: Route): unknown {
  const url = new URL(route.request().url());
  return url.searchParams.get('channel_id') === '99'
    ? [{ id: 9901, channel_id: 99, member_identity: 'codex', member_type: 'agent', membership_status: 'active', wake_policy: 'normal' }]
    : memberships;
}

function messagesFor(route: Route): unknown {
  const url = new URL(route.request().url());
  return url.searchParams.get('task_id') === '3993' ? taskMessages : messages;
}

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function timelineStream(route: Route): Promise<void> {
  return eventStream(route, [
    { type: 'stream_open', data: { channel_id: 7 } },
    {
      type: 'timeline_item',
      data: {
        timeline_id: 'tl-stream-1',
        cursor: 'cursor-stream-1',
        source_domain: 'conversation',
        source_id: '73',
        event_kind: 'channel_message',
        actor: { identity: 'patch' },
        body: 'Stream fixture loaded',
        occurred_at: '2026-07-02T00:04:00Z',
      },
    },
  ]);
}

function eventStream(route: Route, events: readonly { readonly type: string; readonly data: unknown }[]): Promise<void> {
  return route.fulfill({
    contentType: 'text/event-stream',
    headers: { 'Cache-Control': 'no-cache' },
    body: events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`).join(''),
  });
}

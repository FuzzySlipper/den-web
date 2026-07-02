import type { Page, Route } from '@playwright/test';

const project = { id: 'den-web', name: 'Den Web', visibility: 'normal' };
const spaces = [
  { id: 'den-web', name: 'Den Web', kind: 'project', visibility: 'normal' },
  { id: 'asha', name: 'Asha Studio', kind: 'project', visibility: 'normal' },
];
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
const tasks = [primaryTask, nestedTask];
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
const taskDetail = {
  task: primaryTask,
  dependencies: [],
  subtasks: [nestedTask],
  recent_messages: [
    { id: 1, sender: 'codex', content: 'Phase 4 fixture loaded', created_at: '2026-07-02T00:00:00Z' },
  ],
};
const channels = [{ id: 7, project_id: 'den-web', slug: 'den-web', name: 'den-web', kind: 'project_default' }];
const channelMessages = [{ id: 71, channel_id: 7, sender_identity: 'codex', sender_type: 'agent', body: 'Conversation fixture loaded', created_at: '2026-07-02T00:00:00Z' }];
const timeline = { items: [{ id: 'tl-1', kind: 'message', title: 'Timeline fixture loaded', created_at: '2026-07-02T00:00:00Z' }], next_cursor: null };
const notifications = [{ id: 9, project_id: 'den-web', task_id: 3993, sender: 'den-services', content: 'Notification fixture loaded', urgency: 'normal', is_read: false, created_at: '2026-07-02T00:00:00Z', metadata: null }];
const messages = [{ id: 1, project_id: 'den-web', task_id: 3993, thread_id: 1, sender: 'codex', intent: 'handoff', content: 'Message fixture loaded', created_at: '2026-07-02T00:00:00Z' }];
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
const documentDetail = { ...documents[0], content_markdown: '# Successor Brief\n\nDocument fixture loaded.', tags: ['successor'] };
const longDocumentDetail = { ...documents[1], content_markdown: '# Stable Rows\n\nSecond fixture loaded.', tags: ['successor', 'layout'] };
const ashaDocuments = [{ project_id: 'asha', slug: 'asha-brief', title: 'Asha Brief', updated_at: '2026-07-02T00:00:00Z' }];
const ashaDocumentDetail = { ...ashaDocuments[0], content_markdown: '# Asha Brief\n\nAsha document fixture loaded.', tags: ['space'] };
const discussion = { comments: [{ id: 1, author_identity: 'codex', body_markdown: 'Discussion fixture loaded', parent_comment_id: null, created_at: '2026-07-02T00:00:00Z' }] };
const observation = {
  items: [{ id: 'agent-1', agent_identity: 'den-mcp-runner', title: 'Agent fixture loaded', summary: 'Observation-backed overview', status: 'active', project_id: 'den-web', task_id: 3993 }],
  source_health: [{ source: 'observation', status: 'degraded', detail: 'Fixture degraded state' }],
};

export async function mockDenServices(page: Page): Promise<void> {
  await page.route('**/api/v1/projects', (route) => json(route, [project]));
  await page.route('**/api/v1/spaces', (route) => json(route, spaces));
  await page.route('**/api/v1/spaces?**', (route) => json(route, spaces));
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
  await page.route('**/api/v1/projects/asha/tasks/4100', (route) => json(route, {
    task: ashaTask,
    dependencies: [],
    subtasks: [],
    recent_messages: [],
  }));
  await page.route('**/api/v1/conversation/channels?**', (route) => json(route, channels));
  await page.route('**/api/v1/conversation/channels/7/messages', (route) => json(route, channelMessages));
  await page.route('**/api/v1/conversation/channels/7/messages?**', (route) => json(route, channelMessages));
  await page.route('**/api/v1/timeline/channels/7/items?**', (route) => json(route, timeline));
  await page.route('**/api/v1/user-notifications?**', (route) => json(route, notifications));
  await page.route('**/api/v1/user-notifications/read', (route) => json(route, { marked: 1 }));
  await page.route('**/api/v1/projects/den-web/messages?**', (route) => json(route, messages));
  await page.route('**/api/v1/projects/den-web/messages/threads/1', (route) => json(route, messages));
  await page.route('**/api/v1/projects/den-web/documents', (route) => json(route, documents));
  await page.route('**/api/v1/projects/den-web/documents/successor-brief', (route) => json(route, documentDetail));
  await page.route('**/api/v1/projects/den-web/documents/a-very-long-document-slug-used-to-keep-the-list-row-height-stable', (route) => json(route, longDocumentDetail));
  await page.route('**/api/v1/projects/den-web/documents/successor-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/den-web/documents/a-very-long-document-slug-used-to-keep-the-list-row-height-stable/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/asha/documents', (route) => json(route, ashaDocuments));
  await page.route('**/api/v1/projects/asha/documents/asha-brief', (route) => json(route, ashaDocumentDetail));
  await page.route('**/api/v1/projects/asha/documents/asha-brief/discussion', (route) => json(route, discussion));
  await page.route('**/api/v1/projects/den-web/librarian/query', (route) => json(route, { answer: 'Librarian fixture loaded', sources: [{ title: 'fixture' }] }));
  await page.route('**/api/v1/observation/lane?**', (route) => json(route, observation));
}

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

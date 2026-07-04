import { describe, expect, it } from 'vitest';
import type { ClockPort, KeyValueStoragePort } from '@den-web/platform';
import { memoryStorage } from '@den-web/platform';
import type {
  DenChannelMessage,
  DenDiscussion,
  DenDocumentDetail,
  DenDocumentSummary,
  DenNotification,
  DenObservationLane,
  DenProject,
  DenResult,
  DenSpace,
  DenTaskDetail,
  DenTaskSummary,
  DenTimelineResponse,
} from '@den-web/protocol';
import { DEN_GLOBAL_PROJECT_ID } from '@den-web/protocol';
import {
  createAgentsStore,
  createConversationStore,
  createDocumentsStore,
  createNotificationsStore,
  createTasksStore,
  createWorkspaceStore,
  NOTIFICATION_READ_CACHE_KEY,
  stateValue,
} from '../index';

const ok = <T>(value: T): DenResult<T> => ({ ok: true, value });

describe('successor signal stores', () => {
  it('refreshes workspace state through readonly async signals and named commands', async () => {
    const clock = fakeClock();
    const store = createWorkspaceStore({
      listProjects: async () => ok([projectFixture()]),
      listSpaces: async () => ok([spaceFixture()]),
    }, clock);

    await store.refresh();

    expect(store.projects().kind).toBe('data');
    expect(store.selectedProjectId()).toBe('den-web');
    expect(store.selectedSpaceId()).toBe('den-web');
    expect('set' in store.projects).toBe(false);
  });

  it('uses selected spaces as the active project scope', async () => {
    const store = createWorkspaceStore({
      listProjects: async () => ok([projectFixture()]),
      listSpaces: async () => ok([spaceFixture(), spaceFixture({ id: 'asha', name: 'Asha Studio' })]),
    }, fakeClock());

    await store.refresh();
    store.selectSpace('asha');

    expect(store.selectedSpaceId()).toBe('asha');
    expect(store.selectedProjectId()).toBe('asha');
  });

  it('refreshes archived and hidden workspace visibility on demand', async () => {
    const projectOptions: unknown[] = [];
    const spaceOptions: unknown[] = [];
    const store = createWorkspaceStore({
      listProjects: async (options) => {
        projectOptions.push(options);
        return ok([projectFixture()]);
      },
      listSpaces: async (options) => {
        spaceOptions.push(options);
        return ok(options?.includeArchived ? [
          spaceFixture(),
          spaceFixture({ id: 'old-den', name: 'Old Den', visibility: 'archived' }),
        ] : [spaceFixture()]);
      },
    }, fakeClock());

    await store.refresh();
    store.selectSpace('old-den');
    store.setIncludeArchivedHidden(true);
    await eventually(() => stateValue(store.spaces())?.some((space) => space.id === 'old-den') === true);
    store.setIncludeArchivedHidden(false);
    await eventually(() => store.selectedProjectId() === 'den-web');

    expect(store.includeArchivedHidden()).toBe(false);
    expect(projectOptions).toEqual([{}, { includeHidden: true, includeArchived: true }, {}]);
    expect(spaceOptions).toEqual([{}, { includeHidden: true, includeArchived: true }, {}]);
  });

  it('keeps the synthetic global workspace selectable without a backing project row', async () => {
    const store = createWorkspaceStore({
      listProjects: async () => ok([]),
      listSpaces: async () => ok([]),
    }, fakeClock());

    await store.refresh();
    store.selectProject(DEN_GLOBAL_PROJECT_ID);

    expect(store.selectedProjectId()).toBe(DEN_GLOBAL_PROJECT_ID);
    expect(store.selectedSpaceId()).toBeNull();
  });

  it('keeps workspace data visible during background refreshes', async () => {
    let resolver: ((value: DenResult<readonly DenProject[]>) => void) | null = null;
    const store = createWorkspaceStore({
      listProjects: () => new Promise((resolve) => {
        resolver = resolve;
      }),
      listSpaces: async () => ok([spaceFixture()]),
    }, fakeClock());

    const firstRefresh = store.refresh();
    resolver?.(ok([projectFixture()]));
    await firstRefresh;

    const secondRefresh = store.refresh();

    expect(store.projects().kind).toBe('data');
    resolver?.(ok([projectFixture({ name: 'Den Web Updated' })]));
    await secondRefresh;
    expect(stateValue(store.projects())?.[0]?.name).toBe('Den Web Updated');
  });

  it('keeps task filtering, search, and flat mode in the task store', async () => {
    const store = createTasksStore({
      listTasks: async () => ok([
        taskFixture({ id: 10, title: 'Parent milestone' }),
        taskFixture({ id: 3992, title: 'Domain stores', parent_id: 10 }),
      ]),
      getTask: async (_projectId, taskId) => ok(taskDetailFixture({ task: taskFixture({ id: taskId }) })),
      updateTask: async () => ok(undefined),
    }, {
      listMessages: async () => ok([]),
    });

    await store.refresh('den-web');
    store.setQuery('3992');

    expect(store.rows().map((row) => row.task.id)).toEqual([10, 3992]);
    store.setFlat(true);
    expect(store.rows()[0]?.parent?.id).toBe(10);
  });

  it('reconciles task edits into selected detail and list state', async () => {
    const patches: unknown[] = [];
    const store = createTasksStore({
      listTasks: async () => ok([taskFixture({ id: 3992, description: 'old', status: 'planned' })]),
      getTask: async (_projectId, taskId) => ok(taskDetailFixture({
        task: taskFixture({ id: taskId, description: 'old', status: 'planned' }),
      })),
      updateTask: async (_projectId, taskId, patch) => {
        patches.push(patch);
        return ok({ id: taskId, ...patch });
      },
    }, {
      listMessages: async () => ok([]),
    });

    await store.refresh('den-web');
    await store.selectTask('den-web', 3992);
    await store.updateTaskStatus('den-web', 3992, 'in_progress');
    await store.updateTaskDescription('den-web', 3992, 'new body');

    expect(stateValue(store.selectedTask())?.task.status).toBe('in_progress');
    expect(stateValue(store.selectedTask())?.task.description).toBe('new body');
    expect(stateValue(store.tasks())?.[0]?.status).toBe('in_progress');
    expect(stateValue(store.tasks())?.[0]?.description).toBe('new body');
    expect(patches).toEqual([
      { agent: 'web-ui', status: 'in_progress' },
      { agent: 'web-ui', description: 'new body' },
    ]);
  });

  it('loads task-scoped messages into selected task details', async () => {
    const store = createTasksStore({
      listTasks: async () => ok([taskFixture({ id: 4104, status: 'review' })]),
      getTask: async (_projectId, taskId) => ok(taskDetailFixture({
        task: taskFixture({ id: taskId, status: 'review' }),
        recent_messages: [],
      })),
      updateTask: async () => ok(undefined),
    }, {
      listMessages: async (_projectId, options) => ok([
        {
          id: 17653,
          project_id: 'asha',
          task_id: options?.taskId ?? null,
          sender: 'codex',
          intent: 'handoff',
          content: 'Studio encounter/tuning handoff is ready for review.',
          created_at: '2026-07-04T05:08:33.975068Z',
        },
      ]),
    });

    await store.selectTask('asha', 4104);

    expect(stateValue(store.selectedTask())?.recent_messages?.[0]?.content).toContain('ready for review');
    expect(stateValue(store.selectedTask())?.task.status).toBe('review');
  });

  it('owns dirty document switching and separate discussion reads', async () => {
    const current = documentSummaryFixture({ slug: 'current' });
    const next = documentSummaryFixture({ slug: 'next' });
    const store = createDocumentsStore({
      listDocuments: async () => ok([current, next]),
      getDocument: async (_projectId, slug) => ok(documentDetailFixture({ slug })),
      updateDocument: async () => ok(undefined),
      getDiscussion: async () => ok(discussionFixture()),
    });

    await store.select(current);
    store.setDirty(true);

    expect(await store.select(next)).toBe('prompt-for-dirty-switch');
    expect(store.selected()?.slug).toBe('current');
    await store.confirmSelect(next);
    expect(store.discussion().kind).toBe('data');
  });

  it('clears selected document detail when refreshing a different project', async () => {
    const store = createDocumentsStore({
      listDocuments: async (projectId) => ok([documentSummaryFixture({ project_id: projectId, slug: `${projectId}-doc` })]),
      getDocument: async (projectId, slug) => ok(documentDetailFixture({ project_id: projectId, slug })),
      updateDocument: async () => ok(undefined),
      getDiscussion: async () => ok(discussionFixture()),
    });

    await store.refresh('den-web');
    await store.select(documentSummaryFixture({ project_id: 'den-web', slug: 'den-web-doc' }));
    await store.refresh('asha');

    expect(store.selected()).toBeNull();
    expect(store.detail().kind).toBe('idle');
    expect(store.dirty()).toBe(false);
  });

  it('updates document content with the web UI actor', async () => {
    const patches: unknown[] = [];
    const store = createDocumentsStore({
      listDocuments: async () => ok([documentSummaryFixture()]),
      getDocument: async (_projectId, slug) => ok(documentDetailFixture({ slug, content_markdown: 'old' })),
      updateDocument: async (_projectId, _slug, patch) => {
        patches.push(patch);
        return ok({ ...documentDetailFixture({ content_markdown: patch.content_markdown }) });
      },
      getDiscussion: async () => ok(discussionFixture()),
    });

    await store.refresh('den-web');
    await store.select(documentSummaryFixture());
    await store.updateDocumentContent('den-web', 'successor-brief', '# New body');

    expect(stateValue(store.detail())?.content_markdown).toBe('# New body');
    expect(stateValue(store.documents())?.[0]?.title).toBe('Successor Brief');
    expect(patches).toEqual([{ agent: 'web-ui', content_markdown: '# New body' }]);
  });

  it('persists optimistic notification read state through the storage port', async () => {
    const storage = memoryStorage();
    const store = createNotificationsStore({
      listUserNotifications: async () => ok([notificationFixture({ id: 1, is_read: false })]),
      markRead: async () => ok({ marked: 1 }),
    }, storage);

    await store.refresh();
    expect(store.unreadCount()).toBe(1);
    await store.markRead(['notification:1']);

    expect(store.unreadCount()).toBe(0);
    expect(readStorageSet(storage, NOTIFICATION_READ_CACHE_KEY)).toEqual(new Set(['notification:1']));
  });

  it('loads conversation messages and timeline projections by selected channel', async () => {
    const store = createConversationStore({
      listChannels: async () => ok([{ id: 10, slug: 'den-web', project_id: 'den-web' }]),
      listMemberships: async () => ok([{ id: 1, channel_id: 10, member_identity: 'codex', member_type: 'agent', membership_status: 'active' }]),
      listMessages: async () => ok([channelMessageFixture({ id: 4 })]),
      postMessage: async (_channelId, body) => ok(channelMessageFixture({ id: 5, body: body.body })),
    }, {
      listChannelItems: async () => ok(timelineFixture()),
    });

    await store.refreshChannels('den-web');
    await store.selectChannel(10);
    await store.sendMessage('codex', 'Hello', 'phase-3');

    expect(store.messages().kind).toBe('data');
    expect(store.memberships().kind).toBe('data');
    expect(store.timeline().kind).toBe('data');
  });

  it('selects the top channel whenever conversation project channels refresh', async () => {
    let projectId = 'den-web';
    const store = createConversationStore({
      listChannels: async () => ok(projectId === 'den-web'
        ? [
            { id: 10, slug: 'den-web', project_id: 'den-web' },
            { id: 11, slug: 'ops', project_id: 'den-web' },
          ]
        : [{ id: 20, slug: 'asha', project_id: 'asha' }]),
      listMemberships: async (options) => ok([{ id: 1, channel_id: options?.channelId, member_identity: 'codex', member_type: 'agent' }]),
      listMessages: async (channelId) => ok([channelMessageFixture({ id: channelId, channel_id: channelId })]),
      postMessage: async (_channelId, body) => ok(channelMessageFixture({ id: 5, body: body.body })),
    }, {
      listChannelItems: async () => ok(timelineFixture()),
    });

    await store.refreshChannels(projectId);
    await store.selectChannel(11);
    projectId = 'asha';
    await store.refreshChannels(projectId);

    expect(store.selectedChannelId()).toBe(20);
    expect(stateValue(store.messages())?.[0]?.channel_id).toBe(20);
  });

  it('projects observation lanes through the agents store', async () => {
    const store = createAgentsStore({
      lane: async () => ok(observationLaneFixture({ source_health: [{ source: 'observation', status: 'unavailable' }] })),
    });

    await store.refresh();

    expect(store.overview().kind).toBe('data');
    expect(store.degraded()).toBe(true);
  });
});

function fakeClock(): ClockPort {
  return {
    now: () => new Date('2026-07-02T00:00:00Z'),
    setTimeout: () => 1,
    clearTimeout: () => undefined,
  };
}

function readStorageSet(storage: KeyValueStoragePort, key: string): ReadonlySet<string> {
  const raw = storage.getItem(key);
  return new Set(raw ? JSON.parse(raw) as string[] : []);
}

async function eventually(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  expect(predicate()).toBe(true);
}

function projectFixture(overrides: Partial<DenProject> = {}): DenProject {
  return { id: 'den-web', name: 'Den Web', visibility: 'normal', ...overrides };
}

function spaceFixture(overrides: Partial<DenSpace> = {}): DenSpace {
  return { id: 'den-web', name: 'Den Web', kind: 'project', visibility: 'normal', ...overrides };
}

function taskFixture(overrides: Partial<DenTaskSummary> = {}): DenTaskSummary {
  return {
    id: 1,
    project_id: 'den-web',
    title: 'Example task',
    status: 'planned',
    assigned_to: 'codex',
    parent_id: null,
    tags: ['successor'],
    availability: 'available',
    unfinished_dependency_count: 0,
    ...overrides,
  };
}

function taskDetailFixture(overrides: Partial<DenTaskDetail> = {}): DenTaskDetail {
  return { task: taskFixture(), dependencies: [], subtasks: [], recent_messages: [], ...overrides };
}

function documentSummaryFixture(overrides: Partial<DenDocumentSummary> = {}): DenDocumentSummary {
  return { project_id: 'den-web', slug: 'successor-brief', title: 'Successor Brief', ...overrides };
}

function documentDetailFixture(overrides: Partial<DenDocumentDetail> = {}): DenDocumentDetail {
  return { ...documentSummaryFixture(), content_markdown: '# Successor Brief', ...overrides };
}

function discussionFixture(overrides: Partial<DenDiscussion> = {}): DenDiscussion {
  return { comments: [{ id: 1, author_identity: 'codex', body_markdown: 'Readable body', parent_comment_id: null }], ...overrides };
}

function notificationFixture(overrides: Partial<DenNotification> = {}): DenNotification {
  return {
    id: 1,
    project_id: 'den-web',
    task_id: 3992,
    sender: 'den-services',
    content: 'Phase update available',
    urgency: 'normal',
    is_read: false,
    metadata: null,
    created_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

function channelMessageFixture(overrides: Partial<DenChannelMessage> = {}): DenChannelMessage {
  return {
    id: 1,
    channel_id: 10,
    sender_identity: 'patch',
    sender_type: 'user',
    body: 'Hello',
    summary: null,
    metadata: null,
    created_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

function timelineFixture(overrides: Partial<DenTimelineResponse> = {}): DenTimelineResponse {
  return { items: [{ id: 'evt-1', kind: 'message', title: 'Message posted' }], next_cursor: null, ...overrides };
}

function observationLaneFixture(overrides: Partial<DenObservationLane> = {}): DenObservationLane {
  return {
    items: [{ id: 'agent-1', agent_identity: 'den-mcp-runner', status: 'active' }],
    source_health: [{ source: 'observation', status: 'ok' }],
    ...overrides,
  };
}

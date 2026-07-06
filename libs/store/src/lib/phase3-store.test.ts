import { describe, expect, it } from 'vitest';
import type { ClockPort, KeyValueStoragePort } from '@den-web/platform';
import { memoryStorage } from '@den-web/platform';
import type {
  DenChannelMessage,
  DenDiscussion,
  DenDocumentDetail,
  DenDocumentSummary,
  DenGuidanceEntry,
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
  createGuidanceStore,
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

  it('switches task list sorting between priority and id', async () => {
    const store = createTasksStore({
      listTasks: async () => ok([
        taskFixture({ id: 4100, title: 'Earlier low priority', priority: 5 }),
        taskFixture({ id: 4200, title: 'Middle priority', priority: 3 }),
        taskFixture({ id: 5000, title: 'Later high priority', priority: 1 }),
      ]),
      getTask: async (_projectId, taskId) => ok(taskDetailFixture({ task: taskFixture({ id: taskId }) })),
      updateTask: async () => ok(undefined),
    }, {
      listMessages: async () => ok([]),
    });

    await store.refresh('den-web');

    expect(store.sortMode()).toBe('priority');
    expect(store.rows().map((row) => row.task.id)).toEqual([5000, 4200, 4100]);
    store.setSortMode('id');
    expect(store.rows().map((row) => row.task.id)).toEqual([4100, 4200, 5000]);
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

  it('quietly refreshes task lists and reconciles selected task status', async () => {
    let resolveQuietRefresh: ((result: DenResult<readonly DenTaskSummary[]>) => void) | null = null;
    let refreshCount = 0;
    const store = createTasksStore({
      listTasks: async () => {
        refreshCount += 1;
        if (refreshCount === 1) return ok([taskFixture({ id: 3992, status: 'in_progress' })]);
        return new Promise<DenResult<readonly DenTaskSummary[]>>((resolve) => {
          resolveQuietRefresh = resolve;
        });
      },
      getTask: async (_projectId, taskId) => ok(taskDetailFixture({
        task: taskFixture({ id: taskId, status: 'in_progress' }),
      })),
      updateTask: async () => ok(undefined),
    }, {
      listMessages: async () => ok([]),
    });

    await store.refresh('den-web');
    await store.selectTask('den-web', 3992);
    const quietRefresh = store.refresh('den-web', { quiet: true });

    expect(store.tasks().kind).toBe('data');
    resolveQuietRefresh?.(ok([taskFixture({ id: 3992, status: 'done' })]));
    await quietRefresh;

    expect(store.tasks().kind).toBe('data');
    expect(store.rows().map((row) => row.task.id)).toEqual([]);
    expect(stateValue(store.selectedTask())?.task.status).toBe('done');
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

  it('loads and edits project guidance entries with referenced document content', async () => {
    const guidanceBodies: unknown[] = [];
    const documentPatches: unknown[] = [];
    const store = createGuidanceStore({
      listEntries: async (_projectId, options) => ok({
        entries: options?.includeGlobal ? [guidanceEntryFixture(), guidanceEntryFixture({ id: 2, project_id: DEN_GLOBAL_PROJECT_ID, document_project_id: DEN_GLOBAL_PROJECT_ID, document_slug: 'global-brief' })] : [guidanceEntryFixture()],
        count: options?.includeGlobal ? 2 : 1,
      }),
      resolve: async (projectId) => ok({
        project_id: projectId,
        sources: [{ entry_id: 1, source_scope: 'den-web', document_project_id: 'den-web', document_slug: 'successor-brief', document_title: 'Successor Brief', importance: 'required', sort_order: 10 }],
        skipped_sources: [],
      }),
      addEntry: async (projectId, body) => {
        guidanceBodies.push({ projectId, body });
        return ok(guidanceEntryFixture({
          importance: body.importance ?? 'important',
          audience: body.audience ?? [],
          sort_order: body.sort_order ?? 0,
          notes: body.notes ?? '',
        }));
      },
      deleteEntry: async (projectId, entryId) => ok({ deleted: projectId === 'den-web' && entryId === 1 }),
    }, {
      getDocument: async (projectId, slug) => ok(documentDetailFixture({ project_id: projectId, slug, content_markdown: 'old guidance' })),
      updateDocument: async (_projectId, _slug, patch) => {
        documentPatches.push(patch);
        return ok(documentDetailFixture({ content_markdown: patch.content_markdown }));
      },
    });

    await store.refresh('den-web');
    expect(stateValue(store.entries())?.map((entry) => entry.project_id)).toEqual(['den-web', DEN_GLOBAL_PROJECT_ID]);

    const entry = stateValue(store.entries())?.[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    await store.selectEntry(entry);
    await store.saveEntry('den-web', entry, { importance: 'important', audience: ['all'], sortOrder: 20, notes: 'trimmed' });
    await store.updateSelectedDocumentContent('# Edited guidance');
    await store.deleteEntry('den-web', entry);

    expect(guidanceBodies).toEqual([{
      projectId: 'den-web',
      body: {
        document_project_id: 'den-web',
        document_slug: 'successor-brief',
        importance: 'important',
        audience: ['all'],
        sort_order: 20,
        notes: 'trimmed',
      },
    }]);
    expect(documentPatches).toEqual([{ agent: 'web-ui', content_markdown: '# Edited guidance' }]);
    expect(store.selectedEntry()).toBeNull();
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
    const postedBodies: unknown[] = [];
    const deliveryBodies: unknown[] = [];
    const store = createConversationStore({
      listChannels: async () => ok([{ id: 10, slug: 'den-web', project_id: 'den-web' }]),
      listMemberships: async () => ok([{
        id: 1,
        channel_id: 10,
        member_identity: 'codex',
        member_type: 'agent',
        membership_status: 'active',
        wake_policy: 'mentions_only',
        wake_target: { profile: 'codex', instance_id: 'codex@den-srv' },
      }]),
      putMembership: async (_channelId, body) => ok({
        id: 1,
        channel_id: 10,
        member_identity: body.member_identity,
        member_type: body.member_type,
        membership_status: body.membership_status,
        wake_policy: body.wake_policy,
      }),
      listMessages: async () => ok([channelMessageFixture({ id: 4 })]),
      postMessage: async (_channelId, body) => {
        postedBodies.push(body);
        return ok(channelMessageFixture({ id: 5, body: body.body }));
      },
    }, {
      listChannelItems: async () => ok(timelineFixture()),
      streamChannelItems: (_channelId, options) => {
        options.onItem({ timeline_id: 'msg:6', source_domain: 'conversation', source_id: '6', event_kind: 'channel_message', actor: { identity: 'codex' }, body: 'streamed', occurred_at: '2026-07-02T00:03:00Z' });
        return { close: () => undefined };
      },
    }, {
      createIntent: async (body) => {
        deliveryBodies.push(body);
        return ok({ id: 1, state: 'pending' });
      },
    });

    await store.refreshChannels('den-web');
    await store.selectChannel(10);
    const stop = store.streamChannel(10);
    stop();
    await store.sendMessage('codex', 'Hello @codex', 'phase-3');

    expect(store.messages().kind).toBe('data');
    expect(store.memberships().kind).toBe('data');
    expect(store.timeline().kind).toBe('data');
    expect(stateValue(store.timeline())?.find((item) => item.id === 'msg:6')).toMatchObject({
      sender: 'codex',
      createdAt: '2026-07-02T00:03:00Z',
    });
    expect(postedBodies).toEqual([{
      sender_type: 'user',
      sender_identity: 'codex',
      body: 'Hello @codex',
      message_kind: 'human_text',
      source_kind: 'den_web_channel_post',
      dedupe_key: 'phase-3',
    }]);
    expect(deliveryBodies).toEqual([{
      target_identity: { profile: 'codex', instance_id: 'codex@den-srv' },
      idempotency_key: expect.stringMatching(/^mention:10:codex:/),
      source_ref: 'conversation:channels/10/messages/5',
      channel_message_id: 5,
    }]);
  });

  it('does not guess wake targets from legacy agent instance fields', async () => {
    const deliveryBodies: unknown[] = [];
    const store = createConversationStore({
      listChannels: async () => ok([{ id: 10, slug: 'den-web', project_id: 'den-web' }]),
      listMemberships: async () => ok([{
        id: 1,
        channel_id: 10,
        member_identity: 'codex',
        member_type: 'agent',
        membership_status: 'active',
        profile_identity: 'codex',
        agent_instance_id: 'codex@legacy',
      }]),
      putMembership: async (_channelId, body) => ok({
        id: 1,
        channel_id: 10,
        member_identity: body.member_identity,
        member_type: body.member_type,
        membership_status: body.membership_status,
        wake_policy: body.wake_policy,
      }),
      listMessages: async () => ok([]),
      postMessage: async (_channelId, body) => ok(channelMessageFixture({ id: 6, body: body.body })),
    }, {
      listChannelItems: async () => ok(timelineFixture()),
      streamChannelItems: () => ({ close: () => undefined }),
    }, {
      createIntent: async (body) => {
        deliveryBodies.push(body);
        return ok({ id: 1, state: 'pending' });
      },
    });

    await store.refreshChannels('den-web');
    await store.sendMessage('codex', 'Hello @codex', 'phase-3');

    expect(deliveryBodies).toEqual([]);
  });

  it('wakes all-human-message participants without requiring mentions', async () => {
    const deliveryBodies: unknown[] = [];
    const store = createConversationStore({
      listChannels: async () => ok([{ id: 10, slug: 'den-web', project_id: 'den-web' }]),
      listMemberships: async () => ok([{
        id: 1,
        channel_id: 10,
        member_identity: 'codex',
        member_type: 'agent',
        membership_status: 'active',
        wake_policy: 'all_human_messages',
        wake_target: { profile: 'codex', instance_id: 'codex@den-srv' },
      }]),
      putMembership: async (_channelId, body) => ok({
        id: 1,
        channel_id: 10,
        member_identity: body.member_identity,
        member_type: body.member_type,
        membership_status: body.membership_status,
        wake_policy: body.wake_policy,
      }),
      listMessages: async () => ok([]),
      postMessage: async (_channelId, body) => ok(channelMessageFixture({ id: 8, sender_identity: body.sender_identity, body: body.body })),
    }, {
      listChannelItems: async () => ok(timelineFixture()),
      streamChannelItems: () => ({ close: () => undefined }),
    }, {
      createIntent: async (body) => {
        deliveryBodies.push(body);
        return ok({ id: 1, state: 'pending' });
      },
    });

    await store.refreshChannels('den-web');
    await store.sendMessage('patch', 'No mention needed', 'phase-3');

    expect(deliveryBodies).toEqual([{
      target_identity: { profile: 'codex', instance_id: 'codex@den-srv' },
      idempotency_key: expect.stringMatching(/^wake:10:codex:/),
      source_ref: 'conversation:channels/10/messages/8',
      channel_message_id: 8,
    }]);
  });

  it('saves and joins conversation agent memberships', async () => {
    const putBodies: unknown[] = [];
    const store = createConversationStore({
      listChannels: async () => ok([{ id: 10, slug: 'den-web', project_id: 'den-web' }]),
      listMemberships: async () => ok([{
        id: 1,
        channel_id: 10,
        member_identity: 'codex',
        member_type: 'agent',
        profile_identity: 'codex',
        membership_status: 'active',
        wake_policy: 'mentions_only',
        can_send: true,
        can_react: true,
        can_invite: false,
        settings: {},
      }]),
      putMembership: async (channelId, body) => {
        putBodies.push({ channelId, body });
        return ok({
          id: body.member_identity === 'new-agent' ? 2 : 1,
          channel_id: channelId,
          member_identity: body.member_identity,
          member_type: body.member_type,
          profile_identity: body.profile_identity,
          membership_status: body.membership_status,
          wake_policy: body.wake_policy,
        });
      },
      listMessages: async () => ok([]),
      postMessage: async (_channelId, body) => ok(channelMessageFixture({ id: 9, body: body.body })),
    }, {
      listChannelItems: async () => ok(timelineFixture()),
      streamChannelItems: () => ({ close: () => undefined }),
    }, {
      createIntent: async () => ok({ id: 1, state: 'pending' }),
    });

    await store.refreshChannels('den-web');
    const member = stateValue(store.memberships())?.[0];
    expect(member).toBeDefined();
    if (!member) return;
    await store.saveMembership(member, { wakePolicy: 'all_human_messages', membershipStatus: 'muted' });
    await store.joinAgent('new-agent', 'direct_questions_only');

    expect(putBodies).toEqual([
      {
        channelId: 10,
        body: {
          member_type: 'agent',
          member_identity: 'codex',
          profile_identity: 'codex',
          membership_status: 'muted',
          wake_policy: 'all_human_messages',
          can_send: true,
          can_react: true,
          can_invite: false,
          membership_purpose: 'ordinary',
          settings: {},
        },
      },
      {
        channelId: 10,
        body: {
          member_type: 'agent',
          member_identity: 'new-agent',
          profile_identity: 'new-agent',
          membership_status: 'active',
          wake_policy: 'direct_questions_only',
          can_send: true,
          can_react: true,
          can_invite: false,
          membership_purpose: 'ordinary',
          settings: {},
        },
      },
    ]);
    expect(stateValue(store.memberships())?.map((membership) => membership.member_identity)).toEqual(['codex', 'new-agent']);
    expect(stateValue(store.memberships())?.[0]?.wake_policy).toBe('all_human_messages');
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
      putMembership: async (_channelId, body) => ok({
        id: 1,
        channel_id: 10,
        member_identity: body.member_identity,
        member_type: body.member_type,
        membership_status: body.membership_status,
        wake_policy: body.wake_policy,
      }),
      listMessages: async (channelId) => ok([channelMessageFixture({ id: channelId, channel_id: channelId })]),
      postMessage: async (_channelId, body) => ok(channelMessageFixture({ id: 5, body: body.body })),
    }, {
      listChannelItems: async () => ok(timelineFixture()),
      streamChannelItems: () => ({ close: () => undefined }),
    }, {
      createIntent: async () => ok({ id: 1, state: 'pending' }),
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

function guidanceEntryFixture(overrides: Partial<DenGuidanceEntry> = {}): DenGuidanceEntry {
  return {
    id: 1,
    project_id: 'den-web',
    document_project_id: 'den-web',
    document_slug: 'successor-brief',
    importance: 'required',
    audience: ['planner'],
    sort_order: 10,
    notes: 'Project guidance',
    ...overrides,
  };
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

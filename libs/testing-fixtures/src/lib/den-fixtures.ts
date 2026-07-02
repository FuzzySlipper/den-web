import type {
  DenChannelMessage,
  DenConversationChannel,
  DenDiscussion,
  DenDiscussionComment,
  DenDocumentDetail,
  DenDocumentSummary,
  DenMessage,
  DenNotification,
  DenObservationLane,
  DenProject,
  DenSpace,
  DenTaskDetail,
  DenTaskSummary,
  DenTimelineResponse,
} from '@den-web/protocol';

export function projectFixture(overrides: Partial<DenProject> = {}): DenProject {
  return { id: 'den-web', name: 'Den Web', visibility: 'normal', ...overrides };
}

export function spaceFixture(overrides: Partial<DenSpace> = {}): DenSpace {
  return { id: 'den-web', name: 'Den Web', kind: 'project', visibility: 'normal', ...overrides };
}

export function taskFixture(overrides: Partial<DenTaskSummary> = {}): DenTaskSummary {
  return {
    id: 1,
    project_id: 'den-web',
    title: 'Example task',
    status: 'planned',
    priority: 3,
    assigned_to: 'codex',
    parent_id: null,
    tags: ['successor'],
    availability: 'available',
    dependency_count: 0,
    unfinished_dependency_count: 0,
    subtask_count: 0,
    created_at: '2026-07-02T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

export function taskDetailFixture(overrides: Partial<DenTaskDetail> = {}): DenTaskDetail {
  return {
    task: taskFixture(),
    dependencies: [],
    subtasks: [],
    recent_messages: [],
    ...overrides,
  };
}

export function documentSummaryFixture(overrides: Partial<DenDocumentSummary> = {}): DenDocumentSummary {
  return {
    project_id: 'den-web',
    slug: 'successor-brief',
    title: 'Successor Brief',
    updated_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

export function documentDetailFixture(overrides: Partial<DenDocumentDetail> = {}): DenDocumentDetail {
  return {
    ...documentSummaryFixture(),
    content_markdown: '# Successor Brief',
    tags: ['docs'],
    ...overrides,
  };
}

export function discussionCommentFixture(overrides: Partial<DenDiscussionComment> = {}): DenDiscussionComment {
  return {
    id: 1,
    author_identity: 'system-architect',
    body_markdown: 'Readable body text',
    parent_comment_id: null,
    created_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

export function discussionFixture(overrides: Partial<DenDiscussion> = {}): DenDiscussion {
  return { comments: [discussionCommentFixture()], ...overrides };
}

export function notificationFixture(overrides: Partial<DenNotification> = {}): DenNotification {
  return {
    id: 1,
    project_id: 'den-web',
    task_id: 3992,
    sender: 'den-services',
    content: 'Phase update available',
    urgency: 'normal',
    is_read: false,
    created_at: '2026-07-02T00:00:00Z',
    metadata: null,
    ...overrides,
  };
}

export function messageFixture(overrides: Partial<DenMessage> = {}): DenMessage {
  return {
    id: 1,
    project_id: 'den-web',
    task_id: 3992,
    thread_id: 8,
    sender: 'codex',
    intent: 'handoff',
    content: 'Implementation note',
    created_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

export function conversationChannelFixture(overrides: Partial<DenConversationChannel> = {}): DenConversationChannel {
  return { id: 10, project_id: 'den-web', slug: 'den-web', name: 'den-web', kind: 'project', ...overrides };
}

export function channelMessageFixture(overrides: Partial<DenChannelMessage> = {}): DenChannelMessage {
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

export function timelineFixture(overrides: Partial<DenTimelineResponse> = {}): DenTimelineResponse {
  return {
    items: [{ id: 'evt-1', kind: 'message', title: 'Message posted', created_at: '2026-07-02T00:00:00Z' }],
    next_cursor: null,
    ...overrides,
  };
}

export function observationLaneFixture(overrides: Partial<DenObservationLane> = {}): DenObservationLane {
  return {
    items: [
      {
        id: 'agent-1',
        agent_identity: 'den-mcp-runner',
        title: 'Running task',
        summary: 'Working through successor phase',
        status: 'active',
        project_id: 'den-web',
        task_id: 3992,
        updated_at: '2026-07-02T00:00:00Z',
      },
    ],
    source_health: [{ source: 'observation', status: 'ok', checked_at: '2026-07-02T00:00:00Z' }],
    ...overrides,
  };
}

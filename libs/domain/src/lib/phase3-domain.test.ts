import { describe, expect, it } from 'vitest';
import {
  channelMessagePrimaryBody,
  conversationFeedItems,
  discussionAuthor,
  discussionBody,
  discussionThreads,
  documentMarkdownBody,
  documentSelectionAction,
  extractArtifactReferences,
  isDependencyWaitingDetail,
  isDependencyWaitingTask,
  messageIntentLabel,
  messageViewItem,
  notificationCacheId,
  notificationViewItem,
  observationAgentsOverview,
  parseMessageBodySegments,
  parseNotificationReadCache,
  taskMatchesStatusFilter,
  visibleTaskRows,
} from '../index';
import type {
  DenChannelMessage,
  DenDiscussion,
  DenDiscussionComment,
  DenDocumentDetail,
  DenDocumentSummary,
  DenMessage,
  DenNotification,
  DenObservationLane,
  DenTaskDetail,
  DenTaskSummary,
} from '@den-web/protocol';

describe('successor task domain fixtures', () => {
  it('keeps active and dependency-waiting task filters distinct', () => {
    const waiting = taskFixture({ availability: 'waiting_on_dependencies', unfinished_dependency_count: 2 });
    const blocked = taskFixture({ status: 'blocked', availability: 'blocked', unfinished_dependency_count: 0 });
    const done = taskFixture({ status: 'done' });

    expect(taskMatchesStatusFilter(waiting, 'active')).toBe(true);
    expect(taskMatchesStatusFilter(done, 'active')).toBe(false);
    expect(isDependencyWaitingTask(waiting)).toBe(true);
    expect(taskMatchesStatusFilter(waiting, 'waiting_on_dependencies')).toBe(true);
    expect(taskMatchesStatusFilter(blocked, 'waiting_on_dependencies')).toBe(false);
  });

  it('detects waiting detail payloads from unfinished dependency rows', () => {
    const detail = taskDetailFixture({
      task: taskFixture({ availability: 'available', unfinished_dependency_count: 0 }),
      dependencies: [taskFixture({ id: 2, status: 'in_progress' })],
    });

    expect(isDependencyWaitingDetail(detail)).toBe(true);
  });

  it('keeps matching nested search results visible and preserves parent context in flat rows', () => {
    const parent = taskFixture({ id: 10, title: 'Parent milestone' });
    const child = taskFixture({ id: 3992, title: 'Domain stores', parent_id: 10, tags: ['phase-3'] });
    const nestedRows = visibleTaskRows([parent, child], { query: '3992' });
    const flatRows = visibleTaskRows([parent, child], { query: '3992', flat: true });

    expect(nestedRows.map((row) => row.task.id)).toEqual([10, 3992]);
    expect(flatRows).toHaveLength(1);
    expect(flatRows[0]?.parent?.id).toBe(10);
  });
});

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

function discussionCommentFixture(overrides: Partial<DenDiscussionComment> = {}): DenDiscussionComment {
  return {
    id: 1,
    author_identity: 'system-architect',
    body_markdown: 'Readable body text',
    parent_comment_id: null,
    created_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

function discussionFixture(overrides: Partial<DenDiscussion> = {}): DenDiscussion {
  return { comments: [discussionCommentFixture()], ...overrides };
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
    created_at: '2026-07-02T00:00:00Z',
    metadata: null,
    ...overrides,
  };
}

function messageFixture(overrides: Partial<DenMessage> = {}): DenMessage {
  return {
    id: 1,
    project_id: 'den-web',
    task_id: 3992,
    sender: 'codex',
    intent: 'handoff',
    content: 'Implementation note',
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

function observationLaneFixture(overrides: Partial<DenObservationLane> = {}): DenObservationLane {
  return {
    items: [{
      id: 'agent-1',
      agent_identity: 'den-mcp-runner',
      title: 'Running task',
      summary: 'Working through successor phase',
      status: 'active',
      project_id: 'den-web',
      task_id: 3992,
    }],
    source_health: [{ source: 'observation', status: 'ok' }],
    ...overrides,
  };
}

describe('successor document domain fixtures', () => {
  it('keeps dirty document switching as a store/domain decision', () => {
    const current = documentSummaryFixture({ slug: 'current' });
    const next = documentSummaryFixture({ slug: 'next' });

    expect(documentSelectionAction(current, current, true)).toBe('keep-current');
    expect(documentSelectionAction(current, next, true)).toBe('prompt-for-dirty-switch');
    expect(documentSelectionAction(current, next, false)).toBe('select');
  });

  it('separates canonical document Markdown from discussion threads', () => {
    const body = documentMarkdownBody(documentDetailFixture({ content: 'legacy body', content_markdown: '# Canonical' }));
    const fallback = documentMarkdownBody(documentDetailFixture({ content: 'live body', content_markdown: undefined }));
    const discussion = discussionFixture({
      comments: [
        discussionCommentFixture({ id: 2, parent_comment_id: 1, author_identity: 'patch', body_markdown: 'Reply' }),
        discussionCommentFixture({ id: 1, author_identity: 'codex', body_markdown: 'Root' }),
      ],
    });
    const [thread] = discussionThreads(discussion);

    expect(body).toBe('# Canonical');
    expect(fallback).toBe('live body');
    expect(thread ? discussionAuthor(thread.comment) : '').toBe('codex');
    expect(thread ? discussionBody(thread.replies[0] ?? thread.comment) : '').toBe('Reply');
  });
});

describe('successor notification and message fixtures', () => {
  it('treats local notification read state as an optimistic cache only', () => {
    const cached = parseNotificationReadCache(JSON.stringify([notificationCacheId(1)]));
    const item = notificationViewItem(notificationFixture({ id: 1, is_read: false }), cached);
    const urgent = notificationViewItem(notificationFixture({ id: 2, urgency: 'critical' }));

    expect(item.read).toBe(true);
    expect(urgent.severity).toBe('error');
  });

  it('projects messages to stable labels and display bodies', () => {
    expect(messageIntentLabel('review_feedback')).toBe('Feedback');
    expect(messageViewItem(messageFixture({ content: '', summary: 'Fallback summary' })).body).toBe('Fallback summary');
  });

  it('extracts den artifact refs from review metadata without raw image bytes', () => {
    const metadata = {
      packet_type: 'visual_inspect_result',
      artifact_refs: [{
        screenshot_id: 'overview',
        ref: 'den-artifact://art_01jexample',
        mime_type: 'image/png',
        sensitive: false,
      }],
      result: { verdict: 'pass' },
    };

    expect(extractArtifactReferences(metadata)).toEqual([{
      ref: 'den-artifact://art_01jexample',
      label: 'overview',
      mimeType: 'image/png',
      sensitive: false,
    }]);
    expect(JSON.stringify(metadata)).not.toContain('data:image');
    expect(JSON.stringify(metadata)).not.toContain('base64');
  });
});

describe('successor conversation and observation fixtures', () => {
  it('parses details blocks without exposing raw disclosure markup', () => {
    const segments = parseMessageBodySegments('Before\n<details><summary>Plan</summary>\n\nDo the thing\n</details>\nAfter');

    expect(segments).toEqual([
      { type: 'text', text: 'Before\n' },
      { type: 'details', summary: 'Plan', body: 'Do the thing' },
      { type: 'text', text: '\nAfter' },
    ]);
  });

  it('prefers the message body before metadata or summaries', () => {
    expect(channelMessagePrimaryBody(channelMessageFixture({ body: 'Request body', summary: 'Generated summary' }))).toBe('Request body');
  });

  it('merges channel messages and timeline items into chronological chat feed rows', () => {
    const feed = conversationFeedItems(
      [channelMessageFixture({ id: 1, body: 'Channel message', created_at: '2026-07-02T00:02:00Z' })],
      [{ id: 'tool-1', kind: 'observation_tool_call', title: 'Tool call', body: 'Observation event', sender: 'den-mcp-runner', createdAt: '2026-07-02T00:01:00Z' }],
    );

    expect(feed.map((item) => item.body)).toEqual(['Observation event', 'Channel message']);
  });

  it('marks the agents overview degraded when an observation source is unhealthy', () => {
    const model = observationAgentsOverview(observationLaneFixture({
      source_health: [{ source: 'observation', status: 'unavailable', detail: 'not ready' }],
    }));

    expect(model.degraded).toBe(true);
    expect(model.items[0]?.identity).toBe('den-mcp-runner');
  });
});

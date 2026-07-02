import type { NotificationFeedItem } from './types';
import { buildQuery, esc } from './http';
import { successorGet, successorPost } from './successorHttp';

// ---------------------------------------------------------------------------
// User Notifications canonical successor feed
// ---------------------------------------------------------------------------

export interface GetUserNotificationsOpts {
  projectId?: string;
  taskId?: number;
  sender?: string;
  metadataType?: string;
  urgency?: string;
  isRead?: boolean;
  /** Operator/agent identity. Required when isRead is specified by the Messages API contract. */
  readFor?: string;
  limit?: number;
  offset?: number;
}

export function getUserNotifications(opts: GetUserNotificationsOpts = {}): Promise<NotificationFeedItem[]> {
  const q = buildQuery({
    project_id: opts.projectId,
    task_id: opts.taskId,
    sender: opts.sender,
    metadata_type: opts.metadataType,
    urgency: opts.urgency,
    is_read: opts.isRead,
    read_for_agent: opts.readFor,
    limit: opts.limit,
    offset: opts.offset,
  });
  return successorGet(`/user-notifications${q}`);
}

export function getProjectUserNotifications(
  projectId: string,
  opts: Omit<GetUserNotificationsOpts, 'projectId'> = {},
): Promise<NotificationFeedItem[]> {
  const q = buildQuery({
    task_id: opts.taskId,
    sender: opts.sender,
    metadata_type: opts.metadataType,
    urgency: opts.urgency,
    is_read: opts.isRead,
    read_for_agent: opts.readFor,
    limit: opts.limit,
    offset: opts.offset,
  });
  return successorGet(`/projects/${esc(projectId)}/user-notifications${q}`);
}

export interface MarkNotificationsReadBody {
  agent: string;
  notification_ids?: number[];
  mark_all?: boolean;
  scope?: { project_id: string; task_id?: number };
}

export async function markNotificationsRead(body: MarkNotificationsReadBody): Promise<{ marked: number }> {
  const response = await successorPost<{ marked?: unknown }>('/user-notifications/read', {
    agent: body.agent,
    notification_ids: body.notification_ids,
    mark_all: body.mark_all,
    scope_project_id: body.scope?.project_id,
    scope_task_id: body.scope?.task_id,
  });
  if (typeof response.marked === 'number') {
    return { marked: response.marked };
  }
  return { marked: body.notification_ids?.length ?? 0 };
}

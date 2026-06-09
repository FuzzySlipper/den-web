import type { NotificationFeedItem } from './types';
import { buildQuery, esc, get, post } from './http';

// ---------------------------------------------------------------------------
// User Notifications (Core #1789 canonical feed)
// ---------------------------------------------------------------------------

export interface GetUserNotificationsOpts {
  projectId?: string;
  taskId?: number;
  sender?: string;
  metadataType?: string;
  urgency?: string;
  isRead?: boolean;
  /** Operator/agent identity. Required when isRead is specified by Core API contract. */
  readFor?: string;
  limit?: number;
  offset?: number;
}

export function getUserNotifications(opts: GetUserNotificationsOpts = {}): Promise<NotificationFeedItem[]> {
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
    sender: opts.sender,
    metadataType: opts.metadataType,
    urgency: opts.urgency,
    isRead: opts.isRead,
    readFor: opts.readFor,
    limit: opts.limit,
    offset: opts.offset,
  });
  return get(`/api/user-notifications${q}`);
}

export function getProjectUserNotifications(
  projectId: string,
  opts: Omit<GetUserNotificationsOpts, 'projectId'> = {},
): Promise<NotificationFeedItem[]> {
  const q = buildQuery({
    taskId: opts.taskId,
    sender: opts.sender,
    metadataType: opts.metadataType,
    urgency: opts.urgency,
    isRead: opts.isRead,
    readFor: opts.readFor,
    limit: opts.limit,
    offset: opts.offset,
  });
  return get(`/api/projects/${esc(projectId)}/user-notifications${q}`);
}

export interface MarkNotificationsReadBody {
  agent: string;
  notification_ids?: number[];
  mark_all?: boolean;
  scope?: { project_id: string; task_id?: number };
}

export function markNotificationsRead(body: MarkNotificationsReadBody): Promise<{ marked: number }> {
  return post('/api/user-notifications/mark-read', body);
}

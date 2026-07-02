import type { DenNotification } from '@den-web/protocol';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationViewItem {
  readonly id: string;
  readonly summary: string;
  readonly source: string;
  readonly severity: NotificationSeverity;
  readonly read: boolean;
  readonly projectId: string | null;
  readonly taskId: number | null;
  readonly createdAt: string;
}

export function notificationViewItem(notification: DenNotification, cachedReadIds: ReadonlySet<string> = new Set()): NotificationViewItem {
  const id = notificationCacheId(notification.id);
  return {
    id,
    summary: normalizeWhitespace(notification.content ?? ''),
    source: notification.sender ?? 'Notification',
    severity: notificationSeverity(notification),
    read: notification.is_read === true || cachedReadIds.has(id),
    projectId: notification.project_id ?? null,
    taskId: notification.task_id ?? null,
    createdAt: notification.created_at ?? '',
  };
}

export function notificationCacheId(id: number): string {
  return `notification:${id}`;
}

export function unreadNotificationCount(items: readonly NotificationViewItem[]): number {
  return items.filter((item) => !item.read).length;
}

export function parseNotificationReadCache(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function serializeNotificationReadCache(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort());
}

function notificationSeverity(notification: DenNotification): NotificationSeverity {
  const finalStatus = stringMetadata(notification, 'final_status');
  if (finalStatus === 'completed') return 'success';
  if (finalStatus === 'failed' || finalStatus === 'blocked') return 'error';
  if (notification.urgency === 'critical') return 'error';
  if (notification.urgency === 'high' || notification.urgency === 'urgent') return 'warning';
  return 'info';
}

function stringMetadata(notification: DenNotification, key: string): string | null {
  const value = notification.metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

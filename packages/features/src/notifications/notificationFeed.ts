/**
 * Den Web notification feed adapter — canonical successor feed.
 *
 * Consumes the den-services user-notification feed API.
 * The feed is the authoritative source for notification items and read state.
 *
 * ## Read state
 *
 * Server-backed: `is_read` from the Messages service is authoritative. Mark-read calls go to
 * `POST /api/v1/user-notifications/read`. LocalStorage is used only as a
 * labeled UI cache for optimistic updates — it is NOT the source of truth.
 *
 * ## Feed source
 *
 * All items come from `GET /api/v1/user-notifications` which returns
 * `NotificationFeedItem[]`. The old heuristic aggregator over multiple
 * backend surfaces has been replaced.
 */

import type { NotificationFeedItem } from '@den-web/api/types';
import { getUserNotifications, markNotificationsRead } from '@den-web/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationSourceKind =
  | 'agent_work_complete'   // Agent/orchestrator work-drain complete notification
  | 'user_directed_message' // Direct operator/user-directed message surfaced through notifications
  | 'user_notification';    // General user notification

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  /** Stable id derived from backend notification id. */
  id: string;
  /** Source classification. */
  type: NotificationSourceKind;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Human-readable source kind label. */
  sourceKind: string;
  /** Agent/service name if known. */
  agentService: string | null;
  /** Project/space id. */
  projectId: string | null;
  /** Task id if linked. */
  taskId: number | null;
  /** Message thread id if linked. */
  threadId: number | null;
  /** Dispatch id if linked. */
  dispatchId: number | null;
  /** Subagent run id if linked. */
  runId: string | null;
  /** Plain-text summary. */
  summary: string;
  /** Severity/status indicator. */
  severity: NotificationSeverity;
  /** Additional status string (e.g. run state, delivery mode). */
  status: string | null;
  /** Server-backed read state (LocalStorage cache is optimistic only). */
  read: boolean;
}

export interface NotificationFeedResult {
  items: NotificationItem[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Local UI read cache (LocalStorage — cache only, NOT source of truth)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'den-web-notification-read-cache';

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadCachedReadIds(): Set<string> {
  try {
    const raw = getBrowserLocalStorage()?.getItem(CACHE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveCachedReadIds(ids: Set<string>): void {
  try {
    getBrowserLocalStorage()?.setItem(CACHE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Silently ignore storage errors (quota, private browsing)
  }
}

/** Clear the local read-tracking cache (does not affect server read state). */
export function clearLocalReadState(): void {
  saveCachedReadIds(new Set());
}

/** Get the set of locally-cached read notification IDs. Cache only — not authoritative. */
export function getReadIds(): Set<string> {
  return loadCachedReadIds();
}

// ---------------------------------------------------------------------------
// Feed item mapping
// ---------------------------------------------------------------------------

/** Default operator identity for read-state queries. */
const DEFAULT_READ_FOR = 'web-ui';

function severityFromUrgency(urgency: string | null): NotificationSeverity {
  if (urgency === 'high' || urgency === 'urgent') return 'warning';
  if (urgency === 'critical') return 'error';
  return 'info';
}

function classifySourceType(metadata: Record<string, unknown> | null): NotificationSourceKind {
  if (metadata?.type === 'agent_work_complete') return 'agent_work_complete';
  if (
    metadata?.type === 'user_directed_message'
    || metadata?.type === 'direct_operator_message'
    || metadata?.type === 'operator_message'
  ) return 'user_directed_message';
  return 'user_notification';
}

function buildCoreItemId(coreId: number): string {
  return `core:${coreId}`;
}

/**
 * Extract a stable integer notification ID from the composite string id.
 * Returns null if the format is unexpected.
 */
export function parseCoreNotificationId(compositeId: string): number | null {
  if (compositeId.startsWith('core:')) {
    const num = parseInt(compositeId.slice(5), 10);
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

function mapFeedItem(item: NotificationFeedItem): NotificationItem {
  const metadata = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
    ? item.metadata as Record<string, unknown>
    : {};
  const sourceType = classifySourceType(metadata);
  // Extract run_id from source_refs or metadata for convenience
  const runId = (metadata.run_ids as string[] | undefined)?.[0] ?? (metadata.run_id as string | null) ?? null;
  const dispatchId = typeof metadata.dispatch_id === 'number' ? metadata.dispatch_id : null;

  // Derive a short label for sourceKind
  let sourceKind = sourceType === 'agent_work_complete'
    ? 'Agent work complete'
    : sourceType === 'user_directed_message'
      ? 'User-directed message'
      : 'Notification';
  const completionScope = metadata.completion_scope;
  if (typeof completionScope === 'string') {
    sourceKind = `Agent ${completionScope.replace(/_/g, ' ')}`;
  }

  // Derive severity from final_status if available, else from urgency
  let severity = severityFromUrgency(item.urgency);
  const finalStatus = metadata.final_status;
  if (finalStatus === 'completed') severity = 'success';
  else if (finalStatus === 'blocked' || finalStatus === 'failed') severity = 'error';

  return {
    id: buildCoreItemId(item.id),
    type: sourceType,
    timestamp: item.created_at,
    sourceKind,
    agentService: item.sender,
    projectId: item.project_id,
    taskId: item.task_id,
    threadId: item.thread_id,
    dispatchId,
    runId,
    summary: item.content.replace(/\s+/g, ' ').trim(),
    severity,
    status: typeof finalStatus === 'string' ? finalStatus : item.urgency,
    read: item.is_read,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the notification feed from the canonical successor API.
 *
 * @param projectIds Project/space IDs are intentionally ignored. Kept for
 *   backward-compatible call sites while the panel remains a global feed.
 * @returns A feed result with items sorted newest-first.
 */
export async function fetchNotificationFeed(_projectIds: string[]): Promise<NotificationFeedResult> {
  void _projectIds;
  const startTime = Date.now();

  try {
    const feedItems = await getUserNotifications({
      readFor: DEFAULT_READ_FOR,
      limit: 50,
    });

    const items = feedItems.map(mapFeedItem);

    // Sort newest first (API should do this, but enforce client-side)
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply local optimistic read cache on top of server is_read
    const cachedReadIds = loadCachedReadIds();
    for (const item of items) {
      if (cachedReadIds.has(item.id)) {
        item.read = true;
      }
    }

    return { items, loading: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { items: [], loading: false, error: `Failed to load notifications: ${message}` };
  } finally {
    const elapsed = Date.now() - startTime;
    if (elapsed > 8000) {
      console.warn(`[notificationFeed] fetchNotificationFeed took ${elapsed}ms — consider reducing limit or adding pagination`);
    }
  }
}

/**
 * Mark a specific notification as read (server-backed + local cache).
 */
export async function markNotificationRead(id: string): Promise<void> {
  const coreId = parseCoreNotificationId(id);
  // Optimistic local cache update
  const cached = loadCachedReadIds();
  cached.add(id);
  saveCachedReadIds(cached);
  // Server mark-read
  if (coreId !== null) {
    await markNotificationsRead({ agent: DEFAULT_READ_FOR, notification_ids: [coreId] });
  }
}

/**
 * Mark a batch of notification IDs as read (server-backed + local cache).
 */
export async function markNotificationsReadBatch(ids: string[]): Promise<void> {
  // Optimistic local cache update
  const cached = loadCachedReadIds();
  for (const id of ids) cached.add(id);
  saveCachedReadIds(cached);
  // Server mark-read — extract core IDs
  const coreIds = ids.map(parseCoreNotificationId).filter((id): id is number => id !== null);
  if (coreIds.length > 0) {
    await markNotificationsRead({ agent: DEFAULT_READ_FOR, notification_ids: coreIds });
  }
}

/**
 * Mark all currently displayed notifications as read by explicit IDs.
 */
export async function markAllRead(ids: string[]): Promise<void> {
  await markNotificationsReadBatch(ids);
}

/**
 * Mark all notifications read in a project scope using server-side mark_all.
 * Falls back to explicit IDs when available.
 */
export async function markAllReadScoped(projectId: string, taskId?: number): Promise<number> {
  const result = await markNotificationsRead({
    agent: DEFAULT_READ_FOR,
    mark_all: true,
    scope: { project_id: projectId, task_id: taskId },
  });
  return result.marked;
}

/**
 * Count unread notifications in a feed result.
 */
export function countUnread(items: NotificationItem[]): number {
  return items.filter(item => !item.read).length;
}

/**
 * Filter the notification feed by various criteria.
 */
export function filterFeed(
  items: NotificationItem[],
  filters: {
    type?: NotificationSourceKind | 'all';
    severity?: NotificationSeverity | 'all';
    search?: string;
    projectId?: string;
    showRead?: boolean;
  },
): NotificationItem[] {
  return items.filter(item => {
    if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.severity && filters.severity !== 'all' && item.severity !== filters.severity) return false;
    if (filters.projectId && item.projectId !== filters.projectId) return false;
    if (filters.showRead === false && item.read) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchesSummary = item.summary.toLowerCase().includes(q);
      const matchesSource = item.sourceKind.toLowerCase().includes(q);
      const matchesAgent = item.agentService?.toLowerCase().includes(q) ?? false;
      if (!matchesSummary && !matchesSource && !matchesAgent) return false;
    }
    return true;
  });
}

/**
 * Den Web notification feed adapter.
 *
 * This adapter composes from existing Den read APIs to build a unified
 * notification feed. It is NOT a canonical notification database — it
 * reads from reachable backends and aggregates results client-side.
 *
 * ## Backend gap
 *
 * There is currently no dedicated Den notification feed API. The adapter
 * composes from:
 *   - Core `getMessages()` with intent=notification and user-directed heuristics
 *   - Core `listAgentStream()` for agent/worker completion and status events
 *   - Core `listSubagentRuns()` for worker/agent run completions and failures
 *
 * A future canonical notification API in `den-core` or `den-channels`
 * should replace this adapter. Until then, this adapter clearly documents
 * the gap and provides a bounded frontend-only solution.
 *
 * ## Local-only state
 *
 * Read tracking and clear-local-view are managed in LocalStorage via
 * a set of notification IDs. This does not delete canonical records.
 */

import type { AgentStreamEntry, Message, SubagentRunSummary } from '../../api/types';
import { getMessages, listAgentStream, listSubagentRuns } from '../../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationSourceKind =
  | 'user_notification'    // Message with intent='notification'
  | 'user_message'         // User-directed message (question, blocked, etc.)
  | 'agent_event'          // Agent stream event (completions, status)
  | 'worker_completion';   // Subagent run completion/failure

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  /** Composite stable id for dedup and read tracking. */
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
  /** Locally-tracked read state. */
  read: boolean;
}

export interface NotificationFeedResult {
  items: NotificationItem[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Local read tracking (LocalStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'den-web-notification-read-ids';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Silently ignore storage errors (quota, private browsing)
  }
}

/** Mark a specific notification as read in local storage. */
export function markNotificationRead(id: string): void {
  const ids = loadReadIds();
  ids.add(id);
  saveReadIds(ids);
}

/** Mark a batch of notification IDs as read. */
export function markNotificationsRead(ids: string[]): void {
  const stored = loadReadIds();
  for (const id of ids) stored.add(id);
  saveReadIds(stored);
}

/** Mark all currently displayed notifications as read. */
export function markAllRead(ids: string[]): void {
  markNotificationsRead(ids);
}

/** Clear the local read-tracking store (does not affect canonical records). */
export function clearLocalReadState(): void {
  saveReadIds(new Set());
}

/** Get the set of locally-read notification IDs. */
export function getReadIds(): Set<string> {
  return loadReadIds();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metadataObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function buildMessageId(message: Message): string {
  return `msg:${message.project_id}:${message.id}`;
}

function buildAgentStreamId(entry: AgentStreamEntry): string {
  return `stream:${entry.id}`;
}

function buildRunId(run: SubagentRunSummary): string {
  return `run:${run.run_id}`;
}

function severityFromMessage(message: Message): NotificationSeverity {
  if (message.intent === 'task_blocked') return 'error';
  if (message.intent === 'review_request' || message.intent === 'question') return 'warning';
  if (message.intent === 'notification') {
    const meta = metadataObject(message.metadata);
    const urgency = firstString(meta.urgency, meta.priority);
    if (urgency === 'high' || urgency === 'urgent') return 'warning';
    if (urgency === 'critical') return 'error';
  }
  return 'info';
}

function severityFromAgentStreamEntry(entry: AgentStreamEntry): NotificationSeverity {
  const eventType = entry.event_type;
  if (eventType.endsWith('_failed') || eventType.endsWith('_error') || eventType === 'subagent_timeout' || eventType === 'subagent_startup_timeout') return 'error';
  if (eventType === 'subagent_completed' || eventType === 'dispatch_completed') return 'success';
  if (eventType.includes('blocked') || eventType.includes('warning')) return 'warning';
  return 'info';
}

function severityFromRun(run: SubagentRunSummary): NotificationSeverity {
  if (run.state === 'failed' || run.state === 'timeout' || run.state === 'aborted') return 'error';
  if (run.state === 'complete') return 'success';
  if (run.state === 'running' || run.state === 'retrying') return 'info';
  return 'warning';
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ');
}

function isUserDirected(message: Message): boolean {
  if (message.intent === 'question' || message.intent === 'task_blocked' || message.intent === 'notification') return true;
  const meta = metadataObject(message.metadata);
  const recipient = firstString(meta.recipient, meta.recipient_agent, meta.target, meta.to, meta.audience);
  const type = firstString(meta.type, meta.kind);
  if (type === 'user_notification' || type === 'notification') return true;
  if (recipient === 'user' || recipient === 'Patchfoot' || recipient === 'Patch') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Feed source fetchers
// ---------------------------------------------------------------------------

const LARGE_LIMIT = 50;

async function fetchNotificationMessages(projectIds: string[]): Promise<NotificationItem[]> {
  const pages = await Promise.all(projectIds.map(async projectId => {
    try {
      return await getMessages(projectId, { intent: 'notification', limit: LARGE_LIMIT });
    } catch {
      return [] as Message[];
    }
  }));
  return pages.flat().map(message => ({
    id: buildMessageId(message),
    type: 'user_notification' as const,
    timestamp: message.created_at,
    sourceKind: message.intent,
    agentService: message.sender,
    projectId: message.project_id,
    taskId: message.task_id,
    threadId: message.thread_id,
    dispatchId: null,
    runId: null,
    summary: message.content.replace(/\s+/g, ' ').trim(),
    severity: severityFromMessage(message),
    status: null,
    read: false,
  }));
}

async function fetchUserDirectedMessages(projectIds: string[]): Promise<NotificationItem[]> {
  const pages = await Promise.all(projectIds.map(async projectId => {
    try {
      const messages = await getMessages(projectId, { limit: LARGE_LIMIT });
      return messages.filter(isUserDirected);
    } catch {
      return [] as Message[];
    }
  }));
  return pages.flat().map(message => ({
    id: buildMessageId(message),
    type: 'user_message' as const,
    timestamp: message.created_at,
    sourceKind: message.intent,
    agentService: message.sender,
    projectId: message.project_id,
    taskId: message.task_id,
    threadId: message.thread_id,
    dispatchId: null,
    runId: null,
    summary: message.content.replace(/\s+/g, ' ').trim(),
    severity: severityFromMessage(message),
    status: null,
    read: false,
  }));
}

async function fetchAgentStreamEvents(projectIds: string[]): Promise<NotificationItem[]> {
  const pages = await Promise.all(projectIds.map(async projectId => {
    try {
      return await listAgentStream({ projectId, limit: LARGE_LIMIT });
    } catch {
      return [] as AgentStreamEntry[];
    }
  }));
  return pages.flat().map(entry => ({
    id: buildAgentStreamId(entry),
    type: 'agent_event' as const,
    timestamp: entry.created_at,
    sourceKind: formatEventType(entry.event_type),
    agentService: entry.sender,
    projectId: entry.project_id,
    taskId: entry.task_id,
    threadId: entry.thread_id,
    dispatchId: entry.dispatch_id,
    runId: metadataObject(entry.metadata).run_id as string | null ?? null,
    summary: entry.body?.replace(/\s+/g, ' ').trim() ?? formatEventType(entry.event_type),
    severity: severityFromAgentStreamEntry(entry),
    status: entry.delivery_mode,
    read: false,
  }));
}

async function fetchSubagentRuns(projectIds: string[]): Promise<NotificationItem[]> {
  const pages = await Promise.all(projectIds.map(async projectId => {
    try {
      const runs = await listSubagentRuns({ projectId, limit: LARGE_LIMIT });
      return runs.filter(run => run.state === 'complete' || run.state === 'failed' || run.state === 'timeout' || run.state === 'aborted');
    } catch {
      return [] as SubagentRunSummary[];
    }
  }));
  return pages.flat().map(run => ({
    id: buildRunId(run),
    type: 'worker_completion' as const,
    timestamp: run.ended_at ?? run.latest.created_at,
    sourceKind: runStateLabel(run.state),
    agentService: run.role ?? run.latest.sender,
    projectId: run.project_id,
    taskId: run.task_id,
    threadId: null,
    dispatchId: null,
    runId: run.run_id,
    summary: run.purpose ?? `${run.role ?? 'worker'} run ${runStateLabel(run.state)}`,
    severity: severityFromRun(run),
    status: run.state,
    read: false,
  }));
}

function runStateLabel(state: string): string {
  return state.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the unified notification feed from multiple backend sources.
 *
 * @param projectIds Project/space IDs to fetch notifications for.
 *   Pass a single project ID or aggregated project IDs.
 * @returns A feed result with flattened, sorted, deduplicated items.
 *
 * Note: Deduplication is by composite ID. If the same notification appears
 * from multiple sources (e.g., a message is both a user_notification and
 * a user_message), the first source wins by priority order.
 */
export async function fetchNotificationFeed(projectIds: string[]): Promise<NotificationFeedResult> {
  const startTime = Date.now();

  try {
    const [notifications, userMessages, streamEvents, runCompletions] = await Promise.all([
      fetchNotificationMessages(projectIds),
      fetchUserDirectedMessages(projectIds),
      fetchAgentStreamEvents(projectIds),
      fetchSubagentRuns(projectIds),
    ]);

    // Deduplicate by composite ID with priority:
    // 1. user_notification 2. user_message 3. agent_event 4. worker_completion
    const seen = new Set<string>();
    const all: NotificationItem[] = [];

    for (const items of [notifications, userMessages, streamEvents, runCompletions]) {
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }
    }

    // Sort newest first
    all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply local read state
    const readIds = loadReadIds();
    for (const item of all) {
      if (readIds.has(item.id)) {
        item.read = true;
      }
    }

    return { items: all, loading: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { items: [], loading: false, error: `Failed to load notifications: ${message}` };
  } finally {
    const elapsed = Date.now() - startTime;
    if (elapsed > 8000) {
      console.warn(`[notificationFeed] fetchNotificationFeed took ${elapsed}ms — consider reducing projectIds or adding pagination`);
    }
  }
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

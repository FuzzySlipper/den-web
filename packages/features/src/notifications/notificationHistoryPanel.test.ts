/**
 * Tests for the notification feed adapter and panel utilities.
 *
 * Tests cover:
 *   - Feed adapter: canonical Core feed mapping, deduplication, sorting
 *   - Filtering: type, severity, search, project, showRead, agent_work_complete
 *   - Mark read: server-backed mark-read with explicit IDs and scoped mark-all
 *   - Window management: open/focus behavior, route detection
 *   - Failure/reconnect: API errors degrade gracefully, not silently
 *   - Empty vs error state distinction
 */

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  type NotificationItem,
  fetchNotificationFeed,
  filterFeed,
  markNotificationRead,
  markAllRead,
  markAllReadScoped,
  clearLocalReadState,
  countUnread,
  getReadIds,
  parseCoreNotificationId,
} from './notificationFeed';
import {
  clearPendingNotificationCueIds,
  detectNewUnreadNotificationIds,
  loadPendingNotificationCueIds,
  rememberPendingNotificationCueIds,
  notificationCueLabel,
  summarizeNotificationBellCue,
} from './notificationBell';
import {
  openNotificationPanelWindow,
  focusArmedNotificationPanelWindow,
  isNotificationPanelRoute,
} from './notificationWindow';

// ---------------------------------------------------------------------------
// Helpers / mock data
// ---------------------------------------------------------------------------

/** Build a mock NotificationFeedItem from Core API shape. */
function mockFeedItem(overrides: Partial<{
  id: number;
  project_id: string;
  task_id: number | null;
  thread_id: number | null;
  sender: string;
  content: string;
  metadata: Record<string, unknown> | null;
  urgency: string | null;
  is_read: boolean;
  created_at: string;
}> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 1,
    project_id: overrides.project_id ?? 'test-project',
    task_id: overrides.task_id ?? null,
    thread_id: overrides.thread_id ?? null,
    sender: overrides.sender ?? 'den-mcp-runner',
    content: overrides.content ?? 'Test notification',
    metadata: overrides.metadata ?? null,
    urgency: overrides.urgency ?? 'normal',
    is_read: overrides.is_read ?? false,
    created_at: overrides.created_at ?? '2026-05-31T00:00:00Z',
  };
}

function mockAgentWorkComplete(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return mockFeedItem({
    id: 100,
    sender: 'den-mcp-runner',
    content: 'Agent work complete: den-core tasks [1788, 1789]',
    metadata: {
      type: 'agent_work_complete',
      notification_class: 'operator_attention',
      agent_identity: 'den-mcp-runner',
      completion_scope: 'assigned_queue',
      final_status: 'completed',
      project_ids: ['den-core'],
      task_ids: [1788, 1789],
      completed_task_ids: [1788, 1789],
      blocked_task_ids: [],
      run_ids: ['piw_abc123'],
      source_refs: [
        { kind: 'task', project_id: 'den-core', task_id: 1788 },
        { kind: 'task', project_id: 'den-core', task_id: 1789 },
      ],
    },
    urgency: 'normal',
    task_id: 1788,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Feed adapter tests
// ---------------------------------------------------------------------------

describe('notificationFeed adapter', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { for (const key in store) delete store[key]; },
      removeItem: (key: string) => { delete store[key]; },
      length: 0,
      key: () => null,
    });
    clearLocalReadState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('fetchNotificationFeed — canonical Core feed', () => {
    it('fetches from /api/user-notifications and maps items', async () => {
      const mockItems = [
        mockAgentWorkComplete(),
        mockFeedItem({ id: 2, content: 'Simple notification', metadata: { type: 'other' } }),
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockItems),
      }));

      const result = await fetchNotificationFeed(['test-project']);
      expect(result.items).toHaveLength(2);
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();

      const firstFetchUrl = String((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(firstFetchUrl).toContain('/api/user-notifications?');
      expect(firstFetchUrl).toContain('readFor=web-ui');
      expect(firstFetchUrl).toContain('limit=50');
      expect(firstFetchUrl).not.toContain('projectId=');
      // First item should be agent_work_complete
      const agentItem = result.items.find(i => i.type === 'agent_work_complete');
      expect(agentItem).toBeDefined();
      expect(agentItem!.taskId).toBe(1788);
      expect(agentItem!.projectId).toBe('test-project');
      expect(agentItem!.agentService).toBe('den-mcp-runner');
    });

    it('distinguishes API error from empty feed', async () => {
      // True empty feed
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }));
      const empty = await fetchNotificationFeed(['test-project']);
      expect(empty.items).toHaveLength(0);
      expect(empty.error).toBeNull();

      // API error
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }));
      const errored = await fetchNotificationFeed(['test-project']);
      expect(errored.items).toHaveLength(0);
      expect(errored.error).toContain('Failed to load notifications');
    });

    it('maps agent_work_complete with correct source classification', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockAgentWorkComplete()]),
      }));

      const result = await fetchNotificationFeed(['test-project']);
      const item = result.items[0];
      expect(item.type).toBe('agent_work_complete');
      expect(item.severity).toBe('success'); // final_status: completed
      expect(item.runId).toBe('piw_abc123');
    });

    it('maps blocked agent work with error severity', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockAgentWorkComplete({
          metadata: {
            type: 'agent_work_complete',
            final_status: 'blocked',
            completion_scope: 'single_request',
          },
          urgency: 'high',
        })]),
      }));

      const result = await fetchNotificationFeed(['test-project']);
      expect(result.items[0].severity).toBe('error');
      expect(result.items[0].status).toBe('blocked');
    });

    it('uses server is_read as authoritative', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          mockFeedItem({ id: 1, is_read: true }),
          mockFeedItem({ id: 2, is_read: false }),
        ]),
      }));

      const result = await fetchNotificationFeed(['test-project']);
      expect(result.items[0].read).toBe(true);
      expect(result.items[1].read).toBe(false);
    });
  });

  describe('parseCoreNotificationId', () => {
    it('extracts integer ID from core: prefix', () => {
      expect(parseCoreNotificationId('core:42')).toBe(42);
      expect(parseCoreNotificationId('core:1001')).toBe(1001);
    });

    it('returns null for non-core IDs', () => {
      expect(parseCoreNotificationId('msg:proj:1')).toBeNull();
      expect(parseCoreNotificationId('unknown')).toBeNull();
    });
  });

  describe('filterFeed', () => {
    const baseItems: NotificationItem[] = [
      {
        id: 'core:1',
        type: 'user_notification',
        timestamp: '2026-05-30T00:00:00Z',
        sourceKind: 'Notification',
        agentService: 'bot-a',
        projectId: 'proj-a',
        taskId: null,
        threadId: null,
        dispatchId: null,
        runId: null,
        summary: 'Welcome notification',
        severity: 'info',
        status: null,
        read: false,
      },
      {
        id: 'core:100',
        type: 'agent_work_complete',
        timestamp: '2026-05-29T00:00:00Z',
        sourceKind: 'Agent assigned queue',
        agentService: 'den-mcp-runner',
        projectId: 'proj-b',
        taskId: 123,
        threadId: null,
        dispatchId: null,
        runId: 'run-abc',
        summary: 'Agent work complete: 2 tasks done',
        severity: 'success',
        status: 'completed',
        read: false,
      },
      {
        id: 'core:200',
        type: 'user_notification',
        timestamp: '2026-05-28T00:00:00Z',
        sourceKind: 'Notification',
        agentService: 'system',
        projectId: 'proj-a',
        taskId: 456,
        threadId: null,
        dispatchId: null,
        runId: null,
        summary: 'Deployment blocked',
        severity: 'warning',
        status: 'normal',
        read: true,
      },
    ];

    it('returns all items when no filters applied', () => {
      const result = filterFeed(baseItems, {});
      expect(result).toHaveLength(3);
    });

    it('filters by type: agent_work_complete', () => {
      const result = filterFeed(baseItems, { type: 'agent_work_complete' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:100');
    });

    it('filters by type: all returns everything', () => {
      const result = filterFeed(baseItems, { type: 'all' });
      expect(result).toHaveLength(3);
    });

    it('filters by severity', () => {
      const result = filterFeed(baseItems, { severity: 'success' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:100');
    });

    it('filters by project', () => {
      const result = filterFeed(baseItems, { projectId: 'proj-a' });
      expect(result).toHaveLength(2);
    });

    it('hides read items when showRead is false', () => {
      const result = filterFeed(baseItems, { showRead: false });
      expect(result).toHaveLength(2);
      expect(result.every(item => !item.read)).toBe(true);
    });

    it('filters by search text', () => {
      const result = filterFeed(baseItems, { search: 'Welcome' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:1');
    });

    it('filters by search across source kind', () => {
      const result = filterFeed(baseItems, { search: 'queue' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:100');
    });

    it('filters by agent service name', () => {
      const result = filterFeed(baseItems, { search: 'runner' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:100');
    });

    it('combines multiple filters', () => {
      const result = filterFeed(baseItems, {
        projectId: 'proj-a',
        showRead: false,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:1');
    });

    it('returns empty array when no items match', () => {
      const result = filterFeed(baseItems, { severity: 'error' });
      expect(result).toHaveLength(0);
    });
  });

  describe('read tracking (server-backed + local cache)', () => {
    beforeEach(() => {
      localStorage.clear();
      clearLocalReadState();
    });

    it('starts with empty cache', () => {
      expect(getReadIds().size).toBe(0);
    });

    it('marks a single notification as read via API + cache', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ marked: 1 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await markNotificationRead('core:42');

      // Should have called the mark-read API
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'POST');
      expect(call).toBeDefined();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.agent).toBe('web-ui');
      expect(body.notification_ids).toEqual([42]);

      // Should update local cache
      expect(getReadIds().has('core:42')).toBe(true);
    });

    it('marks multiple notifications as read', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ marked: 2 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await markAllRead(['core:1', 'core:2']);

      const ids = getReadIds();
      expect(ids.has('core:1')).toBe(true);
      expect(ids.has('core:2')).toBe(true);
    });

    it('supports scoped mark-all via API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ marked: 5 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const count = await markAllReadScoped('den-core', 123);

      expect(count).toBe(5);
      const call = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'POST');
      expect(call).toBeDefined();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.mark_all).toBe(true);
      expect(body.scope.project_id).toBe('den-core');
      expect(body.scope.task_id).toBe(123);
    });

    it('clears local cache without affecting server', () => {
      // Add items to cache via the public API
      const cached = new Set(['core:1', 'core:2']);
      localStorage.setItem('den-web-notification-read-cache', JSON.stringify(Array.from(cached)));
      expect(getReadIds().size).toBe(2);

      clearLocalReadState();
      expect(getReadIds().size).toBe(0);
    });
  });

  describe('countUnread', () => {
    it('counts only unread items', () => {
      const items: NotificationItem[] = [
        {
          id: 'core:1', type: 'user_notification', timestamp: '2026-01-01T00:00:00Z',
          sourceKind: 'test', agentService: null, projectId: null, taskId: null,
          threadId: null, dispatchId: null, runId: null, summary: 'test',
          severity: 'info', status: null, read: false,
        },
        {
          id: 'core:2', type: 'agent_work_complete', timestamp: '2026-01-01T00:00:00Z',
          sourceKind: 'test', agentService: null, projectId: null, taskId: null,
          threadId: null, dispatchId: null, runId: null, summary: 'test',
          severity: 'success', status: null, read: true,
        },
        {
          id: 'core:3', type: 'user_notification', timestamp: '2026-01-01T00:00:00Z',
          sourceKind: 'test', agentService: null, projectId: null, taskId: null,
          threadId: null, dispatchId: null, runId: null, summary: 'test',
          severity: 'info', status: null, read: false,
        },
      ];
      expect(countUnread(items)).toBe(2);
    });

    it('returns 0 for all-read list', () => {
      const items: NotificationItem[] = [
        {
          id: 'core:1', type: 'user_notification', timestamp: '2026-01-01T00:00:00Z',
          sourceKind: 'test', agentService: null, projectId: null, taskId: null,
          threadId: null, dispatchId: null, runId: null, summary: 'test',
          severity: 'info', status: null, read: true,
        },
      ];
      expect(countUnread(items)).toBe(0);
    });

    it('returns 0 for empty list', () => {
      expect(countUnread([])).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Operator bell detection tests
// ---------------------------------------------------------------------------

describe('notificationBell helpers', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { for (const key in store) delete store[key]; },
      removeItem: (key: string) => { delete store[key]; },
      length: 0,
      key: () => null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const previous: NotificationItem[] = [
    {
      id: 'core:1', type: 'user_notification', timestamp: '2026-01-01T00:00:00Z',
      sourceKind: 'Notification', agentService: 'runner', projectId: null, taskId: null,
      threadId: null, dispatchId: null, runId: null, summary: 'old unread',
      severity: 'info', status: null, read: false,
    },
  ];

  it('does not ring on initial baseline fetch', () => {
    expect(detectNewUnreadNotificationIds(null, previous)).toEqual([]);
  });

  it('rings only for newly arrived unread IDs', () => {
    const current: NotificationItem[] = [
      previous[0],
      {
        id: 'core:2', type: 'agent_work_complete', timestamp: '2026-01-02T00:00:00Z',
        sourceKind: 'Agent work complete', agentService: 'runner', projectId: 'den-web', taskId: 2124,
        threadId: null, dispatchId: null, runId: 'run-2124', summary: 'Agent finished #2124',
        severity: 'success', status: 'completed', read: false,
      },
      {
        id: 'core:3', type: 'user_notification', timestamp: '2026-01-03T00:00:00Z',
        sourceKind: 'Notification', agentService: 'runner', projectId: 'den-web', taskId: null,
        threadId: null, dispatchId: null, runId: null, summary: 'already read new item',
        severity: 'info', status: null, read: true,
      },
    ];

    const ids = detectNewUnreadNotificationIds(previous, current);
    expect(ids).toEqual(['core:2']);
    const cue = summarizeNotificationBellCue(current, ids);
    expect(notificationCueLabel(cue)).toContain('agent finished work');
  });

  it('bridges pending cue IDs across windows until the panel clears them', () => {
    localStorage.clear();
    rememberPendingNotificationCueIds(['core:2', 'core:4']);
    rememberPendingNotificationCueIds(['core:2', 'core:5']);

    expect(loadPendingNotificationCueIds().sort()).toEqual(['core:2', 'core:4', 'core:5']);

    clearPendingNotificationCueIds(['core:4']);
    expect(loadPendingNotificationCueIds().sort()).toEqual(['core:2', 'core:5']);

    clearPendingNotificationCueIds();
    expect(loadPendingNotificationCueIds()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Window management tests
// ---------------------------------------------------------------------------

describe('notificationWindow utilities', () => {
  let mockLocation: { hash: string; href: string; origin: string; pathname: string };
  let mockWindow: { open: ReturnType<typeof vi.fn>; location: typeof mockLocation; focus: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLocation = { hash: '', href: '', origin: 'http://localhost', pathname: '/' };
    const mockOpen = vi.fn();
    mockWindow = {
      open: mockOpen,
      location: mockLocation,
      focus: vi.fn(),
    };
    vi.stubGlobal('window', mockWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isNotificationPanelRoute', () => {
    it('returns true when hash is #/notification-panel', () => {
      mockLocation.hash = '#/notification-panel';
      expect(isNotificationPanelRoute()).toBe(true);
    });

    it('returns false for other hashes', () => {
      mockLocation.hash = '#/other-route';
      expect(isNotificationPanelRoute()).toBe(false);
    });

    it('returns false when there is no hash', () => {
      mockLocation.hash = '';
      expect(isNotificationPanelRoute()).toBe(false);
    });
  });

  describe('openNotificationPanelWindow', () => {
    beforeEach(() => {
      mockLocation.href = 'http://localhost/';
      mockLocation.hash = '';
    });

    it('reports blocked focus before the notification window is armed', () => {
      const result = focusArmedNotificationPanelWindow();
      expect(result).toEqual({ focused: false, blocked: true, reason: 'not_armed' });
    });

    it('calls window.open with the named target and hash URL', () => {
      mockWindow.open.mockReturnValue({ closed: true } as Window);

      openNotificationPanelWindow();

      expect(mockWindow.open).toHaveBeenCalledWith(
        expect.stringContaining('#/notification-panel'),
        'den-web-notification-panel',
        expect.stringContaining('width=600'),
      );
    });

    it('reuses existing window by name', () => {
      const mockFocus = vi.fn();
      const mockWin = { closed: false, focus: mockFocus, location: { href: '' } } as unknown as Window;
      mockWindow.open.mockReturnValue(mockWin);

      openNotificationPanelWindow();

      expect(mockWindow.open).toHaveBeenCalledWith('', 'den-web-notification-panel');
      expect(mockFocus).toHaveBeenCalled();
    });

    it('focuses the armed named window for later operator events', () => {
      const mockFocus = vi.fn();
      const mockWin = { closed: false, focus: mockFocus, location: { href: '' } } as unknown as Window;
      mockWindow.open.mockReturnValue(mockWin);

      openNotificationPanelWindow();
      const result = focusArmedNotificationPanelWindow();

      expect(result.focused).toBe(true);
      expect(result.blocked).toBe(false);
      expect(mockFocus).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Structural invariants: source file assertions
// ---------------------------------------------------------------------------

describe('notificationHistoryPanel source invariants', () => {
  const panelSource = readFileSync(
    resolve(process.cwd(), 'packages/features/src/notifications/NotificationHistoryPanel.tsx'),
    'utf8',
  );
  const rowSource = readFileSync(
    resolve(process.cwd(), 'packages/features/src/notifications/NotificationRow.tsx'),
    'utf8',
  );
  const feedSource = readFileSync(
    resolve(process.cwd(), 'packages/features/src/notifications/notificationFeed.ts'),
    'utf8',
  );

  it('includes filtering by type, severity, search, project', () => {
    expect(panelSource).toContain('notif-type-filter');
    expect(panelSource).toContain('notif-severity-filter');
    expect(panelSource).toContain('searchFilter');
    expect(panelSource).toContain('projectFilter');
    expect(panelSource).toContain('showRead');
    // showRead must pass the raw boolean to filterFeed — `showRead || undefined`
    // would convert `false` to `undefined`, making the "hide read" filter dead.
    expect(panelSource).not.toContain('showRead || undefined');
  });

  it('has agent_work_complete filter option', () => {
    expect(panelSource).toContain('agent_work_complete');
    expect(panelSource).toContain('Agent Done');
  });

  it('has mark-all-read and clear-cache actions', () => {
    expect(panelSource).toContain('handleMarkAllRead');
    expect(panelSource).toContain('handleClearCache');
    expect(panelSource).toContain('Mark all read');
    expect(panelSource).toContain('Clear read cache');
  });

  it('handles loading and error states distinctly', () => {
    expect(panelSource).toContain('Loading notifications');
    expect(panelSource).toContain('Failed to load notifications');
    expect(panelSource).toContain('No notifications yet');
    // API errors come from feed.error, not only from usePolling
    expect(panelSource).toContain('feed?.error');
  });

  it('uses canonical Core feed, not heuristic aggregator', () => {
    // Feed adapter should NOT contain the old "Backend gap" text
    expect(feedSource).not.toContain('Backend gap');
    // Feed adapter should call the Core API
    expect(feedSource).toContain('getUserNotifications');
    expect(feedSource).toContain('markNotificationsRead');
    // Feed adapter should document the canonical feed source
    expect(feedSource).toContain('Core user-notification feed');
  });

  it('uses server-backed read state, not LocalStorage source of truth', () => {
    // Footer should say server-backed
    expect(panelSource).toContain('Server-backed read state');
    // Feed should label LocalStorage as cache only
    expect(feedSource).toContain('cache');
    expect(feedSource).toContain('NOT source of truth');
  });

  it('displays severity, source kind, agent, and project in each row', () => {
    expect(rowSource).toContain('severityClass');
    expect(rowSource).toContain('sourceTypeLabel');
    expect(rowSource).toContain('formatTimeAgo');
    expect(rowSource).toContain('truncate');
  });
});

describe('notificationWindow source invariants', () => {
  const windowSource = readFileSync(
    resolve(process.cwd(), 'packages/features/src/notifications/notificationWindow.ts'),
    'utf8',
  );

  it('exports openNotificationPanelWindow', () => {
    expect(windowSource).toContain('export function openNotificationPanelWindow');
  });

  it('exports isNotificationPanelRoute', () => {
    expect(windowSource).toContain('export function isNotificationPanelRoute');
  });

  it('uses named window target for reuse', () => {
    expect(windowSource).toContain("'den-web-notification-panel'");
  });

  it('uses user-gesture-friendly window.open', () => {
    expect(windowSource).toContain('window.open');
  });

  it('tries to focus existing window before reopening', () => {
    expect(windowSource).toContain('pointAndFocus(existing)');
  });

  it('exposes armed-window focus result for new operator events', () => {
    expect(windowSource).toContain('export function focusArmedNotificationPanelWindow');
    expect(windowSource).toContain('not_armed');
    expect(windowSource).toContain('popup_blocked');
  });
});

describe('ProjectSidebar notification button', () => {
  const sidebarSource = readFileSync(
    resolve(process.cwd(), 'packages/shell/src/ProjectSidebar.tsx'),
    'utf8',
  );

  it('has a notification history button', () => {
    expect(sidebarSource).toContain('Notification History');
    expect(sidebarSource).toContain('openNotificationPanelWindow');
  });

  it('imports from notificationWindow', () => {
    expect(sidebarSource).toContain("import { openNotificationPanelWindow } from '@den-web/features/notifications/notificationWindow'");
  });

  it('uses notificationHistoryMode preference to decide open behavior', () => {
    expect(sidebarSource).toContain('notificationHistoryMode');
  });

  it('calls openNotificationPanelWindow for window mode or sets side panel state', () => {
    // Should have branching logic for window vs sidePanel
    expect(sidebarSource).toContain("'window'");
    expect(sidebarSource).toContain("'sidePanel'");
  });
});

describe('App.tsx notification integration', () => {
  const appSource = readFileSync(
    resolve(process.cwd(), 'packages/shell/src/App.tsx'),
    'utf8',
  );
  const notificationsCss = readFileSync(
    resolve(process.cwd(), 'apps/web/src/styles/features/notifications.css'),
    'utf8',
  );
  const appShellCss = readFileSync(
    resolve(process.cwd(), 'apps/web/src/styles/app-shell.css'),
    'utf8',
  );
  // The app-shell refactor (#2138) split notification wiring into focused modules.
  const bellSource = readFileSync(
    resolve(process.cwd(), 'packages/shell/src/useNotificationBell.ts'),
    'utf8',
  );
  const mainPanelSource = readFileSync(
    resolve(process.cwd(), 'packages/shell/src/MainPanel.tsx'),
    'utf8',
  );
  const sidePanelSource = readFileSync(
    resolve(process.cwd(), 'packages/shell/src/NotificationSidePanel.tsx'),
    'utf8',
  );

  it('imports NotificationHistoryPanel component', () => {
    expect(appSource).toContain("import { NotificationHistoryPanel } from '@den-web/features/notifications/NotificationHistoryPanel'");
  });

  it('imports notification window helpers', () => {
    expect(bellSource).toContain('focusArmedNotificationPanelWindow');
    expect(appSource).toContain('isNotificationPanelRoute');
  });

  it('renders NotificationHistoryPanel in the notifications view mode', () => {
    expect(mainPanelSource).toContain("viewMode === 'notifications'");
    expect(mainPanelSource).toContain('<NotificationHistoryPanel');
  });

  it('detects standalone popup via hash route', () => {
    expect(appSource).toContain('#/notification-panel');
    expect(appSource).toContain('isNotificationPanelRoute()');
  });

  it('sets standalone prop when hash route is active', () => {
    expect(appSource).toContain('standalone');
  });

  it('renders NotificationHistoryPanel as a docked side panel when mode is sidePanel', () => {
    // Should render NotificationHistoryPanel inside a docked side-panel grid area.
    expect(sidePanelSource).toContain('notification-side-panel');
    expect(appSource).toContain('dashboard-notification-docked');
    expect(appSource).toContain('renderNotificationSidePanel');
    expect(appSource).toContain('shouldRenderNotificationSidePanel(\n    showNotificationPanel,\n    prefs.layout.notificationHistoryMode,\n  )');
  });

  it('has close button in side panel notification dock', () => {
    expect(sidePanelSource).toContain('notification-side-panel-close');
  });

  it('styles the notification side-panel close affordance explicitly', () => {
    expect(notificationsCss).toContain('.notification-side-panel-close');
  });

  it('uses explicit z-index tokens with detail overlays above docked notification panel', () => {
    expect(notificationsCss).toContain('--z-notification-side-panel');
    expect(appShellCss).toContain('--z-detail-overlay');
    expect(notificationsCss).toContain('z-index: var(--z-notification-side-panel');
    expect(appShellCss).toContain('z-index: var(--z-detail-overlay');
  });

  it('routes notification side-panel visibility through interaction helpers', () => {
    expect(appSource).toContain('toggleNotificationSidePanel');
    expect(appSource).toContain('closeNotificationSidePanel');
    expect(appSource).toContain('shouldRenderNotificationSidePanel');
  });

  it('polls the canonical feed and drives operator-bell cues', () => {
    expect(appSource).toContain('fetchOperatorNotifications');
    expect(appSource).toContain('useNotificationBell');
    expect(bellSource).toContain('detectNewUnreadNotificationIds');
    expect(appSource).toContain('notificationUnreadCount={bell.unreadCount}');
  });

  it('styles operator-bell attention state', () => {
    expect(appShellCss).toContain('notification-sidebar-button-attention');
    expect(appShellCss).toContain('notification-sidebar-badge');
    expect(notificationsCss).toContain('notification-new-divider');
  });
});

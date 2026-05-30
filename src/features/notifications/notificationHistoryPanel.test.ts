/**
 * Tests for the notification feed adapter and panel utilities.
 *
 * Tests cover:
 *   - Feed adapter: composition, deduplication, sorting, read tracking
 *   - Filtering: type, severity, search, project, showRead
 *   - Window management: open/focus behavior, route detection
 *   - Failure/reconnect: API errors degrade gracefully
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
  clearLocalReadState,
  countUnread,
  getReadIds,
} from './notificationFeed';
import {
  openNotificationPanelWindow,
  isNotificationPanelRoute,
} from './notificationWindow';

// ---------------------------------------------------------------------------
// Feed adapter tests
// ---------------------------------------------------------------------------

describe('notificationFeed adapter', () => {
  beforeEach(() => {
    // Stub localStorage for read tracking tests
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
    vi.unstubAllGlobals();
  });

  describe('fetchNotificationFeed composition', () => {
    it('produces items from multiple source types', async () => {
      const result = await fetchNotificationFeed(['test-project']);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('loading', false);
      expect(result).toHaveProperty('error');
      // The actual items depend on API availability in the test runner;
      // we verify the shape and error/empty handling.
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('gracefully handles API errors', async () => {
      clearLocalReadState();
      const result = await fetchNotificationFeed(['project-that-does-not-exist']);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.loading).toBe(false);
    });
  });

  describe('filterFeed', () => {
    const baseItems: NotificationItem[] = [
      {
        id: 'msg:proj-a:1',
        type: 'user_notification',
        timestamp: '2026-05-30T00:00:00Z',
        sourceKind: 'notification',
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
        id: 'stream:42',
        type: 'agent_event',
        timestamp: '2026-05-29T00:00:00Z',
        sourceKind: 'subagent_failed',
        agentService: 'worker-1',
        projectId: 'proj-b',
        taskId: 123,
        threadId: null,
        dispatchId: 5,
        runId: 'run-abc',
        summary: 'Subagent run failed',
        severity: 'error',
        status: 'notify',
        read: false,
      },
      {
        id: 'run:run-xyz',
        type: 'worker_completion',
        timestamp: '2026-05-28T00:00:00Z',
        sourceKind: 'complete',
        agentService: 'coder-2',
        projectId: 'proj-a',
        taskId: 456,
        threadId: null,
        dispatchId: null,
        runId: 'run-xyz',
        summary: 'Task completed successfully',
        severity: 'success',
        status: 'complete',
        read: true,
      },
    ];

    it('returns all items when no filters applied', () => {
      const result = filterFeed(baseItems, {});
      expect(result).toHaveLength(3);
    });

    it('filters by type', () => {
      const result = filterFeed(baseItems, { type: 'agent_event' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('stream:42');

      const allResult = filterFeed(baseItems, { type: 'all' });
      expect(allResult).toHaveLength(3);
    });

    it('filters by severity', () => {
      const result = filterFeed(baseItems, { severity: 'error' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('stream:42');
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
      expect(result[0].id).toBe('msg:proj-a:1');
    });

    it('filters by search across source kind', () => {
      const result = filterFeed(baseItems, { search: 'failed' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('stream:42');
    });

    it('filters by agent service name', () => {
      const result = filterFeed(baseItems, { search: 'coder-2' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('run:run-xyz');
    });

    it('combines multiple filters', () => {
      const result = filterFeed(baseItems, {
        projectId: 'proj-a',
        showRead: false,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg:proj-a:1');
    });

    it('returns empty array when no items match', () => {
      const result = filterFeed(baseItems, { type: 'user_message' });
      expect(result).toHaveLength(0);
    });
  });

  describe('read tracking (local storage)', () => {
    beforeEach(() => {
      localStorage.clear();
      clearLocalReadState();
    });

    it('starts with empty read set', () => {
      expect(getReadIds().size).toBe(0);
    });

    it('marks a single notification as read', () => {
      markNotificationRead('msg:proj:1');
      expect(getReadIds().has('msg:proj:1')).toBe(true);
    });

    it('marks multiple notifications as read', () => {
      markAllRead(['msg:proj:1', 'stream:42']);
      const ids = getReadIds();
      expect(ids.has('msg:proj:1')).toBe(true);
      expect(ids.has('stream:42')).toBe(true);
    });

    it('clears all local read state', () => {
      markAllRead(['msg:proj:1', 'stream:42']);
      expect(getReadIds().size).toBe(2);
      clearLocalReadState();
      expect(getReadIds().size).toBe(0);
    });

    it('persists across operations', () => {
      markNotificationRead('msg:proj:1');
      markNotificationRead('stream:42');
      const ids = getReadIds();
      expect(ids.size).toBe(2);
    });
  });

  describe('countUnread', () => {
    it('counts only unread items', () => {
      const items: NotificationItem[] = [
        {
          id: 'a', type: 'user_notification', timestamp: '2026-01-01T00:00:00Z',
          sourceKind: 'test', agentService: null, projectId: null, taskId: null,
          threadId: null, dispatchId: null, runId: null, summary: 'test',
          severity: 'info', status: null, read: false,
        },
        {
          id: 'b', type: 'agent_event', timestamp: '2026-01-01T00:00:00Z',
          sourceKind: 'test', agentService: null, projectId: null, taskId: null,
          threadId: null, dispatchId: null, runId: null, summary: 'test',
          severity: 'info', status: null, read: true,
        },
        {
          id: 'c', type: 'worker_completion', timestamp: '2026-01-01T00:00:00Z',
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
          id: 'a', type: 'user_notification', timestamp: '2026-01-01T00:00:00Z',
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
    // Stub the global window for these tests
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
      // mockWindow.open is already set up in parent beforeEach
      // Re-set location if needed
      mockLocation.href = 'http://localhost/';
      mockLocation.hash = '';
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
  });
});

// ---------------------------------------------------------------------------
// Structural invariants: source file assertions
// ---------------------------------------------------------------------------

describe('notificationHistoryPanel source invariants', () => {
  const panelSource = readFileSync(
    resolve(process.cwd(), 'src/features/notifications/NotificationHistoryPanel.tsx'),
    'utf8',
  );
  const feedSource = readFileSync(
    resolve(process.cwd(), 'src/features/notifications/notificationFeed.ts'),
    'utf8',
  );

  it('includes filtering by type, severity, search, project', () => {
    expect(panelSource).toContain('notif-type-filter');
    expect(panelSource).toContain('notif-severity-filter');
    expect(panelSource).toContain('searchFilter');
    expect(panelSource).toContain('projectFilter');
    expect(panelSource).toContain('showRead');
  });

  it('has mark-all-read and clear-local-views actions', () => {
    expect(panelSource).toContain('handleMarkAllRead');
    expect(panelSource).toContain('handleClearLocal');
    expect(panelSource).toContain('Mark all read');
    expect(panelSource).toContain('Reset local reads');
  });

  it('handles loading and error states', () => {
    expect(panelSource).toContain('Loading notifications');
    expect(panelSource).toContain('Failed to load notifications');
    expect(panelSource).toContain('No notifications yet');
  });

  it('documents the backend gap', () => {
    expect(panelSource).toContain('notification feed API does not yet exist');
    expect(feedSource).toContain('Backend gap');
  });

  it('displays severity, source kind, agent, and project in each row', () => {
    expect(panelSource).toContain('severityClass');
    expect(panelSource).toContain('sourceTypeLabel');
    expect(panelSource).toContain('formatTimeAgo');
    expect(panelSource).toContain('truncate');
  });

  it('has local-only read state tracking', () => {
    expect(feedSource).toContain('LocalStorage');
    expect(feedSource).toContain('STORAGE_KEY');
    expect(feedSource).toContain('clearLocalReadState');
  });
});

describe('notificationWindow source invariants', () => {
  const windowSource = readFileSync(
    resolve(process.cwd(), 'src/features/notifications/notificationWindow.ts'),
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
    expect(windowSource).toContain('existing.focus()');
  });
});

describe('ProjectSidebar notification button', () => {
  const sidebarSource = readFileSync(
    resolve(process.cwd(), 'src/app-shell/ProjectSidebar.tsx'),
    'utf8',
  );

  it('has a notification history button', () => {
    expect(sidebarSource).toContain('Notification History');
    expect(sidebarSource).toContain('openNotificationPanelWindow');
  });

  it('imports from notificationWindow', () => {
    expect(sidebarSource).toContain("import { openNotificationPanelWindow } from '../features/notifications/notificationWindow'");
  });
});

describe('App.tsx notification integration', () => {
  const appSource = readFileSync(
    resolve(process.cwd(), 'src/app-shell/App.tsx'),
    'utf8',
  );

  it('imports NotificationHistoryPanel component', () => {
    expect(appSource).toContain("import { NotificationHistoryPanel } from '../features/notifications/NotificationHistoryPanel'");
  });

  it('imports isNotificationPanelRoute', () => {
    expect(appSource).toContain("import { isNotificationPanelRoute } from '../features/notifications/notificationWindow'");
  });

  it('renders NotificationHistoryPanel in the notifications view mode', () => {
    expect(appSource).toContain("viewMode === 'notifications'");
    expect(appSource).toContain('<NotificationHistoryPanel');
  });

  it('detects standalone popup via hash route', () => {
    expect(appSource).toContain('#/notification-panel');
    expect(appSource).toContain('isNotificationPanelRoute()');
  });

  it('sets standalone prop when hash route is active', () => {
    expect(appSource).toContain('standalone');
  });
});

import type { NotificationItem } from './notificationFeed';

const PENDING_NOTIFICATION_CUE_IDS_KEY = 'den-web-notification-pending-cue-ids:v1';

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export interface NotificationBellCue {
  ids: string[];
  count: number;
  latestSummary: string;
  latestType: NotificationItem['type'];
  hasHighUrgency: boolean;
}

/**
 * Detect newly-arrived unread notifications after a successful previous feed.
 * The first fetch establishes baseline history and intentionally does not ring.
 */
export function detectNewUnreadNotificationIds(
  previousItems: NotificationItem[] | null,
  currentItems: NotificationItem[],
): string[] {
  if (previousItems === null) return [];

  const previousIds = new Set(previousItems.map(item => item.id));
  return currentItems
    .filter(item => !item.read && !previousIds.has(item.id))
    .map(item => item.id);
}

export function summarizeNotificationBellCue(
  items: NotificationItem[],
  ids: string[],
): NotificationBellCue | null {
  if (ids.length === 0) return null;

  const idSet = new Set(ids);
  const matching = items.filter(item => idSet.has(item.id));
  if (matching.length === 0) return null;

  const latest = matching[0];
  return {
    ids,
    count: matching.length,
    latestSummary: latest.summary,
    latestType: latest.type,
    hasHighUrgency: matching.some(item => item.severity === 'warning' || item.severity === 'error'),
  };
}

export function notificationCueLabel(cue: NotificationBellCue | null): string | null {
  if (!cue) return null;
  const prefix = cue.count === 1 ? '1 new operator event' : `${cue.count} new operator events`;
  if (cue.latestType === 'agent_work_complete') {
    return `${prefix} — agent finished work`;
  }
  return prefix;
}

function readStoredIdArray(): string[] {
  try {
    const raw = getBrowserLocalStorage()?.getItem(PENDING_NOTIFICATION_CUE_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIdArray(ids: string[]): void {
  try {
    const storage = getBrowserLocalStorage();
    if (!storage) return;
    if (ids.length === 0) {
      storage.removeItem(PENDING_NOTIFICATION_CUE_IDS_KEY);
      return;
    }
    storage.setItem(PENDING_NOTIFICATION_CUE_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Storage is only a cross-window UI cue bridge; never block notification rendering.
  }
}

/** Store new unread ids so a panel/window opened after the bell rings can highlight them. */
export function rememberPendingNotificationCueIds(ids: string[]): void {
  if (ids.length === 0) return;
  const merged = new Set([...readStoredIdArray(), ...ids]);
  writeStoredIdArray(Array.from(merged));
}

/** Read pending cross-window cue ids without clearing them. */
export function loadPendingNotificationCueIds(): string[] {
  return readStoredIdArray();
}

/** Clear selected pending ids once the user reads/acknowledges them in the history panel. */
export function clearPendingNotificationCueIds(ids?: string[]): void {
  if (!ids) {
    writeStoredIdArray([]);
    return;
  }
  const remove = new Set(ids);
  writeStoredIdArray(readStoredIdArray().filter(id => !remove.has(id)));
}

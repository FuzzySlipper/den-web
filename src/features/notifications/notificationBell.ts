import type { NotificationItem } from './notificationFeed';

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

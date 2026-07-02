import { useCallback, useEffect, useRef, useState } from 'react';
import {
  countUnread,
  type NotificationFeedResult,
  type NotificationItem,
} from '@den-web/features/notifications/notificationFeed';
import {
  detectNewUnreadNotificationIds,
  notificationCueLabel,
  rememberPendingNotificationCueIds,
  summarizeNotificationBellCue,
} from '@den-web/features/notifications/notificationBell';
import { focusArmedNotificationPanelWindow } from '@den-web/features/notifications/notificationWindow';
import type { NotificationHistoryMode } from '@den-web/features/preferences/types';

export interface NotificationBellState {
  unreadCount: number;
  newCount: number;
  cueLabel: string | null;
  focusBlocked: boolean;
}

export interface NotificationBell extends NotificationBellState {
  acknowledgeCue: () => void;
}

const INITIAL_BELL: NotificationBellState = {
  unreadCount: 0,
  newCount: 0,
  cueLabel: null,
  focusBlocked: false,
};

/**
 * Derives the sidebar notification-bell cue from the polled notification feed.
 *
 * The bell mirrors an external polled feed, so the effect is the sync point
 * between feed updates and the bell's unread/new/cue state.
 */
export function useNotificationBell(
  operatorNotificationFeed: NotificationFeedResult | null | undefined,
  notificationHistoryMode: NotificationHistoryMode,
): NotificationBell {
  const previousItemsRef = useRef<NotificationItem[] | null>(null);
  const [bell, setBell] = useState<NotificationBellState>(INITIAL_BELL);

  useEffect(() => {
    if (!operatorNotificationFeed || operatorNotificationFeed.error) return;

    const currentItems = operatorNotificationFeed.items;
    const newUnreadIds = detectNewUnreadNotificationIds(previousItemsRef.current, currentItems);
    previousItemsRef.current = currentItems;
    const unreadCount = countUnread(currentItems);

    if (newUnreadIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBell(prev => ({ ...prev, unreadCount }));
      return;
    }

    rememberPendingNotificationCueIds(newUnreadIds);
    const cue = summarizeNotificationBellCue(currentItems, newUnreadIds);
    const focusResult = notificationHistoryMode === 'window'
      ? focusArmedNotificationPanelWindow()
      : { blocked: false };

    setBell({
      unreadCount,
      newCount: newUnreadIds.length,
      cueLabel: notificationCueLabel(cue),
      focusBlocked: focusResult.blocked,
    });
  }, [operatorNotificationFeed, notificationHistoryMode]);

  const acknowledgeCue = useCallback(() => {
    setBell(prev => ({ ...prev, newCount: 0, cueLabel: null, focusBlocked: false }));
  }, []);

  return { ...bell, acknowledgeCue };
}

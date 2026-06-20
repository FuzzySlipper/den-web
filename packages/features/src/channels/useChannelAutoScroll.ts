import { useLayoutEffect, type RefObject } from 'react';
import type { Channel } from '@den-web/api/types';
import { scrollElementToBottom } from './channelScroll';

export function useChannelAutoScroll({
  activeChannel,
  activityLoading,
  autoScroll,
  displayedMessageCount,
  isScrollPinnedToBottomRef,
  messagesLoading,
  pendingAutoScrollObservedLoadingRef,
  pendingAutoScrollSnapKeyRef,
  previousAutoScrollKeyRef,
  projectId,
  scopedActivityEventCount,
  scrollResetKey,
  scrollbackRef,
}: {
  activeChannel: Channel | null;
  activityLoading: boolean;
  autoScroll: boolean;
  displayedMessageCount: number;
  isScrollPinnedToBottomRef: RefObject<boolean>;
  messagesLoading: boolean;
  pendingAutoScrollObservedLoadingRef: RefObject<boolean>;
  pendingAutoScrollSnapKeyRef: RefObject<string | null>;
  previousAutoScrollKeyRef: RefObject<string | null>;
  projectId: string | null;
  scopedActivityEventCount: number;
  scrollResetKey?: string | null;
  scrollbackRef: RefObject<HTMLDivElement | null>;
}) {
  useLayoutEffect(() => {
    const autoScrollKey = `${scrollResetKey ?? projectId ?? 'aggregate'}:${activeChannel?.id ?? 'none'}`;
    if (previousAutoScrollKeyRef.current !== autoScrollKey) {
      previousAutoScrollKeyRef.current = autoScrollKey;
      pendingAutoScrollSnapKeyRef.current = autoScrollKey;
      pendingAutoScrollObservedLoadingRef.current = false;
      isScrollPinnedToBottomRef.current = true;
    }

    if (!autoScroll) return;
    const shouldSnapToBottom = activeChannel !== null && pendingAutoScrollSnapKeyRef.current === autoScrollKey;
    if (!shouldSnapToBottom && !isScrollPinnedToBottomRef.current) return;

    const scrollbackElement = scrollbackRef.current;
    if (!scrollbackElement) return;

    scrollElementToBottom(scrollbackElement, shouldSnapToBottom ? 'auto' : 'smooth');
    isScrollPinnedToBottomRef.current = true;

    if (!shouldSnapToBottom) return;
    if (messagesLoading || activityLoading) {
      pendingAutoScrollObservedLoadingRef.current = true;
      return;
    }

    if (pendingAutoScrollObservedLoadingRef.current) {
      pendingAutoScrollSnapKeyRef.current = null;
      pendingAutoScrollObservedLoadingRef.current = false;
    }
  }, [
    activeChannel,
    activeChannel?.id,
    activityLoading,
    autoScroll,
    displayedMessageCount,
    isScrollPinnedToBottomRef,
    messagesLoading,
    pendingAutoScrollObservedLoadingRef,
    pendingAutoScrollSnapKeyRef,
    previousAutoScrollKeyRef,
    projectId,
    scopedActivityEventCount,
    scrollbackRef,
    scrollResetKey,
  ]);
}

import { useEffect, useReducer, useRef } from 'react';
import { channelEventStreamUrl } from '@den-web/api/channels/client';
import {
  INITIAL_STREAM_STATE,
  isChannelStreamingDisabled,
  parseChannelStreamEvent,
  streamConnectionReducer,
  type ChannelStreamEvent,
  type ChannelStreamStatus,
} from './channelEventStream';

/** Coalesce a burst of stream events (e.g. the initial replay window) into one refresh. */
const STREAM_REFRESH_COALESCE_MS = 150;

export interface UseChannelEventStreamParams {
  channelId: number | null;
  /** Refresh the message list (called coalesced when channel_message events arrive). */
  onMessage: () => void;
  /** Refresh activity/breadcrumbs (called coalesced when channel_activity_event events arrive). */
  onActivity: () => void;
  /** Optional typed consumer for normalized events (future incremental-merge use). */
  onEvent?: (event: ChannelStreamEvent) => void;
  /** Force polling when false. Defaults to true (subject to the operator opt-out). */
  enabled?: boolean;
}

export interface ChannelEventStreamState {
  status: ChannelStreamStatus;
}

/**
 * Subscribe to the Den Channels SSE stream (#2146) for one channel and trigger
 * refreshes of the existing polled message/activity lists as events arrive.
 *
 * This keeps the channel render model unchanged — the stream is a freshness
 * signal, not a new data source — so reactions, composer, DM evidence and
 * wake/delivery rendering are unaffected. Polling remains the fallback: when the
 * stream is missing, disabled, or errors, `status` becomes `fallback` and the
 * panel keeps its fast poll. EventSource handles cursor reconnect via
 * Last-Event-ID.
 */
export function useChannelEventStream(params: UseChannelEventStreamParams): ChannelEventStreamState {
  const { channelId, onMessage, onActivity, onEvent, enabled = true } = params;
  const [state, dispatch] = useReducer(streamConnectionReducer, INITIAL_STREAM_STATE);
  const timelineCursorRef = useRef<string | null>(null);
  const timelineCursorChannelRef = useRef<number | null>(null);

  // Keep the latest handlers in a ref so changing identities (e.g. when the poll
  // interval changes the refresh closures) never re-open the EventSource.
  const handlersRef = useRef({ onMessage, onActivity, onEvent });
  useEffect(() => {
    handlersRef.current = { onMessage, onActivity, onEvent };
  });

  const streamingDisabled = enabled === false || isChannelStreamingDisabled();

  useEffect(() => {
    if (channelId == null || streamingDisabled) {
      dispatch({ type: 'idle' });
      return;
    }
    if (typeof EventSource === 'undefined') {
      dispatch({ type: 'unsupported' });
      return;
    }
    if (timelineCursorChannelRef.current !== channelId) {
      timelineCursorChannelRef.current = channelId;
      timelineCursorRef.current = null;
    }

    dispatch({ type: 'start' });
    const source = new EventSource(channelEventStreamUrl(channelId, { afterTimelineCursor: timelineCursorRef.current }));

    let flushTimer: number | undefined;
    const pending = { message: false, activity: false };
    const scheduleFlush = () => {
      if (flushTimer != null) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = undefined;
        if (pending.message) { pending.message = false; handlersRef.current.onMessage(); }
        if (pending.activity) { pending.activity = false; handlersRef.current.onActivity(); }
      }, STREAM_REFRESH_COALESCE_MS);
    };

    const handleData = (kind: 'message' | 'activity', eventType: 'channel_message' | 'channel_activity_event') =>
      (event: MessageEvent) => {
        pending[kind] = true;
        scheduleFlush();
        const consumer = handlersRef.current.onEvent;
        if (consumer) {
          const normalized = parseChannelStreamEvent(eventType, event.data);
          if (normalized) consumer(normalized);
        }
      };

    const handleOpen = () => dispatch({ type: 'open' });
    const handleMessage = handleData('message', 'channel_message');
    const handleActivity = handleData('activity', 'channel_activity_event');
    const handleTimelineItem = (event: MessageEvent) => {
      const cursor = readTimelineCursor(event.data);
      if (cursor) timelineCursorRef.current = cursor;
      pending.message = true;
      pending.activity = true;
      scheduleFlush();
    };
    const handleTimelineRefresh = (event: MessageEvent) => {
      const cursor = readTimelineRefreshCursor(event.data);
      if (cursor) timelineCursorRef.current = cursor;
      pending.message = true;
      pending.activity = true;
      scheduleFlush();
    };
    const handleTimelineHeartbeat = (event: MessageEvent) => {
      const cursor = readTimelineRefreshCursor(event.data);
      if (cursor) timelineCursorRef.current = cursor;
    };
    const handleError = () => dispatch({ type: 'error' });

    source.addEventListener('open', handleOpen);
    source.addEventListener('stream_open', handleOpen as EventListener);
    source.addEventListener('channel_message', handleMessage as EventListener);
    source.addEventListener('channel_activity_event', handleActivity as EventListener);
    source.addEventListener('timeline_item', handleTimelineItem as EventListener);
    source.addEventListener('timeline_refresh', handleTimelineRefresh as EventListener);
    source.addEventListener('heartbeat', handleTimelineHeartbeat as EventListener);
    source.addEventListener('error', handleError);

    return () => {
      if (flushTimer != null) window.clearTimeout(flushTimer);
      source.removeEventListener('open', handleOpen);
      source.removeEventListener('stream_open', handleOpen as EventListener);
      source.removeEventListener('channel_message', handleMessage as EventListener);
      source.removeEventListener('channel_activity_event', handleActivity as EventListener);
      source.removeEventListener('timeline_item', handleTimelineItem as EventListener);
      source.removeEventListener('timeline_refresh', handleTimelineRefresh as EventListener);
      source.removeEventListener('heartbeat', handleTimelineHeartbeat as EventListener);
      source.removeEventListener('error', handleError);
      source.close();
    };
  }, [channelId, streamingDisabled]);

  return { status: state.status };
}

function readTimelineCursor(data: string): string | null {
  const record = parseJsonRecord(data);
  return typeof record?.cursor === 'string' ? record.cursor : null;
}

function readTimelineRefreshCursor(data: string): string | null {
  const record = parseJsonRecord(data);
  const direct = typeof record?.cursor === 'string' ? record.cursor : null;
  const after = typeof record?.after === 'string' ? record.after : null;
  return direct ?? after;
}

function parseJsonRecord(data: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(data);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

import type { ChannelActivityEvent, ChannelMessage } from '@den-web/api/types';

/**
 * Pure model for the channel SSE stream (#2146/#2147).
 *
 * The transport (EventSource) and React wiring live in
 * `useChannelEventStream`; everything here is pure and unit-tested:
 *  - event normalization (`parseChannelStreamEvent`),
 *  - reconnect cursor parsing (`parseChannelStreamCursor`),
 *  - the connection-status state machine (`streamConnectionReducer`),
 *  - the operator opt-out check (`isChannelStreamingDisabled`).
 *
 * Current backend contract: GET /api/v1/timeline/channels/{channelId}/stream
 * emits timeline events. The legacy parser shape remains here because the
 * React hook still translates both stream generations into the same UI refresh
 * signals.
 */

export interface ChannelStreamCursor {
  messageId: number;
  activityId: number;
  sseId: string;
}

export type ChannelStreamEvent =
  | { kind: 'open'; channelId: number; cursor: ChannelStreamCursor; supportedEventTypes: string[] }
  | { kind: 'message'; channelId: number; cursor: ChannelStreamCursor; message: ChannelMessage }
  | { kind: 'activity'; channelId: number; cursor: ChannelStreamCursor; activityEvent: ChannelActivityEvent };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Parse the composite SSE id `messages={id};activity={id}` into its two cursor parts. */
export function parseChannelStreamCursor(sseId: string): { messageId: number; activityId: number } | null {
  const messageMatch = /messages=(\d+)/.exec(sseId);
  const activityMatch = /activity=(\d+)/.exec(sseId);
  if (!messageMatch || !activityMatch) return null;
  return { messageId: Number(messageMatch[1]), activityId: Number(activityMatch[1]) };
}

function readCursor(raw: unknown): ChannelStreamCursor | null {
  const record = asRecord(raw);
  if (!record) return null;
  const messageId = asNumber(record.messageId);
  const activityId = asNumber(record.activityId);
  const sseId = typeof record.sseId === 'string' ? record.sseId : null;
  if (messageId == null || activityId == null || sseId == null) return null;
  return { messageId, activityId, sseId };
}

/**
 * Normalize one SSE event (its `event:` name + raw `data:` JSON) into a typed
 * {@link ChannelStreamEvent}. Returns null for malformed data, unknown event
 * types, or heartbeats so the caller can safely ignore them.
 */
export function parseChannelStreamEvent(eventType: string, data: string): ChannelStreamEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  const record = asRecord(payload);
  if (!record) return null;

  const channelId = asNumber(record.channelId);
  const cursor = readCursor(record.cursor);
  if (channelId == null || cursor == null) return null;

  switch (eventType) {
    case 'stream_open': {
      const supported = Array.isArray(record.supportedEventTypes)
        ? record.supportedEventTypes.filter((value): value is string => typeof value === 'string')
        : [];
      return { kind: 'open', channelId, cursor, supportedEventTypes: supported };
    }
    case 'channel_message': {
      const message = asRecord(record.message);
      if (!message) return null;
      return { kind: 'message', channelId, cursor, message: message as unknown as ChannelMessage };
    }
    case 'channel_activity_event': {
      const activityEvent = asRecord(record.activityEvent);
      if (!activityEvent) return null;
      return { kind: 'activity', channelId, cursor, activityEvent: activityEvent as unknown as ChannelActivityEvent };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Connection status state machine
// ---------------------------------------------------------------------------

/**
 * - `idle`: no channel selected / streaming disabled — pure polling.
 * - `connecting`: EventSource opening.
 * - `open`: stream connected and delivering; the panel slows its safety-net poll.
 * - `fallback`: stream unavailable/errored — polling carries the updates.
 */
export type ChannelStreamStatus = 'idle' | 'connecting' | 'open' | 'fallback';

export interface StreamConnectionState {
  status: ChannelStreamStatus;
  failures: number;
}

export type StreamConnectionAction =
  | { type: 'start' }
  | { type: 'open' }
  | { type: 'error' }
  | { type: 'idle' }
  | { type: 'unsupported' };

export const INITIAL_STREAM_STATE: StreamConnectionState = { status: 'idle', failures: 0 };

export function streamConnectionReducer(
  state: StreamConnectionState,
  action: StreamConnectionAction,
): StreamConnectionState {
  switch (action.type) {
    case 'start':
      return { status: 'connecting', failures: 0 };
    case 'open':
      return { status: 'open', failures: 0 };
    case 'error':
      // Any transport error degrades to the polling fallback until the stream
      // re-opens. A reconnect emits 'open' again and clears the failure count.
      return { status: 'fallback', failures: state.failures + 1 };
    case 'unsupported':
      // A channel is selected but EventSource isn't available (e.g. SSR/tests
      // or stream endpoint missing) — polling is the only delivery path.
      return { status: 'fallback', failures: state.failures };
    case 'idle':
      return INITIAL_STREAM_STATE;
    default:
      return state;
  }
}

/** True when the stream delivers updates and the panel can slow its poll. */
export function isStreamDelivering(status: ChannelStreamStatus): boolean {
  return status === 'open';
}

const STREAM_DISABLE_STORAGE_KEY = 'den-web-channel-stream';

/** Operator opt-out: set localStorage `den-web-channel-stream` to `off` to force polling. */
export function isChannelStreamingDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STREAM_DISABLE_STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

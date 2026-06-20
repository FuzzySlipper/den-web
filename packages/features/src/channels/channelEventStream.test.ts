import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INITIAL_STREAM_STATE,
  isChannelStreamingDisabled,
  isStreamDelivering,
  parseChannelStreamCursor,
  parseChannelStreamEvent,
  streamConnectionReducer,
} from './channelEventStream';

const cursor = { messageId: 42, activityId: 7, sseId: 'messages=42;activity=7' };

describe('parseChannelStreamCursor', () => {
  it('parses the composite sse id', () => {
    expect(parseChannelStreamCursor('messages=42;activity=7')).toEqual({ messageId: 42, activityId: 7 });
  });

  it('returns null for a malformed id', () => {
    expect(parseChannelStreamCursor('nonsense')).toBeNull();
    expect(parseChannelStreamCursor('messages=42')).toBeNull();
  });
});

describe('parseChannelStreamEvent', () => {
  it('normalizes a stream_open event', () => {
    const data = JSON.stringify({
      type: 'stream_open',
      channelId: 123,
      cursor,
      supportedEventTypes: ['channel_message', 'channel_activity_event'],
    });
    expect(parseChannelStreamEvent('stream_open', data)).toEqual({
      kind: 'open',
      channelId: 123,
      cursor,
      supportedEventTypes: ['channel_message', 'channel_activity_event'],
    });
  });

  it('normalizes a channel_message event', () => {
    const message = { id: 42, channelId: 123, body: 'hi' };
    const data = JSON.stringify({ type: 'channel_message', channelId: 123, cursor, message });
    const parsed = parseChannelStreamEvent('channel_message', data);
    expect(parsed).toMatchObject({ kind: 'message', channelId: 123, cursor });
    expect((parsed as { message: typeof message }).message).toEqual(message);
  });

  it('normalizes a channel_activity_event event', () => {
    const activityEvent = { id: 8, channelId: 123, eventType: 'status' };
    const data = JSON.stringify({ type: 'channel_activity_event', channelId: 123, cursor, activityEvent });
    const parsed = parseChannelStreamEvent('channel_activity_event', data);
    expect(parsed).toMatchObject({ kind: 'activity', channelId: 123, cursor });
    expect((parsed as { activityEvent: typeof activityEvent }).activityEvent).toEqual(activityEvent);
  });

  it('returns null for malformed JSON, unknown types, and missing fields', () => {
    expect(parseChannelStreamEvent('channel_message', '{not json')).toBeNull();
    expect(parseChannelStreamEvent('channel_message', JSON.stringify({ channelId: 1, cursor }))).toBeNull();
    expect(parseChannelStreamEvent('heartbeat', JSON.stringify({ channelId: 1, cursor }))).toBeNull();
    expect(parseChannelStreamEvent('channel_message', JSON.stringify({ channelId: 1, message: {} }))).toBeNull();
    expect(parseChannelStreamEvent('stream_open', JSON.stringify({ cursor }))).toBeNull();
  });
});

describe('streamConnectionReducer', () => {
  it('opens, connects, and resets through the lifecycle', () => {
    expect(streamConnectionReducer(INITIAL_STREAM_STATE, { type: 'start' })).toEqual({ status: 'connecting', failures: 0 });
    expect(streamConnectionReducer({ status: 'connecting', failures: 0 }, { type: 'open' })).toEqual({ status: 'open', failures: 0 });
    expect(streamConnectionReducer({ status: 'open', failures: 0 }, { type: 'idle' })).toEqual(INITIAL_STREAM_STATE);
  });

  it('degrades to fallback on error and counts failures, then recovers on open', () => {
    const errored = streamConnectionReducer({ status: 'open', failures: 0 }, { type: 'error' });
    expect(errored).toEqual({ status: 'fallback', failures: 1 });
    const erroredAgain = streamConnectionReducer(errored, { type: 'error' });
    expect(erroredAgain).toEqual({ status: 'fallback', failures: 2 });
    // A successful reconnect clears the degraded state.
    expect(streamConnectionReducer(erroredAgain, { type: 'open' })).toEqual({ status: 'open', failures: 0 });
  });

  it('falls back when EventSource is unsupported', () => {
    expect(streamConnectionReducer(INITIAL_STREAM_STATE, { type: 'unsupported' }).status).toBe('fallback');
  });
});

describe('isStreamDelivering', () => {
  it('is true only when the stream is open', () => {
    expect(isStreamDelivering('open')).toBe(true);
    expect(isStreamDelivering('fallback')).toBe(false);
    expect(isStreamDelivering('connecting')).toBe(false);
    expect(isStreamDelivering('idle')).toBe(false);
  });
});

describe('isChannelStreamingDisabled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false by default and when window is unavailable', () => {
    expect(isChannelStreamingDisabled()).toBe(false);
  });

  it('honors the localStorage opt-out flag', () => {
    const store = new Map<string, string>([['den-web-channel-stream', 'off']]);
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null } });
    expect(isChannelStreamingDisabled()).toBe(true);
    store.set('den-web-channel-stream', 'on');
    expect(isChannelStreamingDisabled()).toBe(false);
  });
});

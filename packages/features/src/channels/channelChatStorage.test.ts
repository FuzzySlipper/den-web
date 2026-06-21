import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIRECT_TARGET_STORAGE_KEY,
  SENDER_IDENTITY_STORAGE_KEY,
  persistDirectTarget,
  persistSenderIdentity,
  readStoredDirectTarget,
  readStoredSenderIdentity,
} from './channelChatStorage';

function stubWindowStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readStoredSenderIdentity', () => {
  it('returns the trimmed stored identity', () => {
    const store = stubWindowStorage();
    store.set(SENDER_IDENTITY_STORAGE_KEY, '  patch  ');
    expect(readStoredSenderIdentity()).toBe('patch');
  });

  it('returns an empty string when nothing is stored', () => {
    stubWindowStorage();
    expect(readStoredSenderIdentity()).toBe('');
  });

  it('degrades gracefully when window is unavailable', () => {
    expect(readStoredSenderIdentity()).toBe('');
  });
});

describe('persistSenderIdentity', () => {
  it('stores a normalized identity', () => {
    const store = stubWindowStorage();
    persistSenderIdentity('  patch  ');
    expect(store.get(SENDER_IDENTITY_STORAGE_KEY)).toBe('patch');
  });

  it('removes the key when the identity is blank', () => {
    const store = stubWindowStorage();
    store.set(SENDER_IDENTITY_STORAGE_KEY, 'patch');
    persistSenderIdentity('   ');
    expect(store.has(SENDER_IDENTITY_STORAGE_KEY)).toBe(false);
  });

  it('does not throw when window is unavailable', () => {
    expect(() => persistSenderIdentity('patch')).not.toThrow();
  });
});

describe('direct target storage', () => {
  it('stores and reads a normalized direct target by channel id', () => {
    const store = stubWindowStorage();

    persistDirectTarget(31, '  den-web-runner  ');

    expect(JSON.parse(store.get(DIRECT_TARGET_STORAGE_KEY) ?? '{}')).toEqual({ '31': 'den-web-runner' });
    expect(readStoredDirectTarget(31)).toBe('den-web-runner');
    expect(readStoredDirectTarget(40)).toBe('');
  });

  it('keeps other channel targets when replacing one channel target', () => {
    const store = stubWindowStorage();
    store.set(DIRECT_TARGET_STORAGE_KEY, JSON.stringify({ '31': 'den-web-runner', '40': 'asha-runner' }));

    persistDirectTarget(31, 'den-web-planner');

    expect(JSON.parse(store.get(DIRECT_TARGET_STORAGE_KEY) ?? '{}')).toEqual({ '31': 'den-web-planner', '40': 'asha-runner' });
  });

  it('removes a channel target when the identity is blank', () => {
    const store = stubWindowStorage();
    store.set(DIRECT_TARGET_STORAGE_KEY, JSON.stringify({ '31': 'den-web-runner', '40': 'asha-runner' }));

    persistDirectTarget(31, ' ');

    expect(JSON.parse(store.get(DIRECT_TARGET_STORAGE_KEY) ?? '{}')).toEqual({ '40': 'asha-runner' });
  });

  it('degrades gracefully when storage is unavailable or malformed', () => {
    expect(readStoredDirectTarget(31)).toBe('');
    expect(() => persistDirectTarget(31, 'den-web-runner')).not.toThrow();

    const store = stubWindowStorage();
    store.set(DIRECT_TARGET_STORAGE_KEY, 'not-json');
    expect(readStoredDirectTarget(31)).toBe('');
  });
});

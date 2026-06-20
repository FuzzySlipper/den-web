import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SENDER_IDENTITY_STORAGE_KEY,
  persistSenderIdentity,
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

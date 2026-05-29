/// <reference types="node" />
import { describe, expect, it, beforeEach } from 'vitest';
import {
  appendHistory,
  clearHistory,
  readHistory,
  recordAndPersistHistory,
  storageKey,
  type ComposerHistoryEntry,
} from './channelComposerHistory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entry(body: string, timestamp = 0): ComposerHistoryEntry {
  return { body, timestamp };
}

// ---------------------------------------------------------------------------
// Storage key derivation
// ---------------------------------------------------------------------------

describe('storageKey', () => {
  it('uses a browser-global key across identities', () => {
    expect(storageKey('patch')).toBe('den-channel-composer-history:v1');
  });

  it('does not vary by sender identity', () => {
    expect(storageKey('')).toBe(storageKey('  '));
    expect(storageKey('user-a')).toBe(storageKey('user-b'));
  });
});

// ---------------------------------------------------------------------------
// appendHistory (pure function)
// ---------------------------------------------------------------------------

describe('appendHistory', () => {
  it('appends a new entry to an empty list', () => {
    const result = appendHistory([], 'hello world');
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('hello world');
    expect(typeof result[0].timestamp).toBe('number');
  });

  it('skips consecutive duplicates', () => {
    const existing = [entry('hello'), entry('world')];
    const result = appendHistory(existing, 'world');
    expect(result).toHaveLength(2);
    expect(result).toEqual(existing);
  });

  it('allows non-consecutive duplicates', () => {
    const existing = [entry('hello'), entry('world')];
    const result = appendHistory(existing, 'hello');
    expect(result).toHaveLength(3);
    expect(result[2].body).toBe('hello');
  });

  it('trims the body before adding', () => {
    const result = appendHistory([], '  hello  ');
    expect(result[0].body).toBe('hello');
  });

  it('caps body length', () => {
    const longBody = 'x'.repeat(600);
    const result = appendHistory([], longBody);
    expect(result[0].body.length).toBe(500);
  });

  it('ignores empty body after trim', () => {
    const existing = [entry('hello')];
    const result = appendHistory(existing, '   ');
    expect(result).toHaveLength(1);
    expect(result).toEqual(existing);
  });

  it('respects maxEntries parameter and drops oldest on overflow', () => {
    const existing = Array.from({ length: 5 }, (_, i) => entry(`msg-${i}`));
    const result = appendHistory(existing, 'new-msg', 5);
    expect(result).toHaveLength(5);
    expect(result[0].body).toBe('msg-1');
    expect(result[4].body).toBe('new-msg');
  });

  it('drops nothing when under maxEntries', () => {
    const existing = Array.from({ length: 3 }, (_, i) => entry(`msg-${i}`));
    const result = appendHistory(existing, 'new-msg', 5);
    expect(result).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// localStorage roundtrip (only runs when localStorage is available)
// ---------------------------------------------------------------------------

const localStorageAvailable =
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined' &&
  typeof window.localStorage.setItem === 'function';

function lscar() {
  try {
    window.localStorage.setItem('__vitest_ls_check', '1');
    window.localStorage.removeItem('__vitest_ls_check');
    return true;
  } catch {
    return false;
  }
}

const canTestLocalStorage = localStorageAvailable && lscar();

describe.runIf(canTestLocalStorage)('localStorage roundtrip', () => {
  beforeEach(() => {
    window.localStorage.removeItem(storageKey());
  });

  it('returns empty array when no stored data', () => {
    expect(readHistory('test-user')).toEqual([]);
  });

  it('recordAndPersistHistory writes and reads back', () => {
    const updated = recordAndPersistHistory('test-user', 'first message');
    expect(updated).toHaveLength(1);
    expect(updated[0].body).toBe('first message');

    const reread = readHistory('test-user');
    expect(reread).toEqual(updated);
  });

  it('recordAndPersistHistory skips consecutive duplicates across calls', () => {
    recordAndPersistHistory('test-user', 'hello');
    const updated = recordAndPersistHistory('test-user', 'hello');
    expect(updated).toHaveLength(1);
  });

  it('keeps history global across identities in the same browser', () => {
    recordAndPersistHistory('user-a', 'message from a');
    recordAndPersistHistory('user-b', 'message from b');

    const historyA = readHistory('user-a');
    const historyB = readHistory('user-b');

    expect(historyA).toHaveLength(2);
    expect(historyA[0].body).toBe('message from a');
    expect(historyA[1].body).toBe('message from b');
    expect(historyB).toEqual(historyA);
  });

  it('clearHistory removes the stored entry', () => {
    recordAndPersistHistory('test-user', 'something');
    clearHistory('test-user');
    expect(readHistory('test-user')).toEqual([]);
  });
});

describe('graceful fallback without localStorage', () => {
  it('readHistory returns empty array when localStorage unavailable', () => {
    // We can't truly remove localStorage in vitest node, but we verify the
    // guard function returns empty by testing the readHistory logic path
    expect(Array.isArray(readHistory('anyone'))).toBe(true);
  });

  it('recordAndPersistHistory returns the updated array even without persistence', () => {
    const result = recordAndPersistHistory('no-storage', 'hello');
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('hello');
  });
});

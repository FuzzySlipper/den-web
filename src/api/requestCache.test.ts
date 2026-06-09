import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearRequestCache,
  dedupedFetch,
  inFlightRequestCount,
  invalidateRequest,
} from './requestCache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  clearRequestCache();
});

describe('in-flight de-duplication', () => {
  it('shares one in-flight request for concurrent calls with the same key', async () => {
    const d = deferred<number>();
    const run = vi.fn(() => d.promise);

    const p1 = dedupedFetch('k', run);
    const p2 = dedupedFetch('k', run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(inFlightRequestCount()).toBe(1);

    d.resolve(7);
    expect(await p1).toBe(7);
    expect(await p2).toBe(7);
    expect(inFlightRequestCount()).toBe(0);
  });

  it('uses separate requests for different keys', () => {
    const run = vi.fn(() => Promise.resolve('x'));
    dedupedFetch('a', run);
    dedupedFetch('b', run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('refetches once the previous request has settled (default: in-flight only)', async () => {
    const run = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b');

    expect(await dedupedFetch('k', run)).toBe('a');
    expect(await dedupedFetch('k', run)).toBe('b');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures and retries on the next call', async () => {
    const run = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    await expect(dedupedFetch('k', run)).rejects.toThrow('boom');
    expect(inFlightRequestCount()).toBe(0);
    expect(await dedupedFetch('k', run)).toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('shares a rejection across concurrent callers', async () => {
    const d = deferred<number>();
    const run = vi.fn(() => d.promise);

    const p1 = dedupedFetch('k', run);
    const p2 = dedupedFetch('k', run);
    d.reject(new Error('nope'));

    await expect(p1).rejects.toThrow('nope');
    await expect(p2).rejects.toThrow('nope');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('optional TTL cache (cacheMs)', () => {
  it('reuses a freshly-resolved value within the window, then refetches after expiry', async () => {
    let t = 1000;
    const now = () => t;
    const run = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b');

    expect(await dedupedFetch('k', run, { cacheMs: 5000, now })).toBe('a');
    // Within the window: value reused, no new fetch.
    expect(await dedupedFetch('k', run, { cacheMs: 5000, now })).toBe('a');
    expect(run).toHaveBeenCalledTimes(1);

    // Past the window: refetch.
    t = 7000;
    expect(await dedupedFetch('k', run, { cacheMs: 5000, now })).toBe('b');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('invalidate() forces a refetch even within the window', async () => {
    const t = 1000;
    const now = () => t;
    const run = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b');

    expect(await dedupedFetch('k', run, { cacheMs: 5000, now })).toBe('a');
    invalidateRequest('k');
    expect(await dedupedFetch('k', run, { cacheMs: 5000, now })).toBe('b');
    expect(run).toHaveBeenCalledTimes(2);
  });
});

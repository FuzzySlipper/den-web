/**
 * Request de-duplication / shared-cache layer for Den Web live data (#2145).
 *
 * Keyed by a stable query identity (the resolved request URL). When several
 * panels independently fetch the same read-only endpoint, the first call starts
 * the request and any overlapping callers share the same in-flight promise
 * instead of firing a duplicate network request.
 *
 * Default behavior is **in-flight sharing only** (`cacheMs` = 0): once a request
 * settles its in-flight entry is cleared, so the next call (e.g. the next poll
 * tick) refetches from the network. This makes de-dup strictly behavior-
 * preserving for GETs — two concurrent identical requests would return the same
 * response anyway. An optional short TTL (`cacheMs`) can additionally reuse a
 * freshly-resolved value across near-simultaneous callers; it is off by default.
 *
 * This is intentionally small and explicit — not an app-state/query library.
 */

interface CacheEntry<T> {
  inFlight: Promise<T> | null;
  value: T | null;
  hasValue: boolean;
  settledAt: number;
}

export interface DedupeOptions {
  /**
   * Reuse a freshly-resolved value for this many milliseconds for the same key
   * instead of refetching. Default 0 = share in-flight requests only.
   */
  cacheMs?: number;
  /** Clock injection for tests. Defaults to Date.now. */
  now?: () => number;
}

const registry = new Map<string, CacheEntry<unknown>>();

/**
 * Run `run` for `key`, sharing an in-flight request with overlapping callers.
 *
 * - If a request for `key` is already in flight, returns that promise.
 * - Otherwise (and outside any `cacheMs` window) starts a new request.
 * - On settle the in-flight entry clears so the next call refetches.
 * - Failures are not cached; the next call retries.
 */
export function dedupedFetch<T>(key: string, run: () => Promise<T>, options: DedupeOptions = {}): Promise<T> {
  const now = options.now ?? Date.now;
  const cacheMs = options.cacheMs ?? 0;
  const existing = registry.get(key) as CacheEntry<T> | undefined;

  if (existing) {
    if (existing.inFlight) return existing.inFlight;
    if (cacheMs > 0 && existing.hasValue && now() - existing.settledAt < cacheMs) {
      return Promise.resolve(existing.value as T);
    }
  }

  const entry: CacheEntry<T> = existing ?? { inFlight: null, value: null, hasValue: false, settledAt: 0 };
  if (!existing) registry.set(key, entry as CacheEntry<unknown>);

  const promise = (async () => {
    try {
      const value = await run();
      entry.value = value;
      entry.hasValue = true;
      entry.settledAt = now();
      return value;
    } finally {
      entry.inFlight = null;
    }
  })();
  entry.inFlight = promise;
  return promise;
}

/** Drop any cached value for `key` so the next call refetches. Does not abort an in-flight request. */
export function invalidateRequest(key: string): void {
  const entry = registry.get(key);
  if (!entry) return;
  entry.value = null;
  entry.hasValue = false;
  entry.settledAt = 0;
}

/** Reset the whole cache. Primarily for tests. */
export function clearRequestCache(): void {
  registry.clear();
}

/** Count of currently in-flight shared requests. For diagnostics/tests. */
export function inFlightRequestCount(): number {
  let count = 0;
  for (const entry of registry.values()) {
    if (entry.inFlight) count += 1;
  }
  return count;
}

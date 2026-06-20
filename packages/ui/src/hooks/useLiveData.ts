import { usePolling } from './usePolling';

/**
 * Delivery strategy for a live-data subscription.
 *
 * Only `'poll'` is implemented today. The union is the seam for future
 * push-based strategies (e.g. `'sse'`/stream) so consumers can opt in without
 * the data-layer concept being hard-coded as "polling".
 */
export type LiveDataStrategy = 'poll';

export interface LiveDataOptions {
  /** Delivery strategy. Defaults to `'poll'`; future strategies branch here. */
  strategy?: LiveDataStrategy;
  /** Poll interval in milliseconds (used by the `'poll'` strategy). */
  interval: number;
}

export interface LiveData<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Streaming-ready data boundary for Den Web.
 *
 * Phase A (#2140): a thin, behavior-preserving wrapper over {@link usePolling}.
 * Consumers depend on this boundary and an explicit delivery `strategy` instead
 * of importing the polling primitive directly, so later phases can add push
 * strategies and request de-duplication/caching without touching call sites.
 *
 * Loading/error/data/refresh semantics are identical to {@link usePolling};
 * pass a stable (memoized) fetcher — a fresh fetcher identity triggers a refetch.
 */
export function useLiveData<T>(fetcher: () => Promise<T>, options: LiveDataOptions): LiveData<T> {
  // `strategy` defaults to 'poll' and is the only strategy implemented in Phase A.
  // usePolling is always called (unconditionally, per the Rules of Hooks); future
  // strategies will be selected without changing this hook's public contract.
  return usePolling(fetcher, options.interval);
}

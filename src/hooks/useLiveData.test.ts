import { afterEach, describe, expect, it, vi } from 'vitest';

// The boundary is a thin wrapper over usePolling. With no DOM renderer in this
// environment we verify the delegation contract by mocking the polling
// primitive: useLiveData must forward the fetcher + interval and pass the
// {data,loading,error,refresh} result straight through, unchanged.
const usePollingMock = vi.fn();
vi.mock('./usePolling', () => ({
  usePolling: (fetcher: () => Promise<unknown>, interval: number) => usePollingMock(fetcher, interval),
}));

import { useLiveData } from './useLiveData';

afterEach(() => {
  usePollingMock.mockReset();
});

describe('useLiveData', () => {
  it('delegates to usePolling with the configured interval', () => {
    const result = { data: null, loading: true, error: null, refresh: () => {} };
    usePollingMock.mockReturnValue(result);
    const fetcher = () => Promise.resolve(42);

    const out = useLiveData(fetcher, { strategy: 'poll', interval: 5000 });

    expect(usePollingMock).toHaveBeenCalledTimes(1);
    expect(usePollingMock).toHaveBeenCalledWith(fetcher, 5000);
    expect(out).toBe(result);
  });

  it('defaults to the poll strategy without changing the polling call', () => {
    usePollingMock.mockReturnValue({ data: null, loading: false, error: null, refresh: () => {} });
    const fetcher = () => Promise.resolve('x');

    useLiveData(fetcher, { interval: 3000 });

    expect(usePollingMock).toHaveBeenCalledWith(fetcher, 3000);
  });

  it('passes loaded data, errors, and refresh through unchanged', () => {
    const refresh = vi.fn();
    const error = new Error('boom');
    usePollingMock.mockReturnValue({ data: [1, 2], loading: false, error, refresh });

    const out = useLiveData(() => Promise.resolve([1, 2]), { interval: 1000 });

    expect(out.data).toEqual([1, 2]);
    expect(out.loading).toBe(false);
    expect(out.error).toBe(error);
    out.refresh();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

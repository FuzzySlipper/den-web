import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQuery, coreApiUrl, esc, get, getApiBases, resetClient } from './http';
import { clearRequestCache } from '../requestCache';

afterEach(() => {
  resetClient();
  clearRequestCache();
  vi.unstubAllGlobals();
});

describe('buildQuery', () => {
  it('returns an empty string when no params are present', () => {
    expect(buildQuery({})).toBe('');
    expect(buildQuery({ a: undefined, b: null })).toBe('');
  });

  it('drops null/undefined but keeps falsy values like 0 and false', () => {
    expect(buildQuery({ a: 0, b: false, c: undefined, d: null })).toBe('?a=0&b=false');
  });

  it('encodes keys/values and joins with &', () => {
    expect(buildQuery({ q: 'a b', tag: 'x/y' })).toBe('?q=a%20b&tag=x%2Fy');
  });
});

describe('esc', () => {
  it('percent-encodes path segments', () => {
    expect(esc('a/b c')).toBe('a%2Fb%20c');
  });
});

describe('coreApiUrl', () => {
  it('prefixes relative urls with the resolved core base', () => {
    const { denCoreApiBase } = getApiBases();
    expect(coreApiUrl('/api/spaces')).toBe(`${denCoreApiBase}/api/spaces`);
  });

  it('adds a leading slash when the url omits one', () => {
    const { denCoreApiBase } = getApiBases();
    expect(coreApiUrl('api/spaces')).toBe(`${denCoreApiBase}/api/spaces`);
  });

  it('passes absolute http(s) urls through untouched', () => {
    expect(coreApiUrl('https://example.test/api/x')).toBe('https://example.test/api/x');
  });
});

describe('get request de-duplication (#2145)', () => {
  it('collapses concurrent identical GETs into one network request', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ value: 1 }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([get('/api/spaces'), get('/api/spaces')]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
  });

  it('does not collapse GETs to different urls', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ url }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await Promise.all([get('/api/spaces'), get('/api/projects')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches on a subsequent (non-overlapping) call', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ value: 1 }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await get('/api/spaces');
    await get('/api/spaces');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

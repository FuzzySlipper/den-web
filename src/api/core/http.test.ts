import { afterEach, describe, expect, it } from 'vitest';
import { buildQuery, coreApiUrl, esc, getApiBases, resetClient } from './http';

afterEach(() => {
  resetClient();
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

/// <reference types="node" />
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetConfig, getConfig, getCachedConfig, getConfigLoadError, normalizeApiBase } from './config';

beforeEach(() => {
  resetConfig();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('normalizeApiBase', () => {
  it('returns the value when provided and non-empty', () => {
    expect(normalizeApiBase('/custom/api', '/fallback')).toBe('/custom/api');
  });

  it('strips trailing slashes', () => {
    expect(normalizeApiBase('/api/v1/', '/fallback')).toBe('/api/v1');
  });

  it('returns fallback when value is undefined', () => {
    expect(normalizeApiBase(undefined, '/fallback')).toBe('/fallback');
  });

  it('returns fallback when value is empty', () => {
    expect(normalizeApiBase('', '/fallback')).toBe('/fallback');
  });

  it('returns fallback when value is whitespace-only', () => {
    expect(normalizeApiBase('  ', '/fallback')).toBe('/fallback');
  });
});

describe('getConfig - no runtime config (404)', () => {
  beforeEach(() => {
    // Simulate 404 from /den-web-config.json
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
  });

  it('falls back to defaults when runtime config and VITE env values are missing', async () => {
    const config = await getConfig();

    expect(config.denCoreApiBase).toBe('/den-core-api');
    expect(config.denChannelsApiBase).toBe('/api');
    expect(config.denHostApiBase).toBe('/den-host-api');
    expect(config.appBasePath).toBe('/');
    expect(config.environmentName).toBe('development');
  });

  it('uses VITE env values when runtime config is missing', async () => {
    vi.stubEnv('VITE_DEN_CORE_API_BASE', '/env-core-api/');
    vi.stubEnv('VITE_DEN_CHANNELS_API_BASE', '/env-channels-api/');
    vi.stubEnv('VITE_DEN_HOST_API_BASE', '/env-host-api/');

    const config = await getConfig();

    expect(config.denCoreApiBase).toBe('/env-core-api');
    expect(config.denChannelsApiBase).toBe('/env-channels-api');
    expect(config.denHostApiBase).toBe('/env-host-api');
    expect(config.appBasePath).toBe('/');
    expect(config.environmentName).toBe('development');
  });

  it('returns cached config on subsequent calls without reload', async () => {
    await getConfig();
    const config2 = await getConfig();
    expect(config2.denCoreApiBase).toBe('/den-core-api');
  });

  it('can reload config', async () => {
    await getConfig();
    const config = await getConfig(true);
    expect(config.denCoreApiBase).toBe('/den-core-api');
  });
});

describe('getConfig - with runtime config loaded', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        denCoreApiBase: '/custom-core-api/',
        denChannelsApiBase: '/custom-channels-api',
        denHostApiBase: '/custom-host-api',
        appBasePath: '/den-web/',
        environmentName: 'test-env',
      }),
    });
  });

  it('uses runtime config values with trailing slashes stripped', async () => {
    const config = await getConfig();
    expect(config.denCoreApiBase).toBe('/custom-core-api');
    expect(config.denChannelsApiBase).toBe('/custom-channels-api');
    expect(config.denHostApiBase).toBe('/custom-host-api');
    expect(config.appBasePath).toBe('/den-web');
    expect(config.environmentName).toBe('test-env');
  });

  it('caches runtime config so subsequent calls are synchronous', async () => {
    await getConfig();
    // After first load, cachedConfig is set
    const cached = getCachedConfig();
    expect(cached).toBeDefined();
    expect(cached!.denCoreApiBase).toBe('/custom-core-api');
  });
});

describe('getConfig - malformed runtime config', () => {
  it('falls back to defaults when JSON is not an object', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve('not-an-object'),
    });
    const config = await getConfig();
    expect(config.denCoreApiBase).toBe('/den-core-api');
    expect(config.denChannelsApiBase).toBe('/api');
  });

  it('falls back when denCoreApiBase is not a string', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ denCoreApiBase: 123, denChannelsApiBase: '/api' }),
    });
    const config = await getConfig();
    expect(config.denCoreApiBase).toBe('/den-core-api');
  });

  it('falls back when denChannelsApiBase is not a string', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ denCoreApiBase: '/api', denChannelsApiBase: null }),
    });
    const config = await getConfig();
    expect(config.denChannelsApiBase).toBe('/api');
  });
});

describe('getConfig - fetch error', () => {
  it('falls back on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    const config = await getConfig();
    expect(config.denCoreApiBase).toBe('/den-core-api');
    expect(config.denChannelsApiBase).toBe('/api');
  });

  it('records the error message', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    await getConfig();
    expect(getConfigLoadError()).toContain('Connection refused');
  });
});

describe('getConfig - non-404 fail status', () => {
  it('falls back on 500 with console warning', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    const config = await getConfig();
    expect(config.denCoreApiBase).toBe('/den-core-api');
    expect(config.denChannelsApiBase).toBe('/api');
  });
});

describe('getCachedConfig', () => {
  it('returns undefined before getConfig is called', () => {
    expect(getCachedConfig()).toBeUndefined();
  });

  it('returns config after getConfig is called', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    await getConfig();
    expect(getCachedConfig()).toBeDefined();
  });
});

describe('resetConfig', () => {
  it('clears cached state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    await getConfig();
    expect(getCachedConfig()).toBeDefined();
    resetConfig();
    expect(getCachedConfig()).toBeUndefined();
    expect(getConfigLoadError()).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { loadRuntimeApiConfig, normalizeApiBase, runtimeConfigFromFile } from './config';

describe('runtime API config', () => {
  it('normalizes configured successor route bases', () => {
    expect(normalizeApiBase('/api/v1///', '/fallback')).toBe('/api/v1');
    expect(normalizeApiBase('   ', '/fallback')).toBe('/fallback');
  });

  it('maps runtime config file keys to the canonical transport config', () => {
    const config = runtimeConfigFromFile({
      tasksSuccessorApiBase: '/api/v1/',
      conversationSuccessorApiBase: '/api/v1/conversation/',
      timelineSuccessorApiBase: '/api/v1/timeline/',
      observationSuccessorApiBase: '/api/v1/observation/',
      deliverySuccessorApiBase: '/api/v1/delivery/',
      docPublishApiBase: '/api/v1/blog/publications/',
      artifactsApiBase: '/api/v1/artifacts/',
      environmentName: 'den-srv',
    });

    expect(config).toEqual({
      servicesApiBase: '/api/v1',
      conversationApiBase: '/api/v1/conversation',
      timelineApiBase: '/api/v1/timeline',
      observationApiBase: '/api/v1/observation',
      deliveryApiBase: '/api/v1/delivery',
      docPublishApiBase: '/api/v1/blog/publications',
      artifactsApiBase: '/api/v1/artifacts',
      environmentName: 'den-srv',
    });
  });

  it('falls back to defaults when runtime config is absent', async () => {
    const fetchImpl = async () => new Response('', { status: 404 });
    const result = await loadRuntimeApiConfig({ fetchImpl });

    expect(result).toEqual({ config: defaultRuntimeApiConfig, source: 'defaults' });
  });

  it('falls back to defaults with an error when runtime config is malformed', async () => {
    const fetchImpl = async () => Response.json({ tasksSuccessorApiBase: 42 });
    const result = await loadRuntimeApiConfig({ fetchImpl });

    expect(result.source).toBe('defaults');
    expect(result.config).toEqual(defaultRuntimeApiConfig);
    expect(result.error).toContain('tasksSuccessorApiBase');
  });
});

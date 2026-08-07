import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeApiConfig,
  type VisualContract,
} from '@den-web/protocol';
import { createDenTransportClients } from './clients';
import { DenHttpClient } from './http';

const referenceVisualContractFixture: VisualContract = {
  schema: 'layered-visual-contract/v0.1',
  scene: {
    id: 'reference_homepage',
    type: 'web_ui',
    viewport: { width_px: 1440, height_px: 900 },
    coordinate_mode: 'normalized_with_pixel_evidence',
  },
  spaces: [],
  layers: [{ id: 'base', z: 0, contains: ['hero_title'] }],
  objects: [
    {
      id: 'hero_title',
      kind: 'text',
      role: 'heading_1',
      parent: 'viewport',
      layer: 'base',
      bounds: { x: 0.08, y: 0.12, w: 0.42, h: 0.1 },
      importance: 'critical',
      confidence: 0.96,
    },
  ],
  evidence: {
    source_type: 'screenshot',
    generated_by: 'fixture',
    overall_confidence: 0.94,
  },
};

describe('visual contract transport', () => {
  it('uses only the configured same-origin base and preserves typed request bodies', async () => {
    const requests: Array<{ readonly url: string; readonly body: unknown }> =
      [];
    const http = new DenHttpClient({
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });
        return Response.json({
          schema: referenceVisualContractFixture.schema,
          valid: true,
          scene_id: 'reference_homepage',
          counts: {},
        });
      },
    });
    const clients = createDenTransportClients(defaultRuntimeApiConfig, http);

    await clients.visualContract.validate(referenceVisualContractFixture);

    expect(requests).toEqual([
      {
        url: '/api/v1/visual-contracts/validate',
        body: { contract: referenceVisualContractFixture },
      },
    ]);
    expect(JSON.stringify(requests)).not.toContain('127.0.0.1');
    expect(JSON.stringify(requests)).not.toContain('token');
  });

  it('forwards promotion rules without fuzzy client-side rewriting', async () => {
    let body: unknown = null;
    const http = new DenHttpClient({
      fetchImpl: async (_input, init) => {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        return Response.json({
          contract: referenceVisualContractFixture,
          diagnostics: [],
        });
      },
    });
    const clients = createDenTransportClients(defaultRuntimeApiConfig, http);

    await clients.visualContract.promote(
      referenceVisualContractFixture,
      [{ source_id: 'hero_title', target_id: 'project_heading' }],
      ['generated_noise'],
    );

    expect(body).toEqual({
      contract: referenceVisualContractFixture,
      objects: [{ source_id: 'hero_title', target_id: 'project_heading' }],
      ignore_objects: ['generated_noise'],
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { VisualContract } from '@den-web/protocol';
import {
  ignoreVisualObject,
  parseVisualContractJson,
  projectVisualCanvas,
  renameVisualObject,
} from './visual-contract';

const referenceVisualContractFixture = fixture();

describe('visual contract domain', () => {
  it('accepts the schema-derived fixture and rejects opaque JSON', () => {
    expect(
      parseVisualContractJson(JSON.stringify(referenceVisualContractFixture)),
    ).toEqual({ ok: true, value: referenceVisualContractFixture });
    expect(parseVisualContractJson('{"objects":[]}')).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  it('renames an object across typed references', () => {
    const renamed = renameVisualObject(
      referenceVisualContractFixture,
      'hero_title',
      'project_heading',
    );
    expect(renamed.objects[0]?.id).toBe('project_heading');
    expect(renamed.layers[0]?.contains).toContain('project_heading');
    expect(renamed.relations?.[0]?.a).toBe('project_heading');
    expect(renamed.constraints?.[0]?.object).toBe('project_heading');
    expect(renamed.evidence.records?.[0]?.object_refs).toEqual([
      'project_heading',
    ]);
  });

  it('removes ignored generated noise and projects canvas percentages', () => {
    const withoutNoise = ignoreVisualObject(
      referenceVisualContractFixture,
      'primary_cta',
    );
    expect(withoutNoise.objects.map((object) => object.id)).toEqual([
      'hero_title',
    ]);
    expect(withoutNoise.relations).toEqual([]);
    expect(projectVisualCanvas(withoutNoise)[0]).toEqual(
      expect.objectContaining({
        leftPercent: 8,
        topPercent: 12,
        widthPercent: 42,
        heightPercent: 10,
      }),
    );
  });
});

function fixture(): VisualContract {
  return {
    schema: 'layered-visual-contract/v0.1',
    scene: {
      id: 'reference_homepage',
      type: 'web_ui',
      viewport: { width_px: 1440, height_px: 900 },
      coordinate_mode: 'normalized_with_pixel_evidence',
    },
    spaces: [],
    layers: [{ id: 'base', z: 0, contains: ['hero_title', 'primary_cta'] }],
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
      {
        id: 'primary_cta',
        kind: 'button',
        role: 'primary_action',
        parent: 'viewport',
        layer: 'base',
        bounds: { x: 0.08, y: 0.34, w: 0.16, h: 0.06 },
        importance: 'major',
        confidence: 0.94,
      },
    ],
    relations: [
      { type: 'above', a: 'hero_title', b: 'primary_cta', confidence: 0.98 },
    ],
    constraints: [
      {
        id: 'hero_title_exists',
        type: 'object_exists',
        object: 'hero_title',
        importance: 'critical',
      },
    ],
    evidence: {
      source_type: 'screenshot',
      generated_by: 'fixture',
      overall_confidence: 0.94,
      records: [
        {
          id: 'hero',
          kind: 'region',
          object_refs: ['hero_title'],
          confidence: 0.96,
        },
      ],
    },
  };
}

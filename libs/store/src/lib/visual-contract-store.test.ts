import { describe, expect, it } from 'vitest';
import type {
  DenResult,
  VisualComparisonReport,
  VisualContract,
  VisualContractRun,
} from '@den-web/protocol';
import { createVisualContractStore } from './visual-contract-store';

const ok = <T>(value: T): DenResult<T> => ({ ok: true, value });
const referenceVisualContractFixture = fixture('reference_homepage', 0.12);
const candidateVisualContractFixture = fixture('candidate_homepage', 0.42);

describe('visual contract store', () => {
  it('keeps imported drafts local and links outline selection to edits', () => {
    const store = createVisualContractStore(transportFixture());
    store.importReference(JSON.stringify(referenceVisualContractFixture));
    store.selectObject('hero_title');
    store.renameSelected('project_heading');
    store.updateSelected({ domainRole: 'hero_heading', importance: 'major' });

    expect(store.dirty()).toBe(true);
    expect(store.selectedObject()?.id).toBe('project_heading');
    expect(store.selectedObject()?.domain_role).toBe('hero_heading');
  });

  it('runs comparison then retrieves immutable run metadata', async () => {
    const store = createVisualContractStore(transportFixture());
    store.importReference(JSON.stringify(referenceVisualContractFixture));
    store.importCandidate(JSON.stringify(candidateVisualContractFixture));
    await store.runProof();

    expect(store.proof().kind).toBe('data');
    expect(
      store.proof().kind === 'data' ? store.proof().value.report.verdict : null,
    ).toBe('fail');
    expect(
      store.proof().kind === 'data'
        ? store.proof().value.run.artifacts['diff.overlay.svg']
        : null,
    ).toContain('/api/v1/visual-contracts/run-1/');
  });
});

function transportFixture() {
  const report: VisualComparisonReport = {
    schema: 'layered-visual-contract-report/v0.1',
    run_id: 'run-1',
    score: 0.5,
    verdict: 'fail',
    failures: [
      {
        status: 'fail',
        severity: 'critical',
        constraint: 'hero_title_exists',
        message: 'missing',
        match_confidence: 1,
        match_strategy: 'exact',
        repair_hint: 'restore title',
      },
    ],
    artifacts: {
      diff_overlay: '/api/v1/visual-contracts/run-1/artifacts/diff.overlay.svg',
    },
  };
  const run: VisualContractRun = {
    run_id: 'run-1',
    created_at: '2026-08-01T00:00:00Z',
    names: ['diff.overlay.svg'],
    artifacts: {
      'diff.overlay.svg':
        '/api/v1/visual-contracts/run-1/artifacts/diff.overlay.svg',
    },
  };
  return {
    validate: async () =>
      ok({
        schema: referenceVisualContractFixture.schema,
        valid: true,
        scene_id: referenceVisualContractFixture.scene.id,
        counts: {},
      }),
    buildAuthored: async (contract: VisualContract) => ok({ contract }),
    promote: async (contract: VisualContract) =>
      ok({ contract, diagnostics: [] }),
    compare: async () => ok(report),
    getRun: async () => ok(run),
  };
}

function fixture(sceneId: string, titleY: number): VisualContract {
  return {
    schema: 'layered-visual-contract/v0.1',
    scene: {
      id: sceneId,
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
        bounds: { x: 0.08, y: titleY, w: 0.42, h: 0.1 },
        importance: 'critical',
        confidence: 0.96,
      },
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
    },
  };
}

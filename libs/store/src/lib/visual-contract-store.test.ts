import { describe, expect, it } from 'vitest';
import type {
  DenResult,
  VisualComparisonReport,
  VisualContract,
  VisualContractRun,
  VisualPromotionResponse,
  VisualValidationResponse,
} from '@den-web/protocol';
import {
  createVisualContractStore,
  type VisualContractTransportPort,
} from './visual-contract-store';

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

  it('discards a comparison response after the candidate draft changes', async () => {
    const comparison = deferred<DenResult<VisualComparisonReport>>();
    let getRunCalls = 0;
    const store = createVisualContractStore(
      transportFixture({
        compare: () => comparison.promise,
        getRun: async () => {
          getRunCalls += 1;
          return ok(runFixture());
        },
      }),
    );
    store.importReference(JSON.stringify(referenceVisualContractFixture));
    store.importCandidate(JSON.stringify(candidateVisualContractFixture));

    const pending = store.runProof();
    store.importCandidate(JSON.stringify(fixture('new_candidate', 0.2)));
    comparison.resolve(ok(reportFixture()));
    await pending;

    expect(store.proof().kind).toBe('idle');
    expect(getRunCalls).toBe(0);
  });

  it('discards run metadata after the reference draft changes', async () => {
    const run = deferred<DenResult<VisualContractRun>>();
    const store = createVisualContractStore(
      transportFixture({ getRun: () => run.promise }),
    );
    store.importReference(JSON.stringify(referenceVisualContractFixture));
    store.importCandidate(JSON.stringify(candidateVisualContractFixture));

    const pending = store.runProof();
    await Promise.resolve();
    store.renameSelected('newer_heading');
    run.resolve(ok(runFixture()));
    await pending;

    expect(store.referenceDraft()?.objects[0]?.id).toBe('newer_heading');
    expect(store.proof().kind).toBe('idle');
  });

  it('discards authored constraints after a newer reference import', async () => {
    const authored =
      deferred<DenResult<{ readonly contract: VisualContract }>>();
    const store = createVisualContractStore(
      transportFixture({ buildAuthored: () => authored.promise }),
    );
    store.importReference(JSON.stringify(referenceVisualContractFixture));

    const pending = store.addConstraint({
      id: 'new_constraint',
      type: 'object_exists',
      object: 'hero_title',
      importance: 'major',
    });
    store.importReference(JSON.stringify(fixture('newer_reference', 0.25)));
    authored.resolve(ok({ contract: fixture('stale_owner_result', 0.3) }));
    await pending;

    expect(store.referenceDraft()?.scene.id).toBe('newer_reference');
    expect(store.validation().kind).toBe('idle');
  });

  it('discards promotion after a local edit advances the draft', async () => {
    const promotion = deferred<DenResult<VisualPromotionResponse>>();
    const store = createVisualContractStore(
      transportFixture({ promote: () => promotion.promise }),
    );
    store.importReference(JSON.stringify(referenceVisualContractFixture));

    const pending = store.promoteSelected({
      source_id: 'hero_title',
      target_id: 'owner_heading',
    });
    store.renameSelected('local_heading');
    promotion.resolve(
      ok({ contract: fixture('stale_promotion', 0.3), diagnostics: [] }),
    );
    await pending;

    expect(store.selectedObject()?.id).toBe('local_heading');
    expect(store.referenceDraft()?.scene.id).toBe('reference_homepage');
    expect(store.promotion().kind).toBe('idle');
  });

  it('discards validation after a newer reference import', async () => {
    const validation = deferred<DenResult<VisualValidationResponse>>();
    const store = createVisualContractStore(
      transportFixture({ validate: () => validation.promise }),
    );
    store.importReference(JSON.stringify(referenceVisualContractFixture));

    const pending = store.validateReference();
    store.importReference(JSON.stringify(fixture('newer_reference', 0.25)));
    validation.resolve(
      ok({
        schema: referenceVisualContractFixture.schema,
        valid: true,
        scene_id: 'reference_homepage',
        counts: {},
      }),
    );
    await pending;

    expect(store.referenceDraft()?.scene.id).toBe('newer_reference');
    expect(store.validation().kind).toBe('idle');
  });
});

function transportFixture(
  overrides: Partial<VisualContractTransportPort> = {},
): VisualContractTransportPort {
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
    compare: async () => ok(reportFixture()),
    getRun: async () => ok(runFixture()),
    ...overrides,
  };
}

function reportFixture(): VisualComparisonReport {
  return {
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
}

function runFixture(): VisualContractRun {
  return {
    run_id: 'run-1',
    created_at: '2026-08-01T00:00:00Z',
    names: ['diff.overlay.svg'],
    artifacts: {
      'diff.overlay.svg':
        '/api/v1/visual-contracts/run-1/artifacts/diff.overlay.svg',
    },
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
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

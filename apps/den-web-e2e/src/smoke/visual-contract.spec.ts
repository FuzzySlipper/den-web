import { expect, test, type Page, type Route } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

const referenceVisualContractFixture = contractFixture(
  'reference_homepage',
  0.12,
);
const candidateVisualContractFixture = contractFixture(
  'candidate_homepage',
  0.42,
);

test('authors a transient contract and inspects a failing proof', async ({
  page,
}) => {
  await mockDenServices(page);
  await mockVisualContract(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Visual proof' }).click();

  await page
    .getByLabel('Import reference JSON')
    .setInputFiles(jsonFile('reference.json', referenceVisualContractFixture));
  await page
    .getByLabel('Import candidate JSON')
    .setInputFiles(jsonFile('candidate.json', candidateVisualContractFixture));

  await expect(page.getByText('Transient workspace')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select hero_title, heading_1' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Select hero_title, heading_1' })
    .click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'hero_title' }),
  ).toHaveClass(/selected/);

  const authorPanel = page
    .getByRole('heading', { name: 'Author selected object' })
    .locator('..')
    .locator('..');
  await authorPanel.getByLabel('Domain role').fill('hero_heading');
  await authorPanel.getByRole('button', { name: 'Promote object' }).click();
  await expect(
    page.getByText(/Promotion applied by Visual Contract/),
  ).toBeVisible();

  const constraintPanel = page
    .getByRole('heading', { name: 'Typed constraints' })
    .locator('..')
    .locator('..');
  await constraintPanel.getByLabel('ID').fill('hero_area_guard');
  await constraintPanel.getByLabel('Type').selectOption('area_ratio');
  await constraintPanel
    .getByRole('button', { name: 'Add for selected object' })
    .click();
  await expect(constraintPanel.getByText('hero_area_guard')).toBeVisible();

  await page
    .getByRole('button', { name: 'Compare reference and candidate' })
    .click();
  await expect(page.locator('.verdict')).toContainText('fail');
  await expect(
    page.getByText('Repair: Move the heading back above the call to action.'),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Reference contract overlay' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Candidate contract overlay' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Visual contract difference overlay' }),
  ).toBeVisible();
  await expect(page.getByText('Run run-ui')).toBeVisible();
});

test('shows an explicit missing artifact state without losing contract geometry', async ({
  page,
}) => {
  await mockDenServices(page);
  await mockVisualContract(page);
  await page.route(
    '**/api/v1/artifacts/resolve?ref=den-artifact%3A%2F%2Fmissing',
    (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'not_found', message: 'artifact missing' },
        }),
      }),
  );
  await page.goto('/');
  await page.getByRole('link', { name: 'Visual proof' }).click();
  await page
    .getByLabel('Import reference JSON')
    .setInputFiles(jsonFile('reference.json', referenceVisualContractFixture));

  await page
    .getByLabel('Artifact or source reference')
    .fill('den-artifact://missing');
  await page.getByRole('button', { name: 'Use reference' }).click();

  await expect(page.getByText(/Artifact unavailable/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select hero_title, heading_1' }),
  ).toBeVisible();
});

async function mockVisualContract(page: Page): Promise<void> {
  await page.route('**/api/v1/visual-contracts/validate', (route) =>
    json(route, {
      schema: 'layered-visual-contract/v0.1',
      valid: true,
      scene_id: 'reference_homepage',
      counts: { objects: 2 },
    }),
  );
  await page.route(
    '**/api/v1/visual-contracts/promote-contract',
    async (route) => {
      const body = route.request().postDataJSON();
      const rule = body.objects?.[0];
      const contract = {
        ...body.contract,
        objects: body.contract.objects.map((object: { id: string }) =>
          object.id === rule.source_id
            ? {
                ...object,
                id: rule.target_id,
                role: rule.role,
                domain_role: rule.domain_role,
                importance: rule.importance,
              }
            : object,
        ),
      };
      await json(route, { contract, diagnostics: [] });
    },
  );
  await page.route(
    '**/api/v1/visual-contracts/build-authored',
    async (route) => {
      const body = route.request().postDataJSON();
      await json(route, {
        contract: {
          ...body.contract,
          constraints: [
            ...(body.contract.constraints ?? []),
            ...body.constraints,
          ],
        },
      });
    },
  );
  await page.route('**/api/v1/visual-contracts/compare', (route) =>
    json(route, {
      schema: 'layered-visual-contract-report/v0.1',
      run_id: 'run-ui',
      score: 0.42,
      verdict: 'fail',
      failures: [
        {
          status: 'fail',
          severity: 'critical',
          constraint: 'hero_title_above_cta',
          message: 'Heading moved below the call to action.',
          expected: 'above',
          actual: 'below',
          match_confidence: 1,
          match_strategy: 'exact_id',
          measured: { edge_delta: -0.2 },
          repair_hint: 'Move the heading back above the call to action.',
        },
      ],
      warnings: [],
      artifacts: {
        reference_overlay:
          '/api/v1/visual-contracts/run-ui/artifacts/reference.overlay.svg',
        candidate_overlay:
          '/api/v1/visual-contracts/run-ui/artifacts/candidate.overlay.svg',
        diff_overlay:
          '/api/v1/visual-contracts/run-ui/artifacts/diff.overlay.svg',
        report: '/api/v1/visual-contracts/run-ui/artifacts/report.json',
      },
    }),
  );
  await page.route('**/api/v1/visual-contracts/run-ui', (route) =>
    json(route, {
      run_id: 'run-ui',
      created_at: '2026-08-01T00:00:00Z',
      names: [
        'reference.overlay.svg',
        'candidate.overlay.svg',
        'diff.overlay.svg',
        'report.json',
      ],
      artifacts: {
        'reference.overlay.svg':
          '/api/v1/visual-contracts/run-ui/artifacts/reference.overlay.svg',
        'candidate.overlay.svg':
          '/api/v1/visual-contracts/run-ui/artifacts/candidate.overlay.svg',
        'diff.overlay.svg':
          '/api/v1/visual-contracts/run-ui/artifacts/diff.overlay.svg',
        'report.json': '/api/v1/visual-contracts/run-ui/artifacts/report.json',
      },
    }),
  );
  await page.route(
    '**/api/v1/visual-contracts/run-ui/artifacts/*.svg',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#172033"/><text x="20" y="40" fill="white">visual proof</text></svg>',
      }),
  );
}

function jsonFile(name: string, value: unknown) {
  return {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  };
}

async function json(route: Route, value: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
}

function contractFixture(sceneId: string, titleY: number) {
  return {
    schema: 'layered-visual-contract/v0.1',
    scene: {
      id: sceneId,
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
        bounds: { x: 0.08, y: titleY, w: 0.42, h: 0.1 },
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
      source_ref: 'reference.png',
      generated_by: 'fixture',
      overall_confidence: 0.94,
    },
  };
}

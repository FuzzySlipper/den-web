import { expect, test } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

test('boots the successor task cockpit', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Den Web', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Den Web den-web/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Asha Studio asha/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Projects' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Spaces' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /#3993 Den Web Angular/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /#3993 Den Web Angular successor Phase 4/ })).toBeVisible();
  await expect(page.getByText('Phase 4 fixture loaded')).toBeVisible();
});

test('selects spaces as active workspaces', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Asha Studio asha/ }).click();

  await expect(page.getByRole('button', { name: /#4100 Asha Studio space task/ })).toBeVisible();
  await page.getByRole('button', { name: 'Documents' }).click();
  await expect(page.getByLabel('Document detail').getByRole('heading', { name: 'Asha Brief' }).first()).toBeVisible();
});

test('applies persisted theme preferences on boot', async ({ page }) => {
  await mockDenServices(page);
  await page.addInitScript(() => {
    localStorage.setItem('den-web.preferences.v2', JSON.stringify({ density: 'comfortable', theme: 'dark', highContrast: false }));
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveClass(/den-dark/);
});

test('searches nested task results and preserves parent context in flat mode', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByLabel('Search tasks').fill('4001');
  await expect(page.getByRole('button', { name: /#3993 Den Web Angular/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /#4001 Nested fixture task/ })).toBeVisible();

  await page.getByLabel('Flat').check();
  await expect(page.getByRole('button', { name: /#4001 Nested fixture task/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /#4001 Nested fixture task/ })).not.toContainText('parent #3993');
});

test('updates task status with the web UI actor', async ({ page }) => {
  await mockDenServices(page);
  let patchBody: unknown = null;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/api/v1/projects/den-web/tasks/3993')) {
      patchBody = request.postDataJSON();
    }
  });

  await page.goto('/');
  await page.getByLabel('Task status', { exact: true }).selectOption('review');

  await expect.poll(() => patchBody).toEqual({ agent: 'web-ui', status: 'review' });
  await expect(page.getByLabel('Task status', { exact: true })).toHaveValue('review');
});

test('renders inherited feature tabs through successor fixtures', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Conversation' }).click();
  await expect(page.getByText('Conversation fixture loaded')).toBeVisible();
  await expect(page.getByText('Timeline fixture loaded')).toBeVisible();

  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('Notification fixture loaded')).toBeVisible();
  await page.getByRole('button', { name: 'Mark read' }).click();
  await expect(page.getByText('0 unread')).toBeVisible();

  await page.getByRole('button', { name: 'Messages' }).click();
  await expect(page.getByText('Message fixture loaded')).toBeVisible();
  await page.getByRole('button', { name: /Handoff/ }).click();
  await expect(page.getByRole('region', { name: 'Messages' }).getByText('Message fixture loaded', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Documents' }).click();
  await expect(page.getByLabel('Document detail').getByRole('heading', { name: 'Successor Brief' }).first()).toBeVisible();
  await expect(async () => {
    const heights = await page.getByTestId('document-list-item').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(1);
    expect(Math.max(...heights)).toBeLessThan(130);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(4);
  }).toPass();
  await expect(async () => {
    const box = await page.getByLabel('Document metadata').boundingBox();
    expect(box?.height).toBeLessThan(220);
  }).toPass();
  await expect(page.getByLabel('Document content').getByText('Document fixture loaded.')).toBeVisible();
  await expect(page.getByText('Discussion fixture loaded')).toBeVisible();

  const publicationRequests: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/blog/publications')) {
      publicationRequests.push(request.postDataJSON());
    }
  });
  await page.getByLabel('Document content').getByRole('button', { name: 'Share via blog' }).click();
  await page.getByLabel('Document blog publishing').getByLabel(/Overwrite/).check();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('_posts/successor-brief.md')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('status').getByText('https://blog.example.test/successor-brief')).toBeVisible();
  await expect.poll(() => publicationRequests.length).toBe(2);
  expect(publicationRequests[0]).toMatchObject({
    requested_by: 'den-web',
    source: {
      document_project_id: 'den-web',
      document_slug: 'successor-brief',
    },
    options: { overwrite: true },
  });
  expect(publicationRequests[0]).not.toHaveProperty('document');
  expect(publicationRequests[1]).not.toHaveProperty('document');

  let documentPatchBody: unknown = null;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/api/v1/projects/den-web/documents/successor-brief')) {
      documentPatchBody = request.postDataJSON();
    }
  });
  await page.getByLabel('Document content').getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Markdown editor').fill('# Successor Brief\n\nEdited document fixture.');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => documentPatchBody).toEqual({
    agent: 'web-ui',
    content_markdown: '# Successor Brief\n\nEdited document fixture.',
  });
  await expect(page.getByLabel('Document content').getByText('Edited document fixture.')).toBeVisible();

  await page.getByRole('button', { name: 'Librarian' }).click();
  await page.getByLabel('Librarian query').fill('phase 5');
  await page.getByRole('button', { name: 'Query' }).click();
  await expect(page.getByText('Librarian fixture loaded')).toBeVisible();

  await page.getByRole('button', { name: 'Agents' }).click();
  await expect(page.getByText('Agent fixture loaded')).toBeVisible();
  await expect(page.getByText(/Fixture degraded state/)).toBeVisible();

  await page.getByRole('button', { name: 'Preferences' }).click();
  await page.getByLabel('Density').selectOption('compact');
  await page.getByLabel('Dark mode').check();
  await page.getByLabel('High contrast').check();
  await expect(page.locator('html')).toHaveClass(/den-compact/);
  await expect(page.locator('html')).toHaveClass(/den-dark/);
  await expect(page.locator('html')).toHaveClass(/den-high-contrast/);
});

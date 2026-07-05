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
  await expect(page.getByRole('button', { name: /Global _global/ })).toBeVisible();
  await expect(page.getByLabel('Task sort')).toHaveValue('priority');
  await page.getByLabel('Task sort').selectOption('id');
  await expect(page.getByLabel('Task sort')).toHaveValue('id');
  await expect(page.getByRole('button', { name: 'Projects' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Spaces' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /#3993 Den Web Angular/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /#3993 Den Web Angular successor Phase 4/ })).toBeVisible();
  await expect(page.getByText('Phase 4 fixture loaded')).toBeVisible();
  await expect(page.getByLabel('Artifact evidence').getByText('visual-evidence-overview.png')).toBeVisible();
  await expect(page.getByLabel('Artifact evidence').getByText('1 x 1')).toBeVisible();
});

test('clicks through task recent messages into message threads', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByLabel('Recent messages').getByRole('button', { name: /Phase 4 fixture loaded/ }).click();

  await expect(page.getByRole('button', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Message thread').getByText('Message fixture loaded', { exact: true })).toBeVisible();
});

test('scrolls long task lists inside the task list panel', async ({ page }) => {
  await mockDenServices(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const taskRows = page.locator('.task-list .rows');
  await expect(page.getByRole('button', { name: /#3993 Den Web Angular/ })).toBeVisible();
  await expect(async () => {
    const metrics = await taskRows.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 100);
  }).toPass();

  await taskRows.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(page.getByRole('button', { name: /#4379 Long task list fixture 80/ })).toBeVisible();
});

test('scrolls long task detail inside the detail panel', async ({ page }) => {
  await mockDenServices(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  await page.getByRole('button', { name: /#4177 Long detail fixture task/ }).click();

  const detailBody = page.locator('.task-detail .detail-body');
  await expect(page.getByLabel('Task detail').getByRole('heading', { name: /#4177 Long detail fixture task/ })).toBeVisible();
  await expect(async () => {
    const metrics = await detailBody.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 300);
  }).toPass();

  await detailBody.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(page.getByText('Long detail bottom sentinel.')).toBeVisible();
});

test('clicks through task references across projects', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByLabel('Subtasks').getByRole('button', { name: /#4100 Asha Studio space task/ }).click();

  await expect(page.getByRole('button', { name: /Asha Studio asha/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.task-list').getByRole('button', { name: /#4100 Asha Studio space task/ })).toBeVisible();
  await expect(page.getByLabel('Task detail').getByRole('heading', { name: /#4100 Asha Studio space task/ })).toBeVisible();
});

test('selects spaces as active workspaces', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Asha Studio asha/ }).click();

  await expect(page.locator('.task-list').getByRole('button', { name: /#4100 Asha Studio space task/ })).toBeVisible();
  await page.getByRole('button', { name: 'Documents' }).click();
  await expect(page.getByLabel('Document detail').getByRole('heading', { name: 'Asha Brief' }).first()).toBeVisible();
});

test('shows archived workspaces on demand and exposes global scope views', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await expect(page.getByRole('button', { name: /Old Space old-space/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Archive Mine archive-mine/ })).toHaveCount(0);
  await page.getByLabel('Show archived and hidden').check();
  await expect(page.getByRole('button', { name: /Old Space old-space/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Archive Mine archive-mine/ })).toBeVisible();
  await page.getByLabel('Show archived and hidden').uncheck();
  await expect(page.getByRole('button', { name: /Old Space old-space/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Global _global/ }).click();
  await expect(page.locator('.task-list').getByRole('button', { name: /#4100 Asha Studio space task/ })).toBeVisible();

  await page.getByRole('button', { name: 'Documents' }).click();
  await expect(page.getByLabel('Document detail').getByRole('heading', { name: 'Global Brief' }).first()).toBeVisible();
  await expect(page.getByLabel('Document content').getByText('Global document fixture loaded.')).toBeVisible();

  await page.getByRole('button', { name: 'Conversation' }).click();
  await expect(page.getByLabel('Channels').getByRole('button', { name: /#agent-commons/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Channel chat').getByText('Agent commons fixture loaded')).toBeVisible();
});

test('supports minimal mobile viewing navigation', async ({ page }) => {
  await mockDenServices(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Den Web den-web/ })).toBeVisible();
  await page.getByRole('button', { name: /Asha Studio asha/ }).click();
  await expect(page.locator('.task-list').getByRole('button', { name: /#4100 Asha Studio space task/ })).toBeVisible();
  await page.locator('.task-list').getByRole('button', { name: /#4100 Asha Studio space task/ }).click();
  await expect(page.getByLabel('Task detail').getByRole('heading', { name: /#4100/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back to tasks' }).click();
  await expect(page.locator('.task-list').getByRole('button', { name: /#4100 Asha Studio space task/ })).toBeVisible();

  await page.getByRole('button', { name: 'Documents' }).click();
  await expect(page.getByRole('button', { name: /Asha Brief/ })).toBeVisible();
  await page.getByRole('button', { name: /Asha Brief/ }).click();
  await expect(page.getByLabel('Document detail').getByRole('heading', { name: 'Asha Brief' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(page.getByRole('button', { name: /Asha Brief/ })).toBeVisible();
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
  await expect(page.locator('.task-list').getByRole('button', { name: /#4001 Nested fixture task/ })).toBeVisible();

  await page.getByLabel('Flat').check();
  await expect(page.locator('.task-list').getByRole('button', { name: /#4001 Nested fixture task/ })).toBeVisible();
  await expect(page.locator('.task-list').getByRole('button', { name: /#4001 Nested fixture task/ })).not.toContainText('parent #3993');
});

test('updates task status with the web UI actor', async ({ page }) => {
  await mockDenServices(page);
  let patchBody: unknown = null;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/api/v1/projects/den-web/tasks/4177')) {
      patchBody = request.postDataJSON();
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: /#4177 Long detail fixture task/ }).click();
  await expect(page.getByLabel('Task detail').getByRole('heading', { name: /#4177 Long detail fixture task/ })).toBeVisible();
  await expect(page.getByLabel('Task status', { exact: true })).toHaveValue('in_progress');
  await page.getByLabel('Task status', { exact: true }).selectOption('review');

  await expect.poll(() => patchBody).toEqual({ agent: 'web-ui', status: 'review' });
  await expect(page.getByLabel('Task status', { exact: true })).toHaveValue('review');
  await page.getByLabel('Task status', { exact: true }).selectOption('done');
  await expect(page.locator('.task-list').getByRole('button', { name: /#4177 Long detail fixture task/ })).toHaveCount(0);
  await page.getByLabel('Task status filter').selectOption('__all');
  await expect(page.locator('.task-list').getByRole('button', { name: /#4177 Long detail fixture task/ })).toBeVisible();
});

test('renders inherited feature tabs through successor fixtures', async ({ page }) => {
  await mockDenServices(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Preferences' }).click();
  await page.getByLabel('Conversation sender identity').fill('patch');
  await page.getByRole('button', { name: 'Conversation' }).click();
  await expect(page.getByText('Conversation fixture loaded')).toBeVisible();
  await expect(page.getByText('Timeline fixture loaded')).toBeVisible();
  await expect(page.getByText('Observation tool fixture loaded')).toBeVisible();
  await expect(page.getByText('Stream fixture loaded')).toBeVisible();
  await expect(page.getByLabel('Channels').getByRole('button', { name: /#den-web/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Channels').getByRole('button', { name: /#ops/ })).toBeVisible();
  await expect(page.getByLabel('Channel participants').getByText('codex')).toBeVisible();
  await expect(page.getByLabel('Channel participants').getByText('always-agent')).toBeVisible();
  await expect(page.getByLabel('Channel chat').getByText(/Jul 1|Jul 2|Jul 3/).first()).toBeVisible();
  await expect(page.getByLabel('Channel chat').getByText('unknown time')).toHaveCount(0);
  await expect(page.getByLabel('Channel chat').locator('.sender', { hasText: 'timeline' })).toHaveCount(0);

  const conversationRequests: unknown[] = [];
  const deliveryRequests: unknown[] = [];
  const membershipRequests: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/api/v1/conversation/channels/7/memberships')) {
      membershipRequests.push(request.postDataJSON());
    }
    if (request.method() === 'POST' && request.url().includes('/api/v1/conversation/channels/7/messages')) {
      conversationRequests.push(request.postDataJSON());
    }
    if (request.method() === 'POST' && request.url().includes('/api/v1/delivery/intents')) {
      deliveryRequests.push(request.postDataJSON());
    }
  });

  await page.getByLabel('Channel participants').getByRole('button', { name: /codex/ }).click();
  await expect(page.getByLabel('Participant wake policy')).toHaveValue('mentions_only');
  await page.getByLabel('Participant membership status').selectOption('active');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByLabel('Agent identity to join').fill('fixture-agent');
  await page.getByLabel('New agent wake policy').selectOption('direct_questions_only');
  await page.getByRole('button', { name: 'Add agent' }).click();
  await expect(page.getByLabel('Channel participants').getByText('fixture-agent')).toBeVisible();
  await expect.poll(() => membershipRequests).toEqual([
    expect.objectContaining({
      member_identity: 'codex',
      membership_status: 'active',
      wake_policy: 'mentions_only',
    }),
    expect.objectContaining({
      member_identity: 'fixture-agent',
      membership_status: 'active',
      wake_policy: 'direct_questions_only',
    }),
  ]);

  const composer = page.getByLabel('Conversation message');
  await composer.fill('Line one');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Line two');
  await expect(composer).toHaveValue('Line one\nLine two');
  await composer.fill('@c');
  await expect(page.getByRole('listbox', { name: 'Mention suggestions' }).getByText('codex')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(composer).toHaveValue('@codex ');
  await page.keyboard.type('Sent from fixture UI');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Channel chat').getByText('@codex Sent from fixture UI')).toBeVisible();
  await expect.poll(() => conversationRequests).toEqual([{
    sender_type: 'user',
    sender_identity: 'patch',
    body: '@codex Sent from fixture UI',
    message_kind: 'human_text',
    source_kind: 'den_web_channel_post',
    dedupe_key: expect.stringMatching(/^patch:/),
  }]);
  await expect.poll(() => deliveryRequests.length).toBe(2);
  expect(deliveryRequests).toEqual([{
    target_identity: { profile: 'codex', instance_id: 'codex@den-srv' },
    idempotency_key: expect.stringMatching(/^mention:7:codex:/),
    source_ref: 'conversation:channels/7/messages/72',
    channel_message_id: 72,
  }, {
    target_identity: { profile: 'always-agent', instance_id: 'always-agent@den-srv' },
    idempotency_key: expect.stringMatching(/^wake:7:always-agent:/),
    source_ref: 'conversation:channels/7/messages/72',
    channel_message_id: 72,
  }]);

  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('Notification fixture loaded')).toBeVisible();
  await page.getByRole('button', { name: 'Mark read' }).click();
  await expect(page.getByText('0 unread')).toBeVisible();

  await page.getByRole('button', { name: 'Messages' }).click();
  await expect(page.getByText('Message fixture loaded')).toBeVisible();
  await page.getByRole('button', { name: /Handoff/ }).click();
  await expect(page.getByLabel('Message thread').getByText('Message fixture loaded', { exact: true })).toBeVisible();
  await expect(async () => {
    const metrics = await page.getByLabel('Message inbox').evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 100);
  }).toPass();
  await expect(async () => {
    const box = await page.getByLabel('Message thread').boundingBox();
    expect(box?.height).toBeGreaterThan(100);
    expect(box?.height).toBeLessThan(900);
  }).toPass();
  await expect(page.getByLabel('Artifact evidence').getByText('visual-evidence-overview.png')).toBeVisible();
  await expect(page.getByLabel('Artifact evidence').getByRole('img', { name: 'visual-evidence-overview.png' })).toBeVisible();

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
  await expect(page.getByLabel('Document content').getByRole('table')).toBeVisible();
  await expect(page.getByLabel('Document content').getByRole('cell', { name: 'ASHA main' })).toBeVisible();
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

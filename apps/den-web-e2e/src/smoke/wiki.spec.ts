import { expect, test, type Page } from '@playwright/test';
import { mockDenServices } from '../support/mock-den-services';

const pageContent = [
  '---',
  'type: concept',
  'title: SQLite WAL mode',
  'curation: unreviewed',
  'confidence: high',
  'tags: [software]',
  '---',
  '# SQLite WAL mode',
  '',
  'Readers do not block the writer.[^wal1] See [git daemon](/wiki/git-daemon-security.md).',
  '',
  '[^wal1]: [SQLite WAL documentation](/sources/sqlite/write-ahead-logging.md) "readers do not block writers"',
].join('\n');

const results: Record<string, unknown> = {
  wiki_list: {
    folder: 'wiki',
    zone: 'wiki',
    enrichedPaths: [
      { path: 'wiki', type: 'directory', description: 'One page per concept.' },
      { path: 'wiki/index.md', title: 'Index' },
      { path: 'wiki/sqlite-wal-mode.md', frontmatter: { title: 'SQLite WAL mode', curation: 'unreviewed' } },
    ],
  },
  wiki_taxonomy: {
    present: true,
    types: [{ name: 'concept', pages: ['wiki/sqlite-wal-mode.md'] }],
    tags: [{ name: 'software', description: 'Software.', pages: ['wiki/sqlite-wal-mode.md'] }],
  },
  wiki_search: { query: 'wal', results: [{ path: 'wiki/sqlite-wal-mode.md', title: 'SQLite WAL mode', snippet: '…WAL…' }] },
  wiki_curation_scan: {
    generated: '2026-10-31T00:00:00Z',
    summary_markdown: 'Curation scan: 1 page.\n\n### unreviewed\n\n- `wiki/sqlite-wal-mode.md`: unreviewed',
  },
};

function read(path: string): Record<string, unknown> {
  if (path === 'sources/sqlite/write-ahead-logging.md') {
    return {
      path,
      content: '---\ntitle: SQLite documentation, Write-Ahead Logging\nurl: https://sqlite.org/wal.html\n---\nCaptured text.',
      frontmatter: { title: 'SQLite documentation, Write-Ahead Logging', url: 'https://sqlite.org/wal.html' },
      project_history: [],
    };
  }
  if (path === 'trails/sqlite-wal-run.md') {
    return {
      path,
      content: '---\ntype: trail\nquestion: How does WAL work?\n---\n## Question and scope\n\nWAL.\n\n## Changes made\n\n- Wrote the page.',
      frontmatter: { type: 'trail', question: 'How does WAL work?', agent: 'den-agents' },
      project_history: [],
    };
  }
  return {
    path: 'wiki/sqlite-wal-mode.md',
    content: pageContent,
    frontmatter: { type: 'concept', title: 'SQLite WAL mode', curation: 'unreviewed', confidence: 'high', tags: ['software'], sources: ['sources/sqlite/write-ahead-logging.md'], trails: ['sqlite-wal-run'] },
    backlinks: [{ source: 'trails/sqlite-wal-run', title: 'trails/sqlite-wal-run' }],
    project_history: [
      { hash: 'aaaaaaa1111', date: '2026-10-30T11:06:13Z', authorName: 'claude', subject: 'Write the WAL page (trail:sqlite-wal-run)' },
      { hash: 'bbbbbbb2222', date: '2026-10-30T11:02:29Z', authorName: 'ui', subject: 'Edit in the OpenKnowledge UI: wiki/sqlite-wal-mode.md (ui)' },
    ],
  };
}

async function mockWiki(page: Page): Promise<{ tools: string[]; agents: string[] }> {
  const tools: string[] = [];
  const agents: string[] = [];
  await mockDenServices(page);
  await page.route('**/api/v1/wiki/mcp', (route) => {
    const body = route.request().postDataJSON() as { id: number; params: { name: string; arguments: { path?: string } } };
    tools.push(body.params.name);
    agents.push(route.request().headers()['x-den-wiki-agent'] ?? '');
    const structured = body.params.name === 'wiki_read' ? read(body.params.arguments.path ?? '') : results[body.params.name];
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent: structured } }),
    });
  });
  return { tools, agents };
}

test('Wiki sits under Library and reads pages, citations, trails, tags and curation without writing', async ({ page }) => {
  const calls = await mockWiki(page);
  await page.goto('/');
  await expect(page.locator('.rail-group[aria-label="Admin"]').getByRole('link', { name: 'Resources' })).toBeVisible();
  await page.locator('.rail-group[aria-label="Library"]').getByRole('link', { name: 'Wiki' }).click();
  await expect(page).toHaveURL(/\/wiki/);

  await page.locator('.browse').getByRole('link', { name: 'SQLite WAL mode' }).click();
  await expect(page.locator('.page-head h1')).toHaveText('SQLite WAL mode');
  await expect(page.locator('.body h1')).toHaveCount(0);
  await expect(page.locator('.facts')).toContainText('unreviewed');
  await expect(page.locator('.history')).toContainText('Write the WAL page');
  await expect(page.locator('.history .badge', { hasText: 'ui' })).toBeVisible();

  await page.locator('.footnotes').getByRole('link', { name: 'SQLite WAL documentation' }).click();
  await expect(page).toHaveURL(/path=sources%2Fsqlite%2Fwrite-ahead-logging\.md/);
  await expect(page.locator('.page-head h1')).toHaveText('SQLite documentation, Write-Ahead Logging');
  await page.goBack();

  await page.locator('.history').getByRole('link', { name: 'trail:sqlite-wal-run' }).click();
  await expect(page.locator('.page-head .question')).toHaveText('How does WAL work?');
  await expect(page.locator('.body h2')).toHaveText(['Question and scope', 'Changes made']);

  await page.getByRole('tab', { name: 'Tags' }).click();
  await page.locator('.browse').getByRole('link', { name: 'software' }).click();
  await expect(page.locator('.browse')).toContainText('Tagged software');

  await page.getByRole('searchbox').fill('wal');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('.results')).toContainText('SQLite WAL mode');

  await page.getByRole('tab', { name: 'Curation' }).click();
  await page.locator('.reader').getByRole('link', { name: 'wiki/sqlite-wal-mode.md' }).click();
  await expect(page.locator('.page-head h1')).toHaveText('SQLite WAL mode');

  expect(new Set(calls.tools)).toEqual(new Set(['wiki_list', 'wiki_read', 'wiki_taxonomy', 'wiki_search', 'wiki_curation_scan']));
  expect(new Set(calls.agents)).toEqual(new Set(['den-web-viewer']));
});

import { describe, expect, it } from 'vitest';
import {
  normalizeWikiPath,
  resolveWikiHref,
  stripFrontmatter,
  wikiCommitView,
  wikiFacts,
  wikiListing,
  wikiParentFolder,
  wikiTitle,
  wikiZoneOf,
  linkContentPaths,
  withoutLeadingTitle,
} from './wiki';

describe('wiki paths and links', () => {
  it('normalizes content paths', () => {
    expect(normalizeWikiPath('/wiki/sqlite-wal-mode')).toBe('wiki/sqlite-wal-mode.md');
    expect(normalizeWikiPath('sources/sqlite/x.md#frag')).toBe('sources/sqlite/x.md');
    expect(wikiZoneOf('/trails/run.md')).toBe('trails');
    expect(wikiZoneOf('taxonomy.yml')).toBeNull();
  });

  it('resolves root-absolute, relative and external hrefs', () => {
    expect(resolveWikiHref('/sources/sqlite/write-ahead-logging.md', 'wiki/sqlite-wal-mode.md')).toEqual({
      kind: 'page',
      path: 'sources/sqlite/write-ahead-logging.md',
    });
    expect(resolveWikiHref('../trails/a%20b.md#x', 'wiki/sqlite-wal-mode.md')).toEqual({ kind: 'page', path: 'trails/a b.md' });
    expect(resolveWikiHref('git-daemon-security', 'wiki/sqlite-wal-mode.md')).toEqual({
      kind: 'page',
      path: 'wiki/git-daemon-security.md',
    });
    expect(resolveWikiHref('https://sqlite.org/wal.html', 'wiki/a.md')).toEqual({ kind: 'external', url: 'https://sqlite.org/wal.html' });
    expect(resolveWikiHref('../../etc/passwd', 'wiki/a.md')).toEqual({ kind: 'external', url: '../../etc/passwd' });
    expect(resolveWikiHref('/docs/content-contract.md', 'wiki/a.md')).toEqual({ kind: 'external', url: '/docs/content-contract.md' });
  });

  it('strips frontmatter and picks a title', () => {
    expect(stripFrontmatter('---\ntype: concept\ntitle: X\n---\n# Body\n')).toBe('# Body\n');
    expect(stripFrontmatter('# No frontmatter')).toBe('# No frontmatter');
    expect(wikiTitle('trails/run-2026.md', { type: 'trail' })).toBe('run-2026');
    expect(wikiTitle('wiki/a.md', { title: ' SQLite WAL ' })).toBe('SQLite WAL');
  });
});

describe('wikiCommitView', () => {
  it('splits trail and UI tags off the subject', () => {
    const base = { hash: '1a31c59c9893baded5ba391b7adf5ba5dc7fe1b8', date: '2026-10-30T11:06:13Z', authorName: 'claude' };
    expect(wikiCommitView({ ...base, subject: 'Restore the page (trail:repair-sqlite-wal-duplicate-2026-10-30)' })).toEqual({
      hash: base.hash,
      shortHash: '1a31c59',
      date: base.date,
      author: 'claude',
      summary: 'Restore the page',
      tag: { kind: 'trail', slug: 'repair-sqlite-wal-duplicate-2026-10-30' },
    });
    expect(wikiCommitView({ ...base, subject: 'Edit in the OpenKnowledge UI: wiki/a.md (ui)' }).tag).toEqual({ kind: 'ui' });
    expect(wikiCommitView({ ...base, subject: 'Formatting only: wiki/a.md (ui:format)' }).tag).toEqual({ kind: 'ui-format' });
    expect(wikiCommitView({ ...base, subject: 'Regenerate index' })).toMatchObject({ summary: 'Regenerate index', tag: { kind: 'none' } });
  });
});

describe('wikiListing', () => {
  it('puts folders first, sorts pages by title and drops the folder row and generated indexes', () => {
    const listing = wikiListing({
      folder: 'sources',
      enrichedPaths: [
        { path: 'sources', type: 'directory', description: 'Captured sources.' },
        { path: 'sources/index.md', title: 'Index' },
        { path: 'sources/sqlite', type: 'directory', recursiveMdCount: 4 },
        { path: 'sources/zz.md', frontmatter: { title: 'Alpha', captured: '2026-10-30' } },
        { path: 'sources/caddy', type: 'directory', directMdCount: 2 },
      ],
    });
    expect(listing.description).toBe('Captured sources.');
    expect(listing.entries.map((entry) => [entry.title, entry.folder, entry.count, entry.updated])).toEqual([
      ['caddy', true, 2, null],
      ['sqlite', true, 4, null],
      ['Alpha', false, null, '2026-10-30'],
    ]);
    expect(wikiParentFolder('sources/sqlite')).toBe('sources');
    expect(wikiParentFolder('sources')).toBeNull();
  });

  it('shows scalar frontmatter facts in order', () => {
    expect(wikiFacts({ volatility: 'cold', type: 'concept', curation: 'curated', job: 1, tags: ['x'] })).toEqual([
      { label: 'Type', value: 'concept' },
      { label: 'Curation', value: 'curated' },
      { label: 'Volatility', value: 'cold' },
      { label: 'Ledger job', value: '1' },
    ]);
  });
});

describe('display transforms', () => {
  it('drops a repeated leading title only', () => {
    expect(withoutLeadingTitle('\n# SQLite WAL\n\nBody', 'sqlite wal')).toBe('\nBody');
    expect(withoutLeadingTitle('# Other\nBody', 'SQLite WAL')).toBe('# Other\nBody');
  });

  it('links backticked content paths', () => {
    expect(linkContentPaths('- `wiki/a.md`: stale; `go test` and [`trails/t.md`](/trails/t.md)')).toBe(
      '- [`wiki/a.md`](/wiki/a.md): stale; `go test` and [`trails/t.md`](/trails/t.md)',
    );
  });
});

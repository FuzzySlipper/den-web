import type { DenWikiCommit, DenWikiFrontmatter, DenWikiListResult } from '@den-web/protocol';

// Navigation and display rules for the read-only den-wiki viewer. Paths are
// content-root-relative with the .md extension (`wiki/sqlite-wal-mode.md`),
// which is what the facade takes; Markdown links are content-root-absolute
// (`/sources/sqlite/x.md`) or relative to the page.

export type WikiZone = 'wiki' | 'sources' | 'trails';

export const WIKI_ZONES: readonly { readonly zone: WikiZone; readonly label: string }[] = [
  { zone: 'wiki', label: 'Pages' },
  { zone: 'sources', label: 'Sources' },
  { zone: 'trails', label: 'Trails' },
];

export function wikiZoneOf(path: string): WikiZone | null {
  const first = normalizeWikiPath(path).split('/')[0];
  return first === 'wiki' || first === 'sources' || first === 'trails' ? first : null;
}

/** `/wiki/x`, `wiki/x.md` and `wiki/x.md#y` all become `wiki/x.md`. */
export function normalizeWikiPath(path: string): string {
  let out = path.trim().split('#')[0]?.split('?')[0] ?? '';
  out = out.replace(/^\/+/, '').replace(/\/+$/, '');
  if (out && !out.endsWith('.md')) out = `${out}.md`;
  return out;
}

export function trailPath(slug: string): string {
  return `trails/${slug.replace(/\.md$/, '')}.md`;
}

export type WikiLinkTarget =
  | { readonly kind: 'page'; readonly path: string }
  | { readonly kind: 'external'; readonly url: string };

/**
 * Resolves a Markdown href written in `fromPath`. Anything that leaves the
 * content root (a scheme, `//host`, or `..` above the root) is external.
 */
export function resolveWikiHref(href: string, fromPath: string): WikiLinkTarget {
  const trimmed = href.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('#') || !trimmed) {
    return { kind: 'external', url: trimmed };
  }
  const target = trimmed.split('#')[0] ?? '';
  const base = trimmed.startsWith('/') ? [] : normalizeWikiPath(fromPath).split('/').slice(0, -1);
  const parts = [...base];
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return { kind: 'external', url: trimmed };
      parts.pop();
      continue;
    }
    parts.push(decodeSegment(segment));
  }
  const path = normalizeWikiPath(parts.join('/'));
  return wikiZoneOf(path) ? { kind: 'page', path } : { kind: 'external', url: trimmed };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The body of a page, without its YAML frontmatter. */
export function stripFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return normalized;
  const end = normalized.indexOf('\n---', 4);
  if (end < 0) return normalized;
  const after = normalized.indexOf('\n', end + 4);
  return after < 0 ? '' : normalized.slice(after + 1);
}

/** A page's display title: frontmatter title, else the file name. */
export function wikiTitle(path: string, frontmatter?: DenWikiFrontmatter | null): string {
  const title = typeof frontmatter?.title === 'string' ? frontmatter.title.trim() : '';
  if (title) return title;
  const name = normalizeWikiPath(path).split('/').pop() ?? path;
  return name.replace(/\.md$/, '');
}

export type WikiCommitTag =
  | { readonly kind: 'trail'; readonly slug: string }
  | { readonly kind: 'ui' }
  | { readonly kind: 'ui-format' }
  | { readonly kind: 'none' };

export interface WikiCommitView {
  readonly hash: string;
  readonly shortHash: string;
  readonly date: string;
  readonly author: string;
  /** The subject without its trailing tag. */
  readonly summary: string;
  readonly tag: WikiCommitTag;
}

/** Splits the `(trail:<slug>)`, `(ui)` or `(ui:format)` tag off a commit subject. */
export function wikiCommitView(commit: DenWikiCommit): WikiCommitView {
  const match = /\s*\((trail:([^)\s]+)|ui:format|ui)\)\s*$/.exec(commit.subject);
  let tag: WikiCommitTag = { kind: 'none' };
  if (match?.[2]) tag = { kind: 'trail', slug: match[2] };
  else if (match?.[1] === 'ui:format') tag = { kind: 'ui-format' };
  else if (match?.[1] === 'ui') tag = { kind: 'ui' };
  return {
    hash: commit.hash,
    shortHash: commit.hash.slice(0, 7),
    date: commit.date,
    author: commit.authorName,
    summary: match ? commit.subject.slice(0, match.index) : commit.subject,
    tag,
  };
}

export interface WikiListingEntry {
  readonly path: string;
  readonly title: string;
  readonly folder: boolean;
  /** Pages under a folder, or null for a file. */
  readonly count: number | null;
  readonly curation: string | null;
  readonly updated: string | null;
}

export interface WikiListing {
  readonly folder: string;
  readonly description: string | null;
  readonly entries: readonly WikiListingEntry[];
}

/** A folder listing: subfolders first, then pages by title; generated indexes are left out. */
export function wikiListing(result: DenWikiListResult): WikiListing {
  const folder = result.folder.replace(/^\/+|\/+$/g, '');
  const rows = result.enrichedPaths ?? [];
  const self = rows.find((row) => row.path === folder);
  const entries: WikiListingEntry[] = [];
  for (const row of rows) {
    if (row.path === folder) continue;
    const isFolder = row.type === 'directory';
    if (!isFolder && (!row.path.endsWith('.md') || row.path.endsWith('/index.md'))) continue;
    const frontmatter = row.frontmatter ?? null;
    entries.push({
      path: row.path,
      title: isFolder ? (row.path.split('/').pop() ?? row.path) : wikiTitle(row.path, frontmatter),
      folder: isFolder,
      count: isFolder ? (row.recursiveMdCount ?? row.directMdCount ?? null) : null,
      curation: typeof frontmatter?.curation === 'string' ? frontmatter.curation : null,
      updated: stringField(frontmatter, 'updated') ?? stringField(frontmatter, 'finished') ?? stringField(frontmatter, 'captured'),
    });
  }
  entries.sort((left, right) =>
    left.folder !== right.folder ? (left.folder ? -1 : 1) : left.title.localeCompare(right.title),
  );
  return { folder, description: self?.description ?? null, entries };
}

function stringField(frontmatter: DenWikiFrontmatter | null, key: string): string | null {
  const value = frontmatter?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

/** The parent of a listed folder, or null at a zone root. */
export function wikiParentFolder(folder: string): string | null {
  const parts = folder.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : null;
}

export interface WikiFact {
  readonly label: string;
  readonly value: string;
}

/** The scalar frontmatter fields shown in the facts panel, in display order. */
export function wikiFacts(frontmatter: DenWikiFrontmatter | null | undefined): readonly WikiFact[] {
  if (!frontmatter) return [];
  const keys: readonly [string, string][] = [
    ['type', 'Type'],
    ['curation', 'Curation'],
    ['confidence', 'Confidence'],
    ['volatility', 'Volatility'],
    ['updated', 'Updated'],
    ['verified', 'Verified'],
    ['publisher', 'Publisher'],
    ['captured', 'Captured'],
    ['agent', 'Agent'],
    ['harness', 'Harness'],
    ['job', 'Ledger job'],
    ['started', 'Started'],
    ['finished', 'Finished'],
  ];
  const facts: WikiFact[] = [];
  for (const [key, label] of keys) {
    const value = frontmatter[key];
    if (typeof value === 'string' && value.trim()) facts.push({ label, value });
    if (typeof value === 'number') facts.push({ label, value: String(value) });
  }
  return facts;
}

/** A frontmatter list (tags, aliases, sources, trails), keeping only strings. */
export function wikiList(frontmatter: DenWikiFrontmatter | null | undefined, key: string): readonly string[] {
  const value = frontmatter?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Drops a body's leading `# Heading` when it repeats the title shown above it. */
export function withoutLeadingTitle(body: string, title: string): string {
  const match = /^\s*#[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n|$)/.exec(body);
  if (!match || match[1]?.trim().toLowerCase() !== title.trim().toLowerCase()) return body;
  return body.slice(match[0].length);
}

/** Turns backticked content paths (`wiki/x.md`), as in the curation scan, into links. */
export function linkContentPaths(markdown: string): string {
  return markdown.replace(/(^|[^[])`((?:wiki|sources|trails)\/[^`\s]+\.md)`/g, '$1[`$2`](/$2)');
}

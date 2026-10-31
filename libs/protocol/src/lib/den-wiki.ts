// Wire shapes of the den-wiki facade's read operations, reached as MCP
// JSON-RPC through Gateway at /api/v1/wiki/mcp. Each result is the call's
// `structuredContent`. Contract: FuzzySlipper/den-wiki docs/facade.md and
// docs/content-contract.md. Only the fields the viewer reads are typed.

/** The read operations the viewer may call. Writes are deliberately absent. */
export type DenWikiReadTool =
  | 'wiki_read'
  | 'wiki_search'
  | 'wiki_list'
  | 'wiki_taxonomy'
  | 'wiki_curation_scan';

export interface DenWikiRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly method: 'tools/call';
  readonly params: {
    readonly name: DenWikiReadTool;
    readonly arguments: Readonly<Record<string, unknown>>;
  };
}

export interface DenWikiToolError {
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
}

export interface DenWikiRpcResponse<T> {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: {
    readonly isError?: boolean;
    /** The result, or `{ error: DenWikiToolError }` when `isError` is set. */
    readonly structuredContent?: T;
  };
  readonly error?: { readonly code: number; readonly message: string };
}

/** Page frontmatter (content contract). Every field is optional on the wire. */
export interface DenWikiFrontmatter {
  readonly type?: string;
  readonly title?: string;
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
  readonly curation?: string;
  readonly confidence?: string;
  readonly volatility?: string;
  readonly updated?: string;
  readonly verified?: string;
  readonly sources?: readonly string[];
  readonly trails?: readonly string[];
  // Sources
  readonly url?: string;
  readonly captured?: string;
  readonly publisher?: string;
  readonly sha256?: string;
  // Trails
  readonly question?: string;
  readonly agent?: string;
  readonly harness?: string;
  readonly job?: number;
  readonly started?: string;
  readonly finished?: string;
  readonly [key: string]: unknown;
}

export interface DenWikiLink {
  readonly source?: string;
  readonly docName?: string;
  readonly title?: string;
  readonly snippet?: string;
  readonly kind?: string;
}

/** A commit in the den-wiki content repo, with its trail-tagged subject. */
export interface DenWikiCommit {
  readonly hash: string;
  readonly date: string;
  readonly authorName: string;
  readonly subject: string;
}

export interface DenWikiZone {
  readonly zone: string;
  readonly description?: string;
  readonly mutability?: string;
  readonly rules?: readonly string[];
}

export interface DenWikiReadResult {
  readonly path: string;
  readonly title?: string;
  /** The whole file, frontmatter included. */
  readonly content: string;
  readonly frontmatter?: DenWikiFrontmatter | null;
  readonly tags?: readonly string[] | null;
  readonly backlinks?: readonly DenWikiLink[] | null;
  readonly forward_links?: readonly DenWikiLink[] | null;
  readonly project_history?: readonly DenWikiCommit[] | null;
  readonly graph_role?: string | null;
  readonly zone?: DenWikiZone | null;
}

export interface DenWikiSearchHit {
  readonly path: string;
  readonly title?: string;
  readonly snippet?: string;
  readonly kind?: string;
  readonly score?: number;
}

export interface DenWikiSearchResult {
  readonly query: string;
  readonly results: readonly DenWikiSearchHit[] | null;
}

/** One entry of a folder listing: the folder itself, a subfolder, or a file. */
export interface DenWikiListEntry {
  readonly path: string;
  readonly type?: string;
  readonly title?: string;
  readonly description?: string;
  readonly directMdCount?: number;
  readonly recursiveMdCount?: number;
  readonly frontmatter?: DenWikiFrontmatter | null;
}

export interface DenWikiListResult {
  readonly folder: string;
  readonly enrichedPaths: readonly DenWikiListEntry[] | null;
}

export interface DenWikiTaxonomyEntry {
  readonly name: string;
  readonly description?: string;
  readonly parent?: string;
  readonly pages: readonly string[] | null;
}

export interface DenWikiTaxonomyResult {
  readonly present: boolean;
  readonly types: readonly DenWikiTaxonomyEntry[] | null;
  readonly tags: readonly DenWikiTaxonomyEntry[] | null;
  readonly unlisted_types?: readonly DenWikiTaxonomyEntry[] | null;
  readonly unlisted_tags?: readonly DenWikiTaxonomyEntry[] | null;
}

export interface DenWikiCurationScanResult {
  readonly generated: string;
  readonly counts?: Readonly<Record<string, number>>;
  readonly summary_markdown: string;
}

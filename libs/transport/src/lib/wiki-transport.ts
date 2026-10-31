import type {
  ClassifiedError,
  DenResult,
  DenWikiCurationScanResult,
  DenWikiListResult,
  DenWikiReadResult,
  DenWikiReadTool,
  DenWikiRpcRequest,
  DenWikiRpcResponse,
  DenWikiSearchResult,
  DenWikiTaxonomyResult,
  DenWikiToolError,
  RuntimeApiConfig,
} from '@den-web/protocol';
import { type DenHttpClient, joinUrl } from './http';

/** The read log attributes the viewer's reads to this identity. */
export const DEN_WIKI_VIEWER_AGENT = 'den-web-viewer';

/**
 * Read-only client for the den-wiki facade. Every call goes through `call`,
 * whose tool name is a `DenWikiReadTool`, so a write operation cannot be sent.
 */
export class WikiTransport {
  private nextId = 1;

  constructor(
    private readonly config: RuntimeApiConfig,
    private readonly http: DenHttpClient,
  ) {}

  /** `path` is content-root-relative, e.g. `wiki/sqlite-wal-mode.md`. */
  read(path: string): Promise<DenResult<DenWikiReadResult>> {
    return this.call('wiki_read', { path });
  }

  search(query: string, limit = 50): Promise<DenResult<DenWikiSearchResult>> {
    return this.call('wiki_search', { query, limit });
  }

  list(folder: string): Promise<DenResult<DenWikiListResult>> {
    return this.call('wiki_list', { folder });
  }

  taxonomy(): Promise<DenResult<DenWikiTaxonomyResult>> {
    return this.call('wiki_taxonomy', {});
  }

  curationScan(): Promise<DenResult<DenWikiCurationScanResult>> {
    return this.call('wiki_curation_scan', {});
  }

  private async call<T>(name: DenWikiReadTool, args: Readonly<Record<string, unknown>>): Promise<DenResult<T>> {
    const body: DenWikiRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'tools/call',
      params: { name, arguments: args },
    };
    const response = await this.http.json<DenWikiRpcResponse<T>>(joinUrl(this.config.servicesApiBase, '/wiki/mcp'), {
      method: 'POST',
      body,
      headers: { 'X-Den-Wiki-Agent': DEN_WIKI_VIEWER_AGENT },
    });
    if (!response.ok) return response;
    const { result, error } = response.value;
    if (error) return { ok: false, error: { kind: 'unknown', message: `${name}: ${error.message}` } };
    const content = result?.structuredContent;
    if (result?.isError) return { ok: false, error: toolError(name, toolErrorOf(content)) };
    if (content === undefined) {
      return { ok: false, error: { kind: 'invalid-response', message: `${name}: no structuredContent` } };
    }
    return { ok: true, value: content };
  }
}

function toolErrorOf(content: unknown): DenWikiToolError | undefined {
  if (typeof content !== 'object' || content === null || !('error' in content)) return undefined;
  const error = content.error;
  if (typeof error !== 'object' || error === null) return undefined;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : code;
  return { code, message };
}

function toolError(name: DenWikiReadTool, error: DenWikiToolError | undefined): ClassifiedError {
  const message = `${name}: ${error ? `${error.code}: ${error.message}` : 'failed'}`;
  if (error?.code === 'not_found') return { kind: 'not-found', message, status: 404 };
  if (error?.code === 'backend_unavailable') return { kind: 'server', message, status: 503 };
  return { kind: 'unknown', message };
}

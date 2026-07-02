import type { ClassifiedError, DenResult } from '@den-web/protocol';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface HttpClientOptions {
  readonly fetchImpl?: typeof fetch;
}

export interface JsonRequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export class DenHttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async json<T>(url: string, options: JsonRequestOptions = {}): Promise<DenResult<T>> {
    try {
      const requestInit: RequestInit = {
        cache: 'no-store',
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
      };
      if (options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body);
      }

      const response = await this.fetchImpl(url, requestInit);

      if (!response.ok) {
        return { ok: false, error: classifyHttpStatus(response.status, `${options.method ?? 'GET'} ${url}: ${response.status}`) };
      }

      if (response.status === 204) {
        return { ok: true, value: undefined as T };
      }

      const value = (await response.json()) as T;
      return { ok: true, value };
    } catch (error: unknown) {
      return { ok: false, error: classifyThrownError(error) };
    }
  }
}

export function classifyHttpStatus(status: number, message: string): ClassifiedError {
  if (status === 401 || status === 403) return { kind: 'auth', message, status };
  if (status === 404) return { kind: 'not-found', message, status };
  if (status >= 500) return { kind: 'server', message, status };
  return { kind: 'unknown', message, status };
}

export function classifyThrownError(error: unknown): ClassifiedError {
  if (error instanceof SyntaxError) {
    return { kind: 'invalid-response', message: error.message };
  }
  if (error instanceof TypeError) {
    return { kind: 'network', message: error.message };
  }
  if (error instanceof Error) {
    return { kind: 'unknown', message: error.message };
  }
  return { kind: 'unknown', message: String(error) };
}

export function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function query(params: Readonly<Record<string, string | number | boolean | null | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}

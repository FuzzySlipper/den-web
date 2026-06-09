import { getConfig, normalizeApiBase, resetConfig } from '../config';

/**
 * Shared Core API HTTP layer: base-URL state, lifecycle (init/reset), and the
 * small fetch/url/query helpers every Core domain module is built on.
 *
 * The domain client modules (spaces, tasks, documents, …) import {@link get},
 * {@link post}, {@link put}, {@link coreApiUrl}, {@link esc}, and
 * {@link buildQuery} from here so URL/query construction and error/no-store
 * semantics stay identical across every endpoint.
 */

/**
 * Current effective API base URLs.
 * Initialized synchronously from Vite env vars + defaults at import time.
 * Updated asynchronously when initClient() fetches runtime config.
 */
let denCoreApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CORE_API_BASE, '/den-core-api');

/**
 * Initialize the API client with runtime configuration.
 * Attempts to load `/den-web-config.json`; falls back to current env/defaults on failure.
 * Call once at app startup (e.g., from main.tsx or App.tsx mount).
 */
export async function initClient(): Promise<void> {
  const config = await getConfig();
  denCoreApiBase = config.denCoreApiBase;
}

/**
 * Reset client config to env/defaults. Useful in test teardown.
 */
export function resetClient(): void {
  resetConfig();
  denCoreApiBase = normalizeApiBase(import.meta.env.VITE_DEN_CORE_API_BASE, '/den-core-api');
}

/**
 * Get the current resolved API base values. Useful for tests and diagnostics.
 */
export function getApiBases(): { denCoreApiBase: string } {
  return { denCoreApiBase };
}

function apiUrl(base: string, url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

export function coreApiUrl(url: string): string {
  return apiUrl(denCoreApiBase, url);
}

export async function get<T>(url: string): Promise<T> {
  const requestUrl = coreApiUrl(url);
  const res = await fetch(requestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}

export async function put<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = coreApiUrl(url);
  const res = await fetch(requestUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${requestUrl}: ${res.status}`);
  return res.json();
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = coreApiUrl(url);
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${requestUrl}: ${res.status}`);
  return res.json();
}

export function esc(s: string): string {
  return encodeURIComponent(s);
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

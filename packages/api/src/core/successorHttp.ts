import { getConfig, normalizeApiBase } from '../config';
import { dedupedFetch } from '../requestCache';

const DEFAULT_SUCCESSOR_API_BASE = '/api/v1';

let successorApiBase = normalizeApiBase(import.meta.env.VITE_DEN_SERVICES_API_BASE, DEFAULT_SUCCESSOR_API_BASE);

export async function initSuccessorHttpClient(): Promise<void> {
  const config = await getConfig();
  successorApiBase = config.tasksSuccessorApiBase || DEFAULT_SUCCESSOR_API_BASE;
}

export function resetSuccessorHttpClient(): void {
  successorApiBase = normalizeApiBase(import.meta.env.VITE_DEN_SERVICES_API_BASE, DEFAULT_SUCCESSOR_API_BASE);
}

export function successorApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${successorApiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

export function successorGet<T>(url: string): Promise<T> {
  const requestUrl = successorApiUrl(url);
  return dedupedFetch(`GET ${requestUrl}`, async () => {
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
    return res.json();
  });
}

export async function successorPost<T>(url: string, body: unknown): Promise<T> {
  const requestUrl = successorApiUrl(url);
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${requestUrl}: ${res.status}`);
  return res.json();
}

import { normalizeApiBase } from '../config';
import type { DocumentPublicationRecord, DocumentPublicationRequest, DocumentPublicationResponse } from './types';

interface DocPublishClientConfig {
  apiBase: string;
}

let config: DocPublishClientConfig = {
  apiBase: '/api/v1/blog/publications',
};

export function reinitDocPublishClient(next: Partial<DocPublishClientConfig>): void {
  config = {
    apiBase: normalizeApiBase(next.apiBase, '/api/v1/blog/publications'),
  };
}

function docPublishUrl(path = ''): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path) return config.apiBase;
  return `${config.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseError(response: Response, action: string): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (
      body
      && typeof body === 'object'
      && 'error' in body
      && body.error
      && typeof body.error === 'object'
      && 'message' in body.error
      && typeof body.error.message === 'string'
    ) {
      return new Error(`${action}: ${body.error.message}`);
    }
  } catch {
    // Fall through to status-only error.
  }
  return new Error(`${action}: ${response.status}`);
}

async function postDocPublish<T>(path: string, body: DocumentPublicationRequest, action: string): Promise<T> {
  const response = await fetch(docPublishUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response, action);
  return response.json();
}

export function previewDocumentPublication(request: DocumentPublicationRequest): Promise<DocumentPublicationResponse> {
  return postDocPublish<DocumentPublicationResponse>('/preview', request, 'Preview document publication');
}

export function publishDocument(request: DocumentPublicationRequest): Promise<DocumentPublicationResponse> {
  return postDocPublish<DocumentPublicationResponse>('', request, 'Publish document');
}

export async function getDocumentPublication(id: string): Promise<DocumentPublicationRecord | null> {
  const response = await fetch(docPublishUrl(`/${encodeURIComponent(id)}`), { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw await parseError(response, 'GET document publication');
  return response.json();
}

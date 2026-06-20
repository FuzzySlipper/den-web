import type { DocType, Document, DocumentSearchResult, DocumentSummary } from './types';
import { buildQuery, coreApiUrl, esc, get, post } from './http';

export function listDocuments(projectId?: string, docType?: string, tags?: string): Promise<DocumentSummary[]> {
  if (projectId) {
    const q = buildQuery({ docType, tags });
    return get(`/api/projects/${esc(projectId)}/documents${q}`);
  }
  const q = buildQuery({ projectId, docType, tags });
  return get(`/api/documents${q}`);
}

export function getDocument(projectId: string, slug: string): Promise<Document | null> {
  return fetch(coreApiUrl(`/api/projects/${esc(projectId)}/documents/${esc(slug)}`), { cache: 'no-store' })
    .then(res => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET document: ${res.status}`);
      return res.json();
    });
}

export interface SaveDocumentRequest {
  slug: string;
  title: string;
  content: string;
  doc_type?: DocType;
  tags?: string[] | null;
}

export function saveDocument(projectId: string, doc: SaveDocumentRequest): Promise<Document> {
  return post(`/api/projects/${esc(projectId)}/documents`, doc);
}

export function searchDocuments(query: string, projectId?: string): Promise<DocumentSearchResult[]> {
  if (projectId) {
    return get(`/api/projects/${esc(projectId)}/documents/search?query=${esc(query)}`);
  }
  const q = buildQuery({ query, projectId });
  return get(`/api/documents/search${q}`);
}

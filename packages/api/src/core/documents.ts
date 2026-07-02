import type { DocType, Document, DocumentSearchResult, DocumentSummary } from './types';
import { buildQuery, esc } from './http';
import { successorApiUrl, successorGet, successorPost } from './successorHttp';

export function listDocuments(projectId?: string, docType?: string, tags?: string): Promise<DocumentSummary[]> {
  if (projectId) {
    const q = buildQuery({ doc_type: docType, tags });
    return successorGet(`/projects/${esc(projectId)}/documents${q}`);
  }
  const q = buildQuery({ project_id: projectId, doc_type: docType, tags });
  return successorGet(`/documents${q}`);
}

export function getDocument(projectId: string, slug: string): Promise<Document | null> {
  return fetch(successorApiUrl(`/projects/${esc(projectId)}/documents/${esc(slug)}`), { cache: 'no-store' })
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
  return successorPost(`/projects/${esc(projectId)}/documents`, doc);
}

export function searchDocuments(query: string, projectId?: string): Promise<DocumentSearchResult[]> {
  if (projectId) {
    return successorGet(`/projects/${esc(projectId)}/documents/search?query=${esc(query)}`);
  }
  const q = buildQuery({ query, projectId });
  return successorGet(`/documents/search${q}`);
}

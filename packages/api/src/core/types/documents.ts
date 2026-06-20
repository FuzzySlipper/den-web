export type DocType = 'prd' | 'spec' | 'adr' | 'convention' | 'reference' | 'note';

export interface Document {
  id: number;
  project_id: string;
  slug: string;
  title: string;
  content: string;
  doc_type: DocType;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentSummary {
  id: number;
  project_id: string;
  slug: string;
  title: string;
  doc_type: DocType;
  tags: string[] | null;
  updated_at: string;
}

export interface DocumentSearchResult {
  project_id: string;
  slug: string;
  title: string;
  doc_type: DocType;
  snippet: string;
  rank: number;
}

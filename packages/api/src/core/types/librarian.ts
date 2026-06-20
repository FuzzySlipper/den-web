export type LibrarianConfidence = 'low' | 'medium' | 'high';

export interface RelevantItem {
  type: string;
  source_id: string;
  project_id: string | null;
  summary: string;
  why_relevant: string;
  snippet: string | null;
}

export interface LibrarianResponse {
  relevant_items: RelevantItem[];
  recommendations: string[];
  confidence: LibrarianConfidence;
}

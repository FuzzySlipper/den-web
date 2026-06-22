export interface DocumentPublicationSource {
  project_id?: string;
  document_project_id: string;
  document_slug: string;
}

export interface DocumentPublicationOptions {
  tags?: string[];
  overwrite?: boolean;
}

export interface DocumentPublicationDraft {
  title: string;
  slug?: string;
  markdown: string;
  updated_at?: string;
}

export interface DocumentPublicationRequest {
  source: DocumentPublicationSource;
  options?: DocumentPublicationOptions;
  requested_by: string;
  document?: DocumentPublicationDraft;
}

export type DocumentPublicationStatus = 'previewed' | 'published' | 'failed';

export interface DocumentPublicationResponse {
  publication_id: string;
  status: DocumentPublicationStatus;
  dry_run: boolean;
  title: string;
  slug: string;
  post_path: string;
  public_url: string;
  git_commit?: string;
  preview_markdown?: string;
  warnings?: string[];
  source: DocumentPublicationSource;
}

export interface DocumentPublicationRecord {
  id: string;
  source_project_id?: string;
  document_project_id: string;
  document_slug: string;
  source_version?: string;
  title: string;
  slug: string;
  repo_id: string;
  branch: string;
  post_path: string;
  public_url: string;
  git_commit?: string;
  status: DocumentPublicationStatus;
  requested_by: string;
  created_at: string;
  updated_at: string;
  last_error?: string;
}

import type { LibrarianResponse } from './types';
import { esc, post } from './http';

export interface QueryLibrarianRequest {
  query: string;
  taskId?: number;
  includeGlobal?: boolean;
}

export function queryLibrarian(projectId: string, request: QueryLibrarianRequest): Promise<LibrarianResponse> {
  return post(`/api/projects/${esc(projectId)}/librarian/query`, {
    query: request.query,
    task_id: request.taskId,
    include_global: request.includeGlobal ?? true,
  });
}

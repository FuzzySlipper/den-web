import type { LibrarianResponse } from './types';
import { esc } from './http';
import { successorPost } from './successorHttp';

export interface QueryLibrarianRequest {
  query: string;
  taskId?: number;
  includeGlobal?: boolean;
}

export function queryLibrarian(projectId: string, request: QueryLibrarianRequest): Promise<LibrarianResponse> {
  return successorPost(`/projects/${esc(projectId)}/librarian/query`, {
    query: request.query,
    task_id: request.taskId,
    include_global: request.includeGlobal ?? true,
  });
}

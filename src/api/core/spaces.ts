import type { Project, Space } from './types';
import { buildQuery, esc, get } from './http';

export interface ListSpacesOpts {
  kind?: string;
  includeHidden?: boolean;
  includeArchived?: boolean;
}

export function listSpaces(opts: ListSpacesOpts = {}): Promise<Space[]> {
  const q = buildQuery({
    kind: opts.kind,
    includeHidden: opts.includeHidden,
    includeArchived: opts.includeArchived,
  });
  return get(`/api/spaces${q}`);
}

export function listProjects(): Promise<Project[]> {
  return get('/api/projects');
}

export function getProject(id: string, agent?: string): Promise<Project> {
  const q = buildQuery({ agent });
  return get(`/api/projects/${esc(id)}${q}`);
}

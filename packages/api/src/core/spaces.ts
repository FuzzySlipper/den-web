import type { Project, Space } from './types';
import { buildQuery, esc } from './http';
import { successorGet } from './successorHttp';

export interface ListSpacesOpts {
  kind?: string;
  includeHidden?: boolean;
  includeArchived?: boolean;
}

export function listSpaces(opts: ListSpacesOpts = {}): Promise<Space[]> {
  const q = buildQuery({
    kind: opts.kind,
    include_hidden: opts.includeHidden,
    include_archived: opts.includeArchived,
  });
  return successorGet(`/spaces${q}`);
}

export function listProjects(): Promise<Project[]> {
  return successorGet('/projects');
}

export function getProject(id: string, agent?: string): Promise<Project> {
  const q = buildQuery({ agent });
  return successorGet(`/projects/${esc(id)}${q}`);
}

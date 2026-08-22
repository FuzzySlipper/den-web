import { DEN_GLOBAL_PROJECT_ID, type DenProject, type DenSpace } from '@den-web/protocol';

export interface WorkspaceItem {
  readonly id: string;
  readonly kind: string | undefined;
  readonly name: string | undefined;
  readonly source: 'global' | 'project' | 'space';
  readonly visibility: string | undefined;
}

export function workspaceItems(
  projects: readonly DenProject[],
  spaces: readonly DenSpace[],
  showSpaces: boolean,
): readonly WorkspaceItem[] {
  const byId = new Map<string, WorkspaceItem>();
  const globalItem: WorkspaceItem = {
    id: DEN_GLOBAL_PROJECT_ID,
    kind: 'global',
    name: 'Global',
    source: 'global',
    visibility: 'normal',
  };
  for (const space of spaces) {
    byId.set(space.id, {
      id: space.id,
      kind: space.kind,
      name: space.name,
      source: 'space',
      visibility: space.visibility,
    });
  }
  for (const project of projects) {
    if (byId.has(project.id)) continue;
    byId.set(project.id, {
      id: project.id,
      kind: project.visibility,
      name: project.name,
      source: 'project',
      visibility: project.visibility,
    });
  }
  const items = [
    globalItem,
    ...[...byId.values()].sort((left, right) => displayName(left).localeCompare(displayName(right))),
  ];
  return showSpaces ? items : items.filter((item) => !isSpaceItem(item, projects));
}

/**
 * The projects service stores every scope in one table, so `/v1/spaces`
 * returns projects too; a scope is a space when its `kind` is present and
 * not `project`. Kind-less scopes fall back to membership in the
 * `/v1/projects` response.
 */
function isSpaceItem(item: WorkspaceItem, projects: readonly DenProject[]): boolean {
  if (item.source !== 'space') return false;
  if (item.kind !== undefined && item.kind !== '') return item.kind !== 'project';
  return !projects.some((project) => project.id === item.id);
}

function displayName(item: WorkspaceItem): string {
  return item.name || item.id;
}

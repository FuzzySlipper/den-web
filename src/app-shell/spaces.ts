import type { Space } from '../api/types';

export const ALL_SPACES_ID = '_all';
export const GLOBAL_SPACE_ID = '_global';

export const ALL_SPACES: Space = {
  id: ALL_SPACES_ID,
  name: 'All spaces',
  kind: 'system',
  visibility: 'hidden',
  owner: null,
  root_path: null,
  description: 'Aggregate views across accessible spaces',
  created_at: null,
  updated_at: null,
};

/** Prepend the synthetic "All spaces" aggregate unless it is already present. */
export function withAllSpacesAggregate(spaces: Space[] | null | undefined): Space[] {
  const list = spaces ?? [];
  return list.some(space => space.id === ALL_SPACES.id) ? list : [ALL_SPACES, ...list];
}

/** Pick the startup space, preferring a normal project-kind space to preserve project-centric startup. */
export function defaultSpaceId(spaces: Space[]): string | null {
  return spaces.find(space => space.kind === 'project' && space.visibility === 'normal')?.id
    ?? spaces.find(space => space.id !== ALL_SPACES.id)?.id
    ?? spaces[0]?.id
    ?? null;
}

export function spaceSupportsGit(space: Space | null | undefined, isAllSpaces: boolean): boolean {
  return isAllSpaces || space?.kind === 'project' || Boolean(space?.root_path?.trim());
}

/** Next space id when cycling forward through the sidebar order (switch-project hotkey). */
export function nextSpaceId(spaces: Space[], currentId: string | null): string | null {
  if (spaces.length === 0) return null;
  const currentIdx = currentId ? spaces.findIndex(space => space.id === currentId) : -1;
  const nextIdx = (currentIdx + 1) % spaces.length;
  return spaces[nextIdx].id;
}

/** Project ids that back notification feeds for a given scope (excludes synthetic aggregate spaces). */
export function notificationScopeProjectIds(effectiveSpaceId: string | null, spaces: Space[]): string[] {
  if (effectiveSpaceId && effectiveSpaceId !== ALL_SPACES_ID && effectiveSpaceId !== GLOBAL_SPACE_ID) {
    return [effectiveSpaceId];
  }
  return spaces.filter(space => space.id !== ALL_SPACES_ID).map(space => space.id);
}

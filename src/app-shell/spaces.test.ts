import { describe, expect, it } from 'vitest';
import type { Space } from '../api/types';
import {
  ALL_SPACES_ID,
  GLOBAL_SPACE_ID,
  defaultSpaceId,
  nextSpaceId,
  notificationScopeProjectIds,
  spaceSupportsGit,
  withAllSpacesAggregate,
} from './spaces';

function space(partial: Partial<Space> & { id: string }): Space {
  return {
    name: partial.id,
    kind: 'project',
    visibility: 'normal',
    owner: null,
    root_path: null,
    description: null,
    created_at: null,
    updated_at: null,
    ...partial,
  };
}

describe('withAllSpacesAggregate', () => {
  it('prepends the All spaces aggregate when missing', () => {
    const result = withAllSpacesAggregate([space({ id: 'p1' })]);
    expect(result[0].id).toBe(ALL_SPACES_ID);
    expect(result).toHaveLength(2);
  });

  it('does not duplicate the aggregate when already present', () => {
    const result = withAllSpacesAggregate([space({ id: ALL_SPACES_ID }), space({ id: 'p1' })]);
    expect(result.filter(s => s.id === ALL_SPACES_ID)).toHaveLength(1);
  });

  it('handles null/undefined input', () => {
    expect(withAllSpacesAggregate(null)[0].id).toBe(ALL_SPACES_ID);
    expect(withAllSpacesAggregate(undefined)).toHaveLength(1);
  });
});

describe('defaultSpaceId', () => {
  it('prefers a normal project-kind space', () => {
    const spaces = [
      space({ id: ALL_SPACES_ID, kind: 'system', visibility: 'hidden' }),
      space({ id: 'hidden-proj', visibility: 'hidden' }),
      space({ id: 'proj', kind: 'project', visibility: 'normal' }),
    ];
    expect(defaultSpaceId(spaces)).toBe('proj');
  });

  it('falls back to the first non-aggregate space', () => {
    const spaces = [
      space({ id: ALL_SPACES_ID, kind: 'system', visibility: 'hidden' }),
      space({ id: 'global', kind: 'system', visibility: 'normal' }),
    ];
    expect(defaultSpaceId(spaces)).toBe('global');
  });

  it('returns null for an empty list', () => {
    expect(defaultSpaceId([])).toBeNull();
  });
});

describe('spaceSupportsGit', () => {
  it('always supports git for the aggregate scope', () => {
    expect(spaceSupportsGit(null, true)).toBe(true);
  });

  it('supports git for project-kind spaces', () => {
    expect(spaceSupportsGit(space({ id: 'p', kind: 'project' }), false)).toBe(true);
  });

  it('supports git when a root path is present', () => {
    expect(spaceSupportsGit(space({ id: 'p', kind: 'system', root_path: '/tmp/x' }), false)).toBe(true);
  });

  it('does not support git for a pathless non-project space', () => {
    expect(spaceSupportsGit(space({ id: 'p', kind: 'system', root_path: null }), false)).toBe(false);
  });
});

describe('nextSpaceId', () => {
  const spaces = [space({ id: 'a' }), space({ id: 'b' }), space({ id: 'c' })];

  it('cycles forward', () => {
    expect(nextSpaceId(spaces, 'a')).toBe('b');
    expect(nextSpaceId(spaces, 'b')).toBe('c');
  });

  it('wraps around to the first space', () => {
    expect(nextSpaceId(spaces, 'c')).toBe('a');
  });

  it('starts at the first space when nothing is selected', () => {
    expect(nextSpaceId(spaces, null)).toBe('a');
  });

  it('returns null for an empty list', () => {
    expect(nextSpaceId([], 'a')).toBeNull();
  });
});

describe('notificationScopeProjectIds', () => {
  const spaces = [
    space({ id: ALL_SPACES_ID }),
    space({ id: 'p1' }),
    space({ id: 'p2' }),
  ];

  it('returns a single concrete space when one is selected', () => {
    expect(notificationScopeProjectIds('p1', spaces)).toEqual(['p1']);
  });

  it('expands aggregate scopes to all concrete spaces', () => {
    expect(notificationScopeProjectIds(ALL_SPACES_ID, spaces)).toEqual(['p1', 'p2']);
    expect(notificationScopeProjectIds(GLOBAL_SPACE_ID, spaces)).toEqual(['p1', 'p2']);
    expect(notificationScopeProjectIds(null, spaces)).toEqual(['p1', 'p2']);
  });
});

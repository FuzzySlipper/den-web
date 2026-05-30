import { describe, expect, it, beforeEach } from 'vitest';
import type { Space } from '../../api/types';
import {
  isAggregateEntryId,
  readPinnedProjectIds,
  writePinnedProjectIds,
  togglePinned,
  sortSpacesWithPinned,
} from './pinnedProjects';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function space(overrides: Partial<Space> & { id: string }): Space {
  return {
    name: overrides.id,
    kind: 'project',
    visibility: 'normal',
    owner: null,
    root_path: null,
    description: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers for localStorage mocking
// ---------------------------------------------------------------------------

interface MockStore {
  [key: string]: string;
}
let store: MockStore = {};

beforeEach(() => {
  store = {};
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
    },
    writable: true,
    configurable: true,
  });
});

function storageValue(): string | null {
  return store['den-web-pinned-project-ids'] ?? null;
}

function parseStorage(): string[] {
  const raw = storageValue();
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// ---------------------------------------------------------------------------
// isAggregateEntryId
// ---------------------------------------------------------------------------

describe('isAggregateEntryId', () => {
  it('identifies _all as aggregate', () => {
    expect(isAggregateEntryId('_all')).toBe(true);
  });

  it('identifies _global as aggregate', () => {
    expect(isAggregateEntryId('_global')).toBe(true);
  });

  it('returns false for normal project IDs', () => {
    expect(isAggregateEntryId('project-abc')).toBe(false);
    expect(isAggregateEntryId('den-channels')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readPinnedProjectIds / writePinnedProjectIds
// ---------------------------------------------------------------------------

describe('readPinnedProjectIds', () => {
  it('returns empty array when nothing is stored', () => {
    expect(readPinnedProjectIds()).toEqual([]);
  });

  it('reads stored pinned IDs', () => {
    writePinnedProjectIds(['a', 'b', 'c']);
    expect(readPinnedProjectIds()).toEqual(['a', 'b', 'c']);
  });

  it('filters out empty strings', () => {
    writePinnedProjectIds(['a', '', 'b']);
    expect(readPinnedProjectIds()).toEqual(['a', 'b']);
  });

  it('filters out aggregate entry IDs', () => {
    writePinnedProjectIds(['_all', '_global', 'real-project']);
    expect(readPinnedProjectIds()).toEqual(['real-project']);
  });

  it('ignores corrupt JSON', () => {
    store['den-web-pinned-project-ids'] = 'not-json';
    expect(readPinnedProjectIds()).toEqual([]);
  });

  it('ignores non-array stored value', () => {
    store['den-web-pinned-project-ids'] = '"string"';
    expect(readPinnedProjectIds()).toEqual([]);
  });
});

describe('writePinnedProjectIds', () => {
  it('persists to localStorage', () => {
    writePinnedProjectIds(['proj-a', 'proj-b']);
    expect(parseStorage()).toEqual(['proj-a', 'proj-b']);
  });

  it('deduplicates before writing', () => {
    writePinnedProjectIds(['a', 'a', 'b', 'b']);
    expect(parseStorage()).toEqual(['a', 'b']);
  });

  it('filters out aggregate IDs before writing', () => {
    writePinnedProjectIds(['_all', 'proj-a', '_global']);
    expect(parseStorage()).toEqual(['proj-a']);
  });

  it('handles empty array', () => {
    writePinnedProjectIds([]);
    expect(parseStorage()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// togglePinned
// ---------------------------------------------------------------------------

describe('togglePinned', () => {
  it('adds an unpinned ID', () => {
    expect(togglePinned(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a pinned ID', () => {
    expect(togglePinned(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('does not toggle aggregate entry IDs (no-op)', () => {
    // Aggregate entries are not pinnable; togglePinned returns the array unchanged
    expect(togglePinned([], '_all')).toEqual([]);
    expect(togglePinned([], '_global')).toEqual([]);
  });

  it('does not remove aggregate entry IDs (defensive no-op)', () => {
    // Even if aggregate somehow appears in the array, togglePinned prevents
    // toggling entirely rather than silently removing it.
    expect(togglePinned(['_all'], '_all')).toEqual(['_all']);
  });

  it('handles empty input', () => {
    expect(togglePinned([], 'new-id')).toEqual(['new-id']);
  });
});

// ---------------------------------------------------------------------------
// sortSpacesWithPinned
// ---------------------------------------------------------------------------

describe('sortSpacesWithPinned', () => {
  const projA = space({ id: 'a', name: 'Project A' });
  const projB = space({ id: 'b', name: 'Project B' });
  const projC = space({ id: 'c', name: 'Project C' });

  it('places pinned entries at the top in storage order', () => {
    const result = sortSpacesWithPinned([projA, projB, projC], ['c', 'a']);
    expect(result.map(s => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('preserves unpinned entries in original order below pinned', () => {
    const result = sortSpacesWithPinned([projB, projA, projC], ['a']);
    expect(result.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns all unpinned entries in original order when nothing is pinned', () => {
    const result = sortSpacesWithPinned([projC, projA, projB], []);
    expect(result.map(s => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('handles empty space list', () => {
    expect(sortSpacesWithPinned([], [])).toEqual([]);
    expect(sortSpacesWithPinned([], ['a'])).toEqual([]);
  });

  it('deduplicates — no duplicate rows regardless of pin state', () => {
    const result = sortSpacesWithPinned([projA, projA, projB], []);
    expect(result.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('stale pinned IDs are gracefully ignored', () => {
    const result = sortSpacesWithPinned([projA, projB], ['stale-id', 'a']);
    expect(result.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('aggregate entries stay at the top regardless of pin state', () => {
    const allAgg = space({ id: '_all', name: 'All spaces', kind: 'system', visibility: 'hidden' });
    const pinnedProj = space({ id: 'pinned-proj', name: 'Pinned Proj' });
    const normalProj = space({ id: 'normal-proj', name: 'Normal Proj' });
    // _all is first in the list (as injected by withAllSpacesAggregate)
    const input = [allAgg, pinnedProj, normalProj];
    const result = sortSpacesWithPinned(input, ['pinned-proj']);
    // _all stays at the very top (aggregate priority), then pinned, then unpinned
    expect(result.map(s => s.id)).toEqual(['_all', 'pinned-proj', 'normal-proj']);
  });

  it('preserves space objects (not just IDs) in pinned section', () => {
    const result = sortSpacesWithPinned([projB, projA, projC], ['b']);
    expect(result[0].name).toBe('Project B');
    expect(result[0].id).toBe('b');
  });
});

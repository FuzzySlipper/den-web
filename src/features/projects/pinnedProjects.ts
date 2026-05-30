/**
 * Pinned projects/spaces: local persistence and ordering helpers.
 *
 * V1 uses localStorage (same pattern as preferencesStorage.ts).
 * Pin state survives reload in the current browser profile.
 */

import type { Space } from '../../api/types';

const PINNED_STORAGE_KEY = 'den-web-pinned-project-ids';

// ---------------------------------------------------------------------------
// Aggregate entry IDs — these are synthetic rows injected by the app shell.
// ---------------------------------------------------------------------------

const AGGREGATE_IDS = new Set(['_all', '_global']);

/** True if the ID is a synthetic aggregate entry (All spaces, Global, etc.) */
export function isAggregateEntryId(id: string): boolean {
  return AGGREGATE_IDS.has(id);
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

/**
 * Read pinned project/space IDs from localStorage.
 * Filters out stale/empty IDs and aggregate entries (those are not pinnable).
 *
 * Aggregate entries are deliberately excluded from pin storage because:
 *   - They are injected by `withAllSpacesAggregate` at the top of the list.
 *   - Pinning them to the top would be redundant (they're already first) and
 *     would add confusing state when the aggregate is the only visible entry.
 *   - Leaving them pinnable creates a no-op affordance that tests poorly.
 *
 * Returns a fresh array each call (callers own the copy).
 */
export function readPinnedProjectIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter to valid strings and exclude aggregate IDs
    return parsed.filter(
      (id): id is string => typeof id === 'string' && id.length > 0 && !AGGREGATE_IDS.has(id),
    );
  } catch {
    return [];
  }
}

/**
 * Persist pinned project/space IDs to localStorage.
 */
export function writePinnedProjectIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Normalise before writing: no duplicates, no aggregates, no empty strings
    const seen = new Set<string>();
    const clean = ids.filter(id => id && !AGGREGATE_IDS.has(id) && !seen.has(id) && seen.add(id));
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // localStorage unavailable — in-memory state still works this session
  }
}

// ---------------------------------------------------------------------------
// Pure toggle helper
// ---------------------------------------------------------------------------

/**
 * Toggle a project/space ID in a pinned-ids array.
 * If present, remove it; if absent, append it.
 * Returns a new array (does not mutate the input).
 */
export function togglePinned(ids: string[], id: string): string[] {
  // Aggregate entries cannot be pinned
  if (AGGREGATE_IDS.has(id)) return ids;
  if (ids.includes(id)) {
    return ids.filter(x => x !== id);
  }
  return [...ids, id];
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Order spaces so pinned entries appear first (in their original relative
 * pin-storage order), then unpinned entries in their original order.
 *
 * Aggregate entries (_all, _global) are kept at the top of the list
 * regardless of pin state, because:
 *   - They are injected by `withAllSpacesAggregate` as the default view.
 *   - They should remain at their natural position as the first items
 *     rather than being displaced by pinned user projects.
 *   - They cannot be pinned (filtered by readPinnedProjectIds/togglePinned).
 *
 * Spaces whose IDs aren't in the pinned set stay below.  Stale/missing
 * pinned IDs are gracefully ignored.
 *
 * Deduplication: if a space appears in the list multiple times
 * (shouldn't happen but defensive), only the first occurrence is used.
 */
export function sortSpacesWithPinned(spaces: Space[], pinnedIds: string[]): Space[] {
  // Defensively filter out aggregate IDs from pinnedIds (shouldn't be there
  // but guard against callers bypassing readPinnedProjectIds/togglePinned)
  const filteredPinnedIds = pinnedIds.filter(id => !AGGREGATE_IDS.has(id));
  const pinnedSet = new Set(filteredPinnedIds);
  const used = new Set<string>();

  // Aggregate/system entries always stay at the top of the list.
  const aggregates: Space[] = [];
  const pinned: Space[] = [];
  const unpinned: Space[] = [];

  for (const space of spaces) {
    if (used.has(space.id)) continue;
    used.add(space.id);

    if (isAggregateEntryId(space.id)) {
      aggregates.push(space);
    } else if (pinnedSet.has(space.id)) {
      pinned.push(space);
    } else {
      unpinned.push(space);
    }
  }

  // Within pinned entries, respect the order from pinnedIds storage
  const pinnedOrdered: Space[] = [];
  for (const id of filteredPinnedIds) {
    const found = pinned.find(s => s.id === id);
    if (found) pinnedOrdered.push(found);
  }
  // Any pinned entries not in pinnedIds (shouldn't happen) go after in original order
  for (const s of pinned) {
    if (!pinnedOrdered.includes(s)) pinnedOrdered.push(s);
  }

  return [...aggregates, ...pinnedOrdered, ...unpinned];
}

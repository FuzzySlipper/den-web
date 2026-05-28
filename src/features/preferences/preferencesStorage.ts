/**
 * localStorage-based persistence for Den Web client-local preferences.
 *
 * V1 uses a single JSON blob under `den-web-preferences`.  See types.ts
 * for the rationale on why not server-side shared settings.
 *
 * All exported functions are safe to call in SSR / non-browser contexts
 * — they test for `typeof window !== 'undefined'` first.
 */

import type { DenWebPreferences } from './types';
import { DEFAULT_PREFERENCES } from './types';

const STORAGE_KEY = 'den-web-preferences';

/**
 * Read preferences from localStorage.  Returns defaults if nothing is
 * stored, the blob is corrupt, or we are not in a browser context.
 */
export function readPreferences(): DenWebPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(DEFAULT_PREFERENCES);
    const parsed = JSON.parse(raw) as Partial<DenWebPreferences>;
    return mergeDefaults(parsed);
  } catch {
    return deepClone(DEFAULT_PREFERENCES);
  }
}

/**
 * Persist preferences to localStorage.
 */
export function writePreferences(prefs: DenWebPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage quota or privacy mode — in-memory state still works
  }
}

/**
 * Remove stored preferences, reverting to defaults.
 */
export function clearPreferences(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Get a fresh copy of the default preferences.
 */
export function getDefaults(): DenWebPreferences {
  return deepClone(DEFAULT_PREFERENCES);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeDefaults(partial: Partial<DenWebPreferences>): DenWebPreferences {
  const defaults = DEFAULT_PREFERENCES;
  return {
    chat: { ...defaults.chat, ...partial.chat },
    layout: { ...defaults.layout, ...partial.layout },
    theme: { ...defaults.theme, ...partial.theme },
    font: { ...defaults.font, ...partial.font },
  };
}

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
  const merged: DenWebPreferences = {
    chat: { ...defaults.chat, ...partial.chat },
    layout: clampLayout({ ...defaults.layout, ...partial.layout }),
    theme: { ...defaults.theme, ...partial.theme },
    font: clampFont({ ...defaults.font, ...partial.font }),
    keyboard: { ...defaults.keyboard, ...partial.keyboard },
  };
  // Guard invalid notificationHistoryMode values
  if (
    merged.layout.notificationHistoryMode !== 'window' &&
    merged.layout.notificationHistoryMode !== 'sidePanel'
  ) {
    merged.layout.notificationHistoryMode = 'window';
  }
  return merged;
}

/** Clamp layout dimensions to safe bounds. */
function clampLayout(layout: DenWebPreferences['layout']): DenWebPreferences['layout'] {
  const defaults = DEFAULT_PREFERENCES.layout;
  return {
    ...layout,
    sidebarWidth: clampNumber(layout.sidebarWidth, 140, 500, defaults.sidebarWidth),
    notificationPanelWidth: clampNumber(layout.notificationPanelWidth, 280, 800, defaults.notificationPanelWidth),
    detailPanelWidth: clampNumber(layout.detailPanelWidth, 200, 1200, defaults.detailPanelWidth),
  };
}

/** Clamp font sizes to sane range. */
function clampFont(font: DenWebPreferences['font']): DenWebPreferences['font'] {
  const defaults = DEFAULT_PREFERENCES.font;
  return {
    ...font,
    listSize: clampNumber(font.listSize, 8, 32, defaults.listSize),
    detailSize: clampNumber(font.detailSize, 8, 32, defaults.detailSize),
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

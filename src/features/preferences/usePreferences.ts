/**
 * React hook to read, write, and apply Den Web preferences at runtime.
 *
 * When preferences change, the hook updates CSS custom properties on
 * `document.documentElement` so styles take effect immediately without
 * a rebuild or redeploy.
 */

import { useCallback, useEffect, useState } from 'react';
import type { DenWebPreferences } from './types';

import { readPreferences, writePreferences, clearPreferences, getDefaults } from './preferencesStorage';

function applyThemeVars(prefs: DenWebPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Theme — override the actual CSS variables used throughout the app
  root.style.setProperty('--accent', prefs.theme.accent);
  root.style.setProperty('--bg', prefs.theme.background);
  root.style.setProperty('--bg-surface', prefs.theme.surface);
  root.style.setProperty('--text', prefs.theme.text);
  root.style.setProperty('--text-muted', prefs.theme.textMuted);

  // Compute accent-dim from accent (simple darkened approximation)
  const dim = dimColor(prefs.theme.accent);
  root.style.setProperty('--accent-dim', dim);

  // Font — override root font-family and base size
  root.style.setProperty('--font-mono', prefs.font.monoStack);
  root.style.setProperty('--font-sans', prefs.font.sansStack);
  root.style.fontSize = `${prefs.font.baseSize}px`;

  // CSS custom properties for sub-components that read chat density
  root.style.setProperty('--pref-chat-row-gap', `${prefs.chat.rowGap}px`);
  root.style.setProperty('--pref-chat-message-padding', `${prefs.chat.messagePadding}px`);
  root.style.setProperty('--pref-chat-column-gap', `${prefs.chat.columnGap}px`);
  root.style.setProperty('--pref-layout-chat-fraction', String(prefs.layout.chatFraction));
  root.style.setProperty('--pref-layout-show-participants', prefs.layout.showParticipants ? '1' : '0');
}

/** Produce a dimmed/desaturated variant of a hex colour by reducing brightness. */
function dimColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const factor = 0.65;
    const dr = Math.round(r * factor);
    const dg = Math.round(g * factor);
    const db = Math.round(b * factor);
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  } catch {
    return '#4a6bc5'; // safe fallback
  }
}

export interface UsePreferencesResult {
  /** Current preferences (live state) */
  prefs: DenWebPreferences;
  /** Replace all preferences and persist */
  setPrefs: (next: DenWebPreferences) => void;
  /** Update a single top-level section */
  updateSection: <K extends keyof DenWebPreferences>(key: K, value: DenWebPreferences[K]) => void;
  /** Reset all preferences to factory defaults */
  resetToDefaults: () => void;
}

export function usePreferences(): UsePreferencesResult {
  const [prefs, setPrefsState] = useState<DenWebPreferences>(() => {
    const stored = readPreferences();
    applyThemeVars(stored);
    return stored;
  });

  const setPrefs = useCallback((next: DenWebPreferences) => {
    setPrefsState(next);
    writePreferences(next);
    applyThemeVars(next);
  }, []);

  const updateSection = useCallback(
    <K extends keyof DenWebPreferences>(key: K, value: DenWebPreferences[K]) => {
      setPrefsState((current: DenWebPreferences) => {
        const next = { ...current, [key]: value };
        writePreferences(next);
        applyThemeVars(next);
        return next;
      });
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaults();
    clearPreferences();
    setPrefsState(defaults);
    applyThemeVars(defaults);
  }, []);

  // Apply on mount (covers SSR hydration)
  // We intentionally run this effect only on mount, not on prefs changes,
  // because setPrefs/updateSection already call applyThemeVars inline.
  useEffect(() => {
    applyThemeVars(prefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount effect
  }, []);

  return { prefs, setPrefs, updateSection, resetToDefaults };
}

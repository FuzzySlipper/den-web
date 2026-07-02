import { signal, type Signal } from '@angular/core';
import type { DocumentEffectsPort, KeyValueStoragePort } from '@den-web/platform';

export type DensityPreference = 'comfortable' | 'compact';
export type ThemePreference = 'light' | 'dark';

export interface DenWebPreferences {
  readonly density: DensityPreference;
  readonly theme: ThemePreference;
  readonly highContrast: boolean;
}

export interface PreferencesStore {
  readonly preferences: Signal<DenWebPreferences>;
  readonly setDensity: (density: DensityPreference) => void;
  readonly setTheme: (theme: ThemePreference) => void;
  readonly setHighContrast: (enabled: boolean) => void;
  readonly apply: () => void;
}

const key = 'den-web.preferences.v2';
const defaults: DenWebPreferences = { density: 'comfortable', theme: 'light', highContrast: false };

export function createPreferencesStore(storage: KeyValueStoragePort, effects: DocumentEffectsPort): PreferencesStore {
  const preferences = signal(loadPreferences(storage));

  const persist = (next: DenWebPreferences): void => {
    preferences.set(next);
    storage.setItem(key, JSON.stringify(next));
    applyPreferences(effects, next);
  };

  return {
    preferences: preferences.asReadonly(),
    setDensity: (density) => persist({ ...preferences(), density }),
    setTheme: (theme) => persist({ ...preferences(), theme }),
    setHighContrast: (highContrast) => persist({ ...preferences(), highContrast }),
    apply: () => applyPreferences(effects, preferences()),
  };
}

function loadPreferences(storage: KeyValueStoragePort): DenWebPreferences {
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return defaults;
    return {
      density: parsed['density'] === 'compact' ? 'compact' : 'comfortable',
      theme: parsed['theme'] === 'dark' ? 'dark' : 'light',
      highContrast: parsed['highContrast'] === true,
    };
  } catch {
    return defaults;
  }
}

function applyPreferences(effects: DocumentEffectsPort, preferences: DenWebPreferences): void {
  effects.setTitle('Den Web');
  effects.setRootClass('den-compact', preferences.density === 'compact');
  effects.setRootClass('den-dark', preferences.theme === 'dark');
  effects.setRootClass('den-high-contrast', preferences.highContrast);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

import { getCachedConfig } from '@den-web/api/config';

import type { PiCrewAdminAuthMode } from '@den-web/models/piCrew/piCrewDiagnostics';

export const PI_CREW_DIAGNOSTICS_STORAGE_KEY = 'den-web.piCrewDiagnostics.config';

export interface StoredPiCrewDiagnosticsConfig {
  baseUrl: string;
  operator: string;
  authMode: PiCrewAdminAuthMode;
}

const LEGACY_LOCAL_ADMIN_BASES = new Set([
  'http://127.0.0.1:9237',
  'http://localhost:9237',
  // Current Pi Crew admin target behind Den Web. The service does not answer
  // browser CORS preflights directly, so the browser must use the same-origin
  // Den Web proxy instead of this LAN URL.
  'http://192.168.1.22:9237',
]);

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function defaultPiCrewAdminBaseUrl(): string {
  return getCachedConfig()?.piCrewAdminApiBase ?? import.meta.env?.VITE_PI_CREW_ADMIN_API_BASE ?? '/pi-crew-admin-api';
}

export function normalizeStoredPiCrewAdminBaseUrl(value: unknown, fallback = '/pi-crew-admin-api'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;
  return LEGACY_LOCAL_ADMIN_BASES.has(trimmed) ? fallback : trimmed;
}

export function readStoredPiCrewDiagnosticsConfig(): StoredPiCrewDiagnosticsConfig {
  const defaultBaseUrl = defaultPiCrewAdminBaseUrl();
  try {
    const raw = getBrowserLocalStorage()?.getItem(PI_CREW_DIAGNOSTICS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredPiCrewDiagnosticsConfig> & { bearerToken?: unknown };
      const authMode: PiCrewAdminAuthMode = parsed.authMode === 'none' ? 'none' : 'bearer';
      const sanitized: StoredPiCrewDiagnosticsConfig = {
        baseUrl: normalizeStoredPiCrewAdminBaseUrl(parsed.baseUrl, defaultBaseUrl),
        operator: typeof parsed.operator === 'string' ? parsed.operator : 'patch',
        authMode,
      };
      if (parsed.bearerToken !== undefined || sanitized.baseUrl !== parsed.baseUrl) persistPiCrewDiagnosticsConfig(sanitized);
      return sanitized;
    }
  } catch {
    // Ignore storage failures; the panel remains manually configurable.
  }
  return {
    baseUrl: defaultBaseUrl,
    operator: 'patch',
    authMode: 'bearer',
  };
}

export function persistPiCrewDiagnosticsConfig(config: StoredPiCrewDiagnosticsConfig): void {
  try {
    getBrowserLocalStorage()?.setItem(PI_CREW_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Best effort only.
  }
}

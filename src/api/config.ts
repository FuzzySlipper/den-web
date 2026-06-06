/**
 * Runtime configuration for Den Web API base URLs.
 *
 * Precedence (highest to lowest):
 * 1. Runtime config fetched from `/den-web-config.json` (deploy-time JSON file)
 * 2. Vite build-time env variables (`VITE_DEN_CORE_API_BASE`, `VITE_DEN_CHANNELS_API_BASE`, `VITE_DEN_HOST_API_BASE`)
 * 3. Safe local defaults (`/den-core-api`, `/api`, `/den-host-api`)
 *
 * Malformed or inaccessible config triggers a console diagnostic and falls back
 * gracefully — it never silently points at wrong API endpoints.
 */

export interface DenWebRuntimeConfig {
  denCoreApiBase: string;
  denChannelsApiBase: string;
  denHostApiBase: string;
  appBasePath: string;
  environmentName: string;
}

const DEFAULTS: DenWebRuntimeConfig = {
  denCoreApiBase: '/den-core-api',
  denChannelsApiBase: '/api',
  denHostApiBase: '/den-host-api',
  appBasePath: '/',
  environmentName: 'development',
};

let cachedConfig: DenWebRuntimeConfig | null = null;
let configLoadAttempted = false;
let configLoadError: string | null = null;

/**
 * Normalize an API base path: strip trailing slashes, ensure non-empty result.
 */
export function normalizeApiBase(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? fallback).trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Attempt to load runtime config from `/den-web-config.json`.
 * Returns null on fetch/parse failure — does not throw.
 */
async function loadRuntimeConfigFile(): Promise<DenWebRuntimeConfig | null> {
  try {
    const res = await fetch('/den-web-config.json');
    if (!res.ok) {
      if (res.status === 404) {
        // 404 is expected — no runtime config deployed; use env/defaults.
        return null;
      }
      console.warn(`[den-web-config] GET /den-web-config.json returned ${res.status}; falling back to env/defaults`);
      return null;
    }

    const raw: unknown = await res.json();
    if (typeof raw !== 'object' || raw === null) {
      console.error('[den-web-config] /den-web-config.json is not a JSON object; falling back to env/defaults');
      return null;
    }

    const obj = raw as Record<string, unknown>;

    // Validate required string fields
    const required = ['denCoreApiBase', 'denChannelsApiBase', 'denHostApiBase'] as const;
    for (const key of required) {
      if (obj[key] !== undefined && typeof obj[key] !== 'string') {
        console.error(`[den-web-config] key "${key}" must be a string (got ${typeof obj[key]}); falling back to env/defaults`);
        return null;
      }
    }

    return {
      denCoreApiBase: normalizeApiBase(obj.denCoreApiBase as string | undefined, DEFAULTS.denCoreApiBase),
      denChannelsApiBase: normalizeApiBase(obj.denChannelsApiBase as string | undefined, DEFAULTS.denChannelsApiBase),
      denHostApiBase: normalizeApiBase(obj.denHostApiBase as string | undefined, DEFAULTS.denHostApiBase),
      appBasePath: normalizeApiBase(obj.appBasePath as string | undefined, DEFAULTS.appBasePath),
      environmentName: typeof obj.environmentName === 'string' ? obj.environmentName : DEFAULTS.environmentName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    configLoadError = message;
    console.error(`[den-web-config] Failed to load /den-web-config.json: ${message}`);
    return null;
  }
}

/**
 * Resolve the effective API base paths using the precedence contract.
 *
 * @param reload - Force reload the runtime config file (useful in tests).
 * @returns The resolved runtime configuration.
 */
export async function getConfig(reload = false): Promise<DenWebRuntimeConfig> {
  if (reload || !configLoadAttempted) {
    configLoadAttempted = true;
    const runtimeConfig = await loadRuntimeConfigFile();
    if (runtimeConfig !== null) {
      cachedConfig = runtimeConfig;
      return cachedConfig;
    }
    // Fall through: runtime config unavailable, use env then defaults
  }

  if (cachedConfig !== null) {
    return cachedConfig;
  }

  // Build from Vite env + defaults (synchronous, no IO)
  // Use try/catch to handle non-Vite environments (e.g., tests without import.meta.env)
  let viteEnvViteCoreBase: string | undefined;
  let viteEnvChannelsBase: string | undefined;
  let viteEnvHostBase: string | undefined;
  try {
    viteEnvViteCoreBase = import.meta.env?.VITE_DEN_CORE_API_BASE;
    viteEnvChannelsBase = import.meta.env?.VITE_DEN_CHANNELS_API_BASE;
    viteEnvHostBase = import.meta.env?.VITE_DEN_HOST_API_BASE;
  } catch {
    // Not running in Vite (e.g., jsdom tests without env configured)
  }

  const config: DenWebRuntimeConfig = {
    denCoreApiBase: normalizeApiBase(viteEnvViteCoreBase, DEFAULTS.denCoreApiBase),
    denChannelsApiBase: normalizeApiBase(viteEnvChannelsBase, DEFAULTS.denChannelsApiBase),
    denHostApiBase: normalizeApiBase(viteEnvHostBase, DEFAULTS.denHostApiBase),
    appBasePath: DEFAULTS.appBasePath,
    environmentName: DEFAULTS.environmentName,
  };

  cachedConfig = config;
  return config;
}

/**
 * Synchronous accessor for tests and modules that already have config loaded.
 * Returns undefined if getConfig() has not been called yet.
 */
export function getCachedConfig(): DenWebRuntimeConfig | undefined {
  return cachedConfig ?? undefined;
}

/**
 * Reset cached config state. Useful in test teardown.
 */
export function resetConfig(): void {
  cachedConfig = null;
  configLoadAttempted = false;
  configLoadError = null;
}

/**
 * Returns the last config load error message, if any.
 */
export function getConfigLoadError(): string | null {
  return configLoadError;
}

export { DEFAULTS };

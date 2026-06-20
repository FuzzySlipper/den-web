/**
 * Runtime configuration for Den Web API base URLs.
 *
 * Precedence (highest to lowest):
 * 1. Runtime config fetched from `/den-web-config.json` (deploy-time JSON file)
 * 2. Vite build-time env variables (`VITE_DEN_CORE_API_BASE`, `VITE_DEN_CHANNELS_API_BASE`, `VITE_DEN_HOST_API_BASE`, `VITE_PI_CREW_ADMIN_API_BASE`, successor pilot flags)
 * 3. Safe local defaults (`/den-core-api`, `/api`, `/den-host-api`, `/pi-crew-admin-api`, successor flags disabled)
 *
 * Malformed or inaccessible config triggers a console diagnostic and falls back
 * gracefully — it never silently points at wrong API endpoints.
 */

export interface DenWebRuntimeConfig {
  denCoreApiBase: string;
  denChannelsApiBase: string;
  denHostApiBase: string;
  piCrewAdminApiBase: string;
  conversationSuccessorReadsEnabled: boolean;
  conversationSuccessorWritesEnabled: boolean;
  conversationSuccessorApiBase: string;
  conversationSuccessorReadProjectIds: string[];
  conversationSuccessorWriteProjectIds: string[];
  timelineSuccessorEnabled: boolean;
  timelineSuccessorApiBase: string;
  timelineSuccessorProjectIds: string[];
  appBasePath: string;
  environmentName: string;
}

const DEFAULTS: DenWebRuntimeConfig = {
  denCoreApiBase: '/den-core-api',
  denChannelsApiBase: '/api',
  denHostApiBase: '/den-host-api',
  piCrewAdminApiBase: '/pi-crew-admin-api',
  conversationSuccessorReadsEnabled: false,
  conversationSuccessorWritesEnabled: false,
  conversationSuccessorApiBase: '/api/v1/conversation',
  conversationSuccessorReadProjectIds: [],
  conversationSuccessorWriteProjectIds: [],
  timelineSuccessorEnabled: false,
  timelineSuccessorApiBase: '/api/v1/timeline',
  timelineSuccessorProjectIds: [],
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

function parseBooleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

export function parseCommaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function runtimeStringFieldsAreValid(obj: Record<string, unknown>): boolean {
  const fields = ['denCoreApiBase', 'denChannelsApiBase', 'denHostApiBase', 'piCrewAdminApiBase', 'conversationSuccessorApiBase', 'timelineSuccessorApiBase'] as const;
  for (const key of fields) {
    if (obj[key] !== undefined && typeof obj[key] !== 'string') {
      console.error(`[den-web-config] key "${key}" must be a string (got ${typeof obj[key]}); falling back to env/defaults`);
      return false;
    }
  }
  return true;
}

function runtimeConversationPilotFieldsAreValid(obj: Record<string, unknown>): boolean {
  return runtimeBooleanFieldsAreValid(obj, ['conversationSuccessorReadsEnabled', 'conversationSuccessorWritesEnabled', 'timelineSuccessorEnabled'])
    && runtimeListFieldsAreValid(obj, ['conversationSuccessorReadProjectIds', 'conversationSuccessorWriteProjectIds', 'timelineSuccessorProjectIds']);
}

function runtimeBooleanFieldsAreValid(obj: Record<string, unknown>, fields: string[]): boolean {
  for (const key of fields) {
    if (obj[key] !== undefined && !['boolean', 'string'].includes(typeof obj[key])) {
      console.error(`[den-web-config] key "${key}" must be a boolean/string flag (got ${typeof obj[key]}); falling back to env/defaults`);
      return false;
    }
  }
  return true;
}

function runtimeListFieldsAreValid(obj: Record<string, unknown>, fields: string[]): boolean {
  for (const key of fields) {
    if (obj[key] !== undefined && typeof obj[key] !== 'string' && !Array.isArray(obj[key])) {
      console.error(`[den-web-config] key "${key}" must be a string or string array (got ${typeof obj[key]}); falling back to env/defaults`);
      return false;
    }
  }
  return true;
}

function runtimeConfigFromRecord(obj: Record<string, unknown>): DenWebRuntimeConfig | null {
  if (!runtimeStringFieldsAreValid(obj) || !runtimeConversationPilotFieldsAreValid(obj)) return null;
  return {
    denCoreApiBase: normalizeApiBase(obj.denCoreApiBase as string | undefined, DEFAULTS.denCoreApiBase),
    denChannelsApiBase: normalizeApiBase(obj.denChannelsApiBase as string | undefined, DEFAULTS.denChannelsApiBase),
    denHostApiBase: normalizeApiBase(obj.denHostApiBase as string | undefined, DEFAULTS.denHostApiBase),
    piCrewAdminApiBase: normalizeApiBase(obj.piCrewAdminApiBase as string | undefined, DEFAULTS.piCrewAdminApiBase),
    conversationSuccessorReadsEnabled: parseBooleanFlag(obj.conversationSuccessorReadsEnabled, DEFAULTS.conversationSuccessorReadsEnabled),
    conversationSuccessorWritesEnabled: parseBooleanFlag(obj.conversationSuccessorWritesEnabled, DEFAULTS.conversationSuccessorWritesEnabled),
    conversationSuccessorApiBase: normalizeApiBase(obj.conversationSuccessorApiBase as string | undefined, DEFAULTS.conversationSuccessorApiBase),
    conversationSuccessorReadProjectIds: parseCommaList(obj.conversationSuccessorReadProjectIds),
    conversationSuccessorWriteProjectIds: parseCommaList(obj.conversationSuccessorWriteProjectIds),
    timelineSuccessorEnabled: parseBooleanFlag(obj.timelineSuccessorEnabled, DEFAULTS.timelineSuccessorEnabled),
    timelineSuccessorApiBase: normalizeApiBase(obj.timelineSuccessorApiBase as string | undefined, DEFAULTS.timelineSuccessorApiBase),
    timelineSuccessorProjectIds: parseCommaList(obj.timelineSuccessorProjectIds),
    appBasePath: normalizeApiBase(obj.appBasePath as string | undefined, DEFAULTS.appBasePath),
    environmentName: typeof obj.environmentName === 'string' ? obj.environmentName : DEFAULTS.environmentName,
  };
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
    return runtimeConfigFromRecord(obj);
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
  let viteEnvPiCrewAdminBase: string | undefined;
  let viteEnvConversationSuccessorReadsEnabled: string | undefined;
  let viteEnvConversationSuccessorWritesEnabled: string | undefined;
  let viteEnvConversationSuccessorApiBase: string | undefined;
  let viteEnvConversationSuccessorReadProjectIds: string | undefined;
  let viteEnvConversationSuccessorWriteProjectIds: string | undefined;
  let viteEnvTimelineSuccessorEnabled: string | undefined;
  let viteEnvTimelineSuccessorApiBase: string | undefined;
  let viteEnvTimelineSuccessorProjectIds: string | undefined;
  try {
    viteEnvViteCoreBase = import.meta.env?.VITE_DEN_CORE_API_BASE;
    viteEnvChannelsBase = import.meta.env?.VITE_DEN_CHANNELS_API_BASE;
    viteEnvHostBase = import.meta.env?.VITE_DEN_HOST_API_BASE;
    viteEnvPiCrewAdminBase = import.meta.env?.VITE_PI_CREW_ADMIN_API_BASE;
    viteEnvConversationSuccessorReadsEnabled = import.meta.env?.VITE_CONVERSATION_SUCCESSOR_READS_ENABLED;
    viteEnvConversationSuccessorWritesEnabled = import.meta.env?.VITE_CONVERSATION_SUCCESSOR_WRITES_ENABLED;
    viteEnvConversationSuccessorApiBase = import.meta.env?.VITE_CONVERSATION_SUCCESSOR_API_BASE;
    viteEnvConversationSuccessorReadProjectIds = import.meta.env?.VITE_CONVERSATION_SUCCESSOR_READ_PROJECT_IDS;
    viteEnvConversationSuccessorWriteProjectIds = import.meta.env?.VITE_CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS;
    viteEnvTimelineSuccessorEnabled = import.meta.env?.VITE_TIMELINE_SUCCESSOR_ENABLED;
    viteEnvTimelineSuccessorApiBase = import.meta.env?.VITE_TIMELINE_SUCCESSOR_API_BASE;
    viteEnvTimelineSuccessorProjectIds = import.meta.env?.VITE_TIMELINE_SUCCESSOR_PROJECT_IDS;
  } catch {
    // Not running in Vite (e.g., jsdom tests without env configured)
  }

  const config: DenWebRuntimeConfig = {
    denCoreApiBase: normalizeApiBase(viteEnvViteCoreBase, DEFAULTS.denCoreApiBase),
    denChannelsApiBase: normalizeApiBase(viteEnvChannelsBase, DEFAULTS.denChannelsApiBase),
    denHostApiBase: normalizeApiBase(viteEnvHostBase, DEFAULTS.denHostApiBase),
    piCrewAdminApiBase: normalizeApiBase(viteEnvPiCrewAdminBase, DEFAULTS.piCrewAdminApiBase),
    conversationSuccessorReadsEnabled: parseBooleanFlag(viteEnvConversationSuccessorReadsEnabled, DEFAULTS.conversationSuccessorReadsEnabled),
    conversationSuccessorWritesEnabled: parseBooleanFlag(viteEnvConversationSuccessorWritesEnabled, DEFAULTS.conversationSuccessorWritesEnabled),
    conversationSuccessorApiBase: normalizeApiBase(viteEnvConversationSuccessorApiBase, DEFAULTS.conversationSuccessorApiBase),
    conversationSuccessorReadProjectIds: parseCommaList(viteEnvConversationSuccessorReadProjectIds),
    conversationSuccessorWriteProjectIds: parseCommaList(viteEnvConversationSuccessorWriteProjectIds),
    timelineSuccessorEnabled: parseBooleanFlag(viteEnvTimelineSuccessorEnabled, DEFAULTS.timelineSuccessorEnabled),
    timelineSuccessorApiBase: normalizeApiBase(viteEnvTimelineSuccessorApiBase, DEFAULTS.timelineSuccessorApiBase),
    timelineSuccessorProjectIds: parseCommaList(viteEnvTimelineSuccessorProjectIds),
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

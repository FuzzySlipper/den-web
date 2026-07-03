import { defaultRuntimeApiConfig, type DenWebRuntimeConfigFile, type RuntimeApiConfig } from '@den-web/protocol';

export interface RuntimeConfigLoadResult {
  readonly config: RuntimeApiConfig;
  readonly source: 'runtime-file' | 'defaults';
  readonly error?: string;
}

export interface RuntimeConfigLoaderOptions {
  readonly fetchImpl?: typeof fetch;
  readonly configPath?: string;
}

const runtimeStringKeys = [
  'tasksSuccessorApiBase',
  'messagesSuccessorApiBase',
  'conversationSuccessorApiBase',
  'timelineSuccessorApiBase',
  'observationSuccessorApiBase',
  'deliverySuccessorApiBase',
  'docPublishApiBase',
  'artifactsApiBase',
  'environmentName',
] as const;

export function normalizeApiBase(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? fallback).trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : fallback;
}

export function runtimeConfigFromFile(file: DenWebRuntimeConfigFile): RuntimeApiConfig {
  const servicesBase = normalizeApiBase(
    file.tasksSuccessorApiBase ?? file.messagesSuccessorApiBase,
    defaultRuntimeApiConfig.servicesApiBase,
  );

  return {
    servicesApiBase: servicesBase,
    conversationApiBase: normalizeApiBase(file.conversationSuccessorApiBase, defaultRuntimeApiConfig.conversationApiBase),
    timelineApiBase: normalizeApiBase(file.timelineSuccessorApiBase, defaultRuntimeApiConfig.timelineApiBase),
    observationApiBase: normalizeApiBase(file.observationSuccessorApiBase, defaultRuntimeApiConfig.observationApiBase),
    deliveryApiBase: normalizeApiBase(file.deliverySuccessorApiBase, defaultRuntimeApiConfig.deliveryApiBase),
    docPublishApiBase: normalizeApiBase(file.docPublishApiBase, defaultRuntimeApiConfig.docPublishApiBase),
    artifactsApiBase: normalizeApiBase(file.artifactsApiBase, defaultRuntimeApiConfig.artifactsApiBase),
    environmentName: file.environmentName?.trim() || defaultRuntimeApiConfig.environmentName,
  };
}

export async function loadRuntimeApiConfig(options: RuntimeConfigLoaderOptions = {}): Promise<RuntimeConfigLoadResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const configPath = options.configPath ?? '/den-web-config.json';

  if (!fetchImpl) {
    return { config: defaultRuntimeApiConfig, source: 'defaults', error: 'fetch unavailable' };
  }

  try {
    const response = await fetchImpl(configPath, { cache: 'no-store' });
    if (response.status === 404) {
      return { config: defaultRuntimeApiConfig, source: 'defaults' };
    }
    if (!response.ok) {
      return { config: defaultRuntimeApiConfig, source: 'defaults', error: `GET ${configPath}: ${response.status}` };
    }

    const raw: unknown = await response.json();
    const parsed = parseRuntimeConfigRecord(raw);
    if (!parsed.ok) {
      return { config: defaultRuntimeApiConfig, source: 'defaults', error: parsed.error };
    }

    return { config: runtimeConfigFromFile(parsed.value), source: 'runtime-file' };
  } catch (error: unknown) {
    return {
      config: defaultRuntimeApiConfig,
      source: 'defaults',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

function parseRuntimeConfigRecord(raw: unknown): ParseResult<DenWebRuntimeConfigFile> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: '/den-web-config.json must be a JSON object' };
  }

  const record = raw as Record<string, unknown>;
  for (const key of runtimeStringKeys) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      return { ok: false, error: `/den-web-config.json key ${key} must be a string` };
    }
  }

  return {
    ok: true,
    value: {
      tasksSuccessorApiBase: record['tasksSuccessorApiBase'],
      messagesSuccessorApiBase: record['messagesSuccessorApiBase'],
      conversationSuccessorApiBase: record['conversationSuccessorApiBase'],
      timelineSuccessorApiBase: record['timelineSuccessorApiBase'],
      observationSuccessorApiBase: record['observationSuccessorApiBase'],
      deliverySuccessorApiBase: record['deliverySuccessorApiBase'],
      docPublishApiBase: record['docPublishApiBase'],
      artifactsApiBase: record['artifactsApiBase'],
      environmentName: record['environmentName'],
    } as DenWebRuntimeConfigFile,
  };
}

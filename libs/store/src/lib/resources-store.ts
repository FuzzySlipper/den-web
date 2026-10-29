import { signal, type Signal } from '@angular/core';
import type { ClockPort, KeyValueStoragePort } from '@den-web/platform';
import type {
  DenResource,
  DenResourceSaveRequest,
  DenResourcesState,
  DenResourcesWork,
  DenResourcesWorkReport,
  DenResourcesWorkReportResponse,
  DenResourcesWorkUpdate,
  DenResult,
} from '@den-web/protocol';
import {
  errorState,
  idleState,
  loadingState,
  resultState,
  stateValue,
  type AsyncState,
  unknownStoreError,
} from './async-state';

export interface ResourcesTransportPort {
  readonly state: (workLimit?: number) => Promise<DenResult<DenResourcesState>>;
  readonly reportWork: (body: DenResourcesWorkReport) => Promise<DenResult<DenResourcesWorkReportResponse>>;
  readonly updateWork: (workId: string, body?: DenResourcesWorkUpdate) => Promise<DenResult<DenResourcesWork>>;
  readonly saveResource: (body: DenResourceSaveRequest) => Promise<DenResult<DenResource>>;
}

export const RESOURCES_REFRESH_INTERVAL_MS = 10_000;
export const RESOURCES_OWNER_STORAGE_KEY = 'den-web.resources.owner';

export interface ResourcesStore {
  readonly state: Signal<AsyncState<DenResourcesState>>;
  /** Warnings from a check-in, a confirmation, or a failed action. */
  readonly notice: Signal<string | null>;
  /** The viewer's remembered owner name for check-ins and confirmations. */
  readonly owner: Signal<string>;
  readonly refresh: () => Promise<void>;
  readonly startPolling: () => void;
  readonly stopPolling: () => void;
  /** While paused (a dialog is open), polling skips its refresh. */
  readonly setPaused: (paused: boolean) => void;
  readonly dismissNotice: () => void;
  readonly checkIn: (report: DenResourcesWorkReport) => Promise<DenResult<DenResourcesWorkReportResponse>>;
  readonly renew: (workId: string) => Promise<void>;
  readonly checkOut: (workId: string) => Promise<void>;
  /** Saves a resource and confirms its lifecycle as `owner`. */
  readonly saveResource: (body: DenResourceSaveRequest, owner: string) => Promise<DenResult<DenResource>>;
  /** Records actual use of a resource today as `owner`. */
  readonly recordUse: (resourceId: string, owner: string) => Promise<DenResult<DenResource>>;
}

export function createResourcesStore(
  transport: ResourcesTransportPort,
  clock: ClockPort,
  storage: KeyValueStoragePort,
): ResourcesStore {
  const state = signal<AsyncState<DenResourcesState>>(idleState());
  const notice = signal<string | null>(null);
  const owner = signal(readOwner(storage));
  let timer: number | null = null;
  let polling = false;
  let paused = false;
  let inflight: Promise<void> | null = null;

  const load = async (): Promise<void> => {
    const previous = stateValue(state());
    state.set(loadingState(previous));
    try {
      state.set(resultState(await transport.state(), previous));
    } catch (error) {
      state.set(errorState(unknownStoreError(error), previous));
    }
  };

  // A write that lands during a poll waits for it, then reads again so the change shows.
  const refresh = async (): Promise<void> => {
    while (inflight) await inflight;
    inflight = load();
    try {
      await inflight;
    } finally {
      inflight = null;
    }
  };

  const schedule = (): void => {
    if (!polling) return;
    timer = clock.setTimeout(() => {
      timer = null;
      if (paused) {
        schedule();
        return;
      }
      void refresh().finally(schedule);
    }, RESOURCES_REFRESH_INTERVAL_MS);
  };

  const remember = (name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    owner.set(trimmed);
    try {
      storage.setItem(RESOURCES_OWNER_STORAGE_KEY, trimmed);
    } catch {
      // Storage can be unavailable (private windows, blocked site data); the name still applies this session.
    }
  };

  const afterWrite = async <T>(result: DenResult<T>, success: string | null): Promise<DenResult<T>> => {
    if (result.ok) {
      notice.set(success);
      await refresh();
    }
    return result;
  };

  const updateWork = async (workId: string, body: DenResourcesWorkUpdate): Promise<void> => {
    const result = await transport.updateWork(workId, body);
    if (!result.ok) {
      notice.set(result.error.message);
      return;
    }
    notice.set(null);
    await refresh();
  };

  return {
    state: state.asReadonly(),
    notice: notice.asReadonly(),
    owner: owner.asReadonly(),
    refresh,
    startPolling: () => {
      if (polling) return;
      polling = true;
      void refresh().finally(schedule);
    },
    stopPolling: () => {
      polling = false;
      if (timer !== null) clock.clearTimeout(timer);
      timer = null;
    },
    setPaused: (value) => {
      paused = value;
    },
    dismissNotice: () => notice.set(null),
    checkIn: async (report) => {
      const result = await transport.reportWork(report);
      if (result.ok) remember(report.owner);
      const warnings = result.ok ? (result.value.warnings ?? []) : [];
      return afterWrite(result, warnings.length > 0 ? warnings.join(' · ') : null);
    },
    renew: (workId) => updateWork(workId, {}),
    checkOut: (workId) => updateWork(workId, { state: 'completed' }),
    saveResource: async (body, name) => {
      const result = await transport.saveResource({ ...body, confirm: true, owner: name.trim() });
      if (result.ok) remember(name);
      return afterWrite(result, null);
    },
    recordUse: async (resourceId, name) => {
      const result = await transport.saveResource({ id: resourceId, touch: true, owner: name.trim() });
      if (result.ok) remember(name);
      return afterWrite(result, 'Actual use recorded for today.');
    },
  };
}

function readOwner(storage: KeyValueStoragePort): string {
  try {
    return storage.getItem(RESOURCES_OWNER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

import { signal, type Signal } from '@angular/core';
import type { ClockPort } from '@den-web/platform';
import type { DenOpsJobDetail, DenOpsSummary, DenResult } from '@den-web/protocol';
import {
  errorState,
  idleState,
  loadingState,
  resultState,
  stateValue,
  type AsyncState,
  unknownStoreError,
} from './async-state';

export interface OpsTransportPort {
  readonly summary: () => Promise<DenResult<DenOpsSummary>>;
  readonly job: (jobId: string, limit?: number) => Promise<DenResult<DenOpsJobDetail>>;
}

export const OPS_REFRESH_INTERVAL_MS = 60_000;
export const OPS_HISTORY_LIMIT = 20;

export interface OpsStore {
  readonly summary: Signal<AsyncState<DenOpsSummary>>;
  readonly detail: Signal<AsyncState<DenOpsJobDetail>>;
  readonly selectedJobId: Signal<string | null>;
  /** Advances on every refresh attempt so ages keep moving between loads. */
  readonly now: Signal<Date>;
  readonly refresh: () => Promise<void>;
  readonly selectJob: (jobId: string | null) => Promise<void>;
  readonly startPolling: () => void;
  readonly stopPolling: () => void;
}

export function createOpsStore(transport: OpsTransportPort, clock: ClockPort): OpsStore {
  const summary = signal<AsyncState<DenOpsSummary>>(idleState());
  const detail = signal<AsyncState<DenOpsJobDetail>>(idleState());
  const selectedJobId = signal<string | null>(null);
  const now = signal(clock.now());
  let timer: number | null = null;
  let polling = false;

  const loadDetail = async (jobId: string): Promise<void> => {
    const previous = stateValue(detail());
    const keep = previous?.job.job_id === jobId ? previous : undefined;
    detail.set(loadingState(keep));
    try {
      const result = await transport.job(jobId, OPS_HISTORY_LIMIT);
      if (selectedJobId() === jobId) detail.set(resultState(result, keep));
    } catch (error) {
      if (selectedJobId() === jobId) detail.set(errorState(unknownStoreError(error), keep));
    }
  };

  const refresh = async (): Promise<void> => {
    now.set(clock.now());
    const previous = stateValue(summary());
    summary.set(loadingState(previous));
    try {
      summary.set(resultState(await transport.summary(), previous));
    } catch (error) {
      summary.set(errorState(unknownStoreError(error), previous));
    }
    now.set(clock.now());
    const jobId = selectedJobId();
    if (jobId) await loadDetail(jobId);
  };

  const schedule = (): void => {
    if (!polling) return;
    timer = clock.setTimeout(() => {
      timer = null;
      void refresh().finally(schedule);
    }, OPS_REFRESH_INTERVAL_MS);
  };

  return {
    summary: summary.asReadonly(),
    detail: detail.asReadonly(),
    selectedJobId: selectedJobId.asReadonly(),
    now: now.asReadonly(),
    refresh,
    selectJob: async (jobId) => {
      selectedJobId.set(jobId);
      if (!jobId) {
        detail.set(idleState());
        return;
      }
      await loadDetail(jobId);
    },
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
  };
}

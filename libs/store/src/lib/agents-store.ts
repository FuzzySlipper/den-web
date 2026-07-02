import { computed, signal, type Signal } from '@angular/core';
import { observationAgentsOverview, type AgentOverviewModel } from '@den-web/domain';
import type { DenObservationLane, DenResult } from '@den-web/protocol';
import { dataState, errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface ObservationTransportPort {
  readonly lane: (options?: { readonly limit?: number }) => Promise<DenResult<DenObservationLane>>;
}

export interface AgentsStore {
  readonly lane: Signal<AsyncState<DenObservationLane>>;
  readonly overview: Signal<AsyncState<AgentOverviewModel>>;
  readonly degraded: Signal<boolean>;
  readonly refresh: () => Promise<void>;
}

export function createAgentsStore(transport: ObservationTransportPort): AgentsStore {
  const lane = signal<AsyncState<DenObservationLane>>(idleState());
  const overview = computed<AsyncState<AgentOverviewModel>>(() => {
    const state = lane();
    if (state.kind === 'data') return dataState(observationAgentsOverview(state.value));
    if (state.kind === 'error') return errorState(state.error);
    return state.kind === 'loading' ? loadingState() : idleState();
  });

  return {
    lane: lane.asReadonly(),
    overview,
    degraded: computed(() => stateValue(overview())?.degraded ?? false),
    refresh: async () => {
      const previous = stateValue(lane());
      lane.set(loadingState(previous));
      try {
        lane.set(resultState(await transport.lane({ limit: 100 }), previous));
      } catch (error) {
        lane.set(errorState(unknownStoreError(error), previous));
      }
    },
  };
}

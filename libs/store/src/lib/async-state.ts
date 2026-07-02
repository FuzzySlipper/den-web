import type { ClassifiedError, DenResult } from '@den-web/protocol';

export type AsyncState<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly previous?: T }
  | { readonly kind: 'data'; readonly value: T }
  | { readonly kind: 'error'; readonly error: ClassifiedError; readonly previous?: T };

export const idleState = <T>(): AsyncState<T> => ({ kind: 'idle' });

export const loadingState = <T>(previous?: T): AsyncState<T> => (
  previous === undefined ? { kind: 'loading' } : { kind: 'loading', previous }
);

export const dataState = <T>(value: T): AsyncState<T> => ({ kind: 'data', value });

export const errorState = <T>(error: ClassifiedError, previous?: T): AsyncState<T> => (
  previous === undefined ? { kind: 'error', error } : { kind: 'error', error, previous }
);

export function stateValue<T>(state: AsyncState<T>): T | undefined {
  if (state.kind === 'data') return state.value;
  return state.kind === 'loading' || state.kind === 'error' ? state.previous : undefined;
}

export function resultState<T>(result: DenResult<T>, previous?: T): AsyncState<T> {
  return result.ok ? dataState(result.value) : errorState(result.error, previous);
}

export function unknownStoreError(error: unknown): ClassifiedError {
  return { kind: 'unknown', message: error instanceof Error ? error.message : 'Unknown store failure' };
}

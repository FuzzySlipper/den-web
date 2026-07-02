export type ClassifiedError =
  | { readonly kind: 'network'; readonly message: string; readonly status?: number }
  | { readonly kind: 'auth'; readonly message: string; readonly status: 401 | 403 }
  | { readonly kind: 'not-found'; readonly message: string; readonly status: 404 }
  | { readonly kind: 'server'; readonly message: string; readonly status: number }
  | { readonly kind: 'invalid-response'; readonly message: string }
  | { readonly kind: 'unknown'; readonly message: string; readonly status?: number };

export interface DenResultOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface DenResultError {
  readonly ok: false;
  readonly error: ClassifiedError;
}

export type DenResult<T> = DenResultOk<T> | DenResultError;

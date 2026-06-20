/**
 * Den Core API types — compatibility barrel.
 *
 * The declarations live in domain modules under `./types/<domain>.ts`; this
 * barrel re-exports them so existing `@api/core/types` (and the broader
 * `@api/types`) imports keep working unchanged. Keep type modules pure — no
 * runtime logic.
 */
export * from './types/spaces';
export * from './types/tasks';
export * from './types/messages';
export * from './types/documents';
export * from './types/librarian';
export * from './types/agentStream';
export * from './types/dispatch';
export * from './types/workspaces';
export * from './types/git';
export * from './types/desktop';
export * from './types/workerPool';
export * from './types/notifications';
export * from './types/discussions';

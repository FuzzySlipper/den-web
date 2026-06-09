/**
 * Den Core API client — compatibility barrel.
 *
 * The endpoint wrappers live in domain modules (spaces, tasks, messages,
 * documents, librarian, agentStream, dispatch, workspaces, git, desktop,
 * discussions, notifications, workerPool), all built on the shared HTTP layer
 * in `./http`. This barrel re-exports their public surface so existing
 * `@api/core/client` and `@api/client` imports keep working unchanged.
 *
 * New code may import directly from the specific domain module for tighter
 * ownership, but is not required to.
 */

export { initClient, resetClient, getApiBases } from './http';

export * from './spaces';
export * from './tasks';
export * from './messages';
export * from './documents';
export * from './librarian';
export * from './agentStream';
export * from './dispatch';
export * from './workspaces';
export * from './git';
export * from './desktop';
export * from './discussions';
export * from './notifications';
export * from './workerPool';

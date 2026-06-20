import type {
  AppendDesktopSessionEventRequest,
  DesktopDiffSnapshotLatestResult,
  DesktopGitSnapshot,
  DesktopGitSnapshotLatestResult,
  DesktopSessionEvent,
  DesktopSessionSnapshot,
  ListDesktopSessionEventsOptions,
} from './types';
import { buildQuery, esc, get, post } from './http';

// Desktop-published snapshots

export interface ListDesktopSnapshotsOpts {
  taskId?: number;
  workspaceId?: string;
  sourceInstanceId?: string;
  rootPath?: string;
  state?: string;
  staleAfterSeconds?: number;
  limit?: number;
}

export function listDesktopGitSnapshots(projectId: string, opts: ListDesktopSnapshotsOpts = {}): Promise<DesktopGitSnapshot[]> {
  const q = buildQuery({
    taskId: opts.taskId,
    workspaceId: opts.workspaceId,
    sourceInstanceId: opts.sourceInstanceId,
    rootPath: opts.rootPath,
    state: opts.state,
    staleAfterSeconds: opts.staleAfterSeconds,
    limit: opts.limit,
  });
  return get(`/api/projects/${esc(projectId)}/desktop/git-snapshots${q}`);
}

export function getLatestDesktopGitSnapshot(projectId: string, opts: Omit<ListDesktopSnapshotsOpts, 'state' | 'limit'> = {}): Promise<DesktopGitSnapshotLatestResult> {
  const q = buildQuery({
    taskId: opts.taskId,
    workspaceId: opts.workspaceId,
    sourceInstanceId: opts.sourceInstanceId,
    rootPath: opts.rootPath,
    staleAfterSeconds: opts.staleAfterSeconds,
  });
  return get(`/api/projects/${esc(projectId)}/desktop/git-snapshots/latest${q}`);
}

export interface DesktopDiffSnapshotOpts extends Omit<ListDesktopSnapshotsOpts, 'state' | 'limit'> {
  path?: string;
  baseRef?: string;
  headRef?: string;
  staged?: boolean;
}

export function getLatestDesktopDiffSnapshot(projectId: string, opts: DesktopDiffSnapshotOpts = {}): Promise<DesktopDiffSnapshotLatestResult> {
  const q = buildQuery({
    taskId: opts.taskId,
    workspaceId: opts.workspaceId,
    sourceInstanceId: opts.sourceInstanceId,
    rootPath: opts.rootPath,
    path: opts.path,
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    staged: opts.staged,
  });
  return get(`/api/projects/${esc(projectId)}/desktop/diff-snapshots/latest${q}`);
}

export interface ListDesktopSessionSnapshotsOpts extends Omit<ListDesktopSnapshotsOpts, 'rootPath' | 'state'> {
  sessionId?: string;
}

export function listDesktopSessionSnapshots(projectId: string, opts: ListDesktopSessionSnapshotsOpts = {}): Promise<DesktopSessionSnapshot[]> {
  const q = buildQuery({
    taskId: opts.taskId,
    workspaceId: opts.workspaceId,
    sourceInstanceId: opts.sourceInstanceId,
    sessionId: opts.sessionId,
    staleAfterSeconds: opts.staleAfterSeconds,
    limit: opts.limit,
  });
  return get(`/api/projects/${esc(projectId)}/desktop/session-snapshots${q}`);
}

export function listDesktopSessionEvents(projectId: string, opts: ListDesktopSessionEventsOptions = {}): Promise<DesktopSessionEvent[]> {
  const eventTypes = Array.isArray(opts.eventTypes) ? opts.eventTypes.join(',') : opts.eventTypes;
  const q = buildQuery({
    taskId: opts.taskId,
    workspaceId: opts.workspaceId,
    sourceInstanceId: opts.sourceInstanceId,
    sessionId: opts.sessionId,
    eventTypes,
    limit: opts.limit,
  });
  return get(`/api/projects/${esc(projectId)}/desktop/session-events${q}`);
}

export function appendDesktopSessionEvent(
  projectId: string,
  event: AppendDesktopSessionEventRequest,
): Promise<DesktopSessionEvent> {
  return post(`/api/projects/${esc(projectId)}/desktop/session-events`, event);
}

export type {
  DesktopGitSnapshot,
  DesktopDiffSnapshot,
  DesktopSessionSnapshot,
  DesktopSessionEvent,
  AppendDesktopSessionEventRequest,
  ListDesktopSessionEventsOptions,
} from './types';

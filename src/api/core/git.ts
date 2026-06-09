import type { GitDiffResponse, GitFilesResponse, GitStatusResponse } from './types';
import { buildQuery, esc, get } from './http';

export function getProjectGitStatus(projectId: string): Promise<GitStatusResponse> {
  return get(`/api/projects/${esc(projectId)}/git/status`);
}

export interface GitFilesOpts {
  baseRef?: string;
  headRef?: string;
  includeUntracked?: boolean;
}

export function getProjectGitFiles(projectId: string, opts: GitFilesOpts = {}): Promise<GitFilesResponse> {
  const q = buildQuery({
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    includeUntracked: opts.includeUntracked,
  });
  return get(`/api/projects/${esc(projectId)}/git/files${q}`);
}

export interface GitDiffOpts {
  path?: string;
  baseRef?: string;
  headRef?: string;
  maxBytes?: number;
  staged?: boolean;
}

export function getProjectGitDiff(projectId: string, opts: GitDiffOpts = {}): Promise<GitDiffResponse> {
  const q = buildQuery({
    path: opts.path,
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    maxBytes: opts.maxBytes,
    staged: opts.staged,
  });
  return get(`/api/projects/${esc(projectId)}/git/diff${q}`);
}

export function getWorkspaceGitStatus(projectId: string, workspaceId: string): Promise<GitStatusResponse> {
  return get(`/api/projects/${esc(projectId)}/agent-workspaces/${esc(workspaceId)}/git/status`);
}

export function getWorkspaceGitFiles(projectId: string, workspaceId: string, opts: GitFilesOpts = {}): Promise<GitFilesResponse> {
  const q = buildQuery({
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    includeUntracked: opts.includeUntracked,
  });
  return get(`/api/projects/${esc(projectId)}/agent-workspaces/${esc(workspaceId)}/git/files${q}`);
}

export function getWorkspaceGitDiff(projectId: string, workspaceId: string, opts: GitDiffOpts = {}): Promise<GitDiffResponse> {
  const q = buildQuery({
    path: opts.path,
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    maxBytes: opts.maxBytes,
    staged: opts.staged,
  });
  return get(`/api/projects/${esc(projectId)}/agent-workspaces/${esc(workspaceId)}/git/diff${q}`);
}

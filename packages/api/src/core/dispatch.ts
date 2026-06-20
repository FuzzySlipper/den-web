import type { DispatchEntry } from './types';
import { buildQuery, get, post } from './http';

// Legacy dispatch helpers.
// The default dashboard intentionally does not import these; keep them available
// for historical dispatch detail links or a future explicit legacy/debug view.

export interface ListDispatchesOpts {
  projectId?: string;
  targetAgent?: string;
  status?: string;
}

export function listDispatches(opts: ListDispatchesOpts = {}): Promise<DispatchEntry[]> {
  const q = buildQuery({
    projectId: opts.projectId,
    targetAgent: opts.targetAgent,
    status: opts.status,
  });
  return get(`/api/dispatch${q}`);
}

export function getDispatch(dispatchId: number): Promise<DispatchEntry> {
  return get(`/api/dispatch/${dispatchId}`);
}

export function approveDispatch(dispatchId: number, decidedBy: string): Promise<DispatchEntry> {
  return post(`/api/dispatch/${dispatchId}/approve`, { decided_by: decidedBy });
}

export function rejectDispatch(dispatchId: number, decidedBy: string): Promise<DispatchEntry> {
  return post(`/api/dispatch/${dispatchId}/reject`, { decided_by: decidedBy });
}

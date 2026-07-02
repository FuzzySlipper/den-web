import type { DispatchEntry } from './types';

// Legacy dispatch helpers.
// The default dashboard intentionally does not import these; keep them available
// for historical dispatch detail links or a future explicit legacy/debug view.

export interface ListDispatchesOpts {
  projectId?: string;
  targetAgent?: string;
  status?: string;
}

export function listDispatches(opts: ListDispatchesOpts = {}): Promise<DispatchEntry[]> {
  void opts;
  return Promise.resolve([]);
}

export function getDispatch(dispatchId: number): Promise<DispatchEntry> {
  void dispatchId;
  return Promise.reject(new Error('Legacy dispatch detail is disabled after the den-core cutover.'));
}

export function approveDispatch(dispatchId: number, decidedBy: string): Promise<DispatchEntry> {
  void dispatchId;
  void decidedBy;
  return Promise.reject(new Error('Legacy dispatch approval is disabled after the den-core cutover.'));
}

export function rejectDispatch(dispatchId: number, decidedBy: string): Promise<DispatchEntry> {
  void dispatchId;
  void decidedBy;
  return Promise.reject(new Error('Legacy dispatch rejection is disabled after the den-core cutover.'));
}

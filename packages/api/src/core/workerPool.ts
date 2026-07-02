import type { StaleWorkerSweepResponse } from './types';

// Worker-pool stale diagnostics

export interface ListStaleWorkerConditionsOpts {
  projectId?: string | null;
  taskId?: number | null;
  ackThresholdMinutes?: number;
  runningThresholdMinutes?: number;
  reviewerThresholdMinutes?: number;
  orchestratorThresholdMinutes?: number;
  limit?: number;
}

export function listStaleWorkerConditions(opts: ListStaleWorkerConditionsOpts = {}): Promise<StaleWorkerSweepResponse> {
  void opts;
  return Promise.reject(new Error('Legacy worker-pool stale diagnostics are disabled after the den-core cutover.'));
}

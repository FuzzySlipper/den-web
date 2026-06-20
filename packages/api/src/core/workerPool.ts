import type { StaleWorkerSweepResponse } from './types';
import { buildQuery, get } from './http';

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
  const q = buildQuery({
    projectId: opts.projectId,
    taskId: opts.taskId,
    ackThresholdMinutes: opts.ackThresholdMinutes,
    runningThresholdMinutes: opts.runningThresholdMinutes,
    reviewerThresholdMinutes: opts.reviewerThresholdMinutes,
    orchestratorThresholdMinutes: opts.orchestratorThresholdMinutes,
    limit: opts.limit,
  });
  return get(`/api/worker-pool/stale${q}`);
}

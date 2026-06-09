export interface StaleWorkerCondition {
  stale_signature: string;
  classification: string;
  project_id: string;
  task_id?: number | null;
  run_id?: string | null;
  assignment_id?: number | null;
  review_round_id?: number | null;
  orchestrator_lease_id?: number | null;
  worker_identity?: string | null;
  profile_identity?: string | null;
  worker_role?: string | null;
  current_state?: string | null;
  last_activity_at?: string | null;
  staleness_deadline?: string | null;
  age?: string | null;
  state_reason: string;
  suggested_next_action: string;
  evidence_ids?: string | null;
  severity: string;
  detected_at?: string | null;
}

export interface StaleWorkerSweepResponse {
  stale_count: number;
  conditions: StaleWorkerCondition[];
  swept_at: string | null;
}

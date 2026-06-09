export type DispatchStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'expired';
export type DispatchTriggerType = 'message' | 'task_status';

export interface DispatchEntry {
  id: number;
  project_id: string;
  target_agent: string;
  status: DispatchStatus;
  trigger_type: DispatchTriggerType;
  trigger_id: number;
  task_id: number | null;
  summary: string | null;
  context_prompt: string | null;
  dedup_key: string;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  completed_at: string | null;
  decided_by: string | null;
  completed_by: string | null;
}

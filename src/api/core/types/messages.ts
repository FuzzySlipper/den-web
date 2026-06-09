export type MessageIntent =
  | 'general'
  | 'note'
  | 'status_update'
  | 'question'
  | 'answer'
  | 'handoff'
  | 'review_request'
  | 'review_feedback'
  | 'review_approval'
  | 'task_ready'
  | 'task_blocked'
  | 'notification';

export interface Message {
  id: number;
  project_id: string;
  task_id: number | null;
  thread_id: number | null;
  sender: string;
  content: string;
  intent: MessageIntent;
  metadata: unknown | null;
  created_at: string;
}

export interface Thread {
  root: Message;
  replies: Message[];
}

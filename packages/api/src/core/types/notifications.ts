/**
 * Canonical notification feed item from the Messages successor API.
 */
export interface NotificationFeedItem {
  id: number;
  project_id: string;
  task_id: number | null;
  thread_id: number | null;
  sender: string;
  content: string;
  metadata: Record<string, unknown> | null;
  urgency: string | null;
  is_read: boolean;
  created_at: string;
}

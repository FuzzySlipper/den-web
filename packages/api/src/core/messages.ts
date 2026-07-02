import type { Message, Thread } from './types';
import { buildQuery, esc } from './http';
import { successorApiUrl, successorGet } from './successorHttp';

export interface GetMessagesOpts {
  taskId?: number;
  since?: string;
  unreadFor?: string;
  limit?: number;
  intent?: string;
}

export function getMessage(projectId: string, messageId: number): Promise<Message | null> {
  void projectId;
  return fetch(successorApiUrl(`/messages/${messageId}`), { cache: 'no-store' })
    .then(res => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET message: ${res.status}`);
      return res.json();
    });
}

export function getMessages(projectId: string, opts: GetMessagesOpts = {}): Promise<Message[]> {
  const q = buildQuery({
    task_id: opts.taskId,
    since: opts.since,
    unread_for: opts.unreadFor,
    limit: opts.limit,
    intent: opts.intent,
  });
  return successorGet(`/projects/${esc(projectId)}/messages${q}`);
}

export function getThread(projectId: string, threadId: number): Promise<Thread> {
  return successorGet(`/projects/${esc(projectId)}/messages/threads/${threadId}`);
}

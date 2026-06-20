import type { Message, Thread } from './types';
import { buildQuery, coreApiUrl, esc, get } from './http';

export interface GetMessagesOpts {
  taskId?: number;
  since?: string;
  unreadFor?: string;
  limit?: number;
  intent?: string;
}

export function getMessage(projectId: string, messageId: number): Promise<Message | null> {
  return fetch(coreApiUrl(`/api/projects/${esc(projectId)}/messages/${messageId}`), { cache: 'no-store' })
    .then(res => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET message: ${res.status}`);
      return res.json();
    });
}

export function getMessages(projectId: string, opts: GetMessagesOpts = {}): Promise<Message[]> {
  const q = buildQuery({
    taskId: opts.taskId,
    since: opts.since,
    unreadFor: opts.unreadFor,
    limit: opts.limit,
    intent: opts.intent,
  });
  return get(`/api/projects/${esc(projectId)}/messages${q}`);
}

export function getThread(projectId: string, threadId: number): Promise<Thread> {
  return get(`/api/projects/${esc(projectId)}/messages/thread/${threadId}`);
}

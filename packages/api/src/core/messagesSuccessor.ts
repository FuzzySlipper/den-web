import { getConfig, normalizeApiBase } from '../config';
import type { Message } from './types';
import { buildQuery, esc } from './http';

export interface ListSuccessorMessagesOpts {
  taskId?: number;
  limit?: number;
  intent?: string;
}

const DEFAULT_MESSAGES_SUCCESSOR_API_BASE = '/api/v1';

let messagesSuccessorApiBase = normalizeApiBase(import.meta.env.VITE_MESSAGES_SUCCESSOR_API_BASE, DEFAULT_MESSAGES_SUCCESSOR_API_BASE);

export async function initMessagesSuccessorClient(): Promise<void> {
  const config = await getConfig();
  messagesSuccessorApiBase = config.messagesSuccessorApiBase;
}

export function resetMessagesSuccessorClient(): void {
  messagesSuccessorApiBase = normalizeApiBase(import.meta.env.VITE_MESSAGES_SUCCESSOR_API_BASE, DEFAULT_MESSAGES_SUCCESSOR_API_BASE);
}

function successorUrl(path: string): string {
  return `${messagesSuccessorApiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function listSuccessorMessages(projectId: string, opts: ListSuccessorMessagesOpts = {}): Promise<Message[]> {
  const q = buildQuery({
    task_id: opts.taskId,
    limit: opts.limit,
    intent: opts.intent,
  });
  const requestUrl = successorUrl(`/projects/${esc(projectId)}/messages${q}`);
  const res = await fetch(requestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${requestUrl}: ${res.status}`);
  return res.json();
}

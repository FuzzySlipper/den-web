import type { Channel } from '../../api/types';
import { ensureAgentCommonsChannel, listChannels } from '../../api/client';
import { isWorkerPoolChannel } from './channelRouting';

/** Resolve the shared agent-commons system channel, creating it if absent. */
export async function resolveAgentCommonsChannel(): Promise<Channel> {
  const systemChannels = await listChannels({ kind: 'system', limit: 100 });
  const existing = systemChannels.find(channel => channel.slug === 'agent-commons');
  return existing ?? ensureAgentCommonsChannel();
}

/** Resolve the shared worker-pool system channel, or null when none exists. */
export async function resolveWorkerPoolChannel(): Promise<Channel | null> {
  const systemChannels = await listChannels({ kind: 'system', limit: 100 });
  return systemChannels.find(channel => isWorkerPoolChannel(channel)) ?? null;
}

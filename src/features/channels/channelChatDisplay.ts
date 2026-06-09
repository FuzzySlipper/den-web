import type { Channel, ChannelMessage } from '../../api/types';
import { projectChannelScopeLabel } from './channelRouting';

/**
 * Pure display helpers for channel chat surfaces, shared by the channel chat
 * panel and the focused session view.
 *
 * The two surfaces historically used slightly different fallbacks when neither
 * a channel nor a project is available, so the fallback is an explicit
 * parameter rather than a hidden constant: the channel panel treats the empty
 * state as Agent Commons, while the session view prompts to select a project.
 */
export function channelLabel(
  channel: Channel | null,
  projectId: string | null,
  fallback = '#agent-commons',
): string {
  if (channel) return `#${channel.slug}`;
  if (projectId) return `#project-${projectId}`;
  return fallback;
}

/** Channel label decorated with its project scope, used in the channel picker. */
export function channelOptionLabel(channel: Channel, projectId: string | null): string {
  const base = channelLabel(channel, projectId);
  const scope = projectChannelScopeLabel(channel);
  if (scope) return `${base} — ${scope}`;
  return base;
}

/** Human-facing sender for a channel message, falling back to the sender type. */
export function messageSender(message: ChannelMessage): string {
  return message.senderIdentity || message.senderType;
}

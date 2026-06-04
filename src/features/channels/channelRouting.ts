import type { Channel, ChannelProjectLink } from '../../api/types';

export function parseChannelSettings(settingsJson: string | null | undefined): Record<string, unknown> {
  if (!settingsJson) return {};
  try {
    const parsed = JSON.parse(settingsJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function channelRole(channel: Channel | null | undefined): string | null {
  const role = parseChannelSettings(channel?.settingsJson).channelRole;
  return typeof role === 'string' && role.trim() ? role.trim() : null;
}

export function isAgentCommonsChannel(channel: Channel | null | undefined): boolean {
  return channel?.slug === 'agent-commons' || channelRole(channel) === 'agent_commons';
}

export function isDenSystemOpsChannel(channel: Channel | null | undefined): boolean {
  return channel?.slug === 'den-system' || channelRole(channel) === 'den_system_ops';
}

export function isSharedProjectChannel(channel: Channel | null | undefined): boolean {
  if (!channel) return false;
  return channel.projectId == null && channel.kind === 'system' && !isAgentCommonsChannel(channel);
}

export function dedupeChannels(channels: Channel[]): Channel[] {
  const seen = new Set<number>();
  const unique: Channel[] = [];
  for (const channel of channels) {
    if (seen.has(channel.id)) continue;
    seen.add(channel.id);
    unique.push(channel);
  }
  return unique;
}

export function selectProjectChannels(
  projectId: string | null,
  projectChannels: Channel[],
  linkedChannels: Channel[],
  agentCommons: Channel,
): Channel[] {
  if (!projectId) return [agentCommons];

  const activeProjectChannels = projectChannels.filter(channel => channel.visibility !== 'archived');
  if (linkedChannels.length === 0) {
    return dedupeChannels([...activeProjectChannels, agentCommons]);
  }

  // Once a project has an explicit shared linked channel (for example #den-system),
  // old #project-den-* default channels are legacy lanes. Keep non-default ad-hoc
  // project channels visible, but make the shared lane the primary/default choice.
  const nonDefaultProjectChannels = activeProjectChannels.filter(channel => channel.kind !== 'project_default');
  return dedupeChannels([...linkedChannels, ...nonDefaultProjectChannels, agentCommons]);
}

export function preferredProjectChannel(channels: Channel[], projectId: string | null): Channel | undefined {
  if (!projectId) {
    return channels.find(isAgentCommonsChannel) ?? channels[0];
  }
  return channels.find(isDenSystemOpsChannel)
    ?? channels.find(isSharedProjectChannel)
    ?? channels.find(candidate => candidate.kind === 'project_default')
    ?? channels[0];
}

export function messageProjectAttribution(
  message: { sourceProjectId?: string | null; targetProjectId?: string | null; metadataJson?: string | null },
): string | null {
  const direct = (message.targetProjectId?.trim() || message.sourceProjectId?.trim() || '').trim();
  if (direct) return direct;
  if (!message.metadataJson) return null;
  try {
    const metadata = JSON.parse(message.metadataJson) as Record<string, unknown>;
    const fromMetadata = metadata.targetProjectId ?? metadata.sourceProjectId ?? metadata.projectId;
    return typeof fromMetadata === 'string' && fromMetadata.trim() ? fromMetadata.trim() : null;
  } catch {
    return null;
  }
}

export function linkedProjectIds(links: ChannelProjectLink[]): string[] {
  return Array.from(new Set(links.map(link => link.projectId).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

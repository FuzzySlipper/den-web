import type { Channel } from '@den-web/api/types';

export function membershipLookupForChannel(channel: Channel | null | undefined): { channelId?: number; projectId?: string } {
  if (!channel) return {};
  if (channel.projectId && channel.kind === 'project_default') return { projectId: channel.projectId };
  return { channelId: channel.id };
}

export function membershipWriteChannelId(channel: Channel | null | undefined, membershipChannelId: number | null | undefined): number | null {
  if (!channel) return null;
  return membershipChannelId && membershipChannelId > 0 ? membershipChannelId : channel.id;
}

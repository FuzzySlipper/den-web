import type {
  AgentOverviewItem,
  ChannelMembershipOverviewDto,
  DeliveryOverviewDto,
  GatewayAdapterInstanceDto,
} from '@den-web/api/types';

export interface ProjectAttributionRecord {
  targetProjectId?: string | null;
  sourceProjectId?: string | null;
  projectId?: string | null;
  metadataJson?: string | null;
}

const STALE_CONTROL_CHANNEL_ID = 5;

function normalizedProjectId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function projectAttributionFromRecord(record: ProjectAttributionRecord | null | undefined): string | null {
  if (!record) return null;

  const direct = normalizedProjectId(record.targetProjectId)
    ?? normalizedProjectId(record.sourceProjectId)
    ?? normalizedProjectId(record.projectId);
  if (direct) return direct;

  if (!record.metadataJson) return null;
  try {
    const metadata = JSON.parse(record.metadataJson) as Record<string, unknown>;
    return normalizedProjectId(metadata.targetProjectId)
      ?? normalizedProjectId(metadata.sourceProjectId)
      ?? normalizedProjectId(metadata.projectId);
  } catch {
    return null;
  }
}

export function deliveryProjectAttribution(delivery: DeliveryOverviewDto | null | undefined): string | null {
  return projectAttributionFromRecord(delivery as ProjectAttributionRecord | null | undefined);
}

export function membershipLaneLabel(membership: ChannelMembershipOverviewDto, currentProjectId?: string | null): string {
  if (membership.channelId === STALE_CONTROL_CHANNEL_ID) return 'stale control-channel binding';
  if (membership.projectId) {
    return membership.projectId === currentProjectId ? 'current project channel' : 'project channel';
  }
  if (membership.channelKind === 'project_default') return 'project lane';
  if (membership.channelKind === 'system') return 'shared worker/control channel';
  return 'channel member';
}

export function adapterIsStaleControlChannelBinding(adapter: GatewayAdapterInstanceDto | null | undefined): boolean {
  if (!adapter?.isStale) return false;
  const metadata = adapter.metadata ?? {};
  const channelId = metadata.channelId ?? metadata.channel_id ?? metadata.channel;
  return String(channelId ?? '').trim() === String(STALE_CONTROL_CHANNEL_ID);
}

export function bindingHasStaleControlChannel(adapterInstances: GatewayAdapterInstanceDto[] | null | undefined): boolean {
  return (adapterInstances ?? []).some(adapterIsStaleControlChannelBinding);
}

export function agentProjectAttributions(agent: Pick<AgentOverviewItem, 'memberships' | 'deliverySummaries' | 'recentActivity'>): string[] {
  const ids = new Set<string>();
  for (const membership of agent.memberships ?? []) {
    const id = normalizedProjectId(membership.projectId);
    if (id) ids.add(id);
  }
  for (const delivery of agent.deliverySummaries ?? []) {
    const id = deliveryProjectAttribution(delivery);
    if (id) ids.add(id);
  }
  for (const activity of agent.recentActivity ?? []) {
    const id = projectAttributionFromRecord(activity as ProjectAttributionRecord);
    if (id) ids.add(id);
  }
  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

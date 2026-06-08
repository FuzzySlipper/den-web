import { describe, expect, it } from 'vitest';
import type { AgentOverviewItem, ChannelMembershipOverviewDto, DeliveryOverviewDto, GatewayAdapterInstanceDto } from '../../api/types';
import {
  adapterIsStaleControlChannelBinding,
  agentProjectAttributions,
  deliveryProjectAttribution,
  membershipLaneLabel,
  projectAttributionFromRecord,
} from './agentAttribution';

function delivery(overrides: Partial<DeliveryOverviewDto>): DeliveryOverviewDto {
  return {
    deliveryRequestId: 'delivery-1',
    deliveryMode: 'worker_pool',
    deliveryState: 'delivering',
    requestedAt: null,
    targetAgentIdentity: 'worker-1',
    channelSlug: 'worker-pool',
    channelId: 604,
    projectId: null,
    taskId: null,
    isTerminal: false,
    latestActivityAt: null,
    evidenceSummary: null,
    state: 'delivering',
    status: 'delivering',
    terminal: false,
    createdAt: null,
    updatedAt: null,
    summary: null,
    ...overrides,
  };
}

function membership(overrides: Partial<ChannelMembershipOverviewDto>): ChannelMembershipOverviewDto {
  return {
    channelId: 20,
    channelSlug: 'project-den-web',
    channelDisplayName: 'den-web',
    channelKind: 'project_default',
    projectId: 'den-web',
    membershipStatus: 'active',
    wakePolicy: 'mentions_only',
    canSend: true,
    settingsLabel: null,
    ...overrides,
  };
}

describe('agent attribution helpers', () => {
  it('prefers targetProjectId/sourceProjectId/projectId for worker-pool project attribution', () => {
    expect(projectAttributionFromRecord({ targetProjectId: 'den-web', sourceProjectId: 'den-core', projectId: 'den-router' })).toBe('den-web');
    expect(projectAttributionFromRecord({ sourceProjectId: 'den-core', projectId: 'den-router' })).toBe('den-core');
    expect(projectAttributionFromRecord({ projectId: 'den-router' })).toBe('den-router');
    expect(projectAttributionFromRecord({ metadataJson: '{"targetProjectId":"den-web","projectId":"den-core"}' })).toBe('den-web');
  });

  it('surfaces project attribution from worker-pool delivery summaries when no channel membership exists', () => {
    const agent = {
      memberships: null,
      deliverySummaries: [delivery({ targetProjectId: 'den-web' })],
      recentActivity: null,
    } as AgentOverviewItem;

    expect(agentProjectAttributions(agent)).toEqual(['den-web']);
    expect(deliveryProjectAttribution(agent.deliverySummaries![0])).toBe('den-web');
  });

  it('distinguishes project-channel membership from shared worker/control channels', () => {
    expect(membershipLaneLabel(membership({ projectId: 'den-web' }), 'den-web')).toBe('current project channel');
    expect(membershipLaneLabel(membership({ channelKind: 'system', projectId: null, channelSlug: 'worker-pool' }), 'den-web')).toBe('shared worker/control channel');
  });

  it('marks stale channel_id=5 bindings as hidden control-channel remnants, not visible residency', () => {
    const adapter: GatewayAdapterInstanceDto = {
      adapterKind: 'gateway',
      adapterInstanceId: 'old-binding',
      status: 'stale',
      lastSeenAt: null,
      expiresAt: null,
      isStale: true,
      stalenessReason: 'expired heartbeat',
      metadata: { channel_id: '5' },
    };

    expect(adapterIsStaleControlChannelBinding(adapter)).toBe(true);
    expect(membershipLaneLabel(membership({ channelId: 5, channelKind: 'system', projectId: null }), 'den-web')).toBe('stale control-channel binding');
  });
});

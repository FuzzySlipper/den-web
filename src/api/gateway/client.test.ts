import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFleetOps, getFleetOpsRun, getWorkerPoolLobbyPresence, postFleetOpsActionRun, postGatewayDirectAgentMessage, reinitHostBase } from './client';

describe('postGatewayDirectAgentMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the canonical Channels direct-agent-events route instead of the retired Gateway compatibility route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'recorded',
        eventId: 4044,
        channelId: 584,
        requestId: 'direct-agent-message:584:den-mcp-planner:req-1',
        memberIdentity: 'den-mcp-planner',
        wakePolicy: 'subscription',
        eventUrl: '/api/direct-agent-events/4044',
        eventsUrl: '/api/direct-agent-events?channelId=584&afterId=4043&limit=10',
        evidenceSummary: 'Direct agent wake_event recorded as event 4044.',
        deliveryStatus: 'recorded_pending_claim',
        claimStatus: 'unclaimed',
        completionStatus: 'pending',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postGatewayDirectAgentMessage({
      channelId: 584,
      projectId: 'den-web',
      memberIdentity: 'den-mcp-planner',
      senderIdentity: 'patch',
      body: '@den-mcp-planner please check this',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/direct-agent-events', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        channelId: 584,
        projectId: 'den-web',
        memberIdentity: 'den-mcp-planner',
        senderIdentity: 'patch',
        body: '@den-mcp-planner please check this',
      }),
    }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/gateway/direct-agent-messages'), expect.anything());
    expect(result).toMatchObject({
      status: 'recorded',
      deliveryStatus: 'recorded_pending_claim',
      messageId: 4044,
      gatewayMessageUrl: '/api/direct-agent-events/4044',
      gatewayEventsUrl: '/api/direct-agent-events?channelId=584&afterId=4043&limit=10',
    });
  });
});

describe('getWorkerPoolLobbyPresence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps the live Channels worker-pool lobby response shape before the UI renders it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        lobbySlug: 'worker-pool',
        lobbyDisplayName: '#worker-pool',
        lobbyChannelId: 604,
        totalMembers: 2,
        availableCount: 2,
        byRole: [
          { role: 'reviewer', profile: 'spawned-reviewer', count: 1, members: [] },
          { role: 'validator', profile: 'spawned-validator', count: 1, members: [] },
        ],
        members: [
          {
            id: 1,
            channelId: 604,
            memberIdentity: 'spawned-reviewer',
            agentInstanceId: 'hermes:den-k8:spawned-reviewer:pool-reviewer-01:live',
            poolMemberId: 'pool-reviewer-01',
            profile: 'spawned-reviewer',
            role: 'reviewer',
            status: 'idle',
            currentAssignmentId: null,
            currentTaskId: null,
            currentProjectId: null,
            lastActivityAt: null,
            createdAt: '2026-05-30 11:16:45',
            updatedAt: '2026-05-30 11:16:45',
          },
          {
            id: 2,
            channelId: 604,
            memberIdentity: 'spawned-validator',
            agentInstanceId: 'hermes:den-k8:spawned-validator:pool-validator-01:live',
            poolMemberId: 'pool-validator-01',
            profile: 'spawned-validator',
            role: 'validator',
            status: 'idle',
            currentAssignmentId: null,
            currentTaskId: null,
            currentProjectId: null,
            lastActivityAt: null,
            createdAt: '2026-05-30 11:16:45',
            updatedAt: '2026-05-30 11:16:45',
          },
        ],
      }),
    }));

    const presence = await getWorkerPoolLobbyPresence();

    expect(presence).toMatchObject({
      channelId: 604,
      availableCount: 2,
      totalCandidateCount: 2,
      roleCounts: { reviewer: 1, validator: 1 },
    });
    expect(presence.members).toHaveLength(2);
    expect(presence.members[0]).toMatchObject({
      identity: 'spawned-reviewer',
      role: 'reviewer',
      availabilityState: 'idle',
      activeAssignmentCount: 0,
      completedAssignmentCount: 0,
      activeAssignmentIds: [],
      lastSeenAt: '2026-05-30 11:16:45',
      isLegacyPilot: false,
      isQuarantined: false,
    });
  });

  it('maps leased assignment ids to the trace-friendly frontend shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        lobbyChannelId: 604,
        byRole: [{ role: 'coder', count: 1, members: [] }],
        members: [{
          memberIdentity: 'spawned-coder',
          role: 'coder',
          status: 'leased',
          currentAssignmentId: 1840,
          updatedAt: '2026-06-02 12:00:00',
        }],
      }),
    }));

    const presence = await getWorkerPoolLobbyPresence();

    expect(presence.availableCount).toBe(0);
    expect(presence.totalCandidateCount).toBe(1);
    expect(presence.members[0]).toMatchObject({
      identity: 'spawned-coder',
      availabilityState: 'leased',
      statusDetail: 'Assignment 1840',
      activeAssignmentCount: 1,
      activeAssignmentIds: ['1840'],
    });
  });
});

describe('Den Host FleetOps client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    reinitHostBase('/den-host-api');
  });

  it('routes FleetOps overview reads through the Den Host API base', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ service: 'den-host', generatedAt: '2026-06-06T00:00:00Z', serviceUnits: [], actions: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    reinitHostBase('/custom-den-host');

    await getFleetOps();

    expect(fetchMock).toHaveBeenCalledWith('/custom-den-host/fleet-ops');
  });

  it('routes FleetOps action runs and run details through Den Host, not Gateway', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: 'run-1', actionId: 'fleet-status', status: 'completed', createdAt: '2026-06-06T00:00:00Z', wasDryRun: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ run: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await postFleetOpsActionRun({ actionId: 'fleet-status', dryRun: true });
    await getFleetOpsRun('run-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/den-host-api/fleet-ops/actions/fleet-status/runs', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/den-host-api/fleet-ops/runs/run-1');
  });
});

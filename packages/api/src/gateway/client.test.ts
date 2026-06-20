import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getFleetOps,
  getFleetOpsRun,
  getObservationAgentOverview,
  getWorkerPoolLobbyPresence,
  listObservationActiveWork,
  listObservationLane,
  postFleetOpsActionRun,
  postGatewayDirectAgentMessage,
  reinitHostBase,
} from './client';

describe('postGatewayDirectAgentMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates conversation evidence then delivery successor intent instead of legacy direct-agent-events', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 4044,
          channel_id: 584,
          dedupe_key: 'conversation-direct-agent-message:584:den-mcp-planner:req1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 812,
          state: 'pending',
          idempotency_key: 'direct-agent-message:584:den-mcp-planner:req1',
          created_at: '2026-06-20T00:00:00Z',
          expires_at: '2026-06-20T00:05:00Z',
          channel_message_id: 4044,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'req-1' });

    const result = await postGatewayDirectAgentMessage({
      channelId: 584,
      projectId: 'den-web',
      memberIdentity: 'den-mcp-planner',
      senderIdentity: 'patch',
      body: '@den-mcp-planner please check this',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/conversation/channels/584/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-Den-Migrated-Functions': 'true',
        'Idempotency-Key': 'conversation-direct-agent-message:584:den-mcp-planner:req1',
      }),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      sender_identity: 'patch',
      body: '@den-mcp-planner please check this',
      message_kind: 'direct_agent_wake',
      source_kind: 'den_web_direct_agent',
      profile_identity: 'den-mcp-planner',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/delivery/intents', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Den-Migrated-Functions': 'true' }),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      member_identity: 'den-mcp-planner',
      profile_identity: 'den-mcp-planner',
      idempotency_key: 'direct-agent-message:584:den-mcp-planner:req1',
      source_ref: '/api/v1/conversation/channels/584/messages/4044',
      channel_message_id: 4044,
    });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/direct-agent-events'), expect.anything());
    expect(result).toMatchObject({
      status: 'pending',
      deliveryStatus: 'pending',
      messageId: 4044,
      requestId: 'direct-agent-message:584:den-mcp-planner:req1',
      gatewayMessageUrl: '/api/v1/conversation/channels/584/messages?after_id=4043&limit=10',
      gatewayEventsUrl: '/api/v1/delivery/intents/812',
    });
  });

  it('can create a delivery intent without channel evidence for DM sends', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 900,
        state: 'pending',
        idempotency_key: 'direct-agent-message:den-web:den-mcp-planner:req2',
        created_at: '2026-06-20T00:00:00Z',
        expires_at: '2026-06-20T00:05:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'req-2' });

    const result = await postGatewayDirectAgentMessage({
      projectId: 'den-web',
      memberIdentity: 'den-mcp-planner',
      senderIdentity: 'patch',
      body: 'hello DM',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/delivery/intents', expect.objectContaining({
      method: 'POST',
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      member_identity: 'den-mcp-planner',
      idempotency_key: 'direct-agent-message:den-web:den-mcp-planner:req2',
    });
    expect(result).toMatchObject({
      status: 'pending',
      messageId: 900,
      channelId: 0,
      gatewayEventsUrl: '/api/v1/delivery/intents/900',
    });
  });

  it('includes successor error body when delivery creation is rejected', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 4044,
          channel_id: 584,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('{"code":"runtime_not_alive","detail":"Target runtime is stale."}'),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(postGatewayDirectAgentMessage({
      channelId: 642,
      projectId: 'pi-crew',
      memberIdentity: 'pool-reviewer-03',
      senderIdentity: 'patch',
      body: '@pool-reviewer-03 please review this',
    })).rejects.toThrow(/runtime_not_alive/);
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

describe('Observation API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes lane, agent overview, and active-work reads through Gateway observation paths', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ events: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ agent_id: 'den-mcp-runner', runtime_instances: [], active_work: [], activity_events: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await listObservationLane({ limit: 5 });
    await getObservationAgentOverview('den-mcp-runner');
    await listObservationActiveWork();

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/observation/lane?limit=5', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/observation/agents/den-mcp-runner/overview', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/observation/active-work', { cache: 'no-store' });
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

    expect(fetchMock).toHaveBeenCalledWith('/custom-den-host/fleet-ops', { cache: 'no-store' });
  });

  it('passes cache: no-store to Channels GET calls so polling bypasses the browser cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        lobbyChannelId: 604,
        byRole: [],
        members: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await getWorkerPoolLobbyPresence();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worker-pool/lobby/presence',
      { cache: 'no-store' },
    );
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
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/den-host-api/fleet-ops/runs/run-1', { cache: 'no-store' });
  });
});

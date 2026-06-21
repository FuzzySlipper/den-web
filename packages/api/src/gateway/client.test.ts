import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentDetail,
  getAssignmentTrace,
  getObservationAgentOverview,
  getWorkerPoolLobbyPresence,
  listAgentsOverview,
  listObservationActiveWork,
  listObservationLane,
  postGatewayDirectAgentMessage,
} from './client';

describe('postGatewayDirectAgentMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates conversation evidence then delivery successor intent instead of legacy direct-agent-events', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 31, project_id: 'den-web', kind: 'project_default' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 4044,
          channel_id: 31,
          dedupe_key: 'conversation-direct-agent-message:584:den-mcp-planner:req1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          runtime_instances: [{ instance_id: 'den-mcp-planner@live' }],
          activity_events: [],
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

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/conversation/channels?project_id=den-web&kind=project_default&limit=5', {
      cache: 'no-store',
      headers: { 'X-Den-Migrated-Functions': 'true' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/conversation/channels/31/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-Den-Migrated-Functions': 'true',
        'Idempotency-Key': 'conversation-direct-agent-message:584:den-mcp-planner:req1',
      }),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      sender_identity: 'patch',
      body: '@den-mcp-planner please check this',
      message_kind: 'direct_agent_wake',
      source_kind: 'den_web_direct_agent',
      profile_identity: 'den-mcp-planner',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/observation/agents/den-mcp-planner/overview', {
      cache: 'no-store',
      headers: { 'X-Den-Migrated-Functions': 'true' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/delivery/intents', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Den-Migrated-Functions': 'true' }),
    }));
    const deliveryBody = JSON.parse(String(fetchMock.mock.calls[3][1]?.body));
    expect(deliveryBody).toMatchObject({
      target_identity: {
        profile: 'den-mcp-planner',
        instance_id: 'den-mcp-planner@live',
      },
      idempotency_key: 'direct-agent-message:584:den-mcp-planner:req1',
      source_ref: '/api/v1/conversation/channels/31/messages/4044',
      channel_message_id: 4044,
    });
    expect(deliveryBody).not.toHaveProperty('member_identity');
    expect(deliveryBody).not.toHaveProperty('agent_instance_id');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/direct-agent-events'), expect.anything());
    expect(result).toMatchObject({
      status: 'pending',
      deliveryStatus: 'pending',
      messageId: 4044,
      channelId: 31,
      requestId: 'direct-agent-message:584:den-mcp-planner:req1',
      gatewayMessageUrl: '/api/v1/conversation/channels/31/messages?after_id=4043&limit=10',
      gatewayEventsUrl: '/api/v1/delivery/intents/812',
    });
  });

  it('can create a delivery intent without channel evidence for DM sends', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runtime_instances: [], activity_events: [{ agent_identity: { instance_id: 'den-mcp-planner@recent' } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 900,
          state: 'pending',
          idempotency_key: 'direct-agent-message:direct:den-mcp-planner:req2',
          created_at: '2026-06-20T00:00:00Z',
          expires_at: '2026-06-20T00:05:00Z',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'req-2' });

    const result = await postGatewayDirectAgentMessage({
      memberIdentity: 'den-mcp-planner',
      senderIdentity: 'patch',
      body: 'hello DM',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/delivery/intents', expect.objectContaining({
      method: 'POST',
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      target_identity: {
        profile: 'den-mcp-planner',
        instance_id: 'den-mcp-planner@recent',
      },
      idempotency_key: 'direct-agent-message:direct:den-mcp-planner:req2',
    });
    expect(result).toMatchObject({
      status: 'pending',
      messageId: 900,
      channelId: 0,
      gatewayEventsUrl: '/api/v1/delivery/intents/900',
    });
  });

  it('fails locally instead of posting an invalid profile-only delivery intent', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runtime_instances: [], activity_events: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(postGatewayDirectAgentMessage({
      memberIdentity: 'spawned-coder',
      senderIdentity: 'patch',
      body: 'hello',
    })).rejects.toThrow(/No concrete delivery target instance/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/agents/overview'), expect.anything());
  });

  it('accepts the live bare-array conversation channel listing shape', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 31, project_id: 'den-web', kind: 'project_default' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 4051, channel_id: 31 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runtime_instances: [{ instance_id: 'den-mcp-planner@live' }], activity_events: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 813,
          state: 'pending',
          idempotency_key: 'direct-agent-message:584:den-mcp-planner:req-array',
          created_at: '2026-06-20T00:00:00Z',
          expires_at: '2026-06-20T00:05:00Z',
          channel_message_id: 4051,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'req-array' });

    const result = await postGatewayDirectAgentMessage({
      channelId: 584,
      projectId: 'den-web',
      memberIdentity: 'den-mcp-planner',
      senderIdentity: 'patch',
      body: '@den-mcp-planner live shape check',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/conversation/channels/31/messages', expect.anything());
    expect(result).toMatchObject({
      messageId: 4051,
      channelId: 31,
      gatewayEventsUrl: '/api/v1/delivery/intents/813',
    });
  });

  it('includes successor error body when delivery creation is rejected', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 31, project_id: 'pi-crew', kind: 'project_default' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 4044,
          channel_id: 31,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runtime_instances: [{ instance_id: 'pool-reviewer-03@live' }], activity_events: [] }),
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

  it('builds the agents overview from Observation successor reads instead of den-channels aggregates', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          events: [{
            event_id: 'evt-1',
            source_domain: 'observation',
            event_type: 'agent_activity',
            agent_identity: { profile: 'den-web-runner', instance_id: 'inst-1' },
            runtime_instance_id: 'inst-1',
            payload: { summary: 'Working task', severity: 'info', visibility: 'channel', work_ref: { project_id: 'den-web', task_id: 3076 } },
            display_only: true,
            created_at: '2026-06-21T00:00:00Z',
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [{
            intent_id: 10,
            target_identity: { profile: 'den-web-runner', instance_id: 'inst-1' },
            state: 'pending',
            source_ref: 'test',
            channel_message_id: 20,
            created_at: '2026-06-21T00:00:01Z',
          }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const overview = await listAgentsOverview({ projectId: 'den-web', activityLimit: 5 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/observation/lane?limit=5', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/observation/active-work', { cache: 'no-store' });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/agents/overview'), expect.anything());
    expect(overview.agents[0]).toMatchObject({
      agentIdentity: 'den-web-runner',
      operatorStatus: 'active',
      flags: ['observation_only'],
      summary: { activeDeliveryCount: 1, recentActivityCount: 1 },
    });
    expect(overview.sourceHealth.channels?.status).toBe('degraded');
  });

  it('maps agent detail from Observation and degrades assignment trace without legacy trace calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        agent_id: 'den-web-runner',
        runtime_instances: [{ runtime_instance_id: 'inst-1', profile_identity: 'den-web-runner', host: 'den-srv', state: 'running', started_at: '2026-06-21T00:00:00Z', display_only: true }],
        active_work: [],
        activity_events: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getAgentDetail('den-web-runner');
    const trace = await getAssignmentTrace('assignment-1', { projectId: 'den-web' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/observation/agents/den-web-runner/overview', { cache: 'no-store' });
    expect(detail).toMatchObject({
      agentIdentity: 'den-web-runner',
      operatorStatus: 'observed',
      flags: expect.arrayContaining(['observation_only']),
    });
    expect(trace).toMatchObject({
      assignmentId: 'assignment-1',
      projectId: 'den-web',
      coreAvailability: 'core_unavailable',
      gatewayAvailability: 'gateway_unavailable',
      summary: expect.stringContaining('successor is not available yet'),
    });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/assignments/assignment-1/trace'), expect.anything());
  });
});

describe('Gateway polling client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

});

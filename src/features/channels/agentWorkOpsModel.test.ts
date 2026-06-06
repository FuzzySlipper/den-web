import { describe, expect, it } from 'vitest';
import type { AgentWorkCurrentItem, AgentWorkCurrentResponse, AgentWorkEventsResponse, ChannelActivityEvent, DirectAgentEvent } from '../../api/types';
import { buildAgentWorkOpsModel } from './agentWorkOpsModel';

function currentItem(overrides: Partial<AgentWorkCurrentItem>): AgentWorkCurrentItem {
  return {
    agentIdentity: 'spawned-coder',
    workerRunId: 'piw_run_1234567890',
    projectId: 'den-web',
    taskId: 1978,
    assignmentId: '312',
    workerRole: 'coder',
    profileIdentity: null,
    poolMemberId: null,
    agentInstanceId: null,
    state: 'running',
    stateReason: 'Lifecycle running',
    lastActivityAt: '2026-06-06 01:00:00',
    stalenessDeadline: null,
    lastActivityEventId: 10,
    evidenceLink: '/api/channels/604/activity-events?limit=10',
    evidenceProvenance: ['agent_work_lifecycle'],
    evidenceLinks: ['/api/channels/604/activity-events?limit=10'],
    sessionId: null,
    deliveryRequestId: '2801',
    directAgentEventId: null,
    hostId: null,
    processId: null,
    currentWorkState: 'running',
    stalenessDiagnostic: null,
    flags: [],
    ...overrides,
  };
}

function currentResponse(items: AgentWorkCurrentItem[], migrationNote: string | null = null): AgentWorkCurrentResponse {
  return {
    items,
    totalCount: items.length,
    generatedAt: '2026-06-06T01:00:00Z',
    stalenessSummary: { totalTracked: items.length, stale: items.filter(item => item.stalenessDiagnostic).length, staleDiagnostics: [] },
    migrationNote,
  };
}

function lifecycleResponse(items: AgentWorkEventsResponse['items']): AgentWorkEventsResponse {
  return { items, count: items.length, channelId: 604, filters: {} };
}

function activityEvent(overrides: Partial<ChannelActivityEvent>): ChannelActivityEvent {
  return {
    id: 1,
    channelId: 604,
    projectId: 'den-web',
    agentIdentity: 'spawned-reviewer',
    deliveryRequestId: '2801',
    hermesSessionKey: null,
    displayBlockId: null,
    parentHermesSessionKey: null,
    parentAgentIdentity: null,
    workerRunId: 'piw_review',
    workerRole: 'reviewer',
    taskId: 1978,
    threadId: null,
    anchorMessageId: null,
    eventType: 'tool_call_completed',
    status: 'completed',
    deliveryStage: 'progress',
    terminal: false,
    sequence: 1,
    updateVersion: 1,
    title: 'mcp_den_post_worker_completion_packet',
    summary: 'posted packet',
    previewJson: null,
    metadataJson: null,
    dedupeKey: null,
    finalChannelMessageId: null,
    createdAt: '2026-06-06 01:01:00',
    updatedAt: '2026-06-06 01:01:00',
    ...overrides,
  };
}

function directEvent(overrides: Partial<DirectAgentEvent>): DirectAgentEvent {
  return {
    id: 2801,
    channelId: 604,
    messageKind: 'human_text',
    senderType: 'user',
    senderIdentity: 'den-mcp-runner',
    sourceKind: 'wake_event',
    sourceId: 'direct-agent-message:604:spawned-coder:abc',
    sourceProjectId: null,
    targetProjectId: 'den-web',
    targetTaskId: 1978,
    assignmentId: null,
    workerRunId: null,
    workerRole: null,
    profileIdentity: null,
    poolMemberId: null,
    agentInstanceId: null,
    sessionOwnerId: null,
    sessionId: null,
    deliveryRequestId: null,
    dedupeKey: null,
    deepLink: null,
    summary: 'Direct agent request recorded',
    body: 'please work',
    createdAt: '2026-06-06 01:02:00',
    ...overrides,
  };
}

describe('buildAgentWorkOpsModel', () => {
  it('shows non-empty canonical lifecycle current rows', () => {
    const model = buildAgentWorkOpsModel(
      currentResponse([currentItem({ evidenceProvenance: ['agent_work_lifecycle'] })]),
      lifecycleResponse([{ id: 1, channelId: 604, projectId: 'den-web', taskId: 1978, agentIdentity: 'spawned-coder', eventType: 'worker_running', state: 'running', workerRunId: 'piw_run', assignmentId: '312', deliveryRequestId: '2801', sessionId: null, evidenceLink: '/evidence', summary: 'running', createdAt: '2026-06-06 01:00:00' }]),
      [],
      [],
    );

    expect(model.mode).toBe('lifecycle');
    expect(model.currentRows).toHaveLength(1);
    expect(model.currentRows[0]).toMatchObject({ agentIdentity: 'spawned-coder', state: 'running', taskId: 1978 });
    expect(model.timelineItems[0]).toMatchObject({ source: 'lifecycle', title: 'worker_running' });
  });

  it('makes lifecycle-empty but activity-present state honest and diagnostic', () => {
    const model = buildAgentWorkOpsModel(
      currentResponse([currentItem({ evidenceProvenance: ['activity_event', 'direct_agent_event'], flags: ['no_lifecycle'], currentWorkState: 'delivered_no_lifecycle' })], 'No lifecycle events present.'),
      lifecycleResponse([]),
      [activityEvent({})],
      [],
    );

    expect(model.mode).toBe('composed');
    expect(model.diagnostic).toContain('No lifecycle events present');
    expect(model.currentRows[0].evidenceProvenance).toContain('activity_event');
    expect(model.timelineItems[0]).toMatchObject({ source: 'activity' });
  });

  it('surfaces direct-agent recorded-only evidence when current and activity rows are absent', () => {
    const model = buildAgentWorkOpsModel(currentResponse([]), lifecycleResponse([]), [], [directEvent({})]);

    expect(model.mode).toBe('direct_agent_fallback');
    expect(model.currentRows[0]).toMatchObject({ agentIdentity: 'spawned-coder', state: 'recorded_only' });
    expect(model.currentRows[0].stalenessDiagnostic).toContain('recorded-only');
  });

  it('keeps stale diagnostics visible on current rows', () => {
    const model = buildAgentWorkOpsModel(
      currentResponse([currentItem({ stalenessDiagnostic: 'stale (last seen 90m ago)', flags: ['stale'] })]),
      lifecycleResponse([]),
      [],
      [],
    );

    expect(model.staleCount).toBe(1);
    expect(model.currentRows[0].stalenessDiagnostic).toContain('stale');
    expect(model.headingDetail).toContain('1 stale');
  });
});

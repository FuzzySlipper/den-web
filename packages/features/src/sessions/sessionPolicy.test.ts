import { describe, expect, it } from 'vitest';
import type { ActiveWorkRoute, DesktopSessionSnapshot } from '@den-web/api/types';
import {
  activeOwnerKey,
  continuationPreview,
  groupRoutesByOwner,
  resetScopeForRoute,
  routeAllows,
} from './sessionPolicy';

function route(overrides: Partial<ActiveWorkRoute>): ActiveWorkRoute {
  return {
    targetProjectId: 'den-web',
    targetTaskId: null,
    assignmentId: null,
    workerRunId: null,
    workerRole: null,
    agentInstanceId: null,
    profileIdentity: null,
    poolMemberId: null,
    sessionOwnerId: null,
    sessionId: null,
    sourceChannelId: null,
    sourceControlProjectId: null,
    lastActivityAt: '2026-06-04T00:00:00Z',
    assignmentPhase: null,
    isStale: false,
    allowedActions: ['ask', 'view_transcript'],
    handles: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<DesktopSessionSnapshot> = {}): DesktopSessionSnapshot {
  return {
    id: 1,
    project_id: 'den-web',
    task_id: null,
    workspace_id: null,
    session_id: 'sess-durable',
    parent_session_id: null,
    agent_identity: 'den-mcp-runner',
    role: 'runner',
    current_command: null,
    current_phase: null,
    title: null,
    display_name: null,
    cwd: null,
    kind: null,
    backend: null,
    status: 'active',
    started_at: null,
    last_activity_at: '2026-06-04T00:00:00Z',
    exited_at: null,
    exit_code: null,
    source_display_name: null,
    capabilities: null,
    recent_activity: null,
    child_sessions: null,
    control_capabilities: null,
    warnings: [],
    source_instance_id: 'agent-instance-runner-01',
    observed_at: '2026-06-04T00:00:00Z',
    received_at: '2026-06-04T00:00:00Z',
    updated_at: '2026-06-04T00:00:00Z',
    is_stale: false,
    freshness_seconds: 5,
    ...overrides,
  };
}

describe('session policy route model', () => {
  it('groups same durable agent reached from two source channels by the same session owner', () => {
    const routes = [
      route({ sourceChannelId: 10, sessionOwnerId: 'owner:runner-01', sessionId: 'sess-A', profileIdentity: 'den-mcp-runner' }),
      route({ sourceChannelId: 20, sessionOwnerId: 'owner:runner-01', sessionId: 'sess-A', profileIdentity: 'den-mcp-runner' }),
    ];

    expect(activeOwnerKey(routes[0])).toBe('owner:runner-01');
    expect(groupRoutesByOwner(routes).get('owner:runner-01')).toHaveLength(2);
    expect(resetScopeForRoute(routes[0], null)).toBe('agent_instance_global');
  });

  it('keeps shared-profile workers distinct by concrete agent instance or pool member', () => {
    const routes = [
      route({ profileIdentity: 'spawned-coder', agentInstanceId: 'pool-coder-01:inst', poolMemberId: 'pool-coder-01' }),
      route({ profileIdentity: 'spawned-coder', agentInstanceId: 'pool-coder-02:inst', poolMemberId: 'pool-coder-02' }),
    ];

    expect(activeOwnerKey(routes[0])).toBe('pool-coder-01:inst');
    expect(activeOwnerKey(routes[1])).toBe('pool-coder-02:inst');
    expect(groupRoutesByOwner(routes).size).toBe(2);
  });

  it('shows assignment-run reset scope for worker leases', () => {
    const workerRoute = route({ assignmentId: 'assign-42', workerRunId: 'run-42', poolMemberId: 'pool-coder-01', allowedActions: ['ask', 'continue', 'reset', 'view_transcript'] });

    expect(resetScopeForRoute(workerRoute, null)).toBe('assignment_run');
    expect(routeAllows(workerRoute, 'reset')).toBe(true);
    expect(continuationPreview(workerRoute, null)).toContain('assignment/run reset');
  });

  it('falls back to task-series or explicit source-lane scope when no route exists', () => {
    expect(resetScopeForRoute(null, snapshot({ task_id: 1924 }))).toBe('task_series');
    expect(resetScopeForRoute(null, null, { kind: 'channel', channelSlug: 'den-system' })).toBe('source_lane');
    expect(continuationPreview(null, null, { kind: 'channel', channelSlug: 'den-system' })).toContain('explicit source-lane reset');
  });
});

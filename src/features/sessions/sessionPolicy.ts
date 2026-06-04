import type { ActiveWorkRoute, DesktopSessionSnapshot } from '../../api/types';

export type ResetScope = 'agent_instance_global' | 'task_series' | 'assignment_run' | 'source_lane';

export interface SourceContextSelection {
  kind: 'session' | 'channel';
  channelSlug?: string | null;
  sessionId?: string | null;
  sourceInstanceId?: string | null;
}

export function activeOwnerKey(route: Pick<ActiveWorkRoute,
  'sessionOwnerId' | 'agentInstanceId' | 'poolMemberId' | 'assignmentId' | 'workerRunId' | 'profileIdentity' | 'sourceChannelId'
>): string {
  return route.sessionOwnerId
    ?? route.agentInstanceId
    ?? route.poolMemberId
    ?? route.assignmentId
    ?? route.workerRunId
    ?? route.profileIdentity
    ?? (route.sourceChannelId != null ? `source-channel:${route.sourceChannelId}` : 'unowned-route');
}

export function activeRouteKey(route: ActiveWorkRoute): string {
  return [
    route.targetProjectId ?? 'no-project',
    route.targetTaskId ?? 'no-task',
    route.assignmentId ?? 'no-assignment',
    route.workerRunId ?? 'no-run',
    activeOwnerKey(route),
    route.sourceChannelId ?? 'no-source',
  ].join(':');
}

export function activeOwnerLabel(route: Pick<ActiveWorkRoute,
  'sessionOwnerId' | 'agentInstanceId' | 'poolMemberId' | 'profileIdentity'
>): string {
  if (route.sessionOwnerId) return `session owner ${route.sessionOwnerId}`;
  if (route.agentInstanceId) return `agent instance ${route.agentInstanceId}`;
  if (route.poolMemberId) return `pool member ${route.poolMemberId}`;
  if (route.profileIdentity) return `profile ${route.profileIdentity} (owner not reported)`;
  return 'active owner not reported';
}

export function activeWorkTargetLabel(route: Pick<ActiveWorkRoute,
  'targetProjectId' | 'targetTaskId' | 'assignmentId' | 'workerRunId' | 'workerRole'
>): string {
  const parts = [
    route.targetProjectId ? `project ${route.targetProjectId}` : null,
    route.targetTaskId != null ? `task #${route.targetTaskId}` : null,
    route.assignmentId ? `assignment ${route.assignmentId}` : null,
    route.workerRunId ? `run ${route.workerRunId}` : null,
    route.workerRole ? `role ${route.workerRole}` : null,
  ];
  return parts.filter(Boolean).join(' · ') || 'target work not reported';
}

export function sourceContextLabel(route: Pick<ActiveWorkRoute, 'sourceChannelId' | 'sourceControlProjectId'> | null, selection?: SourceContextSelection | null): string {
  if (route?.sourceChannelId != null) {
    return `source channel #${route.sourceChannelId}${route.sourceControlProjectId ? ` · control ${route.sourceControlProjectId}` : ''}`;
  }
  if (selection?.channelSlug) return `source channel #${selection.channelSlug}`;
  return 'source context not selected';
}

export function resetScopeForRoute(route: ActiveWorkRoute | null, snapshot: DesktopSessionSnapshot | null, selection?: SourceContextSelection | null): ResetScope {
  if (route?.assignmentId || route?.workerRunId || route?.poolMemberId || route?.workerRole) return 'assignment_run';
  if (route?.sessionOwnerId || route?.agentInstanceId) return 'agent_instance_global';
  if (snapshot?.task_id != null) return 'task_series';
  if (snapshot?.source_instance_id || snapshot?.session_id) return 'agent_instance_global';
  if (selection?.kind === 'channel') return 'source_lane';
  return 'source_lane';
}

export function resetScopeLabel(scope: ResetScope): string {
  switch (scope) {
    case 'agent_instance_global':
      return 'agent instance global reset';
    case 'task_series':
      return 'task-series reset';
    case 'assignment_run':
      return 'assignment/run reset';
    case 'source_lane':
      return 'explicit source-lane reset';
  }
}

export function routeAllows(route: Pick<ActiveWorkRoute, 'allowedActions'> | null, action: 'ask' | 'continue' | 'reset' | 'view_transcript'): boolean {
  if (!route) return action === 'ask';
  return route.allowedActions.includes(action);
}

export function continuationPreview(route: ActiveWorkRoute | null, snapshot: DesktopSessionSnapshot | null, selection?: SourceContextSelection | null): string {
  const scope = resetScopeForRoute(route, snapshot, selection);
  if (!route) {
    return `No active-work route selected; messages stay in ${sourceContextLabel(null, selection)}. /new would request ${resetScopeLabel(scope)}.`;
  }
  return `${activeWorkTargetLabel(route)} routes to ${activeOwnerLabel(route)}; ${sourceContextLabel(route, selection)} is metadata. /new would request ${resetScopeLabel(scope)}.`;
}

export function groupRoutesByOwner(routes: ActiveWorkRoute[]): Map<string, ActiveWorkRoute[]> {
  const groups = new Map<string, ActiveWorkRoute[]>();
  for (const route of routes) {
    const key = activeOwnerKey(route);
    groups.set(key, [...(groups.get(key) ?? []), route]);
  }
  return groups;
}

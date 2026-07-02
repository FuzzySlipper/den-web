import type { DenObservationItem, DenObservationLane, DenObservationSourceHealth } from '@den-web/protocol';

export type AgentSeverity = 'idle' | 'info' | 'success' | 'warning' | 'error';

export interface AgentOverviewItem {
  readonly id: string;
  readonly identity: string;
  readonly title: string;
  readonly summary: string;
  readonly severity: AgentSeverity;
  readonly projectId: string | null;
  readonly taskId: number | null;
  readonly updatedAt: string | null;
}

export interface AgentOverviewModel {
  readonly items: readonly AgentOverviewItem[];
  readonly health: readonly SourceHealthView[];
  readonly degraded: boolean;
}

export interface SourceHealthView {
  readonly source: string;
  readonly status: string;
  readonly detail: string | null;
}

export function observationAgentsOverview(lane: DenObservationLane): AgentOverviewModel {
  const health = (lane.source_health ?? []).map(sourceHealthView);
  return {
    items: (lane.items ?? []).map(agentOverviewItem),
    health,
    degraded: health.some((source) => !sourceIsHealthy(source.status)),
  };
}

export function sourceIsHealthy(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase();
  return normalized === 'available' || normalized === 'ready' || normalized === 'ok';
}

function agentOverviewItem(item: DenObservationItem): AgentOverviewItem {
  const identity = item.agent_identity ?? item.agent ?? 'unknown';
  return {
    id: String(item.id ?? `${identity}:${item.updated_at ?? 'latest'}`),
    identity,
    title: item.title ?? identity,
    summary: item.summary ?? '',
    severity: severity(item.severity ?? item.status),
    projectId: item.project_id ?? null,
    taskId: item.task_id ?? null,
    updatedAt: item.updated_at ?? null,
  };
}

function sourceHealthView(health: DenObservationSourceHealth): SourceHealthView {
  return {
    source: health.source ?? 'unknown',
    status: health.status ?? 'unknown',
    detail: health.detail ?? null,
  };
}

function severity(value: string | null | undefined): AgentSeverity {
  if (value === 'success' || value === 'completed') return 'success';
  if (value === 'error' || value === 'failed' || value === 'blocked') return 'error';
  if (value === 'warning') return 'warning';
  if (value === 'info' || value === 'active') return 'info';
  return 'idle';
}

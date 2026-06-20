import type { AgentDetailResponse, SourceHealthDto } from '@den-web/api/types';
import { sourceIsHealthy } from './agentsOverviewFormat';

export interface FullDetailItem {
  title: string;
  subtitle?: string;
  value: unknown;
}

export function renderHealthWarnings(sourceHealth: SourceHealthDto | null): string[] {
  const warnings: string[] = [];
  if (!sourceHealth) return warnings;
  if (sourceHealth.gateway && !sourceIsHealthy(sourceHealth.gateway.status)) {
    warnings.push(`Gateway: ${sourceHealth.gateway.warning ?? sourceHealth.gateway.status}`);
  }
  if (sourceHealth.channels && !sourceIsHealthy(sourceHealth.channels.status)) {
    warnings.push(`Channels: ${sourceHealth.channels.warning ?? sourceHealth.channels.status}`);
  }
  return warnings;
}

export function copyableDiagnosticPacket(agent: AgentDetailResponse): string {
  const lines: string[] = [];
  lines.push(`=== Agent Diagnostic Packet ===`);
  lines.push(`Agent Identity: ${agent.agentIdentity}`);
  lines.push(`Memberships: ${agent.memberships?.length ?? 0}`);
  lines.push(`Bindings: ${agent.bindings?.length ?? 0}`);
  lines.push(`Current Deliveries: ${agent.currentDeliveries?.length ?? 0}`);
  lines.push(`Recent Deliveries: ${agent.recentDeliveries?.length ?? 0}`);
  lines.push(`Activity Events: ${agent.activityEvents?.length ?? 0}`);
  lines.push(`Task Associations: ${agent.taskAssociations?.length ?? 0}`);
  lines.push(`Flags: ${agent.flags.join(', ')}`);
  lines.push(`Summary: ${JSON.stringify(agent.summary, null, 2)}`);
  lines.push(`Source Health: ${JSON.stringify(agent.sourceHealth, null, 2)}`);
  return lines.join('\n');
}

export function detailText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

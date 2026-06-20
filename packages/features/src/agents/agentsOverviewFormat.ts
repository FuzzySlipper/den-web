import type { ChannelMembershipOverviewDto, DeliveryOverviewDto } from '@den-web/api/types';
import { formatTimeAgo } from '@den-web/shared';
import { deliveryProjectAttribution } from './agentAttribution';

export function severityClass(severity: string | null): string {
  switch (severity) {
    case 'error': return 'agents-severity-error';
    case 'warning': return 'agents-severity-warning';
    case 'info': return 'agents-severity-info';
    case 'success': return 'agents-severity-success';
    default: return 'agents-severity-idle';
  }
}

export function chipClass(value: string | null | undefined, prefix: string): string {
  if (!value) return `${prefix}-unknown`;
  const normalized = value.toLowerCase().replace(/[\s_]+/g, '_');
  return `${prefix}-${normalized}`;
}

export function deliveryStateClass(state: string | null | undefined): string {
  if (!state) return '';
  const s = state.toLowerCase();
  if (s === 'delivered' || s === 'delivered_waiting_completion') return 'agents-delivery-delivered';
  if (s === 'completed') return 'agents-delivery-completed';
  if (s === 'failed') return 'agents-delivery-failed';
  if (s === 'pending' || s === 'delivering') return 'agents-delivery-active';
  return '';
}

export function sourceIsHealthy(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase();
  return normalized === 'available' || normalized === 'ready' || normalized === 'ok';
}

export function renderWakePolicy(memberships: ChannelMembershipOverviewDto[] | null): string {
  if (!memberships || memberships.length === 0) return '—';
  const policies = new Set(memberships.map(m => m.wakePolicy));
  return Array.from(policies).join(', ');
}

export function renderLastActivity(summary: { latestActivityAt: string | null; recentActivityCount: number } | null): string {
  if (!summary || !summary.latestActivityAt) return '—';
  return `${formatTimeAgo(summary.latestActivityAt)} (${summary.recentActivityCount})`;
}

export function renderDeliveryId(deliveries: DeliveryOverviewDto[] | null): string {
  if (!deliveries || deliveries.length === 0) return '—';
  const nonTerminal = deliveries.filter(d => !d.terminal);
  if (nonTerminal.length > 0) return nonTerminal[0].deliveryRequestId ?? 'active';
  const terminalDelivered = deliveries.filter(d => d.status === 'delivered' || d.status === 'delivered_waiting_completion');
  if (terminalDelivered.length > 0) return terminalDelivered[0].deliveryRequestId ?? 'delivered';
  return deliveries[0].deliveryRequestId ?? '—';
}

export function renderDeliveryProject(deliveries: DeliveryOverviewDto[] | null): string | null {
  if (!deliveries || deliveries.length === 0) return null;
  const activeAttribution = deliveries.find(d => !d.terminal && deliveryProjectAttribution(d));
  const firstAttribution = activeAttribution ?? deliveries.find(d => deliveryProjectAttribution(d));
  return firstAttribution ? deliveryProjectAttribution(firstAttribution) : null;
}

export function renderDeliveryState(deliveries: DeliveryOverviewDto[] | null): string {
  if (!deliveries || deliveries.length === 0) return '—';
  const nonTerminal = deliveries.filter(d => !d.terminal);
  const terminalDelivered = deliveries.filter(d => d.status === 'delivered' || d.status === 'delivered_waiting_completion');
  const terminalCompleted = deliveries.filter(d => d.terminal && d.status === 'completed');
  if (nonTerminal.length > 0) return nonTerminal[0].state ?? 'active';
  if (terminalDelivered.length > 0) return 'delivered';
  if (terminalCompleted.length > 0) return 'completed';
  return deliveries[0]?.state ?? '—';
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    const ago = formatTimeAgo(ts);
    const date = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
    return `${date.toLocaleString()} (${ago})`;
  } catch {
    return ts;
  }
}

/**
 * Fleet Ops Cockpit Render Model — task #1797
 *
 * Pure-model helpers for the FleetOpsCockpit component. All
 * status labels, CSS classes, action grouping, and fixture
 * factories live here so the TSX stays focused on layout.
 */

import type {
  FleetOpsServiceUnit,
  FleetOpsAction,
  FleetOpsDiagnosticEntry,
  FleetOpsRunSummary,
  FleetOpsResponse,
} from '../../api/types';

// =============================================================================
// Service unit status helpers
// =============================================================================

export function unitStatusLabel(status: string): string {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'running': return 'Running';
    case 'active': return 'Active';
    case 'stopped': return 'Stopped';
    case 'failed': return 'Failed';
    case 'crashed': return 'Crashed';
    case 'restarting': return 'Restarting';
    case 'degraded': return 'Degraded';
    case 'disabled': return 'Disabled';
    case 'unknown': return 'Unknown';
    default: return status;
  }
}

export function unitStatusClass(status: string): string {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'running':
    case 'active':
      return 'fops-unit-running';
    case 'stopped':
    case 'disabled':
      return 'fops-unit-stopped';
    case 'failed':
    case 'crashed':
      return 'fops-unit-failed';
    case 'restarting':
      return 'fops-unit-restarting';
    case 'degraded':
      return 'fops-unit-degraded';
    default:
      return 'fops-unit-unknown';
  }
}

// =============================================================================
// Action helpers
// =============================================================================

export function actionCategoryLabel(category: string): string {
  switch (category) {
    case 'diagnostic': return 'Diagnostics';
    case 'restart': return 'Restart';
    case 'maintenance': return 'Maintenance';
    default: return category;
  }
}

export function actionCategoryClass(category: string): string {
  return `fops-action-cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * Check if an action can be executed (enabled and not high-risk disabled).
 */
export function isActionExecutable(action: FleetOpsAction): boolean {
  return action.enabled && !action.highRisk;
}

/**
 * Extract profile names from serviceUnits for the restart-profile action.
 */
export function extractProfileNames(units: FleetOpsServiceUnit[]): string[] {
  const profiles = new Set<string>();
  for (const unit of units) {
    if (unit.profile) {
      profiles.add(unit.profile);
    } else if (unit.name && !unit.name.startsWith('den-core')) {
      // Use the unit name as a profile candidate
      profiles.add(unit.name);
    }
  }
  return Array.from(profiles).sort();
}

/**
 * Sanitize a profile name: only allow alphanumeric, dash, underscore, dot.
 */
export function sanitizeProfileName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '');
}

// =============================================================================
// Diagnostic helpers
// =============================================================================

export function diagnosticStatusClass(status: string): string {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'ok': return 'fops-diag-ok';
    case 'warn': return 'fops-diag-warn';
    case 'error': return 'fops-diag-error';
    default: return 'fops-diag-unknown';
  }
}

// =============================================================================
// Run status helpers
// =============================================================================

export function runStatusClass(status: string): string {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'completed': return 'fops-run-completed';
    case 'running': return 'fops-run-running';
    case 'pending': return 'fops-run-pending';
    case 'failed': return 'fops-run-failed';
    default: return 'fops-run-unknown';
  }
}

export function runStatusLabel(status: string): string {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'completed': return 'Completed';
    case 'running': return 'Running';
    case 'pending': return 'Pending';
    case 'failed': return 'Failed';
    default: return status;
  }
}

// =============================================================================
// Summary helpers
// =============================================================================

export function buildFleetSummary(response: FleetOpsResponse): string {
  const total = response.serviceUnits.length;
  const running = response.serviceUnits.filter(u =>
    u.status.toLowerCase() === 'running' || u.status.toLowerCase() === 'active'
  ).length;
  const failed = response.serviceUnits.filter(u =>
    u.status.toLowerCase() === 'failed' || u.status.toLowerCase() === 'crashed'
  ).length;
  const parts = [`${running}/${total} running`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (response.recentRuns.length > 0) parts.push(`${response.recentRuns.length} recent runs`);
  return parts.join(' · ');
}

// =============================================================================
// Grouping
// =============================================================================

export interface ActionCategoryGroup {
  category: string;
  label: string;
  cssClass: string;
  actions: FleetOpsAction[];
}

export function groupActionsByCategory(actions: FleetOpsAction[]): ActionCategoryGroup[] {
  const groupMap = new Map<string, FleetOpsAction[]>();
  const categoryOrder = ['diagnostic', 'restart', 'maintenance'];

  for (const action of actions) {
    const cat = action.category || 'other';
    const list = groupMap.get(cat) ?? [];
    list.push(action);
    groupMap.set(cat, list);
  }

  // Ensure order: diagnostic, restart, maintenance, then any others
  const ordered = [...categoryOrder];
  for (const cat of groupMap.keys()) {
    if (!ordered.includes(cat)) ordered.push(cat);
  }

  return ordered
    .filter(cat => groupMap.has(cat))
    .map(cat => ({
      category: cat,
      label: actionCategoryLabel(cat),
      cssClass: actionCategoryClass(cat),
      actions: groupMap.get(cat)!,
    }));
}

// =============================================================================
// Formatting
// =============================================================================

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

// =============================================================================
// Fake fixture factories for testing
// =============================================================================

export interface FakeFleetOpsOpts {
  service?: string;
  serviceUnits?: Partial<FleetOpsServiceUnit>[];
  actions?: Partial<FleetOpsAction>[];
  discoveryDiagnostics?: Partial<FleetOpsDiagnosticEntry>[];
  recentRuns?: Partial<FleetOpsRunSummary>[];
}

export function fakeFleetOpsResponse(opts: FakeFleetOpsOpts = {}): FleetOpsResponse {
  const defaultUnits: FleetOpsServiceUnit[] = [
    { name: 'hermes-coder', status: 'running', enabled: true, profile: 'hermes-coder', description: 'Coder agent', pid: 12345, uptimeSeconds: 86400 },
    { name: 'hermes-reviewer', status: 'running', enabled: true, profile: 'hermes-reviewer', description: 'Reviewer agent', pid: 12346, uptimeSeconds: 72000 },
    { name: 'den-hermes-runner', status: 'running', enabled: true, profile: null, description: 'Orchestrator', pid: 12340, uptimeSeconds: 172800 },
    { name: 'hermes-pilot', status: 'stopped', enabled: true, profile: 'hermes-pilot', description: 'Legacy pilot', pid: null, uptimeSeconds: null },
    { name: 'den-core', status: 'running', enabled: true, profile: null, description: 'Core API', pid: 12300, uptimeSeconds: 200000 },
  ];

  const defaultActions: FleetOpsAction[] = [
    { actionId: 'fleet-status', label: 'Fleet Status', category: 'diagnostic', enabled: true, description: 'Show fleet status', requiresConfirmation: false, supportsDryRun: true, requiresArgs: false },
    { actionId: 'fleet-smoke', label: 'Fleet Smoke Test', category: 'diagnostic', enabled: true, description: 'Run smoke tests', requiresConfirmation: false, supportsDryRun: true, requiresArgs: false },
    { actionId: 'restart-all', label: 'Restart All', category: 'restart', enabled: true, description: 'Restart all fleet services', requiresConfirmation: true, supportsDryRun: true, requiresArgs: false },
    { actionId: 'restart-failed', label: 'Restart Failed', category: 'restart', enabled: true, description: 'Restart only failed services', requiresConfirmation: true, supportsDryRun: false, requiresArgs: false },
    { actionId: 'restart-profile', label: 'Restart Profile', category: 'restart', enabled: true, description: 'Restart a specific profile', requiresConfirmation: true, supportsDryRun: false, requiresArgs: true },
    { actionId: 'purge-logs', label: 'Purge Logs', category: 'maintenance', enabled: false, highRisk: true, description: 'Dangerous: purge all logs', requiresConfirmation: true, supportsDryRun: false, requiresArgs: false },
  ];

  const defaultDiagnostics: FleetOpsDiagnosticEntry[] = [
    { check: 'systemd-resolved', status: 'ok', detail: 'All units resolved' },
    { check: 'service-connectivity', status: 'ok', detail: 'All services reachable' },
    { check: 'disk-space', status: 'warn', detail: '/var/log at 85% capacity' },
  ];

  const defaultRuns: FleetOpsRunSummary[] = [
    { runId: 'run-001', actionId: 'fleet-status', dryRun: false, status: 'completed', startedAt: '2026-05-31T20:00:00Z', completedAt: '2026-05-31T20:00:02Z', summary: 'All services healthy' },
    { runId: 'run-002', actionId: 'restart-failed', dryRun: false, status: 'completed', startedAt: '2026-05-31T19:00:00Z', completedAt: '2026-05-31T19:00:10Z', summary: 'Restarted 1 service' },
    { runId: 'run-003', actionId: 'fleet-smoke', dryRun: true, status: 'completed', startedAt: '2026-05-31T18:00:00Z', completedAt: '2026-05-31T18:00:05Z', summary: 'Dry run: 6 checks passed' },
  ];

  const units = (opts.serviceUnits ?? defaultUnits).map((u, i) => ({
    ...(defaultUnits[i] ?? defaultUnits[0]),
    ...u,
  }));
  const actions = (opts.actions ?? defaultActions).map((a, i) => ({
    ...(defaultActions[i] ?? defaultActions[0]),
    ...a,
  }));
  const diagnostics = (opts.discoveryDiagnostics ?? defaultDiagnostics).map((d, i) => ({
    ...(defaultDiagnostics[i] ?? defaultDiagnostics[0]),
    ...d,
  }));
  const runs = (opts.recentRuns ?? defaultRuns).map((r, i) => ({
    ...(defaultRuns[i] ?? defaultRuns[0]),
    ...r,
  }));

  return {
    service: opts.service ?? 'gateway-fleet-ops',
    generatedAt: '2026-05-31T23:00:00Z',
    serviceUnits: units.length > 0 ? units : defaultUnits,
    actions: actions.length > 0 ? actions : defaultActions,
    discoveryDiagnostics: diagnostics.length > 0 ? diagnostics : defaultDiagnostics,
    recentRuns: runs.length > 0 ? runs : defaultRuns,
  };
}

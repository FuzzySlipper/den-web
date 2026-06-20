/**
 * Fleet Ops Cockpit Render Model — task #1797 (r2 fix)
 *
 * Pure-model helpers for the FleetOpsCockpit component. All
 * status labels, CSS classes, action grouping, and fixture
 * factories live here so the TSX stays focused on layout.
 *
 * Types are aligned with the Den Host FleetOps contract:
 *   FleetOpsServiceUnit  → Den Host FleetServiceUnit
 *   FleetOpsAction       → Den Host FleetActionDescriptor
 *   FleetOpsActionRun    → Den Host FleetOpsActionRun
 */

import type {
  FleetOpsServiceUnit,
  FleetOpsAction,
  FleetOpsActionRun,
  FleetOpsResponse,
} from '@den-web/api/types';

// =============================================================================
// Service unit status helpers (using activeState from Den Host)
// =============================================================================

export function unitStatusLabel(activeState: string): string {
  const normalized = activeState.toLowerCase().trim();
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
    default: return activeState;
  }
}

export function unitStatusClass(activeState: string): string {
  const normalized = activeState.toLowerCase().trim();
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
// Action helpers (using Den Host FleetActionDescriptor fields)
// =============================================================================

/**
 * Derive whether an action is disabled (has a disabledReason from Den Host).
 */
export function isActionDisabled(action: FleetOpsAction): boolean {
  return action.disabledReason != null && action.disabledReason !== '';
}

/**
 * Check if an action can be executed: not disabled. Even high-risk / mutating
 * actions are executable — they just go through the confirmation flow.
 */
export function isActionExecutable(action: FleetOpsAction): boolean {
  return !isActionDisabled(action);
}

/**
 * Check if an action needs confirmation before execution.
 * Uses Den Host needsConfirmation flag; also true for mutating actions as a
 * safety net.
 */
export function actionNeedsConfirmation(action: FleetOpsAction): boolean {
  if (isActionDisabled(action)) return false;
  return action.needsConfirmation || action.mutating;
}

/**
 * Get the confirmation prompt text for an action.
 * Uses Den Host confirmationCopy when present; otherwise a generic message
 * for mutating actions.
 */
export function actionConfirmationPrompt(action: FleetOpsAction): string {
  if (action.confirmationCopy) return action.confirmationCopy;
  if (action.mutating) return `This action (${action.label}) modifies fleet state. Type confirm to proceed.`;
  return 'Type confirm to proceed.';
}

/**
 * Derive risk-level CSS class from Den Host riskLevel field.
 */
export function riskLevelClass(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase().trim();
  switch (normalized) {
    case 'high': return 'fops-risk-high';
    case 'medium': return 'fops-risk-medium';
    case 'low': return 'fops-risk-low';
    default: return 'fops-risk-unknown';
  }
}

/**
 * Derive a UI risk label from Den Host riskLevel field.
 */
export function riskLevelLabel(riskLevel: string): string {
  const cap = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase();
  return `${cap} Risk`;
}

/**
 * Extract profile names from serviceUnits for the restart-profile action.
 * Uses Den Host profileName field directly.
 */
export function extractProfileNames(units: FleetOpsServiceUnit[]): string[] {
  const profiles = new Set<string>();
  for (const unit of units) {
    if (unit.profileName) {
      profiles.add(unit.profileName);
    }
  }
  return Array.from(profiles).sort();
}

/**
 * Sanitize a profile name: only allow alphanumeric, dash, underscore
 * (matching Den Host pattern ^[a-zA-Z0-9_-]+$ — no dots).
 */
export function sanitizeProfileName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

// =============================================================================
// Run status helpers (using Den Host FleetOpsActionRun fields)
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
  const units = response.serviceUnits;
  const total = units.length;
  const running = units.filter(u =>
    u.activeState.toLowerCase() === 'running' || u.activeState.toLowerCase() === 'active'
  ).length;
  const failed = units.filter(u =>
    u.activeState.toLowerCase() === 'failed' || u.activeState.toLowerCase() === 'crashed'
  ).length;
  const parts = [`${running}/${total} running`];
  if (failed > 0) parts.push(`${failed} failed`);
  const runs = response.recentRuns ?? [];
  if (runs.length > 0) parts.push(`${runs.length} recent runs`);
  return parts.join(' · ');
}

// =============================================================================
// Grouping actions by riskLevel as a simple UI grouping strategy
// =============================================================================

export interface ActionRiskGroup {
  riskLevel: string;
  label: string;
  cssClass: string;
  actions: FleetOpsAction[];
}

export function groupActionsByRisk(actions: FleetOpsAction[]): ActionRiskGroup[] {
  const groupMap = new Map<string, FleetOpsAction[]>();
  const riskOrder = ['low', 'medium', 'high'];

  for (const action of actions) {
    const rl = (action.riskLevel || 'unknown').toLowerCase();
    const list = groupMap.get(rl) ?? [];
    list.push(action);
    groupMap.set(rl, list);
  }

  // Ensure order: low, medium, high, then any others
  const ordered = [...riskOrder];
  for (const rl of groupMap.keys()) {
    if (!ordered.includes(rl)) ordered.push(rl);
  }

  return ordered
    .filter(rl => groupMap.has(rl))
    .map(rl => ({
      riskLevel: rl,
      label: riskLevelLabel(rl),
      cssClass: `fops-action-risk-${rl}`,
      actions: groupMap.get(rl)!,
    }));
}

// =============================================================================
// Formatting
// =============================================================================

export function formatRunDuration(
  startedAt?: string | null,
  finishedAt?: string | null,
): string {
  if (!startedAt || !finishedAt) return '\u2014';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return '\u2014';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (mins < 60) return `${mins}m ${remSec}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

// =============================================================================
// Fake fixture factories for testing — aligned with Den Host FleetOps contract
// =============================================================================

export interface FakeFleetOpsOpts {
  service?: string;
  serviceUnits?: Partial<FleetOpsServiceUnit>[];
  actions?: Partial<FleetOpsAction>[];
  discoveryDiagnostics?: string | null;
  recentRuns?: Partial<FleetOpsActionRun>[];
}

export function fakeFleetOpsResponse(opts: FakeFleetOpsOpts = {}): FleetOpsResponse {
  const defaultUnits: FleetOpsServiceUnit[] = [
    { unitName: 'hermes-coder', profileName: 'hermes-coder', activeState: 'running', subState: 'main', pid: 12345, statusSummary: 'OK', description: 'Coder agent' },
    { unitName: 'hermes-reviewer', profileName: 'hermes-reviewer', activeState: 'running', subState: 'main', pid: 12346, statusSummary: 'OK', description: 'Reviewer agent' },
    { unitName: 'den-hermes-runner', profileName: '', activeState: 'running', subState: 'main', pid: 12340, statusSummary: 'OK', description: 'Orchestrator' },
    { unitName: 'hermes-pilot', profileName: 'hermes-pilot', activeState: 'stopped', subState: 'dead', pid: null, statusSummary: 'Not running', description: 'Legacy pilot' },
    { unitName: 'den-core', profileName: '', activeState: 'running', subState: 'main', pid: 12300, statusSummary: 'OK', description: 'Core API' },
  ];

  const defaultActions: FleetOpsAction[] = [
    { actionId: 'fleet-status', label: 'Fleet Status', riskLevel: 'low', mutating: false, supportsDryRun: true, needsConfirmation: false, timeoutSeconds: 30 },
    { actionId: 'fleet-smoke', label: 'Fleet Smoke Test', riskLevel: 'low', mutating: false, supportsDryRun: true, needsConfirmation: false, timeoutSeconds: 60 },
    { actionId: 'restart-all', label: 'Restart All', riskLevel: 'high', mutating: true, supportsDryRun: true, needsConfirmation: true, confirmationCopy: 'Restart ALL fleet services?', timeoutSeconds: 120 },
    { actionId: 'restart-failed', label: 'Restart Failed', riskLevel: 'medium', mutating: true, supportsDryRun: false, needsConfirmation: true, timeoutSeconds: 90 },
    { actionId: 'restart-profile', label: 'Restart Profile', riskLevel: 'medium', mutating: true, supportsDryRun: false, needsConfirmation: true, timeoutSeconds: 90, argsSchema: [{ name: 'profile', type: 'string', required: true, description: 'Profile name to restart', pattern: '^[a-zA-Z0-9_-]+$' }] },
    { actionId: 'purge-logs', label: 'Purge Logs', riskLevel: 'high', mutating: true, supportsDryRun: false, needsConfirmation: true, confirmationCopy: 'This will permanently delete all logs. Continue?', timeoutSeconds: 60, disabledReason: 'Disabled by policy — log purge requires manual intervention' },
  ];

  const defaultRuns: FleetOpsActionRun[] = [
    { runId: 'run-001', actionId: 'fleet-status', args: null, status: 'completed', createdAt: '2026-05-31T19:59:00Z', startedAt: '2026-05-31T20:00:00Z', finishedAt: '2026-05-31T20:00:02Z', exitCode: 0, stdoutTail: 'All services healthy', stderrTail: null, errorMessage: null, wasDryRun: false },
    { runId: 'run-002', actionId: 'restart-failed', args: { profile: 'hermes-pilot' }, status: 'completed', createdAt: '2026-05-31T18:59:00Z', startedAt: '2026-05-31T19:00:00Z', finishedAt: '2026-05-31T19:00:10Z', exitCode: 0, stdoutTail: 'Restarted 1 service', stderrTail: null, errorMessage: null, wasDryRun: false },
    { runId: 'run-003', actionId: 'fleet-smoke', args: null, status: 'completed', createdAt: '2026-05-31T17:59:00Z', startedAt: '2026-05-31T18:00:00Z', finishedAt: '2026-05-31T18:00:05Z', exitCode: 0, stdoutTail: '6 checks passed', stderrTail: null, errorMessage: null, wasDryRun: true },
  ];

  const units = opts.serviceUnits !== undefined
    ? opts.serviceUnits.map((u, i) => ({
        ...(defaultUnits[i] ?? defaultUnits[0]),
        ...u,
      }))
    : defaultUnits;
  const actions = opts.actions !== undefined
    ? opts.actions.map((a, i) => ({
        ...(defaultActions[i] ?? defaultActions[0]),
        ...a,
      }))
    : defaultActions;
  const runs = opts.recentRuns !== undefined
    ? opts.recentRuns.map((r, i) => ({
        ...(defaultRuns[i] ?? defaultRuns[0]),
        ...r,
      }))
    : defaultRuns;

  return {
    service: opts.service ?? 'den-host',
    generatedAt: '2026-05-31T23:00:00Z',
    serviceUnits: units,
    actions: actions,
    discoveryDiagnostics: opts.discoveryDiagnostics !== undefined ? opts.discoveryDiagnostics : 'systemd-resolved: ok\nservice-connectivity: ok\ndisk-space: warn — /var/log at 85%',
    recentRuns: runs,
  };
}

/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  unitStatusLabel,
  unitStatusClass,
  isActionDisabled,
  isActionExecutable,
  actionNeedsConfirmation,
  actionConfirmationPrompt,
  riskLevelClass,
  riskLevelLabel,
  extractProfileNames,
  sanitizeProfileName,
  runStatusClass,
  runStatusLabel,
  buildFleetSummary,
  groupActionsByRisk,
  formatRunDuration,
  fakeFleetOpsResponse,
} from './fleetOpsModel';
import type { FleetOpsAction, FleetOpsServiceUnit } from '../../api/types';

// =============================================================================
// Service unit helpers (activeState-based, not old status/enabled)
// =============================================================================

describe('unitStatusLabel', () => {
  it('returns human-readable labels for known activeStates', () => {
    expect(unitStatusLabel('running')).toBe('Running');
    expect(unitStatusLabel('active')).toBe('Active');
    expect(unitStatusLabel('stopped')).toBe('Stopped');
    expect(unitStatusLabel('failed')).toBe('Failed');
    expect(unitStatusLabel('crashed')).toBe('Crashed');
    expect(unitStatusLabel('restarting')).toBe('Restarting');
    expect(unitStatusLabel('degraded')).toBe('Degraded');
    expect(unitStatusLabel('disabled')).toBe('Disabled');
    expect(unitStatusLabel('unknown')).toBe('Unknown');
  });

  it('passes through unknown activeStates', () => {
    expect(unitStatusLabel('custom-state')).toBe('custom-state');
  });

  it('handles case-insensitively', () => {
    expect(unitStatusLabel('Running')).toBe('Running');
    expect(unitStatusLabel('FAILED')).toBe('Failed');
  });
});

describe('unitStatusClass', () => {
  it('returns appropriate CSS classes for each activeState', () => {
    expect(unitStatusClass('running')).toBe('fops-unit-running');
    expect(unitStatusClass('active')).toBe('fops-unit-running');
    expect(unitStatusClass('stopped')).toBe('fops-unit-stopped');
    expect(unitStatusClass('failed')).toBe('fops-unit-failed');
    expect(unitStatusClass('crashed')).toBe('fops-unit-failed');
    expect(unitStatusClass('restarting')).toBe('fops-unit-restarting');
    expect(unitStatusClass('degraded')).toBe('fops-unit-degraded');
    expect(unitStatusClass('something')).toBe('fops-unit-unknown');
  });
});

// =============================================================================
// Action helpers (Den Host FleetActionDescriptor fields)
// =============================================================================

describe('isActionDisabled', () => {
  it('returns true when disabledReason is set', () => {
    const action: FleetOpsAction = {
      actionId: 'purge-logs',
      label: 'Purge Logs',
      riskLevel: 'high',
      mutating: true,
      supportsDryRun: false,
      needsConfirmation: true,
      timeoutSeconds: 60,
      disabledReason: 'Disabled by policy',
    };
    expect(isActionDisabled(action)).toBe(true);
  });

  it('returns false when disabledReason is null/empty/undefined', () => {
    const base: FleetOpsAction = {
      actionId: 'restart-all',
      label: 'Restart All',
      riskLevel: 'high',
      mutating: true,
      supportsDryRun: true,
      needsConfirmation: true,
      timeoutSeconds: 120,
    };
    expect(isActionDisabled({ ...base, disabledReason: null })).toBe(false);
    expect(isActionDisabled({ ...base, disabledReason: '' })).toBe(false);
    expect(isActionDisabled({ ...base, disabledReason: undefined })).toBe(false);
  });
});

describe('isActionExecutable', () => {
  it('returns true for non-disabled actions (even high risk)', () => {
    const action: FleetOpsAction = {
      actionId: 'restart-all',
      label: 'Restart All',
      riskLevel: 'high',
      mutating: true,
      supportsDryRun: true,
      needsConfirmation: true,
      timeoutSeconds: 120,
      confirmationCopy: 'Restart ALL fleet services?',
    };
    // restart-all is high risk but NOT disabled — must be executable (confirmable)
    expect(isActionExecutable(action)).toBe(true);
  });

  it('returns false for actions with a disabledReason', () => {
    const action: FleetOpsAction = {
      actionId: 'purge-logs',
      label: 'Purge Logs',
      riskLevel: 'high',
      mutating: true,
      supportsDryRun: false,
      needsConfirmation: true,
      timeoutSeconds: 60,
      disabledReason: 'Disabled by policy',
    };
    expect(isActionExecutable(action)).toBe(false);
  });
});

describe('actionNeedsConfirmation', () => {
  it('returns true when needsConfirmation is set', () => {
    const action: FleetOpsAction = {
      actionId: 'restart-failed',
      label: 'Restart Failed',
      riskLevel: 'medium',
      mutating: true,
      supportsDryRun: false,
      needsConfirmation: true,
      timeoutSeconds: 90,
    };
    expect(actionNeedsConfirmation(action)).toBe(true);
  });

  it('returns true for mutating actions even without explicit needsConfirmation', () => {
    const action: FleetOpsAction = {
      actionId: 'some-mutator',
      label: 'Some Mutator',
      riskLevel: 'low',
      mutating: true,
      supportsDryRun: false,
      needsConfirmation: false,
      timeoutSeconds: 30,
    };
    expect(actionNeedsConfirmation(action)).toBe(true);
  });

  it('returns false for non-mutating actions without needsConfirmation', () => {
    const action: FleetOpsAction = {
      actionId: 'fleet-status',
      label: 'Fleet Status',
      riskLevel: 'low',
      mutating: false,
      supportsDryRun: true,
      needsConfirmation: false,
      timeoutSeconds: 30,
    };
    expect(actionNeedsConfirmation(action)).toBe(false);
  });

  it('returns false for disabled actions', () => {
    const action: FleetOpsAction = {
      actionId: 'purge-logs',
      label: 'Purge Logs',
      riskLevel: 'high',
      mutating: true,
      supportsDryRun: false,
      needsConfirmation: true,
      timeoutSeconds: 60,
      disabledReason: 'Disabled',
    };
    expect(actionNeedsConfirmation(action)).toBe(false);
  });
});

describe('actionConfirmationPrompt', () => {
  it('uses confirmationCopy when present', () => {
    const action: FleetOpsAction = {
      actionId: 'restart-all',
      label: 'Restart All',
      riskLevel: 'high',
      mutating: true,
      supportsDryRun: true,
      needsConfirmation: true,
      confirmationCopy: 'Restart ALL fleet services?',
      timeoutSeconds: 120,
    };
    expect(actionConfirmationPrompt(action)).toBe('Restart ALL fleet services?');
  });

  it('generates generic prompt for mutating actions without confirmationCopy', () => {
    const action: FleetOpsAction = {
      actionId: 'restart-failed',
      label: 'Restart Failed',
      riskLevel: 'medium',
      mutating: true,
      supportsDryRun: false,
      needsConfirmation: true,
      timeoutSeconds: 90,
    };
    const prompt = actionConfirmationPrompt(action);
    expect(prompt).toContain('Restart Failed');
    expect(prompt).toContain('confirm');
  });
});

describe('riskLevelClass', () => {
  it('returns correct CSS classes for risk levels', () => {
    expect(riskLevelClass('high')).toBe('fops-risk-high');
    expect(riskLevelClass('medium')).toBe('fops-risk-medium');
    expect(riskLevelClass('low')).toBe('fops-risk-low');
    expect(riskLevelClass('unknown')).toBe('fops-risk-unknown');
  });
});

describe('riskLevelLabel', () => {
  it('capitalizes risk level', () => {
    expect(riskLevelLabel('high')).toBe('High Risk');
    expect(riskLevelLabel('medium')).toBe('Medium Risk');
    expect(riskLevelLabel('low')).toBe('Low Risk');
  });
});

// =============================================================================
// Profile extraction (profileName from Den Host FleetServiceUnit)
// =============================================================================

describe('extractProfileNames', () => {
  it('extracts profileName from service units', () => {
    const units: FleetOpsServiceUnit[] = [
      { unitName: 'hermes-coder', profileName: 'hermes-coder', activeState: 'running', subState: 'main', description: 'Coder' },
      { unitName: 'hermes-reviewer', profileName: 'hermes-reviewer', activeState: 'running', subState: 'main', description: 'Reviewer' },
      { unitName: 'den-core', profileName: '', activeState: 'running', subState: 'main', description: 'Core' },
    ];
    const profiles = extractProfileNames(units);
    expect(profiles).toEqual(['hermes-coder', 'hermes-reviewer']);
  });

  it('excludes units with empty profileName', () => {
    const units: FleetOpsServiceUnit[] = [
      { unitName: 'den-core', profileName: '', activeState: 'running', subState: 'main', description: 'Core' },
    ];
    expect(extractProfileNames(units)).toEqual([]);
  });

  it('returns sorted unique profileName values', () => {
    const units: FleetOpsServiceUnit[] = [
      { unitName: 'z-agent', profileName: 'z-agent', activeState: 'running', subState: 'main', description: 'Z' },
      { unitName: 'a-agent', profileName: 'a-agent', activeState: 'running', subState: 'main', description: 'A' },
      { unitName: 'a-agent-2', profileName: 'a-agent', activeState: 'stopped', subState: 'dead', description: 'A2' },
    ];
    expect(extractProfileNames(units)).toEqual(['a-agent', 'z-agent']);
  });
});

describe('sanitizeProfileName', () => {
  it('allows alphanumeric, dash, underscore (Den Host pattern ^[a-zA-Z0-9_-]+$)', () => {
    expect(sanitizeProfileName('hermes-coder')).toBe('hermes-coder');
    expect(sanitizeProfileName('my_agent')).toBe('my_agent');
    expect(sanitizeProfileName('abc123')).toBe('abc123');
  });

  it('strips dots (Den Host pattern does not allow dots)', () => {
    expect(sanitizeProfileName('test.profile')).toBe('testprofile');
  });

  it('strips dangerous characters', () => {
    expect(sanitizeProfileName('foo; rm -rf /')).toBe('foorm-rf');
    expect(sanitizeProfileName('$(evil)')).toBe('evil');
    expect(sanitizeProfileName('`whoami`')).toBe('whoami');
    expect(sanitizeProfileName('hello world')).toBe('helloworld');
  });
});

// =============================================================================
// Run status helpers (Den Host FleetOpsActionRun fields)
// =============================================================================

describe('runStatusClass', () => {
  it('returns correct CSS classes', () => {
    expect(runStatusClass('completed')).toBe('fops-run-completed');
    expect(runStatusClass('running')).toBe('fops-run-running');
    expect(runStatusClass('pending')).toBe('fops-run-pending');
    expect(runStatusClass('failed')).toBe('fops-run-failed');
    expect(runStatusClass('other')).toBe('fops-run-unknown');
  });
});

describe('runStatusLabel', () => {
  it('returns human-readable labels', () => {
    expect(runStatusLabel('completed')).toBe('Completed');
    expect(runStatusLabel('running')).toBe('Running');
    expect(runStatusLabel('pending')).toBe('Pending');
    expect(runStatusLabel('failed')).toBe('Failed');
    expect(runStatusLabel('custom')).toBe('custom');
  });
});

// =============================================================================
// Fleet summary
// =============================================================================

describe('buildFleetSummary', () => {
  it('builds a summary string from the response using activeState', () => {
    const response = fakeFleetOpsResponse();
    const summary = buildFleetSummary(response);
    expect(summary).toContain('running');
  });

  it('reports failed count when present', () => {
    const response = fakeFleetOpsResponse({
      serviceUnits: [
        { unitName: 'svc-1', profileName: '', activeState: 'running', subState: 'main', description: 'Svc1' },
        { unitName: 'svc-2', profileName: '', activeState: 'failed', subState: 'failed', description: 'Svc2' },
        { unitName: 'svc-3', profileName: '', activeState: 'crashed', subState: 'crashed', description: 'Svc3' },
      ],
    });
    const summary = buildFleetSummary(response);
    expect(summary).toContain('2 failed');
  });
});

// =============================================================================
// Action grouping by risk level
// =============================================================================

describe('groupActionsByRisk', () => {
  it('groups actions by riskLevel in canonical order', () => {
    const response = fakeFleetOpsResponse();
    const groups = groupActionsByRisk(response.actions);

    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].riskLevel).toBe('low');
    expect(groups[1].riskLevel).toBe('medium');
    expect(groups[2].riskLevel).toBe('high');
  });

  it('handles empty actions list', () => {
    expect(groupActionsByRisk([])).toEqual([]);
  });
});

// =============================================================================
// Run duration formatting (startedAt/finishedAt)
// =============================================================================

describe('formatRunDuration', () => {
  it('formats duration between startedAt and finishedAt', () => {
    expect(formatRunDuration('2026-05-31T20:00:00Z', '2026-05-31T20:00:05Z')).toBe('5s');
    expect(formatRunDuration('2026-05-31T20:00:00Z', '2026-05-31T20:02:05Z')).toBe('2m 5s');
  });

  it('returns placeholder for missing timestamps', () => {
    expect(formatRunDuration(null, null)).toBe('\u2014');
    expect(formatRunDuration(undefined, undefined)).toBe('\u2014');
    expect(formatRunDuration('2026-05-31T20:00:00Z', null)).toBe('\u2014');
  });
});

// =============================================================================
// Fake fixture factory — aligned with Den Host FleetOps contract
// =============================================================================

describe('fakeFleetOpsResponse', () => {
  it('creates a valid FleetOpsResponse with Den Host-shaped defaults', () => {
    const response = fakeFleetOpsResponse();
    expect(response.service).toBe('den-host');
    expect(response.serviceUnits.length).toBeGreaterThanOrEqual(3);
    expect(response.actions.length).toBeGreaterThanOrEqual(3);
    expect(typeof response.discoveryDiagnostics).toBe('string');
    expect(response.recentRuns!.length).toBeGreaterThanOrEqual(1);
  });

  it('uses Den Host field names on service units', () => {
    const response = fakeFleetOpsResponse();
    const unit = response.serviceUnits[0];
    expect(unit).toHaveProperty('unitName');
    expect(unit).toHaveProperty('profileName');
    expect(unit).toHaveProperty('activeState');
    expect(unit).toHaveProperty('subState');
    expect(unit).toHaveProperty('description');
    // Must NOT have invented fields
    expect(unit).not.toHaveProperty('name');
    expect(unit).not.toHaveProperty('status');
    expect(unit).not.toHaveProperty('enabled');
    expect(unit).not.toHaveProperty('uptimeSeconds');
  });

  it('uses Den Host field names on actions', () => {
    const response = fakeFleetOpsResponse();
    const action = response.actions[0];
    expect(action).toHaveProperty('actionId');
    expect(action).toHaveProperty('label');
    expect(action).toHaveProperty('riskLevel');
    expect(action).toHaveProperty('mutating');
    expect(action).toHaveProperty('supportsDryRun');
    expect(action).toHaveProperty('needsConfirmation');
    expect(action).toHaveProperty('timeoutSeconds');
    // Must NOT have invented fields
    expect(action).not.toHaveProperty('category');
    expect(action).not.toHaveProperty('enabled');
    expect(action).not.toHaveProperty('highRisk');
    expect(action).not.toHaveProperty('requiresConfirmation');
    expect(action).not.toHaveProperty('requiresArgs');
  });

  it('uses Den Host field names on runs', () => {
    const response = fakeFleetOpsResponse();
    const run = response.recentRuns![0];
    expect(run).toHaveProperty('runId');
    expect(run).toHaveProperty('actionId');
    expect(run).toHaveProperty('status');
    expect(run).toHaveProperty('createdAt');
    expect(run).toHaveProperty('wasDryRun');
    expect(run).toHaveProperty('exitCode');
    expect(run).toHaveProperty('stdoutTail');
    expect(run).toHaveProperty('errorMessage');
    // Must NOT have invented fields
    expect(run).not.toHaveProperty('dryRun');
    expect(run).not.toHaveProperty('completedAt');
    expect(run).not.toHaveProperty('summary');
    expect(run).not.toHaveProperty('error');
  });

  it('accepts overrides for service units', () => {
    const response = fakeFleetOpsResponse({
      serviceUnits: [
        { unitName: 'custom-svc', profileName: 'custom', activeState: 'running', subState: 'main', description: 'Custom' },
      ],
    });
    expect(response.serviceUnits.length).toBe(1);
    expect(response.serviceUnits[0].unitName).toBe('custom-svc');
  });

  it('accepts overrides for actions', () => {
    const response = fakeFleetOpsResponse({
      actions: [
        { actionId: 'custom-action', label: 'Custom', riskLevel: 'low', mutating: false, supportsDryRun: true, needsConfirmation: false, timeoutSeconds: 30 },
      ],
    });
    expect(response.actions.length).toBe(1);
    expect(response.actions[0].actionId).toBe('custom-action');
  });

  it('accepts overrides for recent runs', () => {
    const response = fakeFleetOpsResponse({
      recentRuns: [
        { runId: 'run-custom', actionId: 'fleet-status', status: 'failed', createdAt: '2026-05-31T20:00:00Z', wasDryRun: false, errorMessage: 'timeout', exitCode: 1 },
      ],
    });
    expect(response.recentRuns!.length).toBe(1);
    expect(response.recentRuns![0].errorMessage).toBe('timeout');
    expect(response.recentRuns![0].exitCode).toBe(1);
  });

  it('restart-all is executable (not disabled), just confirmable', () => {
    const response = fakeFleetOpsResponse();
    const restartAll = response.actions.find(a => a.actionId === 'restart-all')!;
    expect(isActionDisabled(restartAll)).toBe(false);
    expect(isActionExecutable(restartAll)).toBe(true);
    expect(actionNeedsConfirmation(restartAll)).toBe(true);
    expect(restartAll.riskLevel).toBe('high');
    expect(restartAll.confirmationCopy).toBe('Restart ALL fleet services?');
  });

  it('purge-logs is disabled (has disabledReason)', () => {
    const response = fakeFleetOpsResponse();
    const purgeLogs = response.actions.find(a => a.actionId === 'purge-logs')!;
    expect(isActionDisabled(purgeLogs)).toBe(true);
    expect(isActionExecutable(purgeLogs)).toBe(false);
    expect(purgeLogs.disabledReason).toBeTruthy();
  });

  it('restart-profile has argsSchema with profile arg matching Den Host pattern', () => {
    const response = fakeFleetOpsResponse();
    const restartProfile = response.actions.find(a => a.actionId === 'restart-profile')!;
    expect(restartProfile.argsSchema).toBeDefined();
    expect(restartProfile.argsSchema!.length).toBeGreaterThan(0);
    const profileArg = restartProfile.argsSchema!.find(a => a.name === 'profile')!;
    expect(profileArg.pattern).toBe('^[a-zA-Z0-9_-]+$');
  });
});

// =============================================================================
// Restart-profile sanitized args
// =============================================================================

describe('restart-profile sanitized args', () => {
  it('sanitizeProfileName strips dots to match Den Host pattern', () => {
    // Den Host pattern is ^[a-zA-Z0-9_-]+$ — dots must be stripped
    expect(sanitizeProfileName('profile.with.dots')).toBe('profilewithdots');
  });

  it('sanitizeProfileName preserves valid Den Host profile names', () => {
    expect(sanitizeProfileName('hermes-coder')).toBe('hermes-coder');
    expect(sanitizeProfileName('my_agent')).toBe('my_agent');
    expect(sanitizeProfileName('agent-123')).toBe('agent-123');
  });

  it('sanitizeProfileName strips all shell-injection characters', () => {
    expect(sanitizeProfileName('; rm -rf /')).toBe('rm-rf');
    expect(sanitizeProfileName('$(cat /etc/passwd)')).toBe('catetcpasswd');
    expect(sanitizeProfileName('`id`')).toBe('id');
    expect(sanitizeProfileName('foo&&bar')).toBe('foobar');
    expect(sanitizeProfileName('a|b')).toBe('ab');
  });
});

// =============================================================================
// Den Host unavailable/error state
// =============================================================================

describe('Den Host error state', () => {
  it('buildFleetSummary handles empty serviceUnits gracefully', () => {
    const response = fakeFleetOpsResponse({
      serviceUnits: [],
      recentRuns: [],
    });
    const summary = buildFleetSummary(response);
    expect(summary).toContain('0/0 running');
  });

  it('fakeFleetOpsResponse supports null discoveryDiagnostics', () => {
    const response = fakeFleetOpsResponse({ discoveryDiagnostics: null });
    expect(response.discoveryDiagnostics).toBeNull();
  });

  it('fakeFleetOpsResponse supports null recentRuns', () => {
    const response = fakeFleetOpsResponse({ recentRuns: [] });
    expect(response.recentRuns).toEqual([]);
  });
});

/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  unitStatusLabel,
  unitStatusClass,
  actionCategoryLabel,
  actionCategoryClass,
  isActionExecutable,
  extractProfileNames,
  sanitizeProfileName,
  diagnosticStatusClass,
  runStatusClass,
  runStatusLabel,
  buildFleetSummary,
  groupActionsByCategory,
  formatUptime,
  fakeFleetOpsResponse,
} from './fleetOpsModel';
import type { FleetOpsAction, FleetOpsServiceUnit } from '../../api/types';

describe('unitStatusLabel', () => {
  it('returns human-readable labels for known statuses', () => {
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

  it('passes through unknown statuses', () => {
    expect(unitStatusLabel('custom-status')).toBe('custom-status');
  });

  it('handles case-insensitively', () => {
    expect(unitStatusLabel('Running')).toBe('Running');
    expect(unitStatusLabel('FAILED')).toBe('Failed');
  });
});

describe('unitStatusClass', () => {
  it('returns appropriate CSS classes for each status', () => {
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

describe('actionCategoryLabel', () => {
  it('returns human-readable category labels', () => {
    expect(actionCategoryLabel('diagnostic')).toBe('Diagnostics');
    expect(actionCategoryLabel('restart')).toBe('Restart');
    expect(actionCategoryLabel('maintenance')).toBe('Maintenance');
    expect(actionCategoryLabel('other')).toBe('other');
  });
});

describe('actionCategoryClass', () => {
  it('returns sanitized CSS class names', () => {
    expect(actionCategoryClass('diagnostic')).toBe('fops-action-cat-diagnostic');
    expect(actionCategoryClass('restart')).toBe('fops-action-cat-restart');
    expect(actionCategoryClass('some category')).toBe('fops-action-cat-some-category');
  });
});

describe('isActionExecutable', () => {
  it('returns true for enabled non-high-risk actions', () => {
    const action: FleetOpsAction = {
      actionId: 'fleet-status',
      label: 'Fleet Status',
      category: 'diagnostic',
      enabled: true,
    };
    expect(isActionExecutable(action)).toBe(true);
  });

  it('returns false for disabled actions', () => {
    const action: FleetOpsAction = {
      actionId: 'purge-logs',
      label: 'Purge Logs',
      category: 'maintenance',
      enabled: false,
      highRisk: true,
    };
    expect(isActionExecutable(action)).toBe(false);
  });

  it('returns false for high-risk actions', () => {
    const action: FleetOpsAction = {
      actionId: 'nuke-all',
      label: 'Nuke All',
      category: 'maintenance',
      enabled: true,
      highRisk: true,
    };
    expect(isActionExecutable(action)).toBe(false);
  });

  it('returns true when highRisk is false or undefined', () => {
    expect(isActionExecutable({ actionId: 'a', label: 'A', category: 'diag', enabled: true, highRisk: false })).toBe(true);
    expect(isActionExecutable({ actionId: 'a', label: 'A', category: 'diag', enabled: true })).toBe(true);
  });
});

describe('extractProfileNames', () => {
  it('extracts profile names from service units', () => {
    const units: FleetOpsServiceUnit[] = [
      { name: 'hermes-coder', status: 'running', enabled: true, profile: 'hermes-coder' },
      { name: 'hermes-reviewer', status: 'running', enabled: true, profile: 'hermes-reviewer' },
      { name: 'den-core', status: 'running', enabled: true, profile: null },
    ];
    const profiles = extractProfileNames(units);
    expect(profiles).toEqual(['hermes-coder', 'hermes-reviewer']);
  });

  it('includes unit names as candidates when no profile is set', () => {
    const units: FleetOpsServiceUnit[] = [
      { name: 'some-agent', status: 'running', enabled: true, profile: null },
      { name: 'den-core', status: 'running', enabled: true, profile: null },
    ];
    const profiles = extractProfileNames(units);
    expect(profiles).toContain('some-agent');
    expect(profiles).not.toContain('den-core');
  });

  it('returns sorted unique names', () => {
    const units: FleetOpsServiceUnit[] = [
      { name: 'z-agent', status: 'running', enabled: true, profile: 'z-agent' },
      { name: 'a-agent', status: 'running', enabled: true, profile: 'a-agent' },
      { name: 'a-agent', status: 'stopped', enabled: true, profile: 'a-agent' },
    ];
    const profiles = extractProfileNames(units);
    expect(profiles).toEqual(['a-agent', 'z-agent']);
  });
});

describe('sanitizeProfileName', () => {
  it('allows alphanumeric, dash, underscore, dot', () => {
    expect(sanitizeProfileName('hermes-coder')).toBe('hermes-coder');
    expect(sanitizeProfileName('my_agent.v2')).toBe('my_agent.v2');
    expect(sanitizeProfileName('abc123')).toBe('abc123');
  });

  it('strips dangerous characters', () => {
    // Only alphanumeric, dash, underscore, dot are kept — spaces and special chars stripped
    expect(sanitizeProfileName('foo; rm -rf /')).toBe('foorm-rf');
    expect(sanitizeProfileName('$(evil)')).toBe('evil');
    expect(sanitizeProfileName('test-profile.v2')).toBe('test-profile.v2');
    expect(sanitizeProfileName('`whoami`')).toBe('whoami');
    expect(sanitizeProfileName('hello world')).toBe('helloworld');
  });
});

describe('diagnosticStatusClass', () => {
  it('returns correct CSS classes', () => {
    expect(diagnosticStatusClass('ok')).toBe('fops-diag-ok');
    expect(diagnosticStatusClass('warn')).toBe('fops-diag-warn');
    expect(diagnosticStatusClass('error')).toBe('fops-diag-error');
    expect(diagnosticStatusClass('unknown')).toBe('fops-diag-unknown');
    expect(diagnosticStatusClass('other')).toBe('fops-diag-unknown');
  });
});

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

describe('buildFleetSummary', () => {
  it('builds a summary string from the response', () => {
    const response = fakeFleetOpsResponse();
    const summary = buildFleetSummary(response);
    expect(summary).toContain('running');
  });

  it('reports failed count when present', () => {
    const response = fakeFleetOpsResponse({
      serviceUnits: [
        { name: 'svc-1', status: 'running', enabled: true },
        { name: 'svc-2', status: 'failed', enabled: true },
        { name: 'svc-3', status: 'crashed', enabled: true },
      ],
    });
    const summary = buildFleetSummary(response);
    expect(summary).toContain('2 failed');
  });
});

describe('groupActionsByCategory', () => {
  it('groups actions by category in canonical order', () => {
    const response = fakeFleetOpsResponse();
    const groups = groupActionsByCategory(response.actions);

    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].category).toBe('diagnostic');
    expect(groups[1].category).toBe('restart');
    expect(groups[2].category).toBe('maintenance');
  });

  it('handles empty actions list', () => {
    const groups = groupActionsByCategory([]);
    expect(groups).toEqual([]);
  });

  it('handles unknown categories', () => {
    const actions: FleetOpsAction[] = [
      { actionId: 'custom-action', label: 'Custom', category: 'custom-cat', enabled: true },
    ];
    const groups = groupActionsByCategory(actions);
    expect(groups.length).toBe(1);
    expect(groups[0].category).toBe('custom-cat');
  });
});

describe('formatUptime', () => {
  it('formats seconds', () => {
    expect(formatUptime(30)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatUptime(125)).toBe('2m 5s');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3720)).toBe('1h 2m');
  });

  it('formats days and hours', () => {
    expect(formatUptime(90000)).toBe('1d 1h');
  });

  it('returns placeholder for null/undefined', () => {
    expect(formatUptime(null)).toBe('—');
    expect(formatUptime(undefined)).toBe('—');
  });

  it('returns placeholder for negative', () => {
    expect(formatUptime(-1)).toBe('—');
  });
});

describe('fakeFleetOpsResponse', () => {
  it('creates a valid FleetOpsResponse with defaults', () => {
    const response = fakeFleetOpsResponse();
    expect(response.service).toBe('gateway-fleet-ops');
    expect(response.serviceUnits.length).toBeGreaterThanOrEqual(3);
    expect(response.actions.length).toBeGreaterThanOrEqual(3);
    expect(response.discoveryDiagnostics.length).toBeGreaterThanOrEqual(1);
    expect(response.recentRuns.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts overrides for service units', () => {
    const response = fakeFleetOpsResponse({
      serviceUnits: [
        { name: 'custom-svc', status: 'running', enabled: true },
      ],
    });
    expect(response.serviceUnits.length).toBe(1);
    expect(response.serviceUnits[0].name).toBe('custom-svc');
  });

  it('accepts overrides for actions', () => {
    const response = fakeFleetOpsResponse({
      actions: [
        { actionId: 'custom-action', label: 'Custom', category: 'test', enabled: true },
      ],
    });
    expect(response.actions.length).toBe(1);
    expect(response.actions[0].actionId).toBe('custom-action');
  });

  it('accepts overrides for recent runs', () => {
    const response = fakeFleetOpsResponse({
      recentRuns: [
        { runId: 'run-custom', actionId: 'fleet-status', dryRun: false, status: 'failed', startedAt: null, completedAt: null, error: 'timeout' },
      ],
    });
    expect(response.recentRuns.length).toBe(1);
    expect(response.recentRuns[0].error).toBe('timeout');
  });
});

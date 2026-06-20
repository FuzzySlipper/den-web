/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import {
  availabilityLabel,
  availabilityClass,
  groupByRole,
  filterArchivedMembers,
  filterCandidateWorkers,
  buildLobbySummary,
  formatObservedAt,
  fakeWorkerPoolPresence,
  fakeWorkerPoolMember,
} from './workerPool';
import type { WorkerPoolMemberPresence } from '@den-web/api/types';

describe('availabilityLabel', () => {
  it('returns human-readable labels for each availability state', () => {
    expect(availabilityLabel('idle')).toBe('Idle');
    expect(availabilityLabel('available')).toBe('Available');
    expect(availabilityLabel('leased')).toBe('Leased');
    expect(availabilityLabel('busy')).toBe('Busy');
    expect(availabilityLabel('draining')).toBe('Draining');
    expect(availabilityLabel('cleanup')).toBe('Cleanup');
    expect(availabilityLabel('quarantined')).toBe('Quarantined');
    expect(availabilityLabel('offline')).toBe('Offline');
    expect(availabilityLabel('unknown')).toBe('Unknown');
  });
});

describe('availabilityClass', () => {
  it('returns appropriate CSS classes', () => {
    expect(availabilityClass('idle')).toBe('wpool-avail-available');
    expect(availabilityClass('available')).toBe('wpool-avail-available');
    expect(availabilityClass('leased')).toBe('wpool-avail-leased');
    expect(availabilityClass('busy')).toBe('wpool-avail-busy');
    expect(availabilityClass('quarantined')).toBe('wpool-avail-quarantined');
    expect(availabilityClass('offline')).toBe('wpool-avail-offline');
    expect(availabilityClass('unknown')).toBe('wpool-avail-unknown');
  });
});

describe('groupByRole', () => {
  it('groups members by role and excludes legacy pilots from candidate counts', () => {
    const members: WorkerPoolMemberPresence[] = [
      fakeWorkerPoolMember({ identity: 'coder-1', role: 'coder', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'coder-2', role: 'coder', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'reviewer-1', role: 'reviewer', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'old-pilot', role: 'pilot', isLegacyPilot: true, isQuarantined: true }),
      fakeWorkerPoolMember({ identity: 'validator-1', role: 'validator', isLegacyPilot: false, isQuarantined: false }),
    ];

    const groups = groupByRole(members);

    expect(groups.length).toBe(4);

    const coderGroup = groups.find(g => g.role === 'coder');
    const reviewerGroup = groups.find(g => g.role === 'reviewer');
    const pilotGroup = groups.find(g => g.role === 'pilot');
    const validatorGroup = groups.find(g => g.role === 'validator');

    expect(coderGroup).toBeDefined();
    expect(coderGroup!.candidateCount).toBe(2);
    expect(coderGroup!.legacyPilotCount).toBe(0);
    expect(coderGroup!.quarantinedCount).toBe(0);
    expect(coderGroup!.members.length).toBe(2);

    expect(reviewerGroup).toBeDefined();
    expect(reviewerGroup!.candidateCount).toBe(1);

    expect(pilotGroup).toBeDefined();
    expect(pilotGroup!.candidateCount).toBe(0);
    expect(pilotGroup!.legacyPilotCount).toBe(1);
    expect(pilotGroup!.quarantinedCount).toBe(1);
    expect(pilotGroup!.members.length).toBe(1);

    expect(validatorGroup).toBeDefined();
    expect(validatorGroup!.candidateCount).toBe(1);
    expect(validatorGroup!.legacyPilotCount).toBe(0);
  });

  it('sorts groups by candidate count descending, then alphabetically', () => {
    const members: WorkerPoolMemberPresence[] = [
      fakeWorkerPoolMember({ identity: 'a', role: 'alpha', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'b', role: 'beta', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'b2', role: 'beta', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'g', role: 'gamma', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'g2', role: 'gamma', isLegacyPilot: false }),
      fakeWorkerPoolMember({ identity: 'g3', role: 'gamma', isLegacyPilot: false }),
    ];

    const groups = groupByRole(members);
    expect(groups.length).toBe(3);
    // gamma has 3, beta has 2, alpha has 1
    expect(groups[0].role).toBe('gamma');
    expect(groups[1].role).toBe('beta');
    expect(groups[2].role).toBe('alpha');
  });
});

describe('filterArchivedMembers', () => {
  it('returns only legacy pilot or quarantined members', () => {
    const members: WorkerPoolMemberPresence[] = [
      fakeWorkerPoolMember({ identity: 'norm', isLegacyPilot: false, isQuarantined: false }),
      fakeWorkerPoolMember({ identity: 'quar', isLegacyPilot: false, isQuarantined: true }),
      fakeWorkerPoolMember({ identity: 'pilot', isLegacyPilot: true, isQuarantined: false }),
      fakeWorkerPoolMember({ identity: 'both', isLegacyPilot: true, isQuarantined: true }),
    ];

    const archived = filterArchivedMembers(members);
    expect(archived.length).toBe(3);
    expect(archived.map(m => m.identity)).toEqual(['quar', 'pilot', 'both']);
  });
});

describe('filterCandidateWorkers', () => {
  it('returns only non-legacy, non-quarantined members', () => {
    const members: WorkerPoolMemberPresence[] = [
      fakeWorkerPoolMember({ identity: 'norm', isLegacyPilot: false, isQuarantined: false }),
      fakeWorkerPoolMember({ identity: 'quar', isLegacyPilot: false, isQuarantined: true }),
      fakeWorkerPoolMember({ identity: 'pilot', isLegacyPilot: true, isQuarantined: false }),
    ];

    const candidates = filterCandidateWorkers(members);
    expect(candidates.length).toBe(1);
    expect(candidates[0].identity).toBe('norm');
  });
});

describe('buildLobbySummary', () => {
  it('builds a concise summary string', () => {
    const presence = fakeWorkerPoolPresence({
      channelId: 604,
      availableCount: 2,
      totalCandidateCount: 4,
      roleCounts: { coder: 2, reviewer: 1, validator: 1 },
    });

    const summary = buildLobbySummary(presence);
    expect(summary).toContain('Channel #604');
    expect(summary).toContain('2 available');
    expect(summary).toContain('4 candidates');
    expect(summary).toContain('[coder: 2, reviewer: 1, validator: 1]');
  });
});

describe('formatObservedAt', () => {
  it('formats ISO timestamps', () => {
    const result = formatObservedAt('2026-05-30T10:00:00Z');
    expect(result).not.toBe('—');
    expect(result).not.toBe('2026-05-30T10:00:00Z');
  });

  it('returns placeholder for null', () => {
    expect(formatObservedAt(null)).toBe('—');
    expect(formatObservedAt(undefined)).toBe('—');
  });
});

describe('fakeWorkerPoolPresence', () => {
  it('creates a valid WorkerPoolLobbyPresence with defaults', () => {
    const presence = fakeWorkerPoolPresence();
    expect(presence.channelId).toBe(604);
    expect(presence.members.length).toBeGreaterThanOrEqual(4);
    expect(presence.availableCount).toBeGreaterThanOrEqual(1);
    expect(presence.totalCandidateCount).toBeGreaterThanOrEqual(3);
    expect(presence.roleCounts.coder).toBeGreaterThanOrEqual(1);

    // Includes legacy pilot in the fixture
    const pilot = presence.members.find(m => m.role === 'pilot');
    expect(pilot).toBeDefined();
    expect(pilot!.isLegacyPilot).toBe(true);
    expect(pilot!.isQuarantined).toBe(true);
  });

  it('accepts overrides for all fields', () => {
    const customMember: WorkerPoolMemberPresence = {
      identity: 'custom-agent',
      role: 'custom',
      availabilityState: 'busy',
      statusDetail: 'Working on assignment',
      activeAssignmentCount: 2,
      completedAssignmentCount: 10,
      activeAssignmentIds: ['del-abc', 'del-def'],
      lastSeenAt: '2026-05-30T12:00:00Z',
      isLegacyPilot: false,
      isQuarantined: false,
    };

    const presence = fakeWorkerPoolPresence({
      channelId: 100,
      availableCount: 0,
      totalCandidateCount: 1,
      members: [customMember],
      observedAt: '2026-05-30T12:00:00Z',
    });

    expect(presence.channelId).toBe(100);
    expect(presence.availableCount).toBe(0);
    expect(presence.totalCandidateCount).toBe(1);
    expect(presence.members.length).toBe(1);
    expect(presence.members[0].identity).toBe('custom-agent');
    expect(presence.members[0].availabilityState).toBe('busy');
    expect(presence.members[0].activeAssignmentIds).toEqual(['del-abc', 'del-def']);
  });
});

describe('fakeWorkerPoolMember', () => {
  it('creates a valid WorkerPoolMemberPresence with defaults', () => {
    const member = fakeWorkerPoolMember();
    expect(member.identity).toBe('hermes-coder');
    expect(member.role).toBe('coder');
    expect(member.availabilityState).toBe('available');
    expect(member.isLegacyPilot).toBe(false);
    expect(member.isQuarantined).toBe(false);
  });

  it('accepts overrides', () => {
    const member = fakeWorkerPoolMember({ identity: 'custom', isLegacyPilot: true });
    expect(member.identity).toBe('custom');
    expect(member.role).toBe('coder');
    expect(member.isLegacyPilot).toBe(true);
  });
});

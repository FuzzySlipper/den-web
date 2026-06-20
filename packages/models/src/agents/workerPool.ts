/**
 * Worker Pool Lobby Render Model — task #1781
 *
 * Pure-model helpers for the WorkerPoolLobbyView component. All
 * availability-state labels, CSS classes, role grouping, and fixture
 * factories live here so the TSX stays focused on layout.
 */

import type {
  WorkerPoolLobbyPresence,
  WorkerPoolMemberPresence,
  WorkerPoolAvailabilityState,
} from '@den-web/api/types';

// Re-export for convenience
export type { WorkerPoolAvailabilityState };

// =============================================================================
// Availability state helpers
// =============================================================================

export function availabilityLabel(state: WorkerPoolAvailabilityState): string {
  switch (state) {
    case 'idle': return 'Idle';
    case 'available': return 'Available';
    case 'leased': return 'Leased';
    case 'busy': return 'Busy';
    case 'draining': return 'Draining';
    case 'cleanup': return 'Cleanup';
    case 'quarantined': return 'Quarantined';
    case 'offline': return 'Offline';
    case 'unknown': return 'Unknown';
    default: return state satisfies never;
  }
}

export function availabilityClass(state: WorkerPoolAvailabilityState): string {
  switch (state) {
    case 'idle': return 'wpool-avail-available';
    case 'available': return 'wpool-avail-available';
    case 'leased': return 'wpool-avail-leased';
    case 'busy': return 'wpool-avail-busy';
    case 'draining': return 'wpool-avail-draining';
    case 'cleanup': return 'wpool-avail-cleanup';
    case 'quarantined': return 'wpool-avail-quarantined';
    case 'offline': return 'wpool-avail-offline';
    case 'unknown': return 'wpool-avail-unknown';
    default: return 'wpool-avail-unknown';
  }
}

// =============================================================================
// Role grouping
// =============================================================================

export interface RoleGroup {
  role: string;
  members: WorkerPoolMemberPresence[];
  candidateCount: number;
  quarantinedCount: number;
  legacyPilotCount: number;
}

/**
 * Group members by role, separating candidate workers from legacy pilots
 * and quarantined entries.
 */
export function groupByRole(members: WorkerPoolMemberPresence[]): RoleGroup[] {
  const groups = new Map<string, WorkerPoolMemberPresence[]>();

  for (const member of members) {
    const list = groups.get(member.role) ?? [];
    list.push(member);
    groups.set(member.role, list);
  }

  const result: RoleGroup[] = [];
  for (const [role, roleMembers] of groups) {
    const candidates = roleMembers.filter(m => !m.isLegacyPilot);
    result.push({
      role,
      members: roleMembers,
      candidateCount: candidates.length,
      quarantinedCount: roleMembers.filter(m => m.isQuarantined).length,
      legacyPilotCount: roleMembers.filter(m => m.isLegacyPilot).length,
    });
  }

  // Sort roles: most candidates first, then alphabetically
  result.sort((a, b) => {
    if (a.candidateCount !== b.candidateCount) return b.candidateCount - a.candidateCount;
    return a.role.localeCompare(b.role);
  });

  return result;
}

/**
 * Filter to only legacy/quarantined members for the archived section.
 */
export function filterArchivedMembers(members: WorkerPoolMemberPresence[]): WorkerPoolMemberPresence[] {
  return members.filter(m => m.isLegacyPilot || m.isQuarantined);
}

/**
 * Filter to candidate workers only (not legacy pilot, not quarantined).
 */
export function filterCandidateWorkers(members: WorkerPoolMemberPresence[]): WorkerPoolMemberPresence[] {
  return members.filter(m => !m.isLegacyPilot && !m.isQuarantined);
}

// =============================================================================
// Summary line
// =============================================================================

export function buildLobbySummary(presence: WorkerPoolLobbyPresence): string {
  const roleCounts = presence.roleCounts ?? {};
  const parts: string[] = [];
  parts.push(`Channel #${presence.channelId}`);
  parts.push(`${presence.availableCount} available`);
  parts.push(`${presence.totalCandidateCount} candidates`);
  const roleLabels = Object.entries(roleCounts)
    .map(([role, count]) => `${role}: ${count}`)
    .join(', ');
  if (roleLabels) parts.push(`[${roleLabels}]`);
  return parts.join(' · ');
}

// =============================================================================
// Formatting
// =============================================================================

export function formatObservedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    return date.toLocaleString();
  } catch {
    return iso ?? '—';
  }
}

// =============================================================================
// Fake fixture factory for testing
// =============================================================================

export interface WorkerPoolPresenceFixtureOpts {
  channelId?: number;
  availableCount?: number;
  totalCandidateCount?: number;
  roleCounts?: Record<string, number>;
  members?: Partial<WorkerPoolMemberPresence>[];
  observedAt?: string;
}

export function fakeWorkerPoolPresence(opts: WorkerPoolPresenceFixtureOpts = {}): WorkerPoolLobbyPresence {
  const defaultMembers: WorkerPoolMemberPresence[] = [
    {
      identity: 'hermes-coder',
      role: 'coder',
      availabilityState: 'available',
      statusDetail: null,
      activeAssignmentCount: 0,
      completedAssignmentCount: 12,
      activeAssignmentIds: [],
      lastSeenAt: '2026-05-30T10:00:00Z',
      isLegacyPilot: false,
      isQuarantined: false,
    },
    {
      identity: 'hermes-reviewer',
      role: 'reviewer',
      availabilityState: 'available',
      statusDetail: null,
      activeAssignmentCount: 0,
      completedAssignmentCount: 8,
      activeAssignmentIds: [],
      lastSeenAt: '2026-05-30T10:01:00Z',
      isLegacyPilot: false,
      isQuarantined: false,
    },
    {
      identity: 'den-hermes-runner',
      role: 'pilot',
      availabilityState: 'quarantined',
      statusDetail: 'Legacy pilot — quarantined in core',
      activeAssignmentCount: 0,
      completedAssignmentCount: 45,
      activeAssignmentIds: [],
      lastSeenAt: '2026-05-28T15:00:00Z',
      isLegacyPilot: true,
      isQuarantined: true,
    },
    {
      identity: 'hermes-validator',
      role: 'validator',
      availabilityState: 'leased',
      statusDetail: 'Assignment del-xyz-789',
      activeAssignmentCount: 1,
      completedAssignmentCount: 5,
      activeAssignmentIds: ['del-xyz-789'],
      lastSeenAt: '2026-05-30T09:55:00Z',
      isLegacyPilot: false,
      isQuarantined: false,
    },
  ];

  const customMembers = (opts.members ?? []).map((m, i) => ({
    ...defaultMembers[i] ?? defaultMembers[0],
    ...m,
  }));

  const members = customMembers.length > 0 ? customMembers : defaultMembers;

  const candidateCount = opts.totalCandidateCount ?? members.filter(m => !m.isLegacyPilot).length;
  const availCount = opts.availableCount ?? members.filter(m => m.availabilityState === 'available').length;

  const roleCounts: Record<string, number> = {};
  for (const m of members) {
    if (!m.isLegacyPilot) {
      roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1;
    }
  }

  return {
    channelId: opts.channelId ?? 604,
    availableCount: availCount,
    totalCandidateCount: candidateCount,
    roleCounts: opts.roleCounts ?? roleCounts,
    members,
    observedAt: opts.observedAt ?? '2026-05-30T10:05:00Z',
  };
}

export function fakeWorkerPoolMember(overrides: Partial<WorkerPoolMemberPresence> = {}): WorkerPoolMemberPresence {
  return {
    identity: 'hermes-coder',
    role: 'coder',
    availabilityState: 'available',
    statusDetail: null,
    activeAssignmentCount: 0,
    completedAssignmentCount: 12,
    activeAssignmentIds: [],
    lastSeenAt: '2026-05-30T10:00:00Z',
    isLegacyPilot: false,
    isQuarantined: false,
    ...overrides,
  };
}

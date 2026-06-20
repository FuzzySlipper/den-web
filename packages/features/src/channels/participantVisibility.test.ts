import { describe, expect, it } from 'vitest';
import type { GatewayMember } from '@den-web/api/types';
import {
  LEFT_PARTICIPANT_GRACE_MINUTES,
  NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS,
  departedAt,
  isVisibleNormalParticipant,
} from './participantVisibility';

function member(overrides: Partial<GatewayMember>): GatewayMember {
  return {
    id: 1,
    memberType: 'agent',
    memberIdentity: 'agent-a',
    membershipStatus: 'active',
    wakePolicy: 'mentions_only',
    canSend: true,
    canReact: true,
    canInvite: false,
    cooldownSeconds: 60,
    maxAutoRepliesPerWindow: 1,
    settingsLabel: null,
    ...overrides,
  };
}

describe('participant visibility', () => {
  const now = new Date('2026-06-04T12:00:00Z');

  it('requests the backend normal participant grace projection', () => {
    expect(NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS).toEqual({
      includeLeft: true,
      leftGraceMinutes: LEFT_PARTICIPANT_GRACE_MINUTES,
    });
  });

  it('keeps active participants and recently-left participants visible', () => {
    expect(isVisibleNormalParticipant(member({ membershipStatus: 'active' }), now)).toBe(true);
    expect(isVisibleNormalParticipant(member({ membershipStatus: 'muted' }), now)).toBe(true);
    expect(isVisibleNormalParticipant(member({
      membershipStatus: 'left',
      leftAt: '2026-06-04T11:45:00Z',
    }), now)).toBe(true);
  });

  it('hides stale or unknown-age left participants from normal lists', () => {
    expect(isVisibleNormalParticipant(member({
      membershipStatus: 'left',
      leftAt: '2026-06-04T11:29:59Z',
    }), now)).toBe(false);
    expect(isVisibleNormalParticipant(member({ membershipStatus: 'left' }), now)).toBe(false);
  });

  it('falls back to updatedAt as departure evidence for left memberships', () => {
    const left = member({ membershipStatus: 'left', updatedAt: '2026-06-04T11:55:00Z' });
    expect(departedAt(left)).toBe('2026-06-04T11:55:00Z');
    expect(isVisibleNormalParticipant(left, now)).toBe(true);
  });
});

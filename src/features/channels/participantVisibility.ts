import type { GatewayMember } from '../../api/types';

export const LEFT_PARTICIPANT_GRACE_MINUTES = 30;

export interface GatewayMembershipVisibilityOptions {
  includeLeft: boolean;
  leftGraceMinutes: number;
}

export const NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS: GatewayMembershipVisibilityOptions = {
  includeLeft: true,
  leftGraceMinutes: LEFT_PARTICIPANT_GRACE_MINUTES,
};

export function departedAt(member: GatewayMember): string | null {
  if (member.membershipStatus !== 'left') return null;
  return member.leftAt ?? member.updatedAt ?? null;
}

export function isVisibleNormalParticipant(
  member: GatewayMember,
  now: Date = new Date(),
  graceMinutes: number = LEFT_PARTICIPANT_GRACE_MINUTES,
): boolean {
  if (member.membershipStatus !== 'left') return true;
  const departed = departedAt(member);
  if (!departed) return false;
  const departedMs = Date.parse(departed);
  if (Number.isNaN(departedMs)) return false;
  const graceMs = Math.max(0, graceMinutes) * 60_000;
  return now.getTime() - departedMs <= graceMs;
}

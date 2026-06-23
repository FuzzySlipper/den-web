import { describe, expect, it } from 'vitest';
import type { GatewayMember } from '@den-web/api/types';
import {
  resolveEditingMemberForChannelMembers,
  resolveInviteExistingMemberForChannelMembers,
} from './useChannelChatData';

function member(overrides: Partial<GatewayMember> & { id: number; memberIdentity: string }): GatewayMember {
  return {
    memberType: 'agent',
    membershipStatus: 'active',
    wakePolicy: 'mentions_only',
    canSend: true,
    canReact: true,
    canInvite: false,
    cooldownSeconds: 60,
    maxAutoRepliesPerWindow: 1,
    settingsLabel: null,
    createdAt: null,
    updatedAt: null,
    leftAt: null,
    membershipPurpose: null,
    ...overrides,
  };
}

describe('resolveEditingMemberForChannelMembers', () => {
  it('resolves by id when duplicate identities have different purposes', () => {
    const members = [
      member({ id: 581, memberIdentity: 'agora-prime', membershipStatus: 'left', membershipPurpose: 'normal' }),
      member({ id: 128, memberIdentity: 'agora-prime', membershipStatus: 'active', membershipPurpose: 'ordinary' }),
    ];
    // User clicked the ordinary/active row (id 128)
    const result = resolveEditingMemberForChannelMembers(members, 128, 'agora-prime');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(128);
    expect(result!.membershipPurpose).toBe('ordinary');
    expect(result!.membershipStatus).toBe('active');
  });

  it('resolves by id even when the id targets the left row', () => {
    const members = [
      member({ id: 581, memberIdentity: 'agora-prime', membershipStatus: 'left', membershipPurpose: 'normal' }),
      member({ id: 128, memberIdentity: 'agora-prime', membershipStatus: 'active', membershipPurpose: 'ordinary' }),
    ];
    const result = resolveEditingMemberForChannelMembers(members, 581, 'agora-prime');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(581);
    expect(result!.membershipStatus).toBe('left');
  });

  it('falls back to identity when memberId is null', () => {
    const members = [
      member({ id: 1, memberIdentity: 'agent-a', membershipPurpose: 'ordinary' }),
    ];
    const result = resolveEditingMemberForChannelMembers(members, null, 'agent-a');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
  });

  it('returns null when no member matches', () => {
    const result = resolveEditingMemberForChannelMembers([], null, 'unknown');
    expect(result).toBeNull();
  });
});

describe('resolveInviteExistingMemberForChannelMembers', () => {
  it('prefers the active row when duplicates exist with different statuses', () => {
    const members = [
      member({ id: 581, memberIdentity: 'agora-prime', membershipStatus: 'left', membershipPurpose: 'normal' }),
      member({ id: 128, memberIdentity: 'agora-prime', membershipStatus: 'active', membershipPurpose: 'ordinary' }),
    ];
    const result = resolveInviteExistingMemberForChannelMembers(members, 'agora-prime');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(128);
    expect(result!.membershipStatus).toBe('active');
  });

  it('returns the only candidate when no duplicates', () => {
    const members = [
      member({ id: 1, memberIdentity: 'agent-a', membershipStatus: 'active' }),
    ];
    const result = resolveInviteExistingMemberForChannelMembers(members, 'agent-a');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.membershipStatus).toBe('active');
  });

  it('returns null when no match for the invite identity', () => {
    const result = resolveInviteExistingMemberForChannelMembers([member({ id: 1, memberIdentity: 'agent-a' })], 'agent-b');
    expect(result).toBeNull();
  });

  it('returns null for empty identity', () => {
    const result = resolveInviteExistingMemberForChannelMembers([member({ id: 1, memberIdentity: 'agent-a' })], '');
    expect(result).toBeNull();
  });
});

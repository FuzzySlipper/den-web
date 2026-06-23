import { useCallback, useState } from 'react';
import type { GatewayMember } from '@den-web/api/types';
import { upsertChannelMembership } from '@den-web/api/client';
import { DEFAULT_WAKE_POLICY } from './channelParticipantOptions';
import type { useChannelChatData } from './useChannelChatData';
import { membershipWriteChannelId } from './channelMembershipLookup';

type ChatData = ReturnType<typeof useChannelChatData>;

interface Options {
  activeChannel: ChatData['activeChannel'];
  editingMember: ChatData['editingMember'];
  editingMembershipStatus: string;
  editingWakePolicy: string;
  inviteExistingMember: ChatData['inviteExistingMember'];
  inviteIdentity: string;
  inviteWakePolicy: string;
  membershipChannelId: number | null;
  refreshMemberships: () => void;
  setEditingMembershipStatus: (status: string) => void;
  setEditingMemberIdentity: (identity: string | null) => void;
  setEditingMemberId: (id: number | null) => void;
  setEditingWakePolicy: (wakePolicy: string) => void;
  setInviteIdentity: (identity: string) => void;
  setSendError: (error: Error | null) => void;
}

export function useChannelMembershipActions({
  activeChannel,
  editingMember,
  editingMembershipStatus,
  editingWakePolicy,
  inviteExistingMember,
  inviteIdentity,
  inviteWakePolicy,
  membershipChannelId,
  refreshMemberships,
  setEditingMembershipStatus,
  setEditingMemberIdentity,
  setEditingMemberId,
  setEditingWakePolicy,
  setInviteIdentity,
  setSendError,
}: Options) {
  const [inviteSending, setInviteSending] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);

  const handleInviteAgent = useCallback(async () => {
    const identity = inviteIdentity.trim();
    if (!activeChannel || !identity) return;
    setInviteSending(true);
    setSendError(null);
    try {
      const writeChannelId = membershipWriteChannelId(activeChannel, membershipChannelId);
      if (!writeChannelId) return;
      await upsertChannelMembership(writeChannelId, {
        memberType: 'agent',
        memberIdentity: identity,
        membershipStatus: inviteExistingMember?.membershipStatus ?? 'active',
        wakePolicy: inviteWakePolicy,
        canSend: inviteExistingMember?.canSend ?? true,
        canReact: inviteExistingMember?.canReact ?? true,
        canInvite: inviteExistingMember?.canInvite ?? false,
        membershipPurpose: inviteExistingMember?.membershipPurpose ?? null,
        cooldownSeconds: inviteExistingMember?.cooldownSeconds,
        maxAutoRepliesPerWindow: inviteExistingMember?.maxAutoRepliesPerWindow,
      });
      refreshMemberships();
      setInviteIdentity('');
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setInviteSending(false);
    }
  }, [activeChannel, inviteExistingMember, inviteIdentity, inviteWakePolicy, membershipChannelId, refreshMemberships, setInviteIdentity, setSendError]);

  const handleEditMember = useCallback((member: GatewayMember) => {
    setEditingMemberIdentity(member.memberIdentity);
    setEditingMemberId(member.id);
    setEditingWakePolicy(member.wakePolicy || DEFAULT_WAKE_POLICY);
    setEditingMembershipStatus(member.membershipStatus || 'active');
  }, [setEditingMembershipStatus, setEditingMemberIdentity, setEditingMemberId, setEditingWakePolicy]);

  const handleSaveMemberSettings = useCallback(async () => {
    if (!activeChannel || !editingMember) return;
    setMemberSaving(true);
    setSendError(null);
    try {
      const writeChannelId = membershipWriteChannelId(activeChannel, membershipChannelId);
      if (!writeChannelId) return;
      await upsertChannelMembership(writeChannelId, {
        memberType: editingMember.memberType,
        memberIdentity: editingMember.memberIdentity,
        membershipStatus: editingMembershipStatus,
        wakePolicy: editingWakePolicy,
        canSend: editingMember.canSend,
        canReact: editingMember.canReact,
        canInvite: editingMember.canInvite,
        membershipPurpose: editingMember.membershipPurpose ?? null,
        cooldownSeconds: editingMember.cooldownSeconds,
        maxAutoRepliesPerWindow: editingMember.maxAutoRepliesPerWindow,
      });
      setEditingMemberIdentity(null);
      setEditingMemberId(null);
      refreshMemberships();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setMemberSaving(false);
    }
  }, [activeChannel, editingMember, editingMembershipStatus, editingWakePolicy, membershipChannelId, refreshMemberships, setEditingMemberIdentity, setEditingMemberId, setSendError]);

  return {
    handleEditMember,
    handleInviteAgent,
    handleSaveMemberSettings,
    inviteSending,
    memberSaving,
  };
}

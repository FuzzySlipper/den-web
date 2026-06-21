import type { ChannelSendMode } from './useComposerHotkeys';
import type { useChannelChatData } from './useChannelChatData';
import { useChannelMembershipActions } from './useChannelMembershipActions';
import { useChannelMessageActions } from './useChannelMessageActions';

type ChatData = ReturnType<typeof useChannelChatData>;

export function useChannelChatActions({
  activeAgentMembers,
  activeChannel,
  composer,
  editingMember,
  editingMembershipStatus,
  editingWakePolicy,
  inviteExistingMember,
  inviteIdentity,
  inviteWakePolicy,
  membershipChannelId,
  normalizedSenderIdentity,
  projectId,
  refreshActivityEvents,
  refreshMemberships,
  refreshMessages,
  refreshReactions,
  selectedTarget,
  sendMode,
  setEditingMembershipStatus,
  setEditingMemberIdentity,
  setEditingWakePolicy,
  setInviteIdentity,
  targetMemberIdentity,
}: {
  activeAgentMembers: ChatData['activeAgentMembers'];
  activeChannel: ChatData['activeChannel'];
  composer: ChatData['composer'];
  editingMember: ChatData['editingMember'];
  editingMembershipStatus: string;
  editingWakePolicy: string;
  inviteExistingMember: ChatData['inviteExistingMember'];
  inviteIdentity: string;
  inviteWakePolicy: string;
  membershipChannelId: number | null;
  normalizedSenderIdentity: string;
  projectId: string | null;
  refreshActivityEvents: () => void;
  refreshMemberships: () => void;
  refreshMessages: () => void;
  refreshReactions: () => void;
  selectedTarget: ChatData['selectedTarget'];
  sendMode: ChannelSendMode;
  setEditingMembershipStatus: (status: string) => void;
  setEditingMemberIdentity: (identity: string | null) => void;
  setEditingWakePolicy: (wakePolicy: string) => void;
  setInviteIdentity: (identity: string) => void;
  targetMemberIdentity: string;
}) {
  const {
    handleClarifyChoice,
    handleReactToMessage,
    handleSubmit,
    sendError,
    sending,
    setSendError,
  } = useChannelMessageActions({
    activeAgentMembers,
    activeChannel,
    composer,
    normalizedSenderIdentity,
    projectId,
    refreshActivityEvents,
    refreshMessages,
    refreshReactions,
    selectedTarget,
    sendMode,
    targetMemberIdentity,
  });
  const {
    handleEditMember,
    handleInviteAgent,
    handleSaveMemberSettings,
    inviteSending,
    memberSaving,
  } = useChannelMembershipActions({
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
    setEditingWakePolicy,
    setInviteIdentity,
    setSendError,
  });

  return {
    handleClarifyChoice,
    handleEditMember,
    handleInviteAgent,
    handleReactToMessage,
    handleSaveMemberSettings,
    handleSubmit,
    inviteSending,
    memberSaving,
    sendError,
    sending,
  };
}

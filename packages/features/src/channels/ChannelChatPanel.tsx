import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, UIEvent } from 'react';
import { useComposerHotkeys } from './useComposerHotkeys';
import type { ChannelSendMode } from './useComposerHotkeys';
import { AgentWorkOpsPanel } from './AgentWorkOpsPanel';
import { persistSenderIdentity, readStoredSenderIdentity } from './channelChatStorage';
import { channelLabel } from '@den-web/models/channels/chatDisplay';
import { isScrollElementPinnedToBottom } from './channelScroll';
import { DEFAULT_WAKE_POLICY } from './channelParticipantOptions';
import { ChannelChatHeader } from './ChannelChatHeader';
import { ChannelMessageList } from './ChannelMessageList';
import { ChannelParticipants } from './ChannelParticipants';
import { ChannelComposer } from './ChannelComposer';
import { useChannelChatData } from './useChannelChatData';
import { useChannelAutoScroll } from './useChannelAutoScroll';
import { useChannelChatActions } from './useChannelChatActions';

const QUICK_REACTIONS = ['✅', '👀', '👍', '🫡', '❓'];

interface Props {
  projectId: string | null;
  spaceName?: string | null;
  panelSize: ChannelChatPanelSize;
  scrollResetKey?: string | null;
  onPanelSizeChange: (size: ChannelChatPanelSize) => void;
  onOpenPreferences: () => void;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
  onOpenDmTranscript?: (agentIdentity: string) => void;
}

export type ChannelChatPanelSize = 'small' | 'medium' | 'large';

export function ChannelChatPanel({ projectId, spaceName, panelSize, scrollResetKey, onPanelSizeChange, onOpenPreferences, onOpenAssignmentTrace, onOpenDmTranscript }: Props) {
  const [senderIdentity, setSenderIdentity] = useState(readStoredSenderIdentity);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [sendMode, setSendMode] = useState<ChannelSendMode>('channel');
  const [autoScroll, setAutoScroll] = useState(true);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const scrollbackRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isScrollPinnedToBottomRef = useRef(true);
  const previousAutoScrollKeyRef = useRef<string | null>(null);
  const pendingAutoScrollSnapKeyRef = useRef<string | null>(null);
  const pendingAutoScrollObservedLoadingRef = useRef(false);
  const [projectAttributionFilter, setProjectAttributionFilter] = useState('');
  const [targetMemberIdentity, setTargetMemberIdentity] = useState('');
  const [inviteIdentity, setInviteIdentity] = useState('');
  const [inviteWakePolicy, setInviteWakePolicy] = useState(DEFAULT_WAKE_POLICY);
  const [editingMemberIdentity, setEditingMemberIdentity] = useState<string | null>(null);
  const [editingWakePolicy, setEditingWakePolicy] = useState(DEFAULT_WAKE_POLICY);
  const [editingMembershipStatus, setEditingMembershipStatus] = useState('active');
  const normalizedSenderIdentity = senderIdentity.trim();

  const {
    activeAgentMembers,
    activeChannel,
    activeChannelLinkedProjectIds,
    activityEventsByMessageId,
    activityState,
    agentWorkCurrentState,
    agentWorkEventsState,
    availableChannels,
    channelError,
    channelStatus,
    channelStream,
    composer,
    deliveryProgressBlocks,
    directAgentEventsState,
    displayedMessages,
    editingMember,
    inviteExistingMember,
    isMessageSearchActive,
    memberActivityByIdentity,
    members,
    membershipsState,
    messagesState,
    observationActiveWorkState,
    observationLaneState,
    reactionsByMessageId,
    reactionsState,
    refreshChannels,
    scopedActivityEvents,
    scopedAgentWorkCurrent,
    scopedAgentWorkEvents,
    scopedDirectAgentEvents,
    selectedTarget,
    sortedMessages,
    unanchoredActivityEvents,
  } = useChannelChatData({
    projectId,
    spaceName,
    normalizedSenderIdentity,
    selectedChannelId,
    setSelectedChannelId,
    projectAttributionFilter,
    setProjectAttributionFilter,
    messageSearchQuery,
    targetMemberIdentity,
    setTargetMemberIdentity,
    inviteIdentity,
    editingMemberIdentity,
  });

  const { loading: messagesLoading, error: messagesError, refresh: refreshMessages } = messagesState;
  const { loading: activityLoading, error: activityError, refresh: refreshActivityEvents } = activityState;
  const { loading: observationLaneLoading, error: observationLaneError, refresh: refreshObservationLane } = observationLaneState;
  const agentWorkCurrentLoading = agentWorkCurrentState.loading;
  const agentWorkCurrentError = agentWorkCurrentState.error;
  const refreshAgentWorkCurrent = agentWorkCurrentState.refresh;
  const agentWorkEventsLoading = agentWorkEventsState.loading;
  const agentWorkEventsError = agentWorkEventsState.error;
  const refreshAgentWorkEvents = agentWorkEventsState.refresh;
  const directAgentEventsLoading = directAgentEventsState.loading;
  const directAgentEventsError = directAgentEventsState.error;
  const refreshDirectAgentEvents = directAgentEventsState.refresh;
  const { refresh: refreshReactions } = reactionsState;
  const { loading: membershipsLoading, error: membershipsError, refresh: refreshMemberships } = membershipsState;
  const availableTargets = useMemo(
    () => activeAgentMembers.map(member => member.memberIdentity),
    [activeAgentMembers],
  );
  const refreshAgentWorkEvidence = useCallback(() => {
    refreshAgentWorkCurrent();
    refreshAgentWorkEvents();
    refreshActivityEvents();
    refreshObservationLane();
    refreshDirectAgentEvents();
  }, [refreshActivityEvents, refreshAgentWorkCurrent, refreshAgentWorkEvents, refreshDirectAgentEvents, refreshObservationLane]);

  const { onComposerHotkey, bindings } = useComposerHotkeys({
    sendMode,
    onSetSendMode: setSendMode,
    targetMemberIdentity,
    onSetTargetMemberIdentity: setTargetMemberIdentity,
    availableTargets,
  });

  const {
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
  } = useChannelChatActions({
    activeAgentMembers,
    activeChannel,
    composer,
    editingMember,
    editingMembershipStatus,
    editingWakePolicy,
    inviteExistingMember,
    inviteIdentity,
    inviteWakePolicy,
    membershipChannelId: membershipsState.data?.channelId ?? null,
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
  });

  const disabledReason = channelError
    ? 'Channel unavailable. Check den-channels API health.'
    : null;
  const agentWorkLoading = agentWorkCurrentLoading || agentWorkEventsLoading || directAgentEventsLoading || activityLoading || observationLaneLoading || observationActiveWorkState.loading;
  const agentWorkError = agentWorkCurrentError ?? agentWorkEventsError ?? directAgentEventsError ?? observationLaneError ?? observationActiveWorkState.error ?? null;
  const identityRequired = normalizedSenderIdentity.length === 0;
  const directModeRequiresTarget = sendMode === 'direct' && !selectedTarget;
  const isComposerDisabled = !activeChannel || sending || Boolean(disabledReason) || identityRequired || directModeRequiresTarget;
  const handleSenderIdentityChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSenderIdentity(value);
    persistSenderIdentity(value);
  }, []);

  const handleScrollbackScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    isScrollPinnedToBottomRef.current = isScrollElementPinnedToBottom(event.currentTarget);
  }, []);

  const handleRefreshAll = useCallback(() => {
    refreshChannels();
    refreshMessages();
    refreshActivityEvents();
    refreshAgentWorkEvidence();
    refreshReactions();
    refreshMemberships();
  }, [refreshActivityEvents, refreshAgentWorkEvidence, refreshChannels, refreshMemberships, refreshMessages, refreshReactions]);

  const composerPlaceholder = identityRequired
    ? 'Set Posting as before sending'
    : sendMode === 'direct' && selectedTarget
        ? `Direct message ${selectedTarget.memberIdentity} in ${channelLabel(activeChannel, projectId)}`
        : sendMode === 'direct'
          ? 'Join or select an agent before sending a direct message'
          : `Message ${channelLabel(activeChannel, projectId)}`;

  useChannelAutoScroll({
    activeChannel,
    activityLoading: activityLoading || observationLaneLoading,
    autoScroll,
    displayedMessageCount: displayedMessages.length,
    isScrollPinnedToBottomRef,
    messagesLoading,
    pendingAutoScrollObservedLoadingRef,
    pendingAutoScrollSnapKeyRef,
    previousAutoScrollKeyRef,
    projectId,
    scopedActivityEventCount: scopedActivityEvents.length,
    scrollResetKey,
    scrollbackRef,
  });

  return (
    <section className={`panel channel-chat-panel channel-chat-panel-size-${panelSize}`} aria-label="Project channel chat">
      <ChannelChatHeader
        activeChannel={activeChannel}
        projectId={projectId}
        channelStatus={channelStatus}
        streamStatus={channelStream.status}
        panelSize={panelSize}
        onPanelSizeChange={onPanelSizeChange}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onOpenPreferences={onOpenPreferences}
        senderIdentity={senderIdentity}
        onSenderIdentityChange={handleSenderIdentityChange}
        availableChannels={availableChannels}
        onSelectChannel={setSelectedChannelId}
        activeChannelLinkedProjectIds={activeChannelLinkedProjectIds}
        projectAttributionFilter={projectAttributionFilter}
        onProjectAttributionFilterChange={setProjectAttributionFilter}
        messageSearchQuery={messageSearchQuery}
        onMessageSearchQueryChange={setMessageSearchQuery}
        onRefresh={handleRefreshAll}
      />

      <div className="channel-chat-body-region">
        <ChannelMessageList
          activeChannel={activeChannel}
          sortedMessages={sortedMessages}
          displayedMessages={displayedMessages}
          unanchoredActivityEvents={unanchoredActivityEvents}
          deliveryProgressBlocks={deliveryProgressBlocks}
          reactionsByMessageId={reactionsByMessageId}
          activityEventsByMessageId={activityEventsByMessageId}
          messagesLoading={messagesLoading}
          activityLoading={activityLoading || observationLaneLoading}
          messagesError={messagesError}
          activityError={activityError ?? observationLaneError}
          disabledReason={disabledReason}
          isMessageSearchActive={isMessageSearchActive}
          messageSearchQuery={messageSearchQuery}
          identityRequired={identityRequired}
          quickReactions={QUICK_REACTIONS}
          scrollbackRef={scrollbackRef}
          scrollAnchorRef={scrollAnchorRef}
          onScrollbackScroll={handleScrollbackScroll}
          onReactToMessage={handleReactToMessage}
          onOpenAssignmentTrace={onOpenAssignmentTrace}
          onSendChoice={handleClarifyChoice}
        />

        <aside className="channel-chat-members" aria-label="Channel participants, current agent work, and active Hermes profile bindings">
          <AgentWorkOpsPanel
            current={scopedAgentWorkCurrent}
            lifecycle={scopedAgentWorkEvents}
            activityEvents={scopedActivityEvents}
            directAgentEvents={scopedDirectAgentEvents}
            loading={agentWorkLoading}
            error={agentWorkError}
            onRefresh={refreshAgentWorkEvidence}
            projectId={projectId}
            onOpenAssignmentTrace={onOpenAssignmentTrace}
          />
          <ChannelParticipants
            activeChannel={activeChannel}
            members={members}
            membershipsLoading={membershipsLoading}
            membershipsError={membershipsError}
            memberActivityByIdentity={memberActivityByIdentity}
            targetMemberIdentity={targetMemberIdentity}
            memberSaving={memberSaving}
            editingMember={editingMember}
            editingWakePolicy={editingWakePolicy}
            editingMembershipStatus={editingMembershipStatus}
            inviteIdentity={inviteIdentity}
            inviteWakePolicy={inviteWakePolicy}
            inviteExistingMember={inviteExistingMember}
            inviteSending={inviteSending}
            onSelectTarget={setTargetMemberIdentity}
            onOpenDmTranscript={onOpenDmTranscript}
            onEditMember={handleEditMember}
            onSaveMemberSettings={handleSaveMemberSettings}
            onCancelEdit={() => setEditingMemberIdentity(null)}
            onEditingWakePolicyChange={setEditingWakePolicy}
            onEditingMembershipStatusChange={setEditingMembershipStatus}
            onInviteIdentityChange={setInviteIdentity}
            onInviteWakePolicyChange={setInviteWakePolicy}
            onInviteAgent={handleInviteAgent}
          />
        </aside>
      </div>

      {(channelError || messagesError || activityError || observationLaneError || membershipsError || sendError) && (
        <div className="channel-chat-error">
          {(sendError ?? membershipsError ?? observationLaneError ?? activityError ?? messagesError ?? channelError)?.message}
        </div>
      )}

      <ChannelComposer
        sendMode={sendMode}
        onSendModeChange={setSendMode}
        bindings={bindings}
        targetMemberIdentity={targetMemberIdentity}
        onTargetMemberIdentityChange={setTargetMemberIdentity}
        activeAgentMembers={activeAgentMembers}
        activeChannel={activeChannel}
        sending={sending}
        disabledReason={disabledReason}
        identityRequired={identityRequired}
        isComposerDisabled={isComposerDisabled}
        draft={composer.draft}
        composerPlaceholder={composerPlaceholder}
        onDraftChange={composer.handleDraftChange}
        onComposerHotkey={onComposerHotkey}
        onComposerKeyDown={composer.handleComposerKeyDown}
        onSubmit={handleSubmit}
        slashCommandSuggestions={composer.slashCommandSuggestions}
        slashActiveIndex={composer.slashActiveIndex}
        onSelectSlashCommand={composer.handleSelectSlashCommand}
        showSlashHelp={composer.showSlashHelp}
        slashHelpLines={composer.slashHelpLines}
        mentionQuery={composer.mentionQuery}
        mentionSuggestions={composer.mentionSuggestions}
        mentionActiveIndex={composer.mentionActiveIndex}
        onInsertMention={composer.insertMention}
      />
    </section>
  );
}

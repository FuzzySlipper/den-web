import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, UIEvent } from 'react';
import type { AgentWorkCurrentResponse, AgentWorkEventsResponse, AgentWorkLifecycleEvent, Channel, ChannelActivityEvent, ChannelMessage, ChannelProjectLink, ChannelReactionSummary, DirectAgentEventsResponse, GatewayMember, GatewayMemberships } from '../../api/types';
import {
  ensureProjectDefaultChannel,
  listAgentWorkCurrent,
  listAgentWorkEvents,
  listChannelActivityEvents,
  listChannelMessages,
  listChannelReactions,
  listChannels,
  listDirectAgentEvents,
  listProjectLinkedChannels,
  listChannelLinkedProjects,
  listGatewayMemberships,
  postChannelMessage,
  addChannelReaction,
  postGatewayDirectAgentMessage,
  upsertChannelMembership,
} from '../../api/client';
import { useLiveData } from '../../hooks/useLiveData';
import { groupActivityEventsForChannelMessages, piCrewAgentWorkActivityEventsFromLifecycleEvents, piCrewDelegationActivityEventsFromMessages } from './channelChatRenderModel';
import { directTargetsForComposerBody } from './channelComposerDirectTargets';
import { NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS, isVisibleNormalParticipant } from './participantVisibility';
import { filterLoadedChannelMessages } from './channelMessageSearch';
import { useComposerHotkeys } from './useComposerHotkeys';
import type { ChannelSendMode } from './useComposerHotkeys';
import { useChannelComposer } from './useChannelComposer';
import { useChannelEventStream } from './useChannelEventStream';
import { isStreamDelivering } from './channelEventStream';
import { AgentWorkOpsPanel } from './AgentWorkOpsPanel';
import {
  isSharedProjectChannel,
  isWorkerPoolChannel,
  linkedProjectIds,
  messageProjectAttribution,
  preferredProjectChannel,
  projectChannelScopeLabel,
  selectProjectChannels,
} from './channelRouting';
import { persistSenderIdentity, readStoredSenderIdentity } from './channelChatStorage';
import { channelLabel } from './channelChatDisplay';
import { isScrollElementPinnedToBottom, scrollElementToBottom } from './channelScroll';
import { resolveAgentCommonsChannel, resolveWorkerPoolChannel } from './channelResolve';
import { deriveParticipantActivity, memberIsActiveAgent } from './channelParticipantActivity';
import { DEFAULT_WAKE_POLICY } from './channelParticipantOptions';
import { ChannelChatHeader } from './ChannelChatHeader';
import { ChannelMessageList } from './ChannelMessageList';
import { ChannelParticipants } from './ChannelParticipants';
import { ChannelComposer } from './ChannelComposer';

const QUICK_REACTIONS = ['✅', '👀', '👍', '🫡', '❓'];
/** Safety-net poll interval for messages/activity while the live stream is healthy. */
const STREAM_SAFETY_POLL_MS = 20000;

function dedupeAgentWorkLifecycleEvents(events: AgentWorkLifecycleEvent[]): AgentWorkLifecycleEvent[] {
  const seen = new Set<string>();
  const deduped: AgentWorkLifecycleEvent[] = [];
  for (const event of events) {
    const key = [
      event.eventFamily ?? '',
      event.eventType,
      event.createdAt,
      event.childSessionId ?? event.ownerSessionId ?? event.sessionId ?? '',
      event.toolCallId ?? '',
      event.summary ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}

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
  const previousProjectIdRef = useRef<string | null>(projectId);
  const pendingProjectDefaultSelectionRef = useRef<string | null>(null);
  const [projectAttributionFilter, setProjectAttributionFilter] = useState('');
  const [targetMemberIdentity, setTargetMemberIdentity] = useState('');
  const [inviteIdentity, setInviteIdentity] = useState('');
  const [inviteWakePolicy, setInviteWakePolicy] = useState(DEFAULT_WAKE_POLICY);
  const [editingMemberIdentity, setEditingMemberIdentity] = useState<string | null>(null);
  const [editingWakePolicy, setEditingWakePolicy] = useState(DEFAULT_WAKE_POLICY);
  const [editingMembershipStatus, setEditingMembershipStatus] = useState('active');
  const [sending, setSending] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const normalizedSenderIdentity = senderIdentity.trim();

  const fetchChannels = useCallback(async () => {
    const agentCommons = await resolveAgentCommonsChannel();
    if (!projectId) return [agentCommons];

    const [projectChannels, linkedChannels, workerPoolChannel] = await Promise.all([
      listChannels({ projectId, limit: 100 }),
      listProjectLinkedChannels(projectId).catch(error => {
        console.warn(`Failed to load linked channels for ${projectId}; falling back to project defaults`, error);
        return [] as Channel[];
      }),
      resolveWorkerPoolChannel().catch(error => {
        console.warn('Failed to load worker-pool channel; project channel list will omit shared worker-pool breadcrumbs', error);
        return null;
      }),
    ]);

    const selectedChannels = selectProjectChannels(projectId, projectChannels, linkedChannels, agentCommons, workerPoolChannel);
    if (selectedChannels.length > 1 || linkedChannels.length > 0 || projectChannels.length > 0) {
      return selectedChannels;
    }

    const ensured = await ensureProjectDefaultChannel(projectId, {
      displayName: spaceName?.trim() || projectId,
      createdBy: normalizedSenderIdentity || 'den-web',
    });
    return selectProjectChannels(projectId, [ensured], [], agentCommons, workerPoolChannel);
  }, [normalizedSenderIdentity, projectId, spaceName]);

  const {
    data: channels,
    loading: channelLoading,
    error: channelError,
    refresh: refreshChannels,
  } = useLiveData<Channel[]>(fetchChannels, { interval: 15000 });

  const availableChannels = useMemo(
    () => channels ?? [],
    [channels],
  );

  useEffect(() => {
    if (availableChannels.length === 0) {
      setSelectedChannelId(null);
      previousProjectIdRef.current = projectId;
      pendingProjectDefaultSelectionRef.current = projectId;
      return;
    }

    const preferredChannel = preferredProjectChannel(availableChannels, projectId);
    const projectChanged = previousProjectIdRef.current !== projectId;
    previousProjectIdRef.current = projectId;

    if (projectChanged) {
      pendingProjectDefaultSelectionRef.current = null;
      setSelectedChannelId(preferredChannel?.id ?? null);
      return;
    }

    if (!selectedChannelId || !availableChannels.some(candidate => candidate.id === selectedChannelId)) {
      setSelectedChannelId(preferredChannel?.id ?? null);
    }
  }, [availableChannels, projectId, selectedChannelId]);

  const activeChannel = useMemo(
    () => availableChannels.find(candidate => candidate.id === selectedChannelId) ?? null,
    [availableChannels, selectedChannelId],
  );

  // Near-real-time channel updates (#2147): the SSE stream triggers refreshes of
  // the polled message/activity lists. Stable callbacks read the latest refresh
  // functions from refs so changing the poll interval never re-opens the stream.
  const refreshMessagesRef = useRef(() => {});
  const refreshActivityRef = useRef(() => {});
  const triggerMessageRefresh = useCallback(() => refreshMessagesRef.current(), []);
  const triggerActivityRefresh = useCallback(() => refreshActivityRef.current(), []);
  const channelStream = useChannelEventStream({
    channelId: activeChannel?.id ?? null,
    onMessage: triggerMessageRefresh,
    onActivity: triggerActivityRefresh,
  });
  // Stream healthy → lean on event-triggered refreshes plus a slow safety-net
  // poll. Stream unavailable/errored → fall back to the original fast cadence.
  const liveListInterval = isStreamDelivering(channelStream.status) ? STREAM_SAFETY_POLL_MS : 4000;

  const fetchMessages = useCallback(
    () => activeChannel ? listChannelMessages(activeChannel.id, { limit: 80 }) : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
  } = useLiveData(fetchMessages, { interval: liveListInterval });

  const fetchActivityEvents = useCallback(
    () => activeChannel ? listChannelActivityEvents(activeChannel.id, { limit: 120 }) : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: activityEvents,
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivityEvents,
  } = useLiveData<ChannelActivityEvent[]>(fetchActivityEvents, { interval: liveListInterval });

  useEffect(() => {
    refreshMessagesRef.current = refreshMessages;
    refreshActivityRef.current = refreshActivityEvents;
  });

  const fetchAgentWorkCurrent = useCallback(
    () => activeChannel ? listAgentWorkCurrent({ channelId: activeChannel.id, limit: 12 }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: agentWorkCurrent,
    loading: agentWorkCurrentLoading,
    error: agentWorkCurrentError,
    refresh: refreshAgentWorkCurrent,
  } = useLiveData<AgentWorkCurrentResponse | null>(fetchAgentWorkCurrent, { interval: 4000 });

  const fetchAgentWorkEvents = useCallback(
    () => activeChannel ? listAgentWorkEvents({ channelId: activeChannel.id, limit: 24 }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: agentWorkEvents,
    loading: agentWorkEventsLoading,
    error: agentWorkEventsError,
    refresh: refreshAgentWorkEvents,
  } = useLiveData<AgentWorkEventsResponse | null>(fetchAgentWorkEvents, { interval: 4000 });

  const fetchDirectAgentEvents = useCallback(
    () => activeChannel ? listDirectAgentEvents({ channelId: activeChannel.id, limit: 24 }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: directAgentEvents,
    loading: directAgentEventsLoading,
    error: directAgentEventsError,
    refresh: refreshDirectAgentEvents,
  } = useLiveData<DirectAgentEventsResponse | null>(fetchDirectAgentEvents, { interval: 4000 });

  const refreshAgentWorkEvidence = useCallback(() => {
    refreshAgentWorkCurrent();
    refreshAgentWorkEvents();
    refreshActivityEvents();
    refreshDirectAgentEvents();
  }, [refreshActivityEvents, refreshAgentWorkCurrent, refreshAgentWorkEvents, refreshDirectAgentEvents]);

  const fetchReactions = useCallback(
    () => activeChannel ? listChannelReactions(activeChannel.id) : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: reactions,
    refresh: refreshReactions,
  } = useLiveData<ChannelReactionSummary[]>(fetchReactions, { interval: 5000 });

  const fetchMemberships = useCallback(
    () => activeChannel ? listGatewayMemberships({ channelId: activeChannel.id, ...NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: memberships,
    loading: membershipsLoading,
    error: membershipsError,
    refresh: refreshMemberships,
  } = useLiveData<GatewayMemberships | null>(fetchMemberships, { interval: 5000 });

  const fetchLinkedProjects = useCallback(
    () => activeChannel && isSharedProjectChannel(activeChannel)
      ? listChannelLinkedProjects(activeChannel.id)
      : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: activeChannelLinkedProjects,
  } = useLiveData<ChannelProjectLink[]>(fetchLinkedProjects, { interval: 15000 });

  const activeChannelScopeLabel = projectChannelScopeLabel(activeChannel);
  const workerPoolProjectFilter = projectId && isWorkerPoolChannel(activeChannel) ? projectId : '';
  const effectiveProjectAttributionFilter = projectAttributionFilter || workerPoolProjectFilter;
  const activeChannelLinkedProjectIds = useMemo(
    () => linkedProjectIds(activeChannelLinkedProjects ?? []),
    [activeChannelLinkedProjects],
  );

  useEffect(() => {
    setProjectAttributionFilter(current => {
      if (!current) return current;
      return activeChannelLinkedProjectIds.includes(current) ? current : '';
    });
  }, [activeChannelLinkedProjectIds]);

  const sortedMessages = useMemo(() => {
    const channelMessages = activeChannel
      ? (messages ?? []).filter(message => message.channelId === activeChannel.id)
      : [];
    const visibleMessages = effectiveProjectAttributionFilter
      ? channelMessages.filter(message => messageProjectAttribution(message) === effectiveProjectAttributionFilter)
      : channelMessages;
    return [...visibleMessages].sort((left, right) => left.id - right.id);
  }, [activeChannel, effectiveProjectAttributionFilter, messages]);

  const displayedMessages = useMemo(
    () => filterLoadedChannelMessages(sortedMessages, messageSearchQuery),
    [messageSearchQuery, sortedMessages],
  );
  const isMessageSearchActive = messageSearchQuery.trim().length > 0;

  const reactionsByMessageId = useMemo(() => {
    const grouped = new Map<number, ChannelReactionSummary[]>();
    for (const reaction of reactions ?? []) {
      const current = grouped.get(reaction.channelMessageId) ?? [];
      current.push(reaction);
      grouped.set(reaction.channelMessageId, current);
    }
    return grouped;
  }, [reactions]);

  const scopedActivityEvents = useMemo(
    () => effectiveProjectAttributionFilter
      ? (activityEvents ?? []).filter(event => messageProjectAttribution(event) === effectiveProjectAttributionFilter)
      : (activityEvents ?? []),
    [activityEvents, effectiveProjectAttributionFilter],
  );
  const scopedDirectAgentEvents = useMemo(
    () => effectiveProjectAttributionFilter
      ? (directAgentEvents?.items ?? []).filter(event => messageProjectAttribution(event) === effectiveProjectAttributionFilter)
      : (directAgentEvents?.items ?? []),
    [directAgentEvents, effectiveProjectAttributionFilter],
  );
  const scopedAgentWorkCurrent = useMemo(
    () => agentWorkCurrent && effectiveProjectAttributionFilter
      ? { ...agentWorkCurrent, items: agentWorkCurrent.items.filter(item => item.projectId === effectiveProjectAttributionFilter) }
      : agentWorkCurrent,
    [agentWorkCurrent, effectiveProjectAttributionFilter],
  );
  const scopedAgentWorkEvents = useMemo(
    () => agentWorkEvents && effectiveProjectAttributionFilter
      ? { ...agentWorkEvents, items: agentWorkEvents.items.filter(item => item.projectId === effectiveProjectAttributionFilter) }
      : agentWorkEvents,
    [agentWorkEvents, effectiveProjectAttributionFilter],
  );

  const piCrewDelegationActivityEvents = useMemo(
    () => isMessageSearchActive ? [] : piCrewDelegationActivityEventsFromMessages(displayedMessages),
    [displayedMessages, isMessageSearchActive],
  );
  const piCrewAgentWorkActivityEvents = useMemo(
    () => isMessageSearchActive ? [] : piCrewAgentWorkActivityEventsFromLifecycleEvents(dedupeAgentWorkLifecycleEvents(scopedAgentWorkEvents?.items ?? [])),
    [isMessageSearchActive, scopedAgentWorkEvents],
  );

  const groupedActivityEvents = useMemo(
    () => groupActivityEventsForChannelMessages(displayedMessages, isMessageSearchActive ? [] : [...scopedActivityEvents, ...piCrewDelegationActivityEvents, ...piCrewAgentWorkActivityEvents]),
    [displayedMessages, isMessageSearchActive, scopedActivityEvents, piCrewDelegationActivityEvents, piCrewAgentWorkActivityEvents],
  );
  const activityEventsByMessageId = groupedActivityEvents.byMessageId;
  const deliveryProgressBlocks = groupedActivityEvents.displayBlocks;
  const unanchoredActivityEvents = groupedActivityEvents.unanchoredEvents;

  const members = useMemo(() => (memberships?.members ?? []).filter(member => isVisibleNormalParticipant(member)), [memberships]);
  const memberActivityByIdentity = useMemo(() => {
    const entries = members.map(member => [member.memberIdentity, deriveParticipantActivity(member, sortedMessages)] as const);
    return new Map(entries);
  }, [members, sortedMessages]);
  const activeAgentMembers = members.filter(memberIsActiveAgent);
  const selectedTarget = activeAgentMembers.find(member => member.memberIdentity === targetMemberIdentity) ?? null;
  const editingMember = members.find(member => member.memberIdentity === editingMemberIdentity && member.memberType === 'agent') ?? null;
  const inviteExistingMember = members.find(member => member.memberType === 'agent' && member.memberIdentity === inviteIdentity.trim()) ?? null;
  const composer = useChannelComposer({ members, normalizedSenderIdentity });

  useEffect(() => {
    if (activeAgentMembers.length === 0) {
      setTargetMemberIdentity('');
      return;
    }
    if (!targetMemberIdentity || !activeAgentMembers.some(member => member.memberIdentity === targetMemberIdentity)) {
      setTargetMemberIdentity(activeAgentMembers[0].memberIdentity);
    }
  }, [activeAgentMembers, targetMemberIdentity]);

  const availableTargets = useMemo(
    () => activeAgentMembers.map(m => m.memberIdentity),
    [activeAgentMembers],
  );

  const { onComposerHotkey, bindings } = useComposerHotkeys({
    sendMode,
    onSetSendMode: setSendMode,
    targetMemberIdentity,
    onSetTargetMemberIdentity: setTargetMemberIdentity,
    availableTargets,
  });

  const disabledReason = channelError
    ? 'Channel unavailable. Check den-channels API health.'
    : null;
  const agentWorkLoading = agentWorkCurrentLoading || agentWorkEventsLoading || directAgentEventsLoading || activityLoading;
  const agentWorkError = agentWorkCurrentError ?? agentWorkEventsError ?? directAgentEventsError ?? null;
  const identityRequired = normalizedSenderIdentity.length === 0;
  const directModeRequiresTarget = sendMode === 'direct' && !selectedTarget;
  const isComposerDisabled = !activeChannel || sending || Boolean(disabledReason) || identityRequired || directModeRequiresTarget;
  const channelStatus = channelLoading && !activeChannel
    ? 'loading channels…'
    : channelError
      ? channelError.message
      : activeChannel
        ? `${activeChannel.displayName} · ${activeChannel.kind}${activeChannelScopeLabel ? ` · ${activeChannelScopeLabel}` : ''} · ${activeAgentMembers.length} active agent binding${activeAgentMembers.length === 1 ? '' : 's'}`
        : 'No project channel selected';

  const handleSenderIdentityChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSenderIdentity(value);
    persistSenderIdentity(value);
  }, []);

  const handleScrollbackScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    isScrollPinnedToBottomRef.current = isScrollElementPinnedToBottom(event.currentTarget);
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = composer.draft.trim();
    if (!activeChannel || !body || isComposerDisabled || !normalizedSenderIdentity) return;

    setSending(true);
    setSendError(null);
    try {
      if (sendMode === 'direct' && selectedTarget) {
        await postGatewayDirectAgentMessage({
          channelId: activeChannel.id,
          projectId: projectId ?? undefined,
          memberIdentity: selectedTarget.memberIdentity,
          senderIdentity: normalizedSenderIdentity,
          body,
        });
      } else if (sendMode === 'channel') {
        await postChannelMessage(activeChannel.id, {
          senderType: 'user',
          senderIdentity: normalizedSenderIdentity,
          messageKind: 'human_text',
          body,
        });
        const mentionedDirectTargets = directTargetsForComposerBody(body, activeAgentMembers);
        if (mentionedDirectTargets.length > 0) {
          await Promise.all(mentionedDirectTargets.map(target => postGatewayDirectAgentMessage({
            channelId: activeChannel.id,
            projectId: projectId ?? undefined,
            memberIdentity: target.memberIdentity,
            senderIdentity: normalizedSenderIdentity,
            body,
          })));
        }
      }
      composer.recordSentMessage(body);
      refreshMessages();
      refreshActivityEvents();
      refreshReactions();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [activeAgentMembers, activeChannel, composer, isComposerDisabled, normalizedSenderIdentity, projectId, refreshActivityEvents, refreshMessages, refreshReactions, selectedTarget, sendMode]);

  const handleReactToMessage = useCallback(async (message: ChannelMessage, reactionKey: string) => {
    const reactorIdentity = normalizedSenderIdentity || targetMemberIdentity;
    if (!reactorIdentity) {
      setSendError(new Error('Set Posting as before reacting.'));
      return;
    }
    setSendError(null);
    try {
      await addChannelReaction(message.id, {
        reactorType: 'user',
        reactorIdentity,
        reactionKey,
      });
      refreshReactions();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [normalizedSenderIdentity, refreshReactions, targetMemberIdentity]);

  const handleInviteAgent = useCallback(async () => {
    const identity = inviteIdentity.trim();
    if (!activeChannel || !identity) return;
    setInviteSending(true);
    setSendError(null);
    try {
      await upsertChannelMembership(activeChannel.id, {
        memberType: 'agent',
        memberIdentity: identity,
        membershipStatus: inviteExistingMember?.membershipStatus ?? 'active',
        wakePolicy: inviteWakePolicy,
        canSend: inviteExistingMember?.canSend ?? true,
        canReact: inviteExistingMember?.canReact ?? true,
        canInvite: inviteExistingMember?.canInvite ?? false,
        cooldownSeconds: inviteExistingMember?.cooldownSeconds,
        maxAutoRepliesPerWindow: inviteExistingMember?.maxAutoRepliesPerWindow,
      });
      setInviteIdentity('');
      refreshMemberships();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setInviteSending(false);
    }
  }, [activeChannel, inviteExistingMember, inviteIdentity, inviteWakePolicy, refreshMemberships]);

  const handleEditMember = useCallback((member: GatewayMember) => {
    setEditingMemberIdentity(member.memberIdentity);
    setEditingWakePolicy(member.wakePolicy || DEFAULT_WAKE_POLICY);
    setEditingMembershipStatus(member.membershipStatus || 'active');
  }, []);

  const handleSaveMemberSettings = useCallback(async () => {
    if (!activeChannel || !editingMember) return;
    setMemberSaving(true);
    setSendError(null);
    try {
      await upsertChannelMembership(activeChannel.id, {
        memberType: editingMember.memberType,
        memberIdentity: editingMember.memberIdentity,
        membershipStatus: editingMembershipStatus,
        wakePolicy: editingWakePolicy,
        canSend: editingMember.canSend,
        canReact: editingMember.canReact,
        canInvite: editingMember.canInvite,
        cooldownSeconds: editingMember.cooldownSeconds,
        maxAutoRepliesPerWindow: editingMember.maxAutoRepliesPerWindow,
      });
      setEditingMemberIdentity(null);
      refreshMemberships();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setMemberSaving(false);
    }
  }, [activeChannel, editingMember, editingMembershipStatus, editingWakePolicy, refreshMemberships]);


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

  useLayoutEffect(() => {
    const autoScrollKey = `${scrollResetKey ?? projectId ?? 'aggregate'}:${activeChannel?.id ?? 'none'}`;
    if (previousAutoScrollKeyRef.current !== autoScrollKey) {
      previousAutoScrollKeyRef.current = autoScrollKey;
      pendingAutoScrollSnapKeyRef.current = autoScrollKey;
      pendingAutoScrollObservedLoadingRef.current = false;
      isScrollPinnedToBottomRef.current = true;
    }

    if (!autoScroll) return;

    const shouldSnapToBottom = activeChannel !== null && pendingAutoScrollSnapKeyRef.current === autoScrollKey;
    if (!shouldSnapToBottom && !isScrollPinnedToBottomRef.current) return;

    const scrollbackElement = scrollbackRef.current;
    if (!scrollbackElement) return;

    scrollElementToBottom(scrollbackElement, shouldSnapToBottom ? 'auto' : 'smooth');
    isScrollPinnedToBottomRef.current = true;

    if (!shouldSnapToBottom) return;

    if (messagesLoading || activityLoading) {
      pendingAutoScrollObservedLoadingRef.current = true;
      return;
    }

    if (pendingAutoScrollObservedLoadingRef.current) {
      pendingAutoScrollSnapKeyRef.current = null;
      pendingAutoScrollObservedLoadingRef.current = false;
    }
  }, [activeChannel, activeChannel?.id, activityLoading, autoScroll, displayedMessages.length, messagesLoading, projectId, scopedActivityEvents.length, scrollResetKey]);

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
          activityLoading={activityLoading}
          messagesError={messagesError}
          activityError={activityError}
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

      {(channelError || messagesError || activityError || membershipsError || sendError) && (
        <div className="channel-chat-error">
          {(sendError ?? membershipsError ?? activityError ?? messagesError ?? channelError)?.message}
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

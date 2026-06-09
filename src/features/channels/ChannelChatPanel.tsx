import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent, UIEvent } from 'react';
import type { AgentWorkCurrentResponse, AgentWorkEventsResponse, Channel, ChannelActivityEvent, ChannelMessage, ChannelProjectLink, ChannelReactionSummary, DirectAgentEventsResponse, GatewayMember, GatewayMemberships } from '../../api/types';
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
import { usePolling } from '../../hooks/usePolling';
import { findActiveMentionQuery, getMentionSuggestions, groupActivityEventsForChannelMessages, insertMentionToken } from './channelChatRenderModel';
import { directTargetsForComposerBody } from './channelComposerDirectTargets';
import { NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS, isVisibleNormalParticipant } from './participantVisibility';
import { findSlashCommandSuggestions, getSlashCommandHelpLines } from './channelSlashCommands';
import { appendHistory, persistHistory, readHistory, subscribeToHistoryChanges } from './channelComposerHistory';
import { filterLoadedChannelMessages } from './channelMessageSearch';
import { useComposerHotkeys } from './useComposerHotkeys';
import type { ChannelSendMode } from './useComposerHotkeys';
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
  const [draft, setDraft] = useState('');
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [senderIdentity, setSenderIdentity] = useState(readStoredSenderIdentity);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [sendMode, setSendMode] = useState<ChannelSendMode>('channel');
  const [autoScroll, setAutoScroll] = useState(true);
  const [composerHistoryEntries, setComposerHistoryEntries] = useState<ReturnType<typeof readHistory>>([]);
  const [historyNavigateIndex, setHistoryNavigateIndex] = useState<number | null>(null);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const slashCommandSuggestions = useMemo(
    () => findSlashCommandSuggestions(draft),
    [draft],
  );
  const slashHelpLines = useMemo(() => getSlashCommandHelpLines(), []);
  const showSlashHelp = draft.trim() === '/help';
  const scrollbackRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isScrollPinnedToBottomRef = useRef(true);
  const previousAutoScrollKeyRef = useRef<string | null>(null);
  const pendingAutoScrollSnapKeyRef = useRef<string | null>(null);
  const pendingAutoScrollObservedLoadingRef = useRef(false);
  const previousProjectIdRef = useRef<string | null>(projectId);
  const pendingProjectDefaultSelectionRef = useRef<string | null>(null);
  const historyUnsentDraftRef = useRef('');
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
  } = usePolling<Channel[]>(fetchChannels, 15000);

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

  const fetchMessages = useCallback(
    () => activeChannel ? listChannelMessages(activeChannel.id, { limit: 80 }) : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
  } = usePolling(fetchMessages, 4000);

  const fetchActivityEvents = useCallback(
    () => activeChannel ? listChannelActivityEvents(activeChannel.id, { limit: 120 }) : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: activityEvents,
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivityEvents,
  } = usePolling<ChannelActivityEvent[]>(fetchActivityEvents, 4000);

  const fetchAgentWorkCurrent = useCallback(
    () => activeChannel ? listAgentWorkCurrent({ channelId: activeChannel.id, limit: 12 }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: agentWorkCurrent,
    loading: agentWorkCurrentLoading,
    error: agentWorkCurrentError,
    refresh: refreshAgentWorkCurrent,
  } = usePolling<AgentWorkCurrentResponse | null>(fetchAgentWorkCurrent, 4000);

  const fetchAgentWorkEvents = useCallback(
    () => activeChannel ? listAgentWorkEvents({ channelId: activeChannel.id, limit: 24 }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: agentWorkEvents,
    loading: agentWorkEventsLoading,
    error: agentWorkEventsError,
    refresh: refreshAgentWorkEvents,
  } = usePolling<AgentWorkEventsResponse | null>(fetchAgentWorkEvents, 4000);

  const fetchDirectAgentEvents = useCallback(
    () => activeChannel ? listDirectAgentEvents({ channelId: activeChannel.id, limit: 24 }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: directAgentEvents,
    loading: directAgentEventsLoading,
    error: directAgentEventsError,
    refresh: refreshDirectAgentEvents,
  } = usePolling<DirectAgentEventsResponse | null>(fetchDirectAgentEvents, 4000);

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
  } = usePolling<ChannelReactionSummary[]>(fetchReactions, 5000);

  const fetchMemberships = useCallback(
    () => activeChannel ? listGatewayMemberships({ channelId: activeChannel.id, ...NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS }) : Promise.resolve(null),
    [activeChannel],
  );
  const {
    data: memberships,
    loading: membershipsLoading,
    error: membershipsError,
    refresh: refreshMemberships,
  } = usePolling<GatewayMemberships | null>(fetchMemberships, 5000);

  const fetchLinkedProjects = useCallback(
    () => activeChannel && isSharedProjectChannel(activeChannel)
      ? listChannelLinkedProjects(activeChannel.id)
      : Promise.resolve([]),
    [activeChannel],
  );
  const {
    data: activeChannelLinkedProjects,
  } = usePolling<ChannelProjectLink[]>(fetchLinkedProjects, 15000);

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

  const groupedActivityEvents = useMemo(
    () => groupActivityEventsForChannelMessages(displayedMessages, isMessageSearchActive ? [] : scopedActivityEvents),
    [displayedMessages, isMessageSearchActive, scopedActivityEvents],
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
  const mentionQuery = useMemo(() => findActiveMentionQuery(draft), [draft]);
  const mentionSuggestions = useMemo(
    () => mentionQuery ? getMentionSuggestions(members, mentionQuery.query) : [],
    [members, mentionQuery],
  );

  useEffect(() => {
    setMentionActiveIndex(0);
  }, [mentionQuery?.query, mentionSuggestions.length]);

  // Load composer history when sender identity changes
  useEffect(() => {
    setComposerHistoryEntries(readHistory(normalizedSenderIdentity));
    setHistoryNavigateIndex(null);
  }, [normalizedSenderIdentity]);

  // Cross-tab composer history synchronization
  useEffect(() => {
    return subscribeToHistoryChanges(normalizedSenderIdentity, (entries) => {
      setComposerHistoryEntries(entries);
    });
  }, [normalizedSenderIdentity]);

  // Reset slash-command active index when suggestions change
  useEffect(() => {
    setSlashActiveIndex(0);
  }, [slashCommandSuggestions.length]);

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

  const handleDraftChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft(value);
    setHistoryNavigateIndex(null);
    historyUnsentDraftRef.current = value;
  }, []);

  const insertMention = useCallback((identity: string) => {
    if (!mentionQuery) return;
    setDraft(current => insertMentionToken(current, mentionQuery, identity));
    setMentionActiveIndex(0);
  }, [mentionQuery]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    // If slash-command menu is active, handle slash-command navigation/selection
    if (slashCommandSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashActiveIndex(index => (index + 1) % slashCommandSuggestions.length);
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashActiveIndex(index => (index - 1 + slashCommandSuggestions.length) % slashCommandSuggestions.length);
        return;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const cmd = slashCommandSuggestions[slashActiveIndex] ?? slashCommandSuggestions[0];
        if (cmd) {
          if (cmd.command === '/clear') {
            setDraft('');
          } else {
            setDraft(cmd.command);
          }
        }
        setHistoryNavigateIndex(null);
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSlashActiveIndex(0);
        return;
      }
    }

    // If mention menu is active, handle mention navigation/selection
    if (mentionQuery && mentionSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionActiveIndex(index => (index + 1) % mentionSuggestions.length);
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionActiveIndex(index => (index - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(mentionSuggestions[mentionActiveIndex]?.identity ?? mentionSuggestions[0].identity);
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setMentionActiveIndex(0);
        setDraft(current => current);
        return;
      }
    }

    // ArrowUp — navigate history (only when at the start of the draft and not in a menu)
    if (event.key === 'ArrowUp' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      const textarea = event.currentTarget;
      const canStartHistoryRecall = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
      const isNavigatingHistory = historyNavigateIndex !== null;
      if ((isNavigatingHistory || canStartHistoryRecall) && composerHistoryEntries.length > 0) {
        event.preventDefault();
        const currentNavIndex = historyNavigateIndex;
        if (currentNavIndex === null) {
          // Start navigating from the most recent entry
          historyUnsentDraftRef.current = draft;
          setHistoryNavigateIndex(composerHistoryEntries.length - 1);
          setDraft(composerHistoryEntries[composerHistoryEntries.length - 1].body);
        } else if (currentNavIndex > 0) {
          // Go to previous entry
          setHistoryNavigateIndex(currentNavIndex - 1);
          setDraft(composerHistoryEntries[currentNavIndex - 1].body);
        }
        return;
      }
    }

    // ArrowDown — navigate forward through history
    if (event.key === 'ArrowDown' && !event.shiftKey && !event.ctrlKey && !event.metaKey && historyNavigateIndex !== null) {
      event.preventDefault();
      if (historyNavigateIndex < composerHistoryEntries.length - 1) {
        const nextIndex = historyNavigateIndex + 1;
        setHistoryNavigateIndex(nextIndex);
        setDraft(composerHistoryEntries[nextIndex].body);
      } else {
        // At the end of history, restore the current draft
        setHistoryNavigateIndex(null);
        setDraft(historyUnsentDraftRef.current);
      }
      return;
    }

    // Submit on Enter (without Shift). Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const form = (event.currentTarget as HTMLTextAreaElement).form;
      if (form) {
        form.requestSubmit();
      }
    }
  }, [draft, insertMention, mentionActiveIndex, mentionQuery, mentionSuggestions, slashCommandSuggestions, slashActiveIndex, composerHistoryEntries, historyNavigateIndex]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
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
      setDraft('');
      // Record message in composer history
      const updated = appendHistory(composerHistoryEntries, body);
      setComposerHistoryEntries(updated);
      persistHistory(normalizedSenderIdentity, updated);
      setHistoryNavigateIndex(null);
      refreshMessages();
      refreshActivityEvents();
      refreshReactions();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [activeAgentMembers, activeChannel, composerHistoryEntries, draft, isComposerDisabled, normalizedSenderIdentity, projectId, refreshActivityEvents, refreshMessages, refreshReactions, selectedTarget, sendMode]);

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


  const handleSelectSlashCommand = useCallback((command: string) => {
    if (command === '/clear') {
      setDraft('');
    } else {
      setDraft(command);
    }
    setHistoryNavigateIndex(null);
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
        draft={draft}
        composerPlaceholder={composerPlaceholder}
        onDraftChange={handleDraftChange}
        onComposerHotkey={onComposerHotkey}
        onComposerKeyDown={handleComposerKeyDown}
        onSubmit={handleSubmit}
        slashCommandSuggestions={slashCommandSuggestions}
        slashActiveIndex={slashActiveIndex}
        onSelectSlashCommand={handleSelectSlashCommand}
        showSlashHelp={showSlashHelp}
        slashHelpLines={slashHelpLines}
        mentionQuery={mentionQuery}
        mentionSuggestions={mentionSuggestions}
        mentionActiveIndex={mentionActiveIndex}
        onInsertMention={insertMention}
      />
    </section>
  );
}

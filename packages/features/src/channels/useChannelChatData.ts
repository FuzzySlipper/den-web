import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  AgentWorkCurrentResponse,
  AgentWorkEventsResponse,
  Channel,
  ChannelActivityEvent,
  ChannelMessage,
  ChannelProjectLink,
  ChannelReactionSummary,
  DirectAgentEventsResponse,
  GatewayMemberships,
  ObservationActiveWorkResponse,
  ObservationLaneResponse,
} from '@den-web/api/types';
import {
  ensureProjectDefaultChannel,
  listAgentWorkCurrent,
  listAgentWorkEvents,
  listChannelActivityEvents,
  listChannelLinkedProjects,
  listChannelMessages,
  listChannelReactions,
  listChannels,
  listDirectAgentEvents,
  listGatewayMemberships,
  listObservationActiveWork,
  listObservationLane,
  listProjectLinkedChannels,
} from '@den-web/api/client';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import {
  isSharedProjectChannel,
  isWorkerPoolChannel,
  linkedProjectIds,
  preferredProjectChannel,
  projectChannelScopeLabel,
  selectProjectChannels,
} from '@den-web/models/channels/channelRouting';
import { NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS, isVisibleNormalParticipant } from './participantVisibility';
import { useChannelComposer } from './useChannelComposer';
import { useChannelEventStream } from './useChannelEventStream';
import { isStreamDelivering } from './channelEventStream';
import { deriveParticipantActivity, memberIsActiveAgent } from './channelParticipantActivity';
import { resolveAgentCommonsChannel, resolveWorkerPoolChannel } from './channelResolve';
import { useChannelMessageDerivations } from './useChannelMessageDerivations';
import { observationActiveWorkIncludesMember } from '@den-web/models/channels';

const STREAM_SAFETY_POLL_MS = 20000;

function useChannelLiveResources(activeChannel: Channel | null) {
  const refreshMessagesRef = useRef(() => {});
  const refreshActivityRef = useRef(() => {});
  const triggerMessageRefresh = useCallback(() => refreshMessagesRef.current(), []);
  const triggerActivityRefresh = useCallback(() => refreshActivityRef.current(), []);
  const channelStream = useChannelEventStream({
    channelId: activeChannel?.id ?? null,
    onMessage: triggerMessageRefresh,
    onActivity: triggerActivityRefresh,
  });
  const liveListInterval = isStreamDelivering(channelStream.status) ? STREAM_SAFETY_POLL_MS : 4000;
  const fetchMessages = useCallback(() => activeChannel ? listChannelMessages(activeChannel.id, { limit: 80 }) : Promise.resolve([]), [activeChannel]);
  const messagesState = useLiveData(fetchMessages, { interval: liveListInterval });
  const fetchActivityEvents = useCallback(() => activeChannel ? listChannelActivityEvents(activeChannel.id, { limit: 120 }) : Promise.resolve([]), [activeChannel]);
  const activityState = useLiveData<ChannelActivityEvent[]>(fetchActivityEvents, { interval: liveListInterval });
  const fetchObservationLane = useCallback(() => activeChannel ? listObservationLane({ limit: 120 }) : Promise.resolve(null), [activeChannel]);
  const observationLaneState = useLiveData<ObservationLaneResponse | null>(fetchObservationLane, { interval: liveListInterval });
  const fetchObservationActiveWork = useCallback(() => activeChannel ? listObservationActiveWork() : Promise.resolve(null), [activeChannel]);
  const observationActiveWorkState = useLiveData<ObservationActiveWorkResponse | null>(fetchObservationActiveWork, { interval: 5000 });
  const fetchAgentWorkCurrent = useCallback(() => activeChannel ? listAgentWorkCurrent({ channelId: activeChannel.id, limit: 12 }) : Promise.resolve(null), [activeChannel]);
  const agentWorkCurrentState = useLiveData<AgentWorkCurrentResponse | null>(fetchAgentWorkCurrent, { interval: 4000 });
  const fetchAgentWorkEvents = useCallback(() => activeChannel ? listAgentWorkEvents({ channelId: activeChannel.id, limit: 24 }) : Promise.resolve(null), [activeChannel]);
  const agentWorkEventsState = useLiveData<AgentWorkEventsResponse | null>(fetchAgentWorkEvents, { interval: 4000 });
  const fetchDirectAgentEvents = useCallback(() => activeChannel ? listDirectAgentEvents({ channelId: activeChannel.id, limit: 24 }) : Promise.resolve(null), [activeChannel]);
  const directAgentEventsState = useLiveData<DirectAgentEventsResponse | null>(fetchDirectAgentEvents, { interval: 4000 });
  const fetchReactions = useCallback(() => activeChannel ? listChannelReactions(activeChannel.id) : Promise.resolve([]), [activeChannel]);
  const reactionsState = useLiveData<ChannelReactionSummary[]>(fetchReactions, { interval: 5000 });
  const fetchMemberships = useCallback(
    () => activeChannel ? listGatewayMemberships({ channelId: activeChannel.id, ...NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS }) : Promise.resolve(null),
    [activeChannel],
  );
  const membershipsState = useLiveData<GatewayMemberships | null>(fetchMemberships, { interval: 5000 });
  const fetchLinkedProjects = useCallback(
    () => activeChannel && isSharedProjectChannel(activeChannel) ? listChannelLinkedProjects(activeChannel.id) : Promise.resolve([]),
    [activeChannel],
  );
  const { data: activeChannelLinkedProjects } = useLiveData<ChannelProjectLink[]>(fetchLinkedProjects, { interval: 15000 });

  useEffect(() => {
    refreshMessagesRef.current = messagesState.refresh;
    refreshActivityRef.current = activityState.refresh;
  });

  return {
    activeChannelLinkedProjects,
    activityState,
    agentWorkCurrentState,
    agentWorkEventsState,
    channelStream,
    directAgentEventsState,
    membershipsState,
    messagesState,
    observationActiveWorkState,
    observationLaneState,
    reactionsState,
  };
}

function useChannelMemberDerivations({
  editingMemberIdentity,
  inviteIdentity,
  memberships,
  normalizedSenderIdentity,
  observationActiveWork,
  setTargetMemberIdentity,
  sortedMessages,
  targetMemberIdentity,
}: {
  editingMemberIdentity: string | null;
  inviteIdentity: string;
  memberships: GatewayMemberships | null | undefined;
  normalizedSenderIdentity: string;
  observationActiveWork: ObservationActiveWorkResponse | null | undefined;
  setTargetMemberIdentity: (identity: string) => void;
  sortedMessages: ChannelMessage[];
  targetMemberIdentity: string;
}) {
  const members = useMemo(() => (memberships?.members ?? []).filter(member => isVisibleNormalParticipant(member)), [memberships]);
  const memberActivityByIdentity = useMemo(() => new Map(members.map(member => [
    member.memberIdentity,
    observationActiveWorkIncludesMember(observationActiveWork?.items, member.memberIdentity)
      ? 'working'
      : deriveParticipantActivity(member, sortedMessages),
  ] as const)), [members, observationActiveWork, sortedMessages]);
  const activeAgentMembers = members.filter(memberIsActiveAgent);
  const selectedTarget = activeAgentMembers.find(member => member.memberIdentity === targetMemberIdentity) ?? null;
  const editingMember = members.find(member => member.memberIdentity === editingMemberIdentity && member.memberType === 'agent') ?? null;
  const inviteExistingMember = members.find(member => member.memberType === 'agent' && member.memberIdentity === inviteIdentity.trim()) ?? null;
  const composer = useChannelComposer({ members, normalizedSenderIdentity });

  useEffect(() => {
    if (activeAgentMembers.length === 0) return setTargetMemberIdentity('');
    if (!targetMemberIdentity || !activeAgentMembers.some(member => member.memberIdentity === targetMemberIdentity)) {
      setTargetMemberIdentity(activeAgentMembers[0].memberIdentity);
    }
  }, [activeAgentMembers, setTargetMemberIdentity, targetMemberIdentity]);

  return {
    activeAgentMembers,
    composer,
    editingMember,
    inviteExistingMember,
    memberActivityByIdentity,
    members,
    selectedTarget,
  };
}

function useChannelSelection({
  normalizedSenderIdentity,
  projectId,
  selectedChannelId,
  setSelectedChannelId,
  spaceName,
}: {
  normalizedSenderIdentity: string;
  projectId: string | null;
  selectedChannelId: number | null;
  setSelectedChannelId: (channelId: number | null) => void;
  spaceName?: string | null;
}) {
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
    if (selectedChannels.length > 1 || linkedChannels.length > 0 || projectChannels.length > 0) return selectedChannels;

    const ensured = await ensureProjectDefaultChannel(projectId, {
      displayName: spaceName?.trim() || projectId,
      createdBy: normalizedSenderIdentity || 'den-web',
    });
    return selectProjectChannels(projectId, [ensured], [], agentCommons, workerPoolChannel);
  }, [normalizedSenderIdentity, projectId, spaceName]);
  const { data: channels, loading: channelLoading, error: channelError, refresh: refreshChannels } = useLiveData<Channel[]>(fetchChannels, { interval: 15000 });
  const availableChannels = useMemo(() => channels ?? [], [channels]);

  useEffect(() => {
    if (availableChannels.length === 0) {
      setSelectedChannelId(null);
      return;
    }
    if (!selectedChannelId || !availableChannels.some(candidate => candidate.id === selectedChannelId)) {
      setSelectedChannelId(preferredProjectChannel(availableChannels, projectId)?.id ?? null);
    }
  }, [availableChannels, projectId, selectedChannelId, setSelectedChannelId]);

  const activeChannel = useMemo(
    () => availableChannels.find(candidate => candidate.id === selectedChannelId) ?? null,
    [availableChannels, selectedChannelId],
  );

  return { activeChannel, availableChannels, channelError, channelLoading, refreshChannels };
}

function formatChannelStatus({
  activeAgentCount,
  activeChannel,
  channelError,
  channelLoading,
  scopeLabel,
}: {
  activeAgentCount: number;
  activeChannel: Channel | null;
  channelError: Error | null;
  channelLoading: boolean;
  scopeLabel: string | null;
}) {
  if (channelLoading && !activeChannel) return 'loading channels…';
  if (channelError) return channelError.message;
  if (!activeChannel) return 'No project channel selected';

  const bindingLabel = `${activeAgentCount} active agent binding${activeAgentCount === 1 ? '' : 's'}`;
  return `${activeChannel.displayName} · ${activeChannel.kind}${scopeLabel ? ` · ${scopeLabel}` : ''} · ${bindingLabel}`;
}

export function useChannelChatData({
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
}: {
  projectId: string | null;
  spaceName?: string | null;
  normalizedSenderIdentity: string;
  selectedChannelId: number | null;
  setSelectedChannelId: (channelId: number | null) => void;
  projectAttributionFilter: string;
  setProjectAttributionFilter: (value: string | ((current: string) => string)) => void;
  messageSearchQuery: string;
  targetMemberIdentity: string;
  setTargetMemberIdentity: (identity: string) => void;
  inviteIdentity: string;
  editingMemberIdentity: string | null;
}) {
  const { activeChannel, availableChannels, channelError, channelLoading, refreshChannels } = useChannelSelection({
    normalizedSenderIdentity,
    projectId,
    selectedChannelId,
    setSelectedChannelId,
    spaceName,
  });

  const {
    activeChannelLinkedProjects,
    activityState,
    agentWorkCurrentState,
    agentWorkEventsState,
    channelStream,
    directAgentEventsState,
    membershipsState,
    messagesState,
    observationActiveWorkState,
    observationLaneState,
    reactionsState,
  } = useChannelLiveResources(activeChannel);

  const activeChannelScopeLabel = projectChannelScopeLabel(activeChannel);
  const workerPoolProjectFilter = projectId && isWorkerPoolChannel(activeChannel) ? projectId : '';
  const effectiveProjectAttributionFilter = projectAttributionFilter || workerPoolProjectFilter;
  const activeChannelLinkedProjectIds = useMemo(() => linkedProjectIds(activeChannelLinkedProjects ?? []), [activeChannelLinkedProjects]);

  useEffect(() => {
    setProjectAttributionFilter(current => current && !activeChannelLinkedProjectIds.includes(current) ? '' : current);
  }, [activeChannelLinkedProjectIds, setProjectAttributionFilter]);

  const {
    displayedMessages,
    groupedActivityEvents,
    isMessageSearchActive,
    reactionsByMessageId,
    scopedActivityEvents,
    scopedAgentWorkCurrent,
    scopedAgentWorkEvents,
    scopedDirectAgentEvents,
    sortedMessages,
  } = useChannelMessageDerivations({
    activeChannel,
    activityEvents: activityState.data,
    agentWorkCurrent: agentWorkCurrentState.data,
    agentWorkEvents: agentWorkEventsState.data,
    directAgentEvents: directAgentEventsState.data,
    effectiveProjectAttributionFilter,
    messageSearchQuery,
    messages: messagesState.data,
    observationLane: observationLaneState.data,
    reactions: reactionsState.data,
  });

  const {
    activeAgentMembers,
    composer,
    editingMember,
    inviteExistingMember,
    memberActivityByIdentity,
    members,
    selectedTarget,
  } = useChannelMemberDerivations({
    editingMemberIdentity,
    inviteIdentity,
    memberships: membershipsState.data,
    normalizedSenderIdentity,
    observationActiveWork: observationActiveWorkState.data,
    setTargetMemberIdentity,
    sortedMessages,
    targetMemberIdentity,
  });

  const channelStatus = formatChannelStatus({
    activeAgentCount: activeAgentMembers.length,
    activeChannel,
    channelError,
    channelLoading,
    scopeLabel: activeChannelScopeLabel,
  });

  return {
    activeAgentMembers, activeChannel, activeChannelLinkedProjectIds, activityEventsByMessageId: groupedActivityEvents.byMessageId,
    activityState, agentWorkCurrentState, agentWorkEventsState, availableChannels, channelError, channelLoading, channelStatus,
    channelStream, composer, deliveryProgressBlocks: groupedActivityEvents.displayBlocks, directAgentEventsState, displayedMessages,
    editingMember, effectiveProjectAttributionFilter, inviteExistingMember, isMessageSearchActive, memberActivityByIdentity, members,
    membershipsState, messagesState, observationActiveWorkState, observationLaneState, reactionsByMessageId, reactionsState, refreshChannels, scopedActivityEvents, scopedAgentWorkCurrent,
    scopedAgentWorkEvents, scopedDirectAgentEvents, selectedTarget, sortedMessages, unanchoredActivityEvents: groupedActivityEvents.unanchoredEvents,
  };
}

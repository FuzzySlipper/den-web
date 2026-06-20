import { useMemo } from 'react';
import type {
  AgentWorkCurrentResponse,
  AgentWorkEventsResponse,
  AgentWorkLifecycleEvent,
  Channel,
  ChannelActivityEvent,
  ChannelMessage,
  ChannelReactionSummary,
  DirectAgentEventsResponse,
  ObservationLaneResponse,
} from '@den-web/api/types';
import {
  groupActivityEventsForChannelMessages,
  observationEventsToChannelActivityEvents,
  piCrewAgentWorkActivityEventsFromLifecycleEvents,
  piCrewDelegationActivityEventsFromMessages,
} from '@den-web/models/channels';
import { messageProjectAttribution } from '@den-web/models/channels/channelRouting';
import { filterLoadedChannelMessages } from './channelMessageSearch';

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

export function useChannelMessageDerivations({
  activeChannel,
  activityEvents,
  agentWorkCurrent,
  agentWorkEvents,
  directAgentEvents,
  effectiveProjectAttributionFilter,
  messageSearchQuery,
  messages,
  observationLane,
  reactions,
}: {
  activeChannel: Channel | null;
  activityEvents: ChannelActivityEvent[] | null | undefined;
  agentWorkCurrent: AgentWorkCurrentResponse | null | undefined;
  agentWorkEvents: AgentWorkEventsResponse | null | undefined;
  directAgentEvents: DirectAgentEventsResponse | null | undefined;
  effectiveProjectAttributionFilter: string;
  messageSearchQuery: string;
  messages: ChannelMessage[] | null | undefined;
  observationLane: ObservationLaneResponse | null | undefined;
  reactions: ChannelReactionSummary[] | null | undefined;
}) {
  const sortedMessages = useMemo(() => {
    const channelMessages = activeChannel ? (messages ?? []).filter(message => message.channelId === activeChannel.id) : [];
    const visibleMessages = effectiveProjectAttributionFilter
      ? channelMessages.filter(message => messageProjectAttribution(message) === effectiveProjectAttributionFilter)
      : channelMessages;
    return [...visibleMessages].sort((left, right) => left.id - right.id);
  }, [activeChannel, effectiveProjectAttributionFilter, messages]);
  const displayedMessages = useMemo(() => filterLoadedChannelMessages(sortedMessages, messageSearchQuery), [messageSearchQuery, sortedMessages]);
  const isMessageSearchActive = messageSearchQuery.trim().length > 0;
  const scopedActivityEvents = useMemo(
    () => effectiveProjectAttributionFilter
      ? (activityEvents ?? []).filter(event => messageProjectAttribution(event) === effectiveProjectAttributionFilter)
      : (activityEvents ?? []),
    [activityEvents, effectiveProjectAttributionFilter],
  );
  const observationAvailable = observationLane != null;
  const observationActivityEvents = useMemo(
    () => activeChannel
      ? observationEventsToChannelActivityEvents(observationLane?.events, {
        channelId: activeChannel.id,
        projectId: effectiveProjectAttributionFilter || activeChannel.projectId,
        hideDebug: true,
      })
      : [],
    [activeChannel, effectiveProjectAttributionFilter, observationLane],
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
    () => isMessageSearchActive || observationAvailable ? [] : piCrewDelegationActivityEventsFromMessages(displayedMessages),
    [displayedMessages, isMessageSearchActive, observationAvailable],
  );
  const piCrewAgentWorkActivityEvents = useMemo(
    () => isMessageSearchActive || observationAvailable ? [] : piCrewAgentWorkActivityEventsFromLifecycleEvents(dedupeAgentWorkLifecycleEvents(scopedAgentWorkEvents?.items ?? [])),
    [isMessageSearchActive, observationAvailable, scopedAgentWorkEvents],
  );
  const groupedActivityEvents = useMemo(
    () => groupActivityEventsForChannelMessages(displayedMessages, isMessageSearchActive ? [] : [...scopedActivityEvents, ...observationActivityEvents, ...piCrewDelegationActivityEvents, ...piCrewAgentWorkActivityEvents]),
    [displayedMessages, isMessageSearchActive, scopedActivityEvents, observationActivityEvents, piCrewDelegationActivityEvents, piCrewAgentWorkActivityEvents],
  );
  const reactionsByMessageId = useMemo(() => {
    const grouped = new Map<number, ChannelReactionSummary[]>();
    for (const reaction of reactions ?? []) grouped.set(reaction.channelMessageId, [...(grouped.get(reaction.channelMessageId) ?? []), reaction]);
    return grouped;
  }, [reactions]);

  return {
    displayedMessages,
    groupedActivityEvents,
    isMessageSearchActive,
    reactionsByMessageId,
    scopedActivityEvents: [...scopedActivityEvents, ...observationActivityEvents],
    scopedAgentWorkCurrent: scopedAgentWorkCurrent ?? null,
    scopedAgentWorkEvents: scopedAgentWorkEvents ?? null,
    scopedDirectAgentEvents,
    sortedMessages,
  };
}

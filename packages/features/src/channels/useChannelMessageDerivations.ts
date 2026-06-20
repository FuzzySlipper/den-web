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
} from '@den-web/api/types';
import {
  groupActivityEventsForChannelMessages,
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
  const piCrewDelegationActivityEvents = useMemo(() => isMessageSearchActive ? [] : piCrewDelegationActivityEventsFromMessages(displayedMessages), [displayedMessages, isMessageSearchActive]);
  const piCrewAgentWorkActivityEvents = useMemo(
    () => isMessageSearchActive ? [] : piCrewAgentWorkActivityEventsFromLifecycleEvents(dedupeAgentWorkLifecycleEvents(scopedAgentWorkEvents?.items ?? [])),
    [isMessageSearchActive, scopedAgentWorkEvents],
  );
  const groupedActivityEvents = useMemo(
    () => groupActivityEventsForChannelMessages(displayedMessages, isMessageSearchActive ? [] : [...scopedActivityEvents, ...piCrewDelegationActivityEvents, ...piCrewAgentWorkActivityEvents]),
    [displayedMessages, isMessageSearchActive, scopedActivityEvents, piCrewDelegationActivityEvents, piCrewAgentWorkActivityEvents],
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
    scopedActivityEvents,
    scopedAgentWorkCurrent: scopedAgentWorkCurrent ?? null,
    scopedAgentWorkEvents: scopedAgentWorkEvents ?? null,
    scopedDirectAgentEvents,
    sortedMessages,
  };
}

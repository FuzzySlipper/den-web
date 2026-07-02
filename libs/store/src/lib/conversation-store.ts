import { computed, signal, type Signal } from '@angular/core';
import { timelineItems, type TimelineItemView } from '@den-web/domain';
import type { DenChannelMessage, DenConversationChannel, DenResult, DenTimelineResponse } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface ConversationTransportPort {
  readonly listChannels: (projectId: string, options?: { readonly limit?: number; readonly kind?: string }) => Promise<DenResult<readonly DenConversationChannel[]>>;
  readonly listMessages: (channelId: number, options?: { readonly afterId?: number; readonly limit?: number }) => Promise<DenResult<readonly DenChannelMessage[]>>;
  readonly postMessage: (channelId: number, body: { readonly sender: string; readonly body: string; readonly idempotency_key: string }) => Promise<DenResult<DenChannelMessage>>;
}

export interface TimelineTransportPort {
  readonly listChannelItems: (channelId: number, options?: { readonly limit?: number; readonly after?: string }) => Promise<DenResult<DenTimelineResponse>>;
}

export interface ConversationStore {
  readonly channels: Signal<AsyncState<readonly DenConversationChannel[]>>;
  readonly messages: Signal<AsyncState<readonly DenChannelMessage[]>>;
  readonly timeline: Signal<AsyncState<readonly TimelineItemView[]>>;
  readonly selectedChannelId: Signal<number | null>;
  readonly selectedChannel: Signal<DenConversationChannel | null>;
  readonly refreshChannels: (projectId: string) => Promise<void>;
  readonly selectChannel: (channelId: number) => Promise<void>;
  readonly sendMessage: (sender: string, body: string, idempotencyKey: string) => Promise<void>;
}

export function createConversationStore(conversation: ConversationTransportPort, timeline: TimelineTransportPort): ConversationStore {
  const channels = signal<AsyncState<readonly DenConversationChannel[]>>(idleState());
  const messages = signal<AsyncState<readonly DenChannelMessage[]>>(idleState());
  const timelineState = signal<AsyncState<readonly TimelineItemView[]>>(idleState());
  const selectedChannelId = signal<number | null>(null);

  const loadChannel = async (channelId: number): Promise<void> => {
    const previousMessages = stateValue(messages());
    const previousTimeline = stateValue(timelineState());
    selectedChannelId.set(channelId);
    messages.set(loadingState(previousMessages));
    timelineState.set(loadingState(previousTimeline));
    try {
      const [messageResult, timelineResult] = await Promise.all([
        conversation.listMessages(channelId, { limit: 100 }),
        timeline.listChannelItems(channelId, { limit: 100 }),
      ]);
      messages.set(resultState(messageResult, previousMessages));
      timelineState.set(timelineResult.ok ? resultState({ ok: true, value: timelineItems(timelineResult.value) }, previousTimeline) : resultState(timelineResult, previousTimeline));
    } catch (error) {
      const classified = unknownStoreError(error);
      messages.set(errorState(classified, previousMessages));
      timelineState.set(errorState(classified, previousTimeline));
    }
  };

  return {
    channels: channels.asReadonly(),
    messages: messages.asReadonly(),
    timeline: timelineState.asReadonly(),
    selectedChannelId: selectedChannelId.asReadonly(),
    selectedChannel: computed(() => stateValue(channels())?.find((channel) => channel.id === selectedChannelId()) ?? null),
    refreshChannels: async (projectId) => {
      const previous = stateValue(channels());
      channels.set(loadingState(previous));
      try {
        const result = await conversation.listChannels(projectId, { limit: 100 });
        channels.set(resultState(result, previous));
        const firstChannelId = result.ok ? result.value[0]?.id : undefined;
        if (firstChannelId !== undefined && selectedChannelId() === null) await loadChannel(firstChannelId);
      } catch (error) {
        channels.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectChannel: loadChannel,
    sendMessage: async (sender, body, idempotencyKey) => {
      const channelId = selectedChannelId();
      if (channelId === null) return;
      const result = await conversation.postMessage(channelId, { sender, body, idempotency_key: idempotencyKey });
      if (result.ok) {
        const current = stateValue(messages()) ?? [];
        messages.set(resultState({ ok: true, value: [...current, result.value] }));
      } else {
        messages.set(errorState(result.error, stateValue(messages())));
      }
    },
  };
}

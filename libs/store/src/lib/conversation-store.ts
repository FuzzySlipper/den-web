import { computed, signal, type Signal } from '@angular/core';
import { membershipIdentity, timelineItems, timelineItemView, type TimelineItemView } from '@den-web/domain';
import type {
  DenChannelMessage,
  DenConversationChannel,
  DenConversationMembership,
  DenConversationPostMessageRequest,
  DenConversationPutMembershipRequest,
  DenDeliveryIntent,
  DenDeliveryIntentRequest,
  DenDeliveryTargetIdentity,
  DenResult,
  DenTimelineItem,
  DenTimelineResponse,
} from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface ConversationTransportPort {
  readonly listChannels: (projectId: string, options?: { readonly limit?: number; readonly kind?: string }) => Promise<DenResult<readonly DenConversationChannel[]>>;
  readonly listMemberships: (options?: { readonly channelId?: number; readonly projectId?: string; readonly includeLeft?: boolean; readonly limit?: number }) => Promise<DenResult<readonly DenConversationMembership[]>>;
  readonly putMembership: (channelId: number, body: DenConversationPutMembershipRequest) => Promise<DenResult<DenConversationMembership>>;
  readonly listMessages: (channelId: number, options?: { readonly afterId?: number; readonly limit?: number }) => Promise<DenResult<readonly DenChannelMessage[]>>;
  readonly postMessage: (channelId: number, body: DenConversationPostMessageRequest) => Promise<DenResult<DenChannelMessage>>;
}

export interface TimelineTransportPort {
  readonly listChannelItems: (channelId: number, options?: { readonly limit?: number; readonly after?: string }) => Promise<DenResult<DenTimelineResponse>>;
  readonly streamChannelItems: (channelId: number, options: {
    readonly after?: string;
    readonly onItem: (item: DenTimelineItem) => void;
    readonly onRefresh?: () => void;
    readonly onError?: () => void;
  }) => { readonly close: () => void };
}

export interface DeliveryTransportPort {
  readonly createIntent: (body: DenDeliveryIntentRequest) => Promise<DenResult<DenDeliveryIntent>>;
}

export interface ConversationStore {
  readonly channels: Signal<AsyncState<readonly DenConversationChannel[]>>;
  readonly messages: Signal<AsyncState<readonly DenChannelMessage[]>>;
  readonly memberships: Signal<AsyncState<readonly DenConversationMembership[]>>;
  readonly timeline: Signal<AsyncState<readonly TimelineItemView[]>>;
  readonly selectedChannelId: Signal<number | null>;
  readonly selectedChannel: Signal<DenConversationChannel | null>;
  readonly refreshChannels: (projectId: string) => Promise<void>;
  readonly selectChannel: (channelId: number) => Promise<void>;
  readonly streamChannel: (channelId: number) => () => void;
  readonly sendMessage: (senderIdentity: string, body: string, idempotencyKey: string) => Promise<void>;
  readonly saveMembership: (member: DenConversationMembership, patch: { readonly wakePolicy: string; readonly membershipStatus: string }) => Promise<DenResult<DenConversationMembership>>;
  readonly joinAgent: (identity: string, wakePolicy: string) => Promise<DenResult<DenConversationMembership>>;
}

export function createConversationStore(conversation: ConversationTransportPort, timeline: TimelineTransportPort, delivery: DeliveryTransportPort): ConversationStore {
  const channels = signal<AsyncState<readonly DenConversationChannel[]>>(idleState());
  const messages = signal<AsyncState<readonly DenChannelMessage[]>>(idleState());
  const memberships = signal<AsyncState<readonly DenConversationMembership[]>>(idleState());
  const timelineState = signal<AsyncState<readonly TimelineItemView[]>>(idleState());
  const selectedChannelId = signal<number | null>(null);
  let timelineCursor: string | null = null;

  const loadChannel = async (channelId: number): Promise<void> => {
    const previousMessages = stateValue(messages());
    const previousMemberships = stateValue(memberships());
    const previousTimeline = stateValue(timelineState());
    selectedChannelId.set(channelId);
    timelineCursor = null;
    messages.set(loadingState(previousMessages));
    memberships.set(loadingState(previousMemberships));
    timelineState.set(loadingState(previousTimeline));
    try {
      const [messageResult, membershipResult, timelineResult] = await Promise.all([
        conversation.listMessages(channelId, { limit: 100 }),
        conversation.listMemberships({ channelId, limit: 100 }),
        timeline.listChannelItems(channelId, { limit: 100 }),
      ]);
      messages.set(resultState(messageResult, previousMessages));
      memberships.set(resultState(membershipResult, previousMemberships));
      if (timelineResult.ok) {
        timelineCursor = timelineResult.value.next_cursor ?? timelineResult.value.nextCursor ?? null;
        timelineState.set(resultState({ ok: true, value: timelineItems(timelineResult.value) }, previousTimeline));
      } else {
        timelineState.set(resultState(timelineResult, previousTimeline));
      }
    } catch (error) {
      const classified = unknownStoreError(error);
      messages.set(errorState(classified, previousMessages));
      memberships.set(errorState(classified, previousMemberships));
      timelineState.set(errorState(classified, previousTimeline));
    }
  };

  return {
    channels: channels.asReadonly(),
    messages: messages.asReadonly(),
    memberships: memberships.asReadonly(),
    timeline: timelineState.asReadonly(),
    selectedChannelId: selectedChannelId.asReadonly(),
    selectedChannel: computed(() => stateValue(channels())?.find((channel) => channel.id === selectedChannelId()) ?? null),
    refreshChannels: async (projectId) => {
      const previous = stateValue(channels());
      channels.set(loadingState(previous));
      selectedChannelId.set(null);
      messages.set(idleState());
      memberships.set(idleState());
      timelineState.set(idleState());
      try {
        const result = await conversation.listChannels(projectId, { limit: 100 });
        channels.set(resultState(result, previous));
        const firstChannelId = result.ok ? result.value[0]?.id : undefined;
        if (firstChannelId !== undefined) await loadChannel(firstChannelId);
      } catch (error) {
        channels.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectChannel: loadChannel,
    streamChannel: (channelId) => {
      const streamOptions: Parameters<TimelineTransportPort['streamChannelItems']>[1] = {
        onItem: (item) => mergeTimelineItem(item),
        onRefresh: () => void loadChannel(channelId),
        ...(timelineCursor ? { after: timelineCursor } : {}),
      };
      const subscription = timeline.streamChannelItems(channelId, streamOptions);
      return () => subscription.close();
    },
    sendMessage: async (senderIdentity, body, idempotencyKey) => {
      const channelId = selectedChannelId();
      if (channelId === null) return;
      const result = await conversation.postMessage(channelId, {
        sender_type: 'user',
        sender_identity: senderIdentity,
        body,
        message_kind: 'human_text',
        source_kind: 'den_web_channel_post',
        dedupe_key: idempotencyKey,
      });
      if (result.ok) {
        const current = stateValue(messages()) ?? [];
        messages.set(resultState({ ok: true, value: [...current, result.value] }));
        await wakeMentionedParticipants(channelId, result.value, body);
      } else {
        messages.set(errorState(result.error, stateValue(messages())));
      }
    },
    saveMembership: async (member, patch) => {
      const channelId = selectedChannelId();
      if (channelId === null) return { ok: false, error: unknownStoreError(new Error('No channel selected')) };
      return putMembership(channelId, membershipRequest(member, {
        wakePolicy: patch.wakePolicy,
        membershipStatus: patch.membershipStatus,
      }));
    },
    joinAgent: async (identity, wakePolicy) => {
      const channelId = selectedChannelId();
      const normalized = identity.trim();
      if (channelId === null || normalized.length === 0) return { ok: false, error: unknownStoreError(new Error('No channel selected')) };
      return putMembership(channelId, {
        member_type: 'agent',
        member_identity: normalized,
        profile_identity: normalized,
        membership_status: 'active',
        wake_policy: wakePolicy,
        can_send: true,
        can_react: true,
        can_invite: false,
        membership_purpose: 'ordinary',
        settings: {},
      });
    },
  };

  function mergeTimelineItem(item: DenTimelineItem): void {
    const previous = stateValue(timelineState()) ?? [];
    const nextItem = timelineItemView(item, previous.length);
    timelineCursor = nextItem.cursor ?? timelineCursor;
    const withoutDuplicate = previous.filter((existing) => existing.id !== nextItem.id);
    timelineState.set(resultState({ ok: true, value: [...withoutDuplicate, nextItem] }, previous));
  }

  async function wakeMentionedParticipants(channelId: number, message: DenChannelMessage, body: string): Promise<void> {
    const mentions = mentionedIdentities(body);
    const members = stateValue(memberships()) ?? [];
    await Promise.all(members.map(async (member) => {
      if ((member.member_type ?? member.memberType) !== 'agent' || (member.membership_status ?? member.membershipStatus ?? 'active') !== 'active') return;
      const identity = membershipIdentity(member);
      const reason = wakeReason(member.wake_policy ?? member.wakePolicy ?? 'mentions_only', identity, mentions, body, message.sender_identity ?? message.sender ?? '');
      if (!reason) return;
      const target = wakeTarget(member);
      if (!target) return;
      const sourceRef = `conversation:channels/${channelId}/messages/${message.id}`;
      await delivery.createIntent({
        target_identity: target,
        idempotency_key: `${reason}:${channelId}:${target.profile}:${message.id}-${Date.now()}`,
        source_ref: sourceRef,
        channel_message_id: message.id,
      });
    }));
  }

  async function putMembership(channelId: number, request: DenConversationPutMembershipRequest): Promise<DenResult<DenConversationMembership>> {
    try {
      const result = await conversation.putMembership(channelId, request);
      if (result.ok) memberships.set(reconcileMembership(memberships(), result.value));
      else memberships.set(errorState(result.error, stateValue(memberships())));
      return result;
    } catch (error) {
      const classified = unknownStoreError(error);
      memberships.set(errorState(classified, stateValue(memberships())));
      return { ok: false, error: classified };
    }
  }
}

function mentionedIdentities(body: string): ReadonlySet<string> {
  return new Set([...body.matchAll(/@([A-Za-z0-9_.-]+)/g)].map((match) => (match[1] ?? '').toLowerCase()).filter(Boolean));
}

function wakeTarget(member: DenConversationMembership): DenDeliveryTargetIdentity | null {
  const direct = member.wake_target ?? member.wakeTarget ?? member.target_identity ?? member.targetIdentity;
  if (isWakeTarget(direct)) return direct;
  return null;
}

function wakeReason(
  policy: string,
  identity: string,
  mentions: ReadonlySet<string>,
  body: string,
  senderIdentity: string,
): 'mention' | 'wake' | null {
  const normalizedIdentity = identity.toLowerCase();
  const normalizedPolicy = policy.toLowerCase();
  if (normalizedPolicy === 'never' || normalizedPolicy === 'substantive_digest') return null;
  if (normalizedPolicy === 'all_human_messages') return 'wake';
  if (normalizedPolicy === 'all_messages_except_self') return senderIdentity.toLowerCase() === normalizedIdentity ? null : 'wake';
  if (normalizedPolicy === 'direct_questions_only') return mentions.has(normalizedIdentity) && body.includes('?') ? 'mention' : null;
  return mentions.has(normalizedIdentity) ? 'mention' : null;
}

function membershipRequest(
  member: DenConversationMembership,
  patch: { readonly wakePolicy: string; readonly membershipStatus: string },
): DenConversationPutMembershipRequest {
  const identity = membershipIdentity(member);
  const type = member.member_type ?? member.memberType ?? 'agent';
  return {
    member_type: type,
    member_identity: identity,
    profile_identity: member.profile_identity ?? member.profileIdentity ?? (type === 'agent' ? identity : null),
    membership_status: patch.membershipStatus,
    wake_policy: patch.wakePolicy,
    can_send: member.can_send ?? member.canSend ?? true,
    can_react: member.can_react ?? member.canReact ?? true,
    can_invite: false,
    membership_purpose: 'ordinary',
    settings: member.settings ?? {},
  };
}

function reconcileMembership(state: AsyncState<readonly DenConversationMembership[]>, updated: DenConversationMembership): AsyncState<readonly DenConversationMembership[]> {
  const previous = stateValue(state) ?? [];
  const next = previous.some((member) => sameMembership(member, updated))
    ? previous.map((member) => sameMembership(member, updated) ? updated : member)
    : [...previous, updated];
  return resultState({ ok: true, value: next }, previous);
}

function sameMembership(left: DenConversationMembership, right: DenConversationMembership): boolean {
  if (left.id !== undefined && right.id !== undefined) return left.id === right.id;
  return membershipIdentity(left) === membershipIdentity(right) && (left.channel_id ?? left.channelId) === (right.channel_id ?? right.channelId);
}

function isWakeTarget(value: unknown): value is DenDeliveryTargetIdentity {
  if (!isRecord(value)) return false;
  return typeof value['profile'] === 'string' && typeof value['instance_id'] === 'string';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

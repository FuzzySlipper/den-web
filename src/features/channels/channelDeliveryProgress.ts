import type { ChannelMessage } from '../../api/types';
import { parseDirectMessageMetadata } from './channelDirectMessages';

export interface WakeProgress {
  label: string;
  detail: string;
  state: 'recorded' | 'preparing' | 'replied';
}

/** Joined direct-delivery status string for a direct-agent message, or null when not a direct message. */
export function directDeliveryStatus(message: ChannelMessage): string | null {
  const metadata = parseDirectMessageMetadata(message);
  if (!metadata) return null;
  const status = [metadata.deliveryStatus, metadata.claimStatus, metadata.completionStatus, metadata.suppressionStatus]
    .filter(value => typeof value === 'string' && value.length > 0)
    .join(' · ');
  return status || 'pending';
}

/** Human-readable explanation of a direct-delivery status. */
export function directDeliveryDetail(status: string): string {
  const normalized = status.toLowerCase();
  if ((normalized.includes('recorded') && normalized.includes('pending')) || normalized.includes('pending')) {
    return 'Delivery recorded; waiting for target claim/completion.';
  }
  if (normalized.includes('claimed') || normalized.includes('delivered') || normalized.includes('delivering')) {
    return 'Delivery accepted by target runtime; waiting for reply.';
  }
  return status;
}

/** Find the agent reply message that corresponds to a direct-message delivery, if one exists. */
export function findAgentReplyForMessage(
  message: ChannelMessage,
  messages: ChannelMessage[],
  agentIdentity?: string,
): ChannelMessage | null {
  const directMetadata = parseDirectMessageMetadata(message);
  const target = agentIdentity ?? (typeof directMetadata?.targetMemberIdentity === 'string' ? directMetadata.targetMemberIdentity : '');
  if (!target) return null;
  const expectedDedupeKey = `channel-message:${message.id}:agent:${target}`;
  return messages.find(candidate => {
    if (candidate.senderType !== 'agent') return false;
    if (candidate.id <= message.id) return false;
    if (candidate.dedupeKey === expectedDedupeKey) return true;
    if (
      (candidate.sourceKind === 'gateway_delivery' || candidate.sourceKind === 'external_adapter_message')
      && candidate.senderIdentity === target
      && candidate.body.includes(`message/${message.id}`)
    ) return true;
    return false;
  }) ?? null;
}

/** Derive the wake-progress badge (recorded/preparing/replied) for a direct-agent message. */
export function deriveWakeProgress(message: ChannelMessage, messages: ChannelMessage[]): WakeProgress | null {
  const status = directDeliveryStatus(message);
  if (!status) return null;
  const reply = findAgentReplyForMessage(message, messages);
  if (reply) {
    return {
      label: 'Reply posted',
      detail: `Agent response #${reply.id} is visible in the channel.`,
      state: 'replied',
    };
  }

  const normalizedStatus = status.toLowerCase();
  const statusParts = normalizedStatus.split(' · ').map(part => part.trim());
  const hasClaimOrDeliveryEvidence = statusParts.some(part => part === 'claimed' || part === 'delivered' || part === 'delivering');
  if (hasClaimOrDeliveryEvidence) {
    return {
      label: 'Agent is preparing a reply',
      detail: directDeliveryDetail(status),
      state: 'preparing',
    };
  }

  return {
    label: 'Direct delivery recorded',
    detail: directDeliveryDetail(status),
    state: 'recorded',
  };
}

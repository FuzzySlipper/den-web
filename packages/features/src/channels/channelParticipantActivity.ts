import type { ChannelMessage, GatewayMember } from '@den-web/api/types';
import { parseDirectMessageMetadata } from './channelDirectMessages';
import { findAgentReplyForMessage } from './channelDeliveryProgress';

export function memberIsActiveAgent(member: GatewayMember): boolean {
  return member.memberType === 'agent' && member.membershipStatus === 'active';
}

/** Compact membership status line: status · wake policy · settings label. */
export function memberStatus(member: GatewayMember): string {
  return [member.membershipStatus, member.wakePolicy, member.settingsLabel]
    .filter(Boolean)
    .join(' · ');
}

/** Whether a member's wake policy would cause it to wake for the given message. */
export function participantShouldWakeForMessage(member: GatewayMember, message: ChannelMessage): boolean {
  if (message.senderType !== 'user' || message.messageKind !== 'human_text') return false;
  const directMetadata = parseDirectMessageMetadata(message);
  if (directMetadata) {
    return directMetadata.targetMemberIdentity === member.memberIdentity;
  }

  const body = message.body.toLowerCase();
  const mention = `@${member.memberIdentity.toLowerCase()}`;
  switch (member.wakePolicy) {
    case 'all_human_messages':
      return true;
    case 'all_messages_except_self':
      return message.senderIdentity !== member.memberIdentity;
    case 'mentions_only':
      return body.includes(mention);
    case 'direct_questions_only':
      return body.includes(mention) && body.includes('?');
    default:
      return false;
  }
}

/**
 * Infer whether an active agent member is currently 'working' (woken by a
 * recent message but has not replied yet) or 'active' (idle/caught up).
 */
export function deriveParticipantActivity(member: GatewayMember, messages: ChannelMessage[]): 'active' | 'working' {
  if (!memberIsActiveAgent(member)) return 'active';
  for (const message of [...messages].reverse()) {
    if (message.senderType === 'agent' && message.senderIdentity === member.memberIdentity) {
      return 'active';
    }
    if (!participantShouldWakeForMessage(member, message)) continue;
    return findAgentReplyForMessage(message, messages, member.memberIdentity) ? 'active' : 'working';
  }
  return 'active';
}

import { describe, expect, it } from 'vitest';
import type { ChannelMessage, GatewayMember } from '@den-web/api/types';
import {
  deriveParticipantActivity,
  memberIsActiveAgent,
  memberStatus,
  participantShouldWakeForMessage,
} from './channelParticipantActivity';

function member(overrides: Partial<GatewayMember>): GatewayMember {
  return {
    id: 1,
    memberType: 'agent',
    memberIdentity: 'den-mcp-runner',
    membershipStatus: 'active',
    wakePolicy: 'mentions_only',
    canSend: true,
    canReact: true,
    canInvite: false,
    cooldownSeconds: 60,
    maxAutoRepliesPerWindow: 1,
    settingsLabel: null,
    createdAt: null,
    updatedAt: null,
    leftAt: null,
    ...overrides,
  };
}

function message(overrides: Partial<ChannelMessage>): ChannelMessage {
  return {
    id: 1,
    channelId: 10,
    senderType: 'user',
    senderIdentity: 'patch',
    body: 'hi',
    messageKind: 'human_text',
    sourceKind: null,
    sourceId: null,
    sourceProjectId: null,
    summary: null,
    deepLink: null,
    threadRootMessageId: null,
    replyToMessageId: null,
    metadataJson: null,
    deliveryRequestId: null,
    dedupeKey: null,
    finalChannelMessageId: null,
    createdAt: '2026-05-19T00:00:00Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('memberIsActiveAgent', () => {
  it('is true only for active agents', () => {
    expect(memberIsActiveAgent(member({}))).toBe(true);
    expect(memberIsActiveAgent(member({ membershipStatus: 'left' }))).toBe(false);
    expect(memberIsActiveAgent(member({ memberType: 'user' }))).toBe(false);
  });
});

describe('memberStatus', () => {
  it('joins present status fields', () => {
    expect(memberStatus(member({ membershipStatus: 'active', wakePolicy: 'mentions_only', settingsLabel: 'lbl' }))).toBe('active · mentions_only · lbl');
  });

  it('omits empty fields', () => {
    expect(memberStatus(member({ membershipStatus: 'active', wakePolicy: '', settingsLabel: null }))).toBe('active');
  });
});

describe('participantShouldWakeForMessage', () => {
  it('ignores non-human or agent messages', () => {
    expect(participantShouldWakeForMessage(member({}), message({ senderType: 'agent', messageKind: 'agent_text' }))).toBe(false);
  });

  it('wakes the targeted member of a direct message', () => {
    const direct = message({
      sourceKind: 'wake_event',
      metadataJson: JSON.stringify({ deliveryMode: 'direct_agent_message', targetMemberIdentity: 'den-mcp-runner' }),
    });
    expect(participantShouldWakeForMessage(member({ memberIdentity: 'den-mcp-runner' }), direct)).toBe(true);
    expect(participantShouldWakeForMessage(member({ memberIdentity: 'other' }), direct)).toBe(false);
  });

  it('applies mentions_only policy', () => {
    expect(participantShouldWakeForMessage(member({ wakePolicy: 'mentions_only' }), message({ body: 'hey @den-mcp-runner' }))).toBe(true);
    expect(participantShouldWakeForMessage(member({ wakePolicy: 'mentions_only' }), message({ body: 'no mention' }))).toBe(false);
  });

  it('applies direct_questions_only policy', () => {
    expect(participantShouldWakeForMessage(member({ wakePolicy: 'direct_questions_only' }), message({ body: '@den-mcp-runner ok?' }))).toBe(true);
    expect(participantShouldWakeForMessage(member({ wakePolicy: 'direct_questions_only' }), message({ body: '@den-mcp-runner ok' }))).toBe(false);
  });

  it('applies all_human_messages and all_messages_except_self policies', () => {
    expect(participantShouldWakeForMessage(member({ wakePolicy: 'all_human_messages' }), message({ body: 'anything' }))).toBe(true);
    expect(participantShouldWakeForMessage(member({ memberIdentity: 'a', wakePolicy: 'all_messages_except_self' }), message({ senderIdentity: 'a' }))).toBe(false);
    expect(participantShouldWakeForMessage(member({ memberIdentity: 'a', wakePolicy: 'all_messages_except_self' }), message({ senderIdentity: 'b' }))).toBe(true);
  });

  it('does not wake for the never policy', () => {
    expect(participantShouldWakeForMessage(member({ wakePolicy: 'never' }), message({ body: '@den-mcp-runner ?' }))).toBe(false);
  });
});

describe('deriveParticipantActivity', () => {
  it('is active for non-active members', () => {
    expect(deriveParticipantActivity(member({ membershipStatus: 'left' }), [])).toBe('active');
  });

  it('is working when woken by a message with no reply yet', () => {
    const woke = message({ id: 5, body: '@den-mcp-runner please look', wakePolicy: undefined } as Partial<ChannelMessage>);
    expect(deriveParticipantActivity(member({ wakePolicy: 'mentions_only' }), [woke])).toBe('working');
  });

  it('is active once the agent has replied after the waking message', () => {
    const woke = message({ id: 5, body: '@den-mcp-runner please look' });
    const reply = message({ id: 6, senderType: 'agent', senderIdentity: 'den-mcp-runner' });
    expect(deriveParticipantActivity(member({ wakePolicy: 'mentions_only' }), [woke, reply])).toBe('active');
  });
});

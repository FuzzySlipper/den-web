import { describe, expect, it } from 'vitest';
import type { ChannelMessage } from '../../api/types';
import {
  deriveWakeProgress,
  directDeliveryDetail,
  directDeliveryStatus,
  findAgentReplyForMessage,
} from './channelDeliveryProgress';

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

function directMessage(extra: Record<string, unknown> = {}, overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return message({
    id: 100,
    sourceKind: 'wake_event',
    metadataJson: JSON.stringify({ deliveryMode: 'direct_agent_message', targetMemberIdentity: 'den-mcp-runner', ...extra }),
    ...overrides,
  });
}

describe('directDeliveryStatus', () => {
  it('joins present status fields', () => {
    expect(directDeliveryStatus(directMessage({ deliveryStatus: 'recorded', claimStatus: 'pending' }))).toBe('recorded · pending');
  });

  it('defaults to pending when no status fields are present', () => {
    expect(directDeliveryStatus(directMessage())).toBe('pending');
  });

  it('returns null for a non-direct message', () => {
    expect(directDeliveryStatus(message({ metadataJson: null }))).toBeNull();
  });
});

describe('directDeliveryDetail', () => {
  it('explains pending deliveries', () => {
    expect(directDeliveryDetail('recorded · pending')).toContain('waiting for target claim');
  });

  it('explains claimed/delivered deliveries', () => {
    expect(directDeliveryDetail('claimed')).toContain('waiting for reply');
  });

  it('passes through unrecognized statuses', () => {
    expect(directDeliveryDetail('weird-status')).toBe('weird-status');
  });
});

describe('findAgentReplyForMessage', () => {
  it('matches a reply by the expected dedupe key', () => {
    const source = directMessage({}, { id: 100 });
    const reply = message({ id: 101, senderType: 'agent', senderIdentity: 'den-mcp-runner', dedupeKey: 'channel-message:100:agent:den-mcp-runner' });
    expect(findAgentReplyForMessage(source, [source, reply])).toBe(reply);
  });

  it('matches a gateway-delivery reply that references the source message', () => {
    const source = directMessage({}, { id: 100 });
    const reply = message({ id: 102, senderType: 'agent', senderIdentity: 'den-mcp-runner', sourceKind: 'gateway_delivery', body: 'see message/100 for context' });
    expect(findAgentReplyForMessage(source, [source, reply])).toBe(reply);
  });

  it('ignores earlier messages and non-agent senders', () => {
    const source = directMessage({}, { id: 100 });
    const earlier = message({ id: 99, senderType: 'agent', senderIdentity: 'den-mcp-runner', dedupeKey: 'channel-message:100:agent:den-mcp-runner' });
    expect(findAgentReplyForMessage(source, [earlier, source])).toBeNull();
  });

  it('returns null when no target can be resolved', () => {
    expect(findAgentReplyForMessage(message({ metadataJson: null }), [])).toBeNull();
  });
});

describe('deriveWakeProgress', () => {
  it('reports a posted reply', () => {
    const source = directMessage({}, { id: 100 });
    const reply = message({ id: 101, senderType: 'agent', senderIdentity: 'den-mcp-runner', dedupeKey: 'channel-message:100:agent:den-mcp-runner' });
    expect(deriveWakeProgress(source, [source, reply])).toMatchObject({ state: 'replied' });
  });

  it('reports preparing when delivery is claimed but unreplied', () => {
    const source = directMessage({ deliveryStatus: 'claimed' }, { id: 100 });
    expect(deriveWakeProgress(source, [source])).toMatchObject({ state: 'preparing' });
  });

  it('reports recorded when only pending evidence exists', () => {
    const source = directMessage({ deliveryStatus: 'recorded' }, { id: 100 });
    expect(deriveWakeProgress(source, [source])).toMatchObject({ state: 'recorded' });
  });

  it('returns null for a non-direct message', () => {
    expect(deriveWakeProgress(message({ metadataJson: null }), [])).toBeNull();
  });
});

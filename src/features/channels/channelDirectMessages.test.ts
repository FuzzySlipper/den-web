import { describe, expect, it } from 'vitest';
import type { ChannelMessage } from '../../api/types';
import { directMessageEvidence, parseDirectMessageMetadata } from './channelDirectMessages';

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

const directMetadata = JSON.stringify({
  deliveryMode: 'direct_agent_message',
  targetMemberIdentity: 'den-mcp-runner',
  deliveryStatus: 'recorded',
  claimStatus: 'pending',
});

describe('parseDirectMessageMetadata (channel chat panel semantics)', () => {
  it('returns the raw metadata for a direct message on a wake_event source', () => {
    const parsed = parseDirectMessageMetadata(message({ sourceKind: 'wake_event', metadataJson: directMetadata }));
    expect(parsed).toMatchObject({ deliveryMode: 'direct_agent_message', targetMemberIdentity: 'den-mcp-runner' });
  });

  it('ignores metadata that is not on a wake_event source', () => {
    expect(parseDirectMessageMetadata(message({ sourceKind: 'gateway_delivery', metadataJson: directMetadata }))).toBeNull();
  });

  it('returns null when metadata is absent or not a direct message', () => {
    expect(parseDirectMessageMetadata(message({ sourceKind: 'wake_event', metadataJson: null }))).toBeNull();
    expect(parseDirectMessageMetadata(message({
      sourceKind: 'wake_event',
      metadataJson: JSON.stringify({ deliveryMode: 'something_else' }),
    }))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseDirectMessageMetadata(message({ sourceKind: 'wake_event', metadataJson: '{not json' }))).toBeNull();
  });
});

describe('directMessageEvidence (focused session view semantics)', () => {
  it('extracts target and joined status regardless of source kind', () => {
    const evidence = directMessageEvidence(message({ sourceKind: 'gateway_delivery', metadataJson: directMetadata }));
    expect(evidence).toEqual({ target: 'den-mcp-runner', status: 'recorded · pending' });
  });

  it('uses a pending placeholder status when no status fields are present', () => {
    const evidence = directMessageEvidence(message({
      metadataJson: JSON.stringify({ deliveryMode: 'direct_agent_message', targetMemberIdentity: 'agent-x' }),
    }));
    expect(evidence).toEqual({ target: 'agent-x', status: 'claimed/delivered/reply-posted pending' });
  });

  it('returns a null target when none is provided', () => {
    const evidence = directMessageEvidence(message({
      metadataJson: JSON.stringify({ deliveryMode: 'direct_agent_message', deliveryStatus: 'delivered' }),
    }));
    expect(evidence).toEqual({ target: null, status: 'delivered' });
  });

  it('returns null for non-direct or missing metadata', () => {
    expect(directMessageEvidence(message({ metadataJson: null }))).toBeNull();
    expect(directMessageEvidence(message({ metadataJson: JSON.stringify({ deliveryMode: 'other' }) }))).toBeNull();
  });
});

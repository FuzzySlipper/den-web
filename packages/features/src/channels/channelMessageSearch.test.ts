import { describe, expect, it } from 'vitest';
import type { ChannelMessage } from '@den-web/api/types';
import { filterLoadedChannelMessages } from './channelMessageSearch';

function message(overrides: Partial<ChannelMessage>): ChannelMessage {
  return {
    id: 1,
    channelId: 10,
    senderType: 'user',
    senderIdentity: 'patch',
    body: 'hello from the channel',
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
    createdAt: '2026-06-06T00:00:00Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('filterLoadedChannelMessages', () => {
  const messages = [
    message({ id: 1, senderIdentity: 'patch', body: 'Need a channel search box for humans' }),
    message({ id: 2, senderIdentity: 'den-mcp-runner', body: 'Agent work evidence deployed', workerRunId: 'piw_1978_reviewer' }),
    message({ id: 3, senderIdentity: 'planner', body: 'Create backend follow-up', targetProjectId: 'den-channels', targetTaskId: 1980 }),
  ];

  it('returns the original loaded messages for a blank query', () => {
    expect(filterLoadedChannelMessages(messages, '')).toBe(messages);
    expect(filterLoadedChannelMessages(messages, '   ')).toBe(messages);
  });

  it('matches message body and sender case-insensitively', () => {
    expect(filterLoadedChannelMessages(messages, 'SEARCH').map(result => result.id)).toEqual([1]);
    expect(filterLoadedChannelMessages(messages, 'runner').map(result => result.id)).toEqual([2]);
  });

  it('requires all query terms to match the same loaded message', () => {
    expect(filterLoadedChannelMessages(messages, 'agent deployed').map(result => result.id)).toEqual([2]);
    expect(filterLoadedChannelMessages(messages, 'agent backend').map(result => result.id)).toEqual([]);
  });

  it('matches routing metadata so humans can find task/project breadcrumbs', () => {
    expect(filterLoadedChannelMessages(messages, 'den-channels 1980').map(result => result.id)).toEqual([3]);
    expect(filterLoadedChannelMessages(messages, 'piw_1978').map(result => result.id)).toEqual([2]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Channel, ChannelMessage } from '@den-web/api/types';
import { channelLabel, channelOptionLabel, messageSender } from './chatDisplay';

function channel(overrides: Partial<Channel>): Channel {
  return {
    id: 1,
    slug: 'test-channel',
    displayName: 'Test Channel',
    kind: 'regular',
    projectId: null,
    spaceId: null,
    createdBy: 'den-web',
    visibility: 'normal',
    settingsJson: null,
    createdAt: '2026-05-19T00:00:00Z',
    updatedAt: '2026-05-19T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

function message(overrides: Partial<ChannelMessage>): ChannelMessage {
  return {
    id: 1,
    channelId: 10,
    senderType: 'user',
    senderIdentity: '',
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

describe('channelLabel', () => {
  it('labels a present channel by slug', () => {
    expect(channelLabel(channel({ slug: 'my-channel' }), 'den-channels')).toBe('#my-channel');
  });

  it('labels an agent-commons channel by slug', () => {
    expect(channelLabel(channel({ slug: 'agent-commons', kind: 'system' }), 'den-channels')).toBe('#agent-commons');
  });

  it('falls back to a project label when only a projectId is present', () => {
    expect(channelLabel(null, 'den-channels')).toBe('#project-den-channels');
    // The fallback argument is not used while a projectId is available.
    expect(channelLabel(null, 'den-channels', '#select-project')).toBe('#project-den-channels');
  });

  describe('empty-state fallback differs by call site', () => {
    it('defaults to #agent-commons (channel chat panel semantics)', () => {
      expect(channelLabel(null, null)).toBe('#agent-commons');
    });

    it('honors an explicit #select-project fallback (focused session view semantics)', () => {
      expect(channelLabel(null, null, '#select-project')).toBe('#select-project');
    });
  });
});

describe('channelOptionLabel', () => {
  it('appends the project scope when present', () => {
    const projectDefault = channel({ id: 43, slug: 'den-channels', kind: 'project_default', projectId: 'den-channels' });
    expect(channelOptionLabel(projectDefault, 'den-channels')).toBe('#den-channels (ch:43) — project lane');
  });

  it('includes the channel id when there is no scope', () => {
    const regular = channel({ id: 7593, slug: 'random', kind: 'regular', projectId: null });
    expect(channelOptionLabel(regular, 'den-channels')).toBe('#random (ch:7593)');
  });
});

describe('messageSender', () => {
  it('prefers the sender identity', () => {
    expect(messageSender(message({ senderIdentity: 'patch', senderType: 'user' }))).toBe('patch');
  });

  it('falls back to the sender type when identity is empty', () => {
    expect(messageSender(message({ senderIdentity: '', senderType: 'agent' }))).toBe('agent');
  });
});

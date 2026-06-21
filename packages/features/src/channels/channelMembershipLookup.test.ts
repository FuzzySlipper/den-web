import { describe, expect, it } from 'vitest';
import type { Channel } from '@den-web/api/types';
import { membershipLookupForChannel, membershipWriteChannelId } from './channelMembershipLookup';

function channel(overrides: Partial<Channel>): Channel {
  return {
    id: 40,
    slug: 'project-den-services',
    displayName: 'den-services',
    kind: 'project_default',
    projectId: 'den-services',
    spaceId: 'den-services',
    createdBy: 'test',
    visibility: 'normal',
    settingsJson: null,
    createdAt: '2026-06-21T00:00:00Z',
    updatedAt: '2026-06-21T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

describe('channel membership lookup', () => {
  it('reads project-owned channels by project id so successor channel ids do not hit legacy membership lookups', () => {
    expect(membershipLookupForChannel(channel({ id: 40, projectId: 'den-services' }))).toEqual({ projectId: 'den-services' });
  });

  it('keeps shared channels on channel-id membership lookups', () => {
    expect(membershipLookupForChannel(channel({ id: 604, projectId: null, kind: 'system', slug: 'worker-pool' }))).toEqual({ channelId: 604 });
  });

  it('keeps non-default project channels on channel-id membership lookups', () => {
    expect(membershipLookupForChannel(channel({ id: 77, projectId: 'den-web', kind: 'topic' }))).toEqual({ channelId: 77 });
  });

  it('writes membership changes through the backing membership channel when one is returned', () => {
    expect(membershipWriteChannelId(channel({ id: 40 }), 7288)).toBe(7288);
  });
});

import { describe, expect, it } from 'vitest';
import type { Channel, ChannelProjectLink } from '../../api/types';
import {
  channelRole,
  isDenSystemOpsChannel,
  isSharedProjectChannel,
  linkedProjectIds,
  messageProjectAttribution,
  preferredProjectChannel,
  selectProjectChannels,
} from './channelRouting';

function channel(overrides: Partial<Channel>): Channel {
  return {
    id: 1,
    slug: 'project-den-web',
    displayName: 'den-web',
    kind: 'project_default',
    projectId: 'den-web',
    spaceId: null,
    createdBy: 'test',
    visibility: 'normal',
    settingsJson: null,
    createdAt: '2026-06-04T00:00:00Z',
    updatedAt: '2026-06-04T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

function link(projectId: string, id: number): ChannelProjectLink {
  return {
    id,
    channelId: 672,
    projectId,
    relationKind: 'linked',
    isPrimary: id === 1,
    settingsJson: null,
    createdAt: '2026-06-04T00:00:00Z',
  };
}

const agentCommons = channel({
  id: 21,
  slug: 'agent-commons',
  displayName: 'Agent Commons',
  kind: 'system',
  projectId: null,
  settingsJson: '{"channelRole":"agent_commons"}',
});

const denSystem = channel({
  id: 672,
  slug: 'den-system',
  displayName: '#den-system',
  kind: 'system',
  projectId: null,
  settingsJson: '{"channelRole":"den_system_ops"}',
});

describe('channel routing helpers', () => {
  it('recognizes den-system as a shared linked-project channel', () => {
    expect(channelRole(denSystem)).toBe('den_system_ops');
    expect(isDenSystemOpsChannel(denSystem)).toBe(true);
    expect(isSharedProjectChannel(denSystem)).toBe(true);
  });

  it('prefers linked #den-system and hides legacy project-default lanes when links exist', () => {
    const legacyProjectDefault = channel({ id: 42, slug: 'project-den-web', kind: 'project_default', projectId: 'den-web' });
    const adHocProjectChannel = channel({ id: 43, slug: 'den-web-release', kind: 'project', projectId: 'den-web' });

    const selected = selectProjectChannels('den-web', [legacyProjectDefault, adHocProjectChannel], [denSystem], agentCommons);

    expect(selected.map(item => item.slug)).toEqual(['den-system', 'den-web-release', 'agent-commons']);
    expect(preferredProjectChannel(selected, 'den-web')?.slug).toBe('den-system');
  });

  it('falls back to project default channels when no linked channels exist', () => {
    const legacyProjectDefault = channel({ id: 42, slug: 'project-den-web', kind: 'project_default', projectId: 'den-web' });

    const selected = selectProjectChannels('den-web', [legacyProjectDefault], [], agentCommons);

    expect(selected.map(item => item.slug)).toEqual(['project-den-web', 'agent-commons']);
    expect(preferredProjectChannel(selected, 'den-web')?.slug).toBe('project-den-web');
  });

  it('extracts project attribution from first-class fields or metadata', () => {
    expect(messageProjectAttribution({ sourceProjectId: 'den-core', targetProjectId: null })).toBe('den-core');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: 'den-web' })).toBe('den-web');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: null, metadataJson: '{"projectId":"den-channels"}' })).toBe('den-channels');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: null, metadataJson: 'not-json' })).toBeNull();
  });

  it('dedupes and sorts linked project ids for the shared-channel filter', () => {
    expect(linkedProjectIds([link('den-web', 1), link('den-core', 2), link('den-web', 3)])).toEqual(['den-core', 'den-web']);
  });
});

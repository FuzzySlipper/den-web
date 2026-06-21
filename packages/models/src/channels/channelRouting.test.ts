import { describe, expect, it } from 'vitest';
import type { Channel, ChannelProjectLink } from '@den-web/api/types';
import {
  channelRole,
  isDenSystemOpsChannel,
  isSharedProjectChannel,
  isWorkerPoolChannel,
  linkedProjectIds,
  messageProjectAttribution,
  preferredProjectChannel,
  projectChannelScopeLabel,
  selectProjectChannels,
  shouldPreferProjectChannelAfterProjectChange,
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

const workerPool = channel({
  id: 604,
  slug: 'worker-pool',
  displayName: '#worker-pool',
  kind: 'system',
  projectId: null,
  settingsJson: '{"channelRole":"worker_pool"}',
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
    expect(projectChannelScopeLabel(legacyProjectDefault)).toBe('project lane');
    expect(projectChannelScopeLabel(legacyProjectDefault)).not.toContain('legacy');
  });

  it('does not let the worker-pool breadcrumb suppress project-default channel creation', () => {
    const selected = selectProjectChannels('new-project', [], [], agentCommons, workerPool);

    expect(selected.map(item => item.slug)).toEqual(['agent-commons']);
  });

  it('keeps a den-router-like project lane while surfacing shared worker-pool breadcrumbs', () => {
    const projectDefault = channel({ id: 9, slug: 'project-den-router', kind: 'project_default', projectId: 'den-router' });

    const selected = selectProjectChannels('den-router', [projectDefault], [], agentCommons, workerPool);

    expect(selected.map(item => item.slug)).toEqual(['project-den-router', 'worker-pool', 'agent-commons']);
    expect(projectChannelScopeLabel(projectDefault)).toBe('project lane');
    expect(projectChannelScopeLabel(workerPool)).toBe('shared worker-pool lane');
    expect(isWorkerPoolChannel(workerPool)).toBe(true);
    expect(preferredProjectChannel(selected, 'den-router')?.slug).toBe('project-den-router');
  });

  it('resets shared channel selection when navigating between projects', () => {
    expect(shouldPreferProjectChannelAfterProjectChange('agora-os', 'den-web', agentCommons)).toBe(true);
    expect(shouldPreferProjectChannelAfterProjectChange('agora-os', 'den-web', denSystem)).toBe(true);
    expect(shouldPreferProjectChannelAfterProjectChange('den-web', 'den-web', agentCommons)).toBe(false);
    expect(shouldPreferProjectChannelAfterProjectChange('agora-os', 'den-web', channel({ projectId: 'den-web' }))).toBe(false);
    expect(shouldPreferProjectChannelAfterProjectChange('agora-os', null, agentCommons)).toBe(false);
  });

  it('extracts project attribution from first-class fields or metadata', () => {
    expect(messageProjectAttribution({ sourceProjectId: 'den-core', targetProjectId: null })).toBe('den-core');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: 'den-web' })).toBe('den-web');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: null, projectId: 'den-router' })).toBe('den-router');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: null, metadataJson: '{"projectId":"den-channels"}' })).toBe('den-channels');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: null, metadataJson: '{"sourceProjectId":"den-core","projectId":"den-web"}' })).toBe('den-core');
    expect(messageProjectAttribution({ sourceProjectId: null, targetProjectId: null, metadataJson: 'not-json' })).toBeNull();
  });

  it('dedupes and sorts linked project ids for the shared-channel filter', () => {
    expect(linkedProjectIds([link('den-web', 1), link('den-core', 2), link('den-web', 3)])).toEqual(['den-core', 'den-web']);
  });
});

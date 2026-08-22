import { describe, expect, it } from 'vitest';
import { DEN_GLOBAL_PROJECT_ID, type DenProject, type DenSpace } from '@den-web/protocol';
import { workspaceItems } from './workspace-items';

const project: DenProject = { id: 'den-web', name: 'Den Web', visibility: 'normal' };
const projectScope: DenSpace = { id: 'den-web', name: 'Den Web', kind: 'project', visibility: 'normal' };
const personalSpace: DenSpace = { id: 'asha', name: 'Asha Studio', kind: 'personal', visibility: 'normal' };
const knowledgeSpace: DenSpace = {
  id: 'knowledge-base',
  name: 'Knowledge Base',
  kind: 'knowledge_base',
  visibility: 'normal',
};

describe('workspaceItems', () => {
  it('hides spaces and keeps global and projects while show spaces is disabled', () => {
    const items = workspaceItems([project], [projectScope, personalSpace, knowledgeSpace], false);
    expect(items.map((item) => item.id)).toEqual([DEN_GLOBAL_PROJECT_ID, 'den-web']);
  });

  it('lists every scope while show spaces is enabled', () => {
    const items = workspaceItems([project], [projectScope, personalSpace, knowledgeSpace], true);
    expect(items.map((item) => item.id)).toEqual([DEN_GLOBAL_PROJECT_ID, 'asha', 'den-web', 'knowledge-base']);
  });

  it('classifies scopes by their kind instead of their list source', () => {
    const items = workspaceItems([project], [projectScope, personalSpace], true);
    const projectItem = items.find((item) => item.id === 'den-web');
    const spaceItem = items.find((item) => item.id === 'asha');
    expect(projectItem?.source).toBe('space');
    expect(spaceItem?.kind).toBe('personal');
  });

  it('keeps kind-less scopes that appear in the projects list when spaces are hidden', () => {
    const untypedProjectScope: DenSpace = { id: 'den-web', name: 'Den Web', kind: undefined, visibility: 'normal' };
    const items = workspaceItems([project], [untypedProjectScope], false);
    expect(items.map((item) => item.id)).toEqual([DEN_GLOBAL_PROJECT_ID, 'den-web']);
  });

  it('hides kind-less scopes that only exist in the spaces response when spaces are hidden', () => {
    const untypedSpace: DenSpace = { id: 'mystery', name: 'Mystery', kind: undefined, visibility: 'normal' };
    const items = workspaceItems([project], [untypedSpace], false);
    expect(items.map((item) => item.id)).toEqual([DEN_GLOBAL_PROJECT_ID, 'den-web']);
  });

  it('keeps archived projects governed by the visibility toggle independent of show spaces', () => {
    const archivedProject: DenProject = { id: 'old-den', name: 'Old Den', visibility: 'archived' };
    const hiddenWhenSpacesOff = workspaceItems([project, archivedProject], [], false);
    const visibleWithSpacesOn = workspaceItems([project, archivedProject], [], true);
    expect(hiddenWhenSpacesOff.map((item) => item.id)).toEqual([DEN_GLOBAL_PROJECT_ID, 'den-web', 'old-den']);
    expect(visibleWithSpacesOn.map((item) => item.id)).toEqual(hiddenWhenSpacesOff.map((item) => item.id));
  });
});

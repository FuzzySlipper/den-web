import { describe, expect, it } from 'vitest';
import { WORKSPACE_VIEW_MODES, type WorkspaceViewMode } from './workspaceViewModes';

describe('workspaceViewModes', () => {
  it('includes dm so the DM transcript panel is reachable', () => {
    expect(WORKSPACE_VIEW_MODES).toContain('dm' as WorkspaceViewMode);
  });

  it('dm mode appears after agents in the cycle order', () => {
    const agentsIdx = WORKSPACE_VIEW_MODES.indexOf('agents');
    const dmIdx = WORKSPACE_VIEW_MODES.indexOf('dm' as WorkspaceViewMode);
    expect(dmIdx).toBe(agentsIdx + 1);
  });

  it('has no duplicates', () => {
    const unique = new Set(WORKSPACE_VIEW_MODES);
    expect(unique.size).toBe(WORKSPACE_VIEW_MODES.length);
  });
});

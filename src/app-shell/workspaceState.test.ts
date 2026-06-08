import { describe, expect, it } from 'vitest';
import { TASK_FILTERS } from '../features/tasks/taskStatuses';
import { WORKSPACE_VIEW_MODES } from './workspaceViewModes';
import {
  WORKSPACE_VIEW_LABELS,
  WORKSPACE_VIEW_TITLES,
  mainPanelCountLabel,
  mainPanelTitle,
  nextTaskFilter,
  nextViewMode,
} from './workspaceState';

describe('view metadata', () => {
  it('has a label and title for every view mode', () => {
    for (const mode of WORKSPACE_VIEW_MODES) {
      expect(WORKSPACE_VIEW_LABELS[mode]).toBeTruthy();
      expect(WORKSPACE_VIEW_TITLES[mode]).toBeTruthy();
    }
  });

  it('titles the dm view as Direct Messages', () => {
    expect(mainPanelTitle('dm')).toBe('Direct Messages');
  });
});

describe('mainPanelCountLabel', () => {
  const counts = { taskCount: 3, filterLabel: ' [Active]', sortLabel: ' ↕id', docCount: 7, streamCount: 12 };

  it('includes filter and sort labels for tasks', () => {
    expect(mainPanelCountLabel('tasks', counts)).toBe('(3 [Active] ↕id)');
  });

  it('counts documents and stream entries', () => {
    expect(mainPanelCountLabel('documents', counts)).toBe('(7)');
    expect(mainPanelCountLabel('agent-stream', counts)).toBe('(12)');
  });

  it('returns null for views without a count', () => {
    expect(mainPanelCountLabel('messages', counts)).toBeNull();
    expect(mainPanelCountLabel('git', counts)).toBeNull();
  });
});

describe('nextViewMode', () => {
  it('cycles forward through the configured order', () => {
    expect(nextViewMode('tasks')).toBe(WORKSPACE_VIEW_MODES[1]);
  });

  it('wraps around from the last view', () => {
    const last = WORKSPACE_VIEW_MODES[WORKSPACE_VIEW_MODES.length - 1];
    expect(nextViewMode(last)).toBe(WORKSPACE_VIEW_MODES[0]);
  });
});

describe('nextTaskFilter', () => {
  it('cycles from all (null) to the first concrete filter', () => {
    expect(nextTaskFilter(null)).toBe(TASK_FILTERS[0]);
  });

  it('wraps from the last filter back to all (null)', () => {
    expect(nextTaskFilter(TASK_FILTERS[TASK_FILTERS.length - 1])).toBeNull();
  });

  it('advances between concrete filters', () => {
    expect(nextTaskFilter(TASK_FILTERS[0])).toBe(TASK_FILTERS[1]);
  });
});

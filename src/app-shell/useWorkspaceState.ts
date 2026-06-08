import { useState } from 'react';
import { ACTIVE_TASK_FILTER } from '../features/tasks/taskStatuses';
import type { WorkspaceViewMode } from './workspaceViewModes';

export type MobilePrimarySection = 'workspace' | 'channel';
export type AgentsSubView = 'overview' | 'worker-pool';

export interface WorkspaceState {
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  sortMode: string;
  setSortMode: (mode: string) => void;
  mobilePrimarySection: MobilePrimarySection;
  setMobilePrimarySection: (section: MobilePrimarySection) => void;
  agentsSubView: AgentsSubView;
  setAgentsSubView: (view: AgentsSubView) => void;
}

/**
 * Workspace routing/view state: which main panel is active, how tasks are
 * filtered/sorted, the mobile primary panel, and the agents sub-view.
 */
export function useWorkspaceState(): WorkspaceState {
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('tasks');
  const [statusFilter, setStatusFilter] = useState<string | null>(ACTIVE_TASK_FILTER);
  const [sortMode, setSortMode] = useState('priority');
  const [mobilePrimarySection, setMobilePrimarySection] = useState<MobilePrimarySection>('workspace');
  const [agentsSubView, setAgentsSubView] = useState<AgentsSubView>('overview');

  return {
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    sortMode,
    setSortMode,
    mobilePrimarySection,
    setMobilePrimarySection,
    agentsSubView,
    setAgentsSubView,
  };
}

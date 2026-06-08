import type { Space } from '../api/types';
import { WORKSPACE_VIEW_MODES, type WorkspaceViewMode } from './workspaceViewModes';
import { WORKSPACE_VIEW_LABELS } from './workspaceState';
import type { MobilePrimarySection } from './useWorkspaceState';

interface Props {
  spaces: Space[];
  effectiveSpaceId: string | null;
  viewMode: WorkspaceViewMode;
  mobilePrimarySection: MobilePrimarySection;
  onProjectSelect: (id: string) => void;
  /** Select a workspace view; also switches the mobile primary panel to the workspace. */
  onSelectViewMode: (mode: WorkspaceViewMode) => void;
  onSelectSection: (section: MobilePrimarySection) => void;
}

/** Phone-viewport top bar for switching project, workspace section, and primary panel. */
export function MobileTopBar({
  spaces,
  effectiveSpaceId,
  viewMode,
  mobilePrimarySection,
  onProjectSelect,
  onSelectViewMode,
  onSelectSection,
}: Props) {
  return (
    <div className="mobile-topbar" aria-label="Mobile navigation">
      <label className="mobile-topbar-control">
        <span>Project</span>
        <select
          value={effectiveSpaceId ?? ''}
          onChange={event => onProjectSelect(event.target.value)}
          aria-label="Switch project or space"
        >
          {spaces.map(space => (
            <option key={space.id} value={space.id}>{space.name || space.id}</option>
          ))}
        </select>
      </label>
      <label className="mobile-topbar-control">
        <span>Section</span>
        <select
          value={mobilePrimarySection === 'channel' ? 'channel' : viewMode}
          onChange={event => {
            if (event.target.value === 'channel') {
              onSelectSection('channel');
              return;
            }
            onSelectViewMode(event.target.value as WorkspaceViewMode);
          }}
          aria-label="Switch primary section"
        >
          {WORKSPACE_VIEW_MODES.map(mode => (
            <option key={mode} value={mode}>{WORKSPACE_VIEW_LABELS[mode]}</option>
          ))}
          <option value="channel">Project lane</option>
        </select>
      </label>
      <div className="mobile-section-tabs" role="tablist" aria-label="Primary panel">
        <button
          type="button"
          className={mobilePrimarySection === 'workspace' ? 'active' : ''}
          onClick={() => onSelectSection('workspace')}
          aria-pressed={mobilePrimarySection === 'workspace'}
        >
          {WORKSPACE_VIEW_LABELS[viewMode]}
        </button>
        <button
          type="button"
          className={mobilePrimarySection === 'channel' ? 'active' : ''}
          onClick={() => onSelectSection('channel')}
          aria-pressed={mobilePrimarySection === 'channel'}
        >
          Project lane
        </button>
      </div>
    </div>
  );
}

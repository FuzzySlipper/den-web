import type { ActiveWorkRoute } from '@den-web/api/types';
import { channelLabel } from '@den-web/models/channels/chatDisplay';
import { activeOwnerLabel, activeRouteKey, activeWorkTargetLabel } from './sessionPolicy';
import type { FocusedLaneState, FocusedSessionLane } from '@den-web/models/sessions/sessionDisplay';

interface Props {
  projectId: string | null;
  viewState: FocusedLaneState;
  selectedActiveRoute: ActiveWorkRoute | null;
  selectedLane: FocusedSessionLane | null;
  allLanes: FocusedSessionLane[];
  liveSessionLanes: FocusedSessionLane[];
  recentSessionLanes: FocusedSessionLane[];
  channelsLoading: boolean;
  snapshotsLoading: boolean;
  activeRoutes: ActiveWorkRoute[];
  activeRoutesLoading: boolean;
  onSelectLane: (laneKey: string) => void;
  onSelectRoute: (routeKey: string) => void;
  onRefresh: () => void;
  onSnapToBottom: () => void;
}

/** Top toolbar: active-owner/source-context lane selector, continuation-route selector, refresh controls. */
export function SessionLaneToolbar({
  projectId,
  viewState,
  selectedActiveRoute,
  selectedLane,
  allLanes,
  liveSessionLanes,
  recentSessionLanes,
  channelsLoading,
  snapshotsLoading,
  activeRoutes,
  activeRoutesLoading,
  onSelectLane,
  onSelectRoute,
  onRefresh,
  onSnapToBottom,
}: Props) {
  return (
    <div className="focused-session-toolbar">
      <div className="focused-session-title">
        <span>Active work</span>
        <strong>{selectedActiveRoute ? activeOwnerLabel(selectedActiveRoute) : selectedLane ? channelLabel(selectedLane.channel, projectId, '#select-project') : channelLabel(null, projectId, '#select-project')}</strong>
        <span className={`focused-session-state focused-session-state-${viewState}`}>{viewState}</span>
      </div>
      <label className="focused-session-selector-label" htmlFor="focused-session-selector">Active owner / source context</label>
      <select
        id="focused-session-selector"
        className="focused-session-selector"
        value={selectedLane?.key ?? ''}
        onChange={event => onSelectLane(event.target.value)}
        disabled={allLanes.length === 0}
      >
        {allLanes.length === 0 ? (
          <option value="">{channelsLoading || snapshotsLoading ? 'Loading sessions…' : 'No sessions or channels'}</option>
        ) : (
          <>
            <optgroup label="Live active-owner sessions">
              {liveSessionLanes.length === 0 ? (
                <option value="" disabled>No live sessions</option>
              ) : liveSessionLanes.map(lane => (
                <option key={lane.key} value={lane.key}>{lane.label}</option>
              ))}
            </optgroup>
            <optgroup label="Recent runtime/source contexts">
              {recentSessionLanes.map(lane => (
                <option key={lane.key} value={lane.key}>{lane.label}</option>
              ))}
            </optgroup>
          </>
        )}
      </select>
      <label className="focused-session-selector-label" htmlFor="focused-active-route-selector">Continuation route</label>
      <select
        id="focused-active-route-selector"
        className="focused-session-selector"
        value={selectedActiveRoute ? activeRouteKey(selectedActiveRoute) : ''}
        onChange={event => onSelectRoute(event.target.value)}
        disabled={activeRoutes.length === 0}
        title="Routes by target project/task/assignment/run; source channel is metadata only"
      >
        {activeRoutes.length === 0 ? (
          <option value="">{activeRoutesLoading ? 'Resolving active work…' : 'No active route for this project'}</option>
        ) : activeRoutes.map(route => (
          <option key={activeRouteKey(route)} value={activeRouteKey(route)}>
            {activeWorkTargetLabel(route)} → {activeOwnerLabel(route)}{route.isStale ? ' (stale)' : ''}
          </option>
        ))}
      </select>
      <button type="button" className="focused-session-refresh" onClick={onRefresh}>Refresh</button>
      <button
        type="button"
        className="focused-session-refresh focused-session-bottom"
        onClick={onSnapToBottom}
        title="Snap the connected transcript to the newest messages"
      >
        Bottom
      </button>
    </div>
  );
}

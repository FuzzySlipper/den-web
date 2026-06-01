import type { LayoutPreferences } from '../preferences/types';

export type NotificationHistoryMode = LayoutPreferences['notificationHistoryMode'];

/** Shared overlay ordering: detail drawers are normal overlays. */
export const DETAIL_OVERLAY_Z_INDEX = 100;

/** Docked notification side panel is normal workspace chrome, below detail overlays. */
export const NOTIFICATION_SIDE_PANEL_Z_INDEX = 10;

export function toggleNotificationSidePanel(current: boolean): boolean {
  return !current;
}

export function closeNotificationSidePanel(): boolean {
  return false;
}

export function shouldRenderNotificationSidePanel(
  isOpen: boolean,
  mode: NotificationHistoryMode,
): boolean {
  return isOpen && mode === 'sidePanel';
}

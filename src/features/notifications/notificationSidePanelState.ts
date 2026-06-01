import type { LayoutPreferences } from '../preferences/types';

export type NotificationHistoryMode = LayoutPreferences['notificationHistoryMode'];

/** Shared overlay ordering: detail drawers are normal overlays. */
export const DETAIL_OVERLAY_Z_INDEX = 100;

/** Notification side panel intentionally sits above detail drawer variants when both are open. */
export const NOTIFICATION_SIDE_PANEL_Z_INDEX = 140;

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

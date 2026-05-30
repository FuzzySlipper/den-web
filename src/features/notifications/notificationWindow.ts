/**
 * Notification panel window management utilities.
 *
 * Separate from the React component to satisfy react-refresh (component-only exports).
 */

export const NOTIFICATION_WINDOW_NAME = 'den-web-notification-panel';

/**
 * Open or focus the named notification panel window.
 * Must be called from a user gesture (e.g., button click) for the first open.
 */
export function openNotificationPanelWindow(): Window | null {
  const url = `${window.location.origin}${window.location.pathname}#/notification-panel`;
  const existing = window.open('', NOTIFICATION_WINDOW_NAME);

  if (existing && !existing.closed) {
    // Window already exists — focus it
    try {
      existing.focus();
    } catch {
      // Cross-origin or popup-blocked; fall through to normal open
    }
    // Ensure it points at the right URL
    try {
      existing.location.href = url;
    } catch {
      // Browser may block cross-origin location access — that's fine
    }
    return existing;
  }

  // Open a new window
  const win = window.open(url, NOTIFICATION_WINDOW_NAME, 'width=600,height=800,scrollbars=yes,resizable=yes');
  return win;
}

/**
 * Check if the current page URL hash indicates notification panel mode.
 */
export function isNotificationPanelRoute(): boolean {
  return window.location.hash === '#/notification-panel';
}

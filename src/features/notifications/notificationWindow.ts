/**
 * Notification panel window management utilities.
 *
 * Separate from the React component to satisfy react-refresh (component-only exports).
 */

export const NOTIFICATION_WINDOW_NAME = 'den-web-notification-panel';

const NOTIFICATION_WINDOW_ARMED_KEY = 'den-web-notification-window-armed:v1';

export interface NotificationWindowFocusResult {
  focused: boolean;
  blocked: boolean;
  reason: 'focused' | 'not_armed' | 'popup_blocked';
}

let notificationWindowRef: Window | null = null;

function notificationPanelUrl(): string {
  return `${window.location.origin}${window.location.pathname}#/notification-panel`;
}

function markNotificationWindowArmed(win: Window | null): void {
  notificationWindowRef = win;
  try {
    localStorage.setItem(NOTIFICATION_WINDOW_ARMED_KEY, 'true');
  } catch {
    // Private browsing/quota failures should not break the explicit launcher.
  }
}

export function isNotificationPanelWindowArmed(): boolean {
  if (notificationWindowRef && !notificationWindowRef.closed) return true;
  try {
    return localStorage.getItem(NOTIFICATION_WINDOW_ARMED_KEY) === 'true';
  } catch {
    return false;
  }
}

function pointAndFocus(win: Window): void {
  try {
    if (win.location.href !== notificationPanelUrl()) {
      win.location.href = notificationPanelUrl();
    }
  } catch {
    // Browser may block cross-origin location access — still attempt focus.
  }
  try {
    win.focus();
  } catch {
    // Focus can be denied by browser policy; caller still gets non-null handle.
  }
}

/**
 * Open or focus the named notification panel window.
 * Must be called from a user gesture (e.g., button click) for the first open.
 */
export function openNotificationPanelWindow(): Window | null {
  const url = notificationPanelUrl();
  const existing = window.open('', NOTIFICATION_WINDOW_NAME);

  if (existing && !existing.closed) {
    pointAndFocus(existing);
    markNotificationWindowArmed(existing);
    return existing;
  }

  // Open a new window
  const win = window.open(url, NOTIFICATION_WINDOW_NAME, 'width=600,height=800,scrollbars=yes,resizable=yes');
  if (win) {
    markNotificationWindowArmed(win);
  }
  return win;
}

/**
 * Best-effort focus/reuse for new operator events after a user has armed the
 * named notification window. If browser policy blocks it, callers should show
 * an in-app cue instead of failing silently.
 */
export function focusArmedNotificationPanelWindow(): NotificationWindowFocusResult {
  if (!isNotificationPanelWindowArmed()) {
    return { focused: false, blocked: true, reason: 'not_armed' };
  }

  const existing = notificationWindowRef && !notificationWindowRef.closed
    ? notificationWindowRef
    : window.open('', NOTIFICATION_WINDOW_NAME);

  if (!existing || existing.closed) {
    return { focused: false, blocked: true, reason: 'popup_blocked' };
  }

  pointAndFocus(existing);
  notificationWindowRef = existing;
  return { focused: true, blocked: false, reason: 'focused' };
}

/**
 * Check if the current page URL hash indicates notification panel mode.
 */
export function isNotificationPanelRoute(): boolean {
  return window.location.hash === '#/notification-panel';
}

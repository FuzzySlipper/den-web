import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  closeNotificationSidePanel,
  DETAIL_OVERLAY_Z_INDEX,
  NOTIFICATION_SIDE_PANEL_Z_INDEX,
  shouldRenderNotificationSidePanel,
  toggleNotificationSidePanel,
} from './notificationSidePanelState';

describe('notification side-panel interaction model', () => {
  function readCssVarNumber(filePath: string, name: string): number {
    const source = readFileSync(resolve(process.cwd(), filePath), 'utf8');
    const match = source.match(new RegExp(`${name}:\\s*(\\d+)`));
    if (!match) throw new Error(`Missing CSS variable ${name}`);
    return Number(match[1]);
  }

  it('opens and closes only the notification side-panel flag', () => {
    expect(toggleNotificationSidePanel(false)).toBe(true);
    expect(toggleNotificationSidePanel(true)).toBe(false);
    expect(closeNotificationSidePanel()).toBe(false);
  });

  it('renders only when side-panel mode is selected and toggled open', () => {
    expect(shouldRenderNotificationSidePanel(true, 'sidePanel')).toBe(true);
    expect(shouldRenderNotificationSidePanel(false, 'sidePanel')).toBe(false);
    expect(shouldRenderNotificationSidePanel(true, 'window')).toBe(false);
  });

  it('keeps docked notification panel below detail overlays', () => {
    expect(NOTIFICATION_SIDE_PANEL_Z_INDEX).toBeLessThan(DETAIL_OVERLAY_Z_INDEX);
  });

  it('keeps TypeScript overlay constants aligned with CSS tokens', () => {
    expect(readCssVarNumber('apps/web/src/styles/app-shell.css', '--z-detail-overlay')).toBe(DETAIL_OVERLAY_Z_INDEX);
    expect(readCssVarNumber('apps/web/src/styles/features/notifications.css', '--z-notification-side-panel')).toBe(NOTIFICATION_SIDE_PANEL_Z_INDEX);
  });

  it('documents the docked notification layout in CSS', () => {
    const layoutCss = readFileSync(resolve(process.cwd(), 'apps/web/src/styles/layout.css'), 'utf8');
    const notificationsCss = readFileSync(resolve(process.cwd(), 'apps/web/src/styles/features/notifications.css'), 'utf8');

    expect(layoutCss).toContain('.dashboard-notification-docked');
    expect(layoutCss).toContain('var(--pref-notification-panel-width, 400px)');
    expect(layoutCss).toContain('.dashboard-notification-docked .dashboard-workspace');
    expect(notificationsCss).toContain('grid-column: 3');
    expect(notificationsCss).toContain('grid-row: 1');
    expect(notificationsCss).not.toContain('position: fixed;');
  });
});

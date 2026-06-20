import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(...relativeParts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'apps/web/src', ...relativeParts), 'utf8');
}

describe('layout preference CSS token invariants', () => {
  const layoutCss = readSource('styles/layout.css');
  const appShellCss = readSource('styles/app-shell.css');
  const notificationCss = readSource('styles/features/notifications.css');

  it('uses preference width tokens for the shell and notification side panel', () => {
    expect(layoutCss).toContain('var(--pref-sidebar-width, 200px)');
    expect(notificationCss).toContain('var(--pref-notification-panel-width, 400px)');
  });

  it('lets detail drawer width preference control the drawer without the old 40vw cap', () => {
    expect(appShellCss).toContain('var(--pref-detail-panel-width, 500px)');
    expect(appShellCss).not.toContain('40vw');
  });
});

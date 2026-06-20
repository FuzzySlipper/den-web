/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('mobile single-panel navigation smoke assertions', () => {
  const appSource = readSource('packages/shell/src/App.tsx');
  const mobileTopBarSource = readSource('packages/shell/src/MobileTopBar.tsx');
  const workspaceStateSource = readSource('packages/shell/src/useWorkspaceState.ts');
  const layoutCss = readSource('apps/web/src/styles/layout.css');

  it('renders a mobile project switcher and major section switcher', () => {
    expect(mobileTopBarSource).toContain('className="mobile-topbar"');
    expect(mobileTopBarSource).toContain('aria-label="Switch project or space"');
    expect(mobileTopBarSource).toContain('aria-label="Switch primary section"');
    expect(mobileTopBarSource).toContain('Project lane');
  });

  it('mounts the mobile top bar in the app shell', () => {
    expect(appSource).toContain('<MobileTopBar');
  });

  it('tracks the active mobile primary panel explicitly', () => {
    expect(workspaceStateSource).toContain("export type MobilePrimarySection = 'workspace' | 'channel'");
    expect(appSource).toContain('dashboard-mobile-section-${workspace.mobilePrimarySection}');
    expect(mobileTopBarSource).toContain("onSelectSection('workspace')");
    expect(mobileTopBarSource).toContain("onSelectSection('channel')");
  });

  it('uses a phone viewport media query that hides inactive primary panels', () => {
    expect(layoutCss).toContain('@media (max-width: 700px)');
    expect(layoutCss).toContain('.dashboard-mobile-section-workspace .channel-chat-panel');
    expect(layoutCss).toContain('display: none;');
    expect(layoutCss).toContain('.dashboard-mobile-section-channel .dashboard-workspace');
    expect(layoutCss).toContain('.panel-projects');
  });
});

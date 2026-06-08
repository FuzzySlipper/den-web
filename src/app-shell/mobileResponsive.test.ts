/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile single-panel navigation smoke assertions', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/app-shell/App.tsx'), 'utf8');
  const layoutCss = readFileSync(resolve(process.cwd(), 'src/styles/layout.css'), 'utf8');

  it('renders a mobile project switcher and major section switcher', () => {
    expect(appSource).toContain('className="mobile-topbar"');
    expect(appSource).toContain('aria-label="Switch project or space"');
    expect(appSource).toContain('aria-label="Switch primary section"');
    expect(appSource).toContain('Project lane');
  });

  it('tracks the active mobile primary panel explicitly', () => {
    expect(appSource).toContain("type MobilePrimarySection = 'workspace' | 'channel'");
    expect(appSource).toContain('dashboard-mobile-section-${mobilePrimarySection}');
    expect(appSource).toContain("setMobilePrimarySection('workspace')");
    expect(appSource).toContain("setMobilePrimarySection('channel')");
  });

  it('uses a phone viewport media query that hides inactive primary panels', () => {
    expect(layoutCss).toContain('@media (max-width: 700px)');
    expect(layoutCss).toContain('.dashboard-mobile-section-workspace .channel-chat-panel');
    expect(layoutCss).toContain('display: none;');
    expect(layoutCss).toContain('.dashboard-mobile-section-channel .dashboard-workspace');
    expect(layoutCss).toContain('.panel-projects');
  });
});

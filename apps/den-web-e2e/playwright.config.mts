import * as path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Equivalent to nxE2EPreset without importing Nx: its native loader needs
// require.cache, which Node 22 does not provide when Playwright loads this
// config as ESM.
const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const outputRoot = path.join(workspaceRoot, 'dist/.playwright/apps/den-web-e2e');

const localPort = process.env['E2E_PORT'] ?? '4317';
const localBaseUrl = `http://127.0.0.1:${localPort}`;
const baseURL = process.env['BASE_URL'] ?? localBaseUrl;

const localWebServer = process.env['BASE_URL'] ? {} : {
  webServer: {
    command: `npx nx run den-web:serve --host 127.0.0.1 --port ${localPort}`,
    url: localBaseUrl,
    reuseExistingServer: false,
    cwd: workspaceRoot,
  },
};

export default defineConfig({
  testDir: './src',
  outputDir: path.join(outputRoot, 'test-output'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  reporter: [['html', { outputFolder: path.join(outputRoot, 'playwright-report'), open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...localWebServer,
});

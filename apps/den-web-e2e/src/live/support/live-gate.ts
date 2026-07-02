import {
  test,
} from '@playwright/test';

export function requireLiveRun(): void {
  const liveRun = process.env['LIVE_RUN'] === '1';
  const hasBaseUrl = Boolean(process.env['BASE_URL']);

  test.skip(!liveRun, 'LIVE_RUN=1 is required for live scenarios');
  test.skip(!hasBaseUrl, 'BASE_URL is required for live scenarios');
}

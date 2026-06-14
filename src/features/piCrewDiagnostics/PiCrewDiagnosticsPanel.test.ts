import { describe, expect, it } from 'vitest';
import { normalizeStoredPiCrewAdminBaseUrl } from './PiCrewDiagnosticsPanel';

describe('normalizeStoredPiCrewAdminBaseUrl', () => {
  it('migrates legacy browser-local Pi Crew defaults to the same-origin proxy', () => {
    expect(normalizeStoredPiCrewAdminBaseUrl('http://127.0.0.1:9237', '/pi-crew-admin-api')).toBe('/pi-crew-admin-api');
    expect(normalizeStoredPiCrewAdminBaseUrl('http://localhost:9237/', '/pi-crew-admin-api')).toBe('/pi-crew-admin-api');
  });

  it('preserves explicit non-legacy admin endpoints', () => {
    expect(normalizeStoredPiCrewAdminBaseUrl('http://192.168.1.22:9237/', '/pi-crew-admin-api')).toBe('http://192.168.1.22:9237');
  });

  it('uses the fallback when stored config is missing or blank', () => {
    expect(normalizeStoredPiCrewAdminBaseUrl(undefined, '/pi-crew-admin-api')).toBe('/pi-crew-admin-api');
    expect(normalizeStoredPiCrewAdminBaseUrl('   ', '/pi-crew-admin-api')).toBe('/pi-crew-admin-api');
  });
});

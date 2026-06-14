import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPiCrewDiagnosticsOverview, postPiCrewControl } from './piCrewDiagnostics';

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('Pi Crew diagnostics API auth modes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends bearer authorization in bearer-token mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ service: { status: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    await getPiCrewDiagnosticsOverview({ baseUrl: 'http://pi-crew.local/', bearerToken: ' token ', authMode: 'bearer' });

    expect(fetchMock).toHaveBeenCalledWith('http://pi-crew.local/admin/diagnostics/overview', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }));
  });

  it('omits authorization when explicit no-auth mode is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ service: { status: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    await getPiCrewDiagnosticsOverview({ baseUrl: 'http://pi-crew.local', bearerToken: '', authMode: 'none' });

    expect(fetchMock).toHaveBeenCalledWith('http://pi-crew.local/admin/diagnostics/overview', expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }));
  });

  it('still requires a token for mutating controls in bearer-token mode', async () => {
    await expect(postPiCrewControl(
      { baseUrl: 'http://pi-crew.local', bearerToken: '', authMode: 'bearer' },
      '/admin/control/config/validate',
      { operator: 'patch', reason: 'test', idempotencyKey: 'key', dryRun: true },
    )).rejects.toThrow('bearer token is required');
  });
});

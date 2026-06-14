import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPiCrewAgentWorkEvents, getPiCrewDiagnosticsOverview, postPiCrewControl } from './piCrewDiagnostics';

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

  it('reads structured agent-work events through the no-auth admin read path', async () => {
    const row = { id: 'event-1', channelId: '642', projectId: 'pi-crew', eventFamily: 'delegation', eventType: 'pi_crew.delegation.spawned', state: 'started', workerRunId: null, assignmentId: null, deliveryRequestId: null, sessionId: null, evidenceLink: null, summary: 'spawned', createdAt: '2026-06-14T12:00:00Z' };
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ events: [row] }));
    vi.stubGlobal('fetch', fetchMock);

    const events = await getPiCrewAgentWorkEvents({ baseUrl: '/pi-crew-admin-api' }, { channelId: 642, projectId: 'pi-crew', limit: 80 });

    expect(events).toEqual([row]);
    expect(fetchMock).toHaveBeenCalledWith('/pi-crew-admin-api/admin/agent-work/events?channelId=642&projectId=pi-crew&limit=80', expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }));
  });
});

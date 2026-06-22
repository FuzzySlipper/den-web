import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDocumentPublication,
  previewDocumentPublication,
  publishDocument,
  reinitDocPublishClient,
} from './client';

describe('doc publish client', () => {
  afterEach(() => {
    reinitDocPublishClient({ apiBase: '/api/v1/blog/publications' });
    vi.unstubAllGlobals();
  });

  it('posts preview requests to the configured preview route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'previewed', publication_id: 'pub-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    reinitDocPublishClient({ apiBase: '/custom/blog' });

    await previewDocumentPublication({
      source: { project_id: 'den-web', document_project_id: 'den-web', document_slug: 'doc' },
      requested_by: 'den-web',
    });

    expect(fetchMock).toHaveBeenCalledWith('/custom/blog/preview', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('posts publish requests to the configured base route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'published', publication_id: 'pub-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await publishDocument({
      source: { document_project_id: 'den-web', document_slug: 'doc' },
      requested_by: 'den-web',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/publications', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns null for missing publication readback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(getDocumentPublication('missing')).resolves.toBeNull();
  });
});

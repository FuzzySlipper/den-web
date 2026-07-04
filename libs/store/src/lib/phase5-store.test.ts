import { describe, expect, it } from 'vitest';
import { memoryStorage, type DocumentEffectsPort } from '@den-web/platform';
import type { DenDocPublishResponse, DenMessage, DenResult } from '@den-web/protocol';
import { createDocumentPublishStore } from './document-publish-store';
import { createLibrarianStore } from './librarian-store';
import { createMessagesStore } from './messages-store';
import { createPreferencesStore } from './preferences-store';

const ok = <T>(value: T): DenResult<T> => ({ ok: true, value });

describe('phase 5 stores', () => {
  it('loads message inbox and selected thread through named commands', async () => {
    const messages: readonly DenMessage[] = [
      { id: 2, sender: 'codex', intent: 'handoff', content: 'Later', created_at: '2026-07-02T00:02:00Z' },
      { id: 1, sender: 'patch', intent: 'question', content: 'Earlier', created_at: '2026-07-02T00:01:00Z' },
    ];
    const store = createMessagesStore({
      listMessages: async () => ok(messages),
      getThread: async () => ok({ root: messages[1], replies: [messages[0]] }),
    });

    await store.refresh('den-web');
    await store.selectThread('den-web', 1);

    expect(store.inbox().kind).toBe('data');
    expect(store.selectedThreadId()).toBe(1);
    expect(store.thread().kind).toBe('data');
    expect(store.thread().kind === 'data' ? store.thread().value.map((message) => message.body) : []).toEqual(['Earlier', 'Later']);
  });

  it('submits librarian queries and exposes answer state', async () => {
    const store = createLibrarianStore({
      query: async (_projectId, request) => ok({ answer: `answer:${request.query}`, sources: [{ id: 1 }] }),
    });

    await store.submit('den-web', 'phase 5');

    expect(store.latestQuery()).toBe('phase 5');
    expect(store.result().kind).toBe('data');
  });

  it('previews and publishes document blog links', async () => {
    const published: DenDocPublishResponse = {
      publication_id: 'pub-1',
      status: 'published',
      public_url: 'https://example.test/posts/successor-brief',
    };
    const requests: unknown[] = [];
    const store = createDocumentPublishStore({
      preview: async (request) => {
        requests.push(['preview', request]);
        return ok({ ...published, status: 'previewed', dry_run: true });
      },
      publish: async (request) => {
        requests.push(['publish', request]);
        return ok(published);
      },
    });

    store.setOverwrite(true);
    await store.preview({ source: { document_project_id: 'den-web', document_slug: 'successor-brief' }, requested_by: 'den-web' });
    await store.publish({ source: { document_project_id: 'den-web', document_slug: 'successor-brief' }, requested_by: 'den-web' });

    expect(store.overwrite()).toBe(true);
    expect(store.previewResult().kind).toBe('data');
    expect(store.publishedResult().kind).toBe('data');
    expect(requests.map((entry) => Array.isArray(entry) ? entry[0] : null)).toEqual(['preview', 'publish']);
  });

  it('persists preferences through storage and applies document effects', () => {
    const classes = new Set<string>();
    const styles = new Map<string, string>();
    let title = '';
    const effects: DocumentEffectsPort = {
      setTitle: (next) => { title = next; },
      setRootClass: (className, enabled) => enabled ? classes.add(className) : classes.delete(className),
      setRootStyle: (property, value) => value === null ? styles.delete(property) : styles.set(property, value),
    };
    const storage = memoryStorage();
    const store = createPreferencesStore(storage, effects);

    store.setDensity('compact');
    store.setTheme('dark');
    store.setHighContrast(true);

    expect(store.preferences()).toEqual({ density: 'compact', theme: 'dark', highContrast: true });
    expect(storage.getItem('den-web.preferences.v2')).toContain('compact');
    expect(classes.has('den-compact')).toBe(true);
    expect(classes.has('den-dark')).toBe(true);
    expect(classes.has('den-high-contrast')).toBe(true);
    expect(title).toBe('Den Web');
  });
});

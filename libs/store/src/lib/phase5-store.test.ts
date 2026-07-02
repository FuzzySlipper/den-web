import { describe, expect, it } from 'vitest';
import { memoryStorage, type DocumentEffectsPort } from '@den-web/platform';
import type { DenMessage, DenResult } from '@den-web/protocol';
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
      getThread: async () => ok(messages),
    });

    await store.refresh('den-web');
    await store.selectThread('den-web', 1);

    expect(store.inbox().kind).toBe('data');
    expect(store.selectedThreadId()).toBe(1);
    expect(store.thread().kind).toBe('data');
  });

  it('submits librarian queries and exposes answer state', async () => {
    const store = createLibrarianStore({
      query: async (_projectId, request) => ok({ answer: `answer:${request.query}`, sources: [{ id: 1 }] }),
    });

    await store.submit('den-web', 'phase 5');

    expect(store.latestQuery()).toBe('phase 5');
    expect(store.result().kind).toBe('data');
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

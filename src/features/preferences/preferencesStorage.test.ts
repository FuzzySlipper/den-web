/// <reference types="node" />
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readPreferences, writePreferences, clearPreferences, getDefaults } from './preferencesStorage';
import type { DenWebPreferences } from './types';

// ---------------------------------------------------------------------------
// Helper: minimal localStorage mock
// ---------------------------------------------------------------------------

function mockLocalStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn(() => null),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('preferencesStorage', () => {
  let mock: Storage;

  beforeEach(() => {
    mock = mockLocalStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = { localStorage: mock };
  });

  it('returns defaults when nothing is stored', () => {
    const prefs = readPreferences();
    expect(prefs.theme.accent).toBe('#7aa2f7');
    expect(prefs.font.baseSize).toBe(13);
    expect(prefs.chat.rowGap).toBe(4);
    expect(prefs.layout.chatFraction).toBe(0.8);
    expect(prefs.keyboard.closePanel).toBe('Escape');
  });

  it('persists and retrieves preferences', () => {
    const custom: DenWebPreferences = {
      chat: { rowGap: 8, messagePadding: 4, columnGap: 12 },
      layout: { chatFraction: 0.7, showParticipants: false },
      theme: { accent: '#ff0000', background: '#000', surface: '#111', text: '#fff', textMuted: '#888' },
      font: { monoStack: 'monospace', sansStack: 'sans-serif', baseSize: 14, chatSize: 13 },
      keyboard: { closePanel: 'Escape', openPreferences: '?' },
    };
    writePreferences(custom);
    const read = readPreferences();
    expect(read).toEqual(custom);
  });

  it('clears preferences and returns defaults', () => {
    writePreferences({
      chat: { rowGap: 99, messagePadding: 0, columnGap: 8 },
      layout: { chatFraction: 0.5, showParticipants: false },
      theme: { accent: '#ff0000', background: '#000', surface: '#111', text: '#fff', textMuted: '#888' },
      font: { monoStack: 'x', sansStack: 'y', baseSize: 10, chatSize: 10 },
      keyboard: { closePanel: 'Escape', openPreferences: '' },
    });
    clearPreferences();
    const read = readPreferences();
    expect(read).toEqual(getDefaults());
  });

  it('merges partial stored data with defaults', () => {
    mock.setItem('den-web-preferences', JSON.stringify({
      chat: { rowGap: 10 },
    }));
    const prefs = readPreferences();
    // chat.rowGap should come from stored data
    expect(prefs.chat.rowGap).toBe(10);
    // other chat fields should fall back to defaults
    expect(prefs.chat.messagePadding).toBe(0);
    expect(prefs.chat.columnGap).toBe(8);
    // unrelated sections should be defaults
    expect(prefs.theme.accent).toBe('#7aa2f7');
    expect(prefs.font.baseSize).toBe(13);
    expect(prefs.keyboard.closePanel).toBe('Escape');
  });

  it('returns defaults on corrupt JSON', () => {
    mock.setItem('den-web-preferences', '{corrupt');
    const prefs = readPreferences();
    expect(prefs).toEqual(getDefaults());
  });

  it('getDefaults returns a fresh copy that can be mutated safely', () => {
    const a = getDefaults();
    const b = getDefaults();
    a.chat.rowGap = 999;
    expect(b.chat.rowGap).toBe(4);
  });

  it('gracefully handles missing window (SSR)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    const prefs = readPreferences();
    expect(prefs.theme.accent).toBe('#7aa2f7');
    writePreferences(prefs); // should not throw
    clearPreferences(); // should not throw
  });
});

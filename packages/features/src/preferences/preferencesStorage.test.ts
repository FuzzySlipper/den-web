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
    expect(prefs.chat.showDebugActivity).toBe(false);
    expect(prefs.layout.chatFraction).toBe(0.8);
    expect(prefs.keyboard.closePanel).toBe('Escape');
    expect(prefs.keyboard.switchProject).toBe('Ctrl+Tab');
    expect(prefs.keyboard.cycleMainPanel).toBe('Shift+Tab');
    expect(prefs.keyboard.cycleTaskFilter).toBe('F3');
    expect(prefs.keyboard.jumpToTasks).toBe('');
    // New layout fields
    expect(prefs.layout.notificationHistoryMode).toBe('window');
    expect(prefs.layout.sidebarWidth).toBe(200);
    expect(prefs.layout.notificationPanelWidth).toBe(400);
    expect(prefs.layout.detailPanelWidth).toBe(500);
    // New font fields
    expect(prefs.font.listSize).toBe(12);
    expect(prefs.font.detailSize).toBe(12);
  });

  it('persists and retrieves preferences', () => {
    const custom: DenWebPreferences = {
      chat: { rowGap: 8, messagePadding: 4, columnGap: 12, showDebugActivity: true },
      layout: { chatFraction: 0.7, showParticipants: false, notificationHistoryMode: 'sidePanel', sidebarWidth: 220, notificationPanelWidth: 450, detailPanelWidth: 600 },
      theme: { accent: '#ff0000', background: '#000', surface: '#111', text: '#fff', textMuted: '#888' },
      font: { monoStack: 'monospace', sansStack: 'sans-serif', baseSize: 14, chatSize: 13, listSize: 11, detailSize: 14 },
      keyboard: { closePanel: 'Escape', openPreferences: '?', switchProject: 'Ctrl+Tab', cycleMainPanel: 'Alt+Tab', cycleTaskFilter: 'F3', jumpToTasks: '1', jumpToAgents: '2', jumpToMessages: '3', jumpToDocs: '4', jumpToGit: '5', jumpToSessions: '6', jumpToLibrarian: '7', jumpToAgentStream: '8', composerCycleSendMode: 'Alt+C', composerCycleTarget: 'Alt+T' },
    };
    writePreferences(custom);
    const read = readPreferences();
    expect(read).toEqual(custom);
  });

  it('clears preferences and returns defaults', () => {
    writePreferences({
      chat: { rowGap: 99, messagePadding: 0, columnGap: 8, showDebugActivity: true },
      layout: { chatFraction: 0.5, showParticipants: false, notificationHistoryMode: 'sidePanel', sidebarWidth: 300, notificationPanelWidth: 600, detailPanelWidth: 400 },
      theme: { accent: '#ff0000', background: '#000', surface: '#111', text: '#fff', textMuted: '#888' },
      font: { monoStack: 'x', sansStack: 'y', baseSize: 10, chatSize: 10, listSize: 10, detailSize: 10 },
      keyboard: { closePanel: 'Escape', openPreferences: '', switchProject: 'Ctrl+Tab', cycleMainPanel: 'Shift+Tab', cycleTaskFilter: 'F3', jumpToTasks: '', jumpToAgents: '', jumpToMessages: '', jumpToDocs: '', jumpToGit: '', jumpToSessions: '', jumpToLibrarian: '', jumpToAgentStream: '', composerCycleSendMode: 'Alt+C', composerCycleTarget: 'Alt+T' },
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
    expect(prefs.chat.showDebugActivity).toBe(false);
    // unrelated sections should be defaults
    expect(prefs.theme.accent).toBe('#7aa2f7');
    expect(prefs.font.baseSize).toBe(13);
    expect(prefs.keyboard.closePanel).toBe('Escape');
  });

  it('merges new layout fields with defaults and clamps out-of-range', () => {
    mock.setItem('den-web-preferences', JSON.stringify({
      layout: {
        notificationHistoryMode: 'sidePanel',
        sidebarWidth: 500,
        notificationPanelWidth: 900,
        detailPanelWidth: 30,
      },
    }));
    const prefs = readPreferences();
    expect(prefs.layout.notificationHistoryMode).toBe('sidePanel');
    expect(prefs.layout.sidebarWidth).toBe(500); // max is 500, within range
    expect(prefs.layout.notificationPanelWidth).toBe(800); // clamped to max 800
    expect(prefs.layout.detailPanelWidth).toBe(200); // clamped to min 200
    // other layout fields fall back to defaults
    expect(prefs.layout.chatFraction).toBe(0.8);
  });

  it('defaults invalid notificationHistoryMode to window', () => {
    mock.setItem('den-web-preferences', JSON.stringify({
      layout: { notificationHistoryMode: 'popup' },
    }));
    const prefs = readPreferences();
    expect(prefs.layout.notificationHistoryMode).toBe('window');
  });

  it('defaults malformed numeric preference fields instead of returning NaN', () => {
    mock.setItem('den-web-preferences', JSON.stringify({
      layout: {
        chatFraction: Number.NaN,
        sidebarWidth: 'enormous',
        notificationPanelWidth: null,
        detailPanelWidth: Number.NaN,
      },
      font: {
        baseSize: null,
        chatSize: 'large',
        listSize: 'tiny',
        detailSize: Number.POSITIVE_INFINITY,
      },
    }));

    const prefs = readPreferences();
    expect(prefs.layout.chatFraction).toBe(0.8);
    expect(prefs.layout.sidebarWidth).toBe(200);
    expect(prefs.layout.notificationPanelWidth).toBe(400);
    expect(prefs.layout.detailPanelWidth).toBe(500);
    expect(prefs.font.baseSize).toBe(13);
    expect(prefs.font.chatSize).toBe(12);
    expect(prefs.font.listSize).toBe(12);
    expect(prefs.font.detailSize).toBe(12);
  });

  it('clamps migrated chatFraction to the PreferencesDialog slider range', () => {
    mock.setItem('den-web-preferences', JSON.stringify({
      layout: { chatFraction: 1.2 },
    }));
    expect(readPreferences().layout.chatFraction).toBe(0.95);

    mock.setItem('den-web-preferences', JSON.stringify({
      layout: { chatFraction: 0.1 },
    }));
    expect(readPreferences().layout.chatFraction).toBe(0.55);
  });

  it('clamps migrated font sizes to the PreferencesDialog slider ranges', () => {
    mock.setItem('den-web-preferences', JSON.stringify({
      font: {
        baseSize: 4,
        chatSize: 99,
        listSize: 30,
        detailSize: 32,
      },
    }));

    const prefs = readPreferences();
    expect(prefs.font.baseSize).toBe(10);
    expect(prefs.font.chatSize).toBe(22);
    expect(prefs.font.listSize).toBe(22);
    expect(prefs.font.detailSize).toBe(22);
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

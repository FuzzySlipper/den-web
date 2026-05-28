/// <reference types="node" />
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { applyThemeVars } from './usePreferences';
import type { DenWebPreferences } from './types';
import { DEFAULT_PREFERENCES } from './types';

// ---------------------------------------------------------------------------
// Helper: minimal document mock with style.setProperty + dataset
// ---------------------------------------------------------------------------

function mockDocument(): Document {
  const style: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  const doc = {
    documentElement: {
      style: {
        setProperty: vi.fn((prop: string, value: string) => {
          style[prop] = value;
        }),
      },
      dataset,
    },
  };
  return doc as unknown as Document;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyThemeVars', () => {
  let doc: Document;

  beforeEach(() => {
    doc = mockDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = doc;
  });

  it('sets theme CSS custom properties on document.documentElement', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      theme: {
        accent: '#ff6600',
        background: '#222',
        surface: '#333',
        text: '#eee',
        textMuted: '#999',
      },
    };
    applyThemeVars(custom);

    const el = doc.documentElement;
    expect(el.style.setProperty).toHaveBeenCalledWith('--accent', '#ff6600');
    expect(el.style.setProperty).toHaveBeenCalledWith('--bg', '#222');
    expect(el.style.setProperty).toHaveBeenCalledWith('--bg-surface', '#333');
    expect(el.style.setProperty).toHaveBeenCalledWith('--text', '#eee');
    expect(el.style.setProperty).toHaveBeenCalledWith('--text-muted', '#999');
  });

  it('sets font CSS custom properties and base font size', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      font: {
        monoStack: '"Fira Code", monospace',
        sansStack: '"Inter", sans-serif',
        baseSize: 15,
        chatSize: 13,
      },
    };
    applyThemeVars(custom);

    const el = doc.documentElement;
    expect(el.style.setProperty).toHaveBeenCalledWith('--font-mono', '"Fira Code", monospace');
    expect(el.style.setProperty).toHaveBeenCalledWith('--font-sans', '"Inter", sans-serif');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((el.style as any).fontSize).toBe('15px');
  });

  it('sets chat density CSS custom properties', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      chat: { rowGap: 10, messagePadding: 6, columnGap: 14 },
    };
    applyThemeVars(custom);

    const el = doc.documentElement;
    expect(el.style.setProperty).toHaveBeenCalledWith('--pref-chat-row-gap', '10px');
    expect(el.style.setProperty).toHaveBeenCalledWith('--pref-chat-message-padding', '6px');
    expect(el.style.setProperty).toHaveBeenCalledWith('--pref-chat-column-gap', '14px');
  });

  it('sets layout chat-fraction CSS custom property', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      layout: { chatFraction: 0.65, showParticipants: true },
    };
    applyThemeVars(custom);

    const el = doc.documentElement;
    expect(el.style.setProperty).toHaveBeenCalledWith('--pref-layout-chat-fraction', '0.65');
  });

  it('sets data-show-participants to "0" when participants are hidden', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      layout: { chatFraction: 0.8, showParticipants: false },
    };
    applyThemeVars(custom);

    expect(doc.documentElement.dataset.showParticipants).toBe('0');
  });

  it('sets data-show-participants to "" when participants are shown', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      layout: { chatFraction: 0.8, showParticipants: true },
    };
    applyThemeVars(custom);

    expect(doc.documentElement.dataset.showParticipants).toBe('');
  });

  it('computes accent-dim from accent color', () => {
    const custom: DenWebPreferences = {
      ...DEFAULT_PREFERENCES,
      theme: { accent: '#ff0000', background: '#000', surface: '#111', text: '#fff', textMuted: '#888' },
    };
    applyThemeVars(custom);

    // #ff0000 * 0.65 = #a60000
    expect(doc.documentElement.style.setProperty).toHaveBeenCalledWith('--accent-dim', '#a60000');
  });

  it('is safe when document is undefined (SSR)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).document;
    // Should not throw
    applyThemeVars(DEFAULT_PREFERENCES);
  });
});

/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { parseHotkey, normalizeHotkey, matchHotkey } from './hotkeyParse';

describe('parseHotkey', () => {
  it('parses simple key', () => {
    const result = parseHotkey('Escape');
    expect(result).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'Escape' });
  });

  it('parses single character key', () => {
    const result = parseHotkey('?');
    expect(result).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: '?' });
  });

  it('parses Ctrl+Tab', () => {
    const result = parseHotkey('Ctrl+Tab');
    expect(result).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'Tab' });
  });

  it('parses Shift+Tab', () => {
    const result = parseHotkey('Shift+Tab');
    expect(result).toEqual({ ctrl: false, shift: true, alt: false, meta: false, key: 'Tab' });
  });

  it('parses Ctrl+Shift+A', () => {
    const result = parseHotkey('Ctrl+Shift+A');
    expect(result).toEqual({ ctrl: true, shift: true, alt: false, meta: false, key: 'A' });
  });

  it('parses F3', () => {
    const result = parseHotkey('F3');
    expect(result).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'F3' });
  });

  it('returns null for empty string', () => {
    expect(parseHotkey('')).toBeNull();
    expect(parseHotkey('   ')).toBeNull();
  });

  it('handles modifier-only string as null', () => {
    expect(parseHotkey('Ctrl')).toBeNull();
    expect(parseHotkey('Ctrl+Shift')).toBeNull();
  });

  it('capitalizes single letter key', () => {
    const result = parseHotkey('a');
    expect(result?.key).toBe('A');
  });
});

describe('normalizeHotkey', () => {
  it('returns empty for empty string', () => {
    expect(normalizeHotkey('')).toBe('');
    expect(normalizeHotkey('   ')).toBe('');
  });

  it('canonicalizes order: Ctrl+Shift+A', () => {
    expect(normalizeHotkey('Shift+Ctrl+A')).toBe('Ctrl+Shift+A');
  });

  it('canonicalizes simple key: escape', () => {
    expect(normalizeHotkey('escape')).toBe('Escape');
  });

  it('preserves single char uppercase', () => {
    expect(normalizeHotkey('?')).toBe('?');
  });

  it('normalizes Ctrl+Tab', () => {
    expect(normalizeHotkey('ctrl+tab')).toBe('Ctrl+Tab');
  });

  it('normalizes F3', () => {
    expect(normalizeHotkey('f3')).toBe('F3');
  });
});

function mockKeyboardEvent(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    defaultPrevented: false,
    preventDefault: () => {},
    ...partial,
  } as KeyboardEvent;
}

describe('matchHotkey', () => {
  it('matches simple key Escape', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Escape' }), 'Escape')).toBe(true);
  });

  it('rejects Escape when modifier is held', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Escape', ctrlKey: true }), 'Escape')).toBe(false);
  });

  it('matches Ctrl+Tab', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Tab', ctrlKey: true }), 'Ctrl+Tab')).toBe(true);
  });

  it('rejects Ctrl+Tab when Ctrl is not held', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Tab' }), 'Ctrl+Tab')).toBe(false);
  });

  it('rejects Ctrl+Tab when Shift is also held (strict modifier check)', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Tab', ctrlKey: true, shiftKey: true }), 'Ctrl+Tab')).toBe(false);
  });

  it('matches Shift+Tab', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Tab', shiftKey: true }), 'Shift+Tab')).toBe(true);
  });

  it('matches Ctrl+Shift+A', () => {
    expect(matchHotkey(
      mockKeyboardEvent({ key: 'A', ctrlKey: true, shiftKey: true }),
      'Ctrl+Shift+A',
    )).toBe(true);
  });

  it('matches F3', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'F3' }), 'F3')).toBe(true);
  });

  it('returns false for empty hotkey', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Escape' }), '')).toBe(false);
  });

  it('matches single char key', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: '?' }), '?')).toBe(true);
  });

  it('matches case-insensitively for letter', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'a' }), 'A')).toBe(true);
    expect(matchHotkey(mockKeyboardEvent({ key: 'A' }), 'a')).toBe(true);
  });

  it('handles esc alias', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'Escape' }), 'esc')).toBe(true);
    expect(matchHotkey(mockKeyboardEvent({ key: 'Esc' }), 'Escape')).toBe(true);
  });

  it('matches Alt+F4', () => {
    expect(matchHotkey(mockKeyboardEvent({ key: 'F4', altKey: true }), 'Alt+F4')).toBe(true);
  });
});

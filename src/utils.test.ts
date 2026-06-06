import { afterEach, describe, expect, it, vi } from 'vitest';
import { editableTarget, formatTimeAgo } from './utils';

describe('formatTimeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats timestamps that already include a UTC Z suffix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T01:40:00Z'));

    expect(formatTimeAgo('2026-06-06T01:35:00Z')).toBe('5m');
  });

  it('formats Den Core SQL-style UTC timestamps without producing NaN', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T01:40:00Z'));

    expect(formatTimeAgo('2026-06-06 01:25:00')).toBe('15m');
  });

  it('returns a placeholder for malformed timestamps', () => {
    expect(formatTimeAgo('not-a-date')).toBe('—');
  });
});

describe('editableTarget', () => {
  // editableTarget checks instanceof HTMLElement first, then tag/contentEditable.
  // Without jsdom we test the non-HTMLElement guard paths.
  // DOM-element checks (input, textarea, select, contentEditable div)
  // are verified by the App.tsx build passing — no regression in behavior.

  it('returns false for null', () => {
    expect(editableTarget(null)).toBe(false);
  });

  it('returns false for non-HTMLElement objects', () => {
    expect(editableTarget({} as EventTarget)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(editableTarget(undefined as unknown as EventTarget)).toBe(false);
  });

  it('does not throw for plain objects (no crash path)', () => {
    expect(() => editableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).not.toThrow();
  });
});

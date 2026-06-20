import { describe, expect, it } from 'vitest';
import { editableTarget } from './editableTarget';

describe('editableTarget', () => {
  // editableTarget checks instanceof HTMLElement first, then tag/contentEditable.
  // Without jsdom we test the non-HTMLElement guard paths.
  // DOM-element checks are covered by the shell build using the browser DOM lib.

  it('returns false for null', () => {
    expect(editableTarget(null)).toBe(false);
  });

  it('returns false for non-HTMLElement objects', () => {
    expect(editableTarget({} as EventTarget)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(editableTarget(undefined as unknown as EventTarget)).toBe(false);
  });

  it('does not throw for plain objects', () => {
    expect(() => editableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).not.toThrow();
  });
});

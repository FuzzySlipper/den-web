import { describe, expect, it } from 'vitest';
import type { KeyboardEvent } from 'react';
import {
  cycleSendMode,
  cycleTargetIdentity,
  matchCombo,
} from './useComposerHotkeys';

// ---------------------------------------------------------------------------
// Fake KeyboardEvent for matchCombo testing
// ---------------------------------------------------------------------------

function fakeKeyEvent(overrides: Partial<KeyboardEvent<HTMLTextAreaElement>>): KeyboardEvent<HTMLTextAreaElement> {
  const state: { defaultPrevented: boolean } = { defaultPrevented: false };
  return {
    key: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    get defaultPrevented() { return state.defaultPrevented; },
    preventDefault() { state.defaultPrevented = true; },
    stopPropagation() {},
    bubbles: false,
    cancelable: false,
    ...overrides,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
}

// ---------------------------------------------------------------------------
// cycleSendMode
// ---------------------------------------------------------------------------

describe('cycleSendMode', () => {
  it('cycles from channel to direct', () => {
    expect(cycleSendMode('channel')).toBe('direct');
  });

  it('cycles from direct to channel', () => {
    expect(cycleSendMode('direct')).toBe('channel');
  });
});

// ---------------------------------------------------------------------------
// cycleTargetIdentity
// ---------------------------------------------------------------------------

describe('cycleTargetIdentity', () => {
  it('returns current identity when no targets are available (no-op)', () => {
    expect(cycleTargetIdentity('agent-a', [])).toBe('agent-a');
  });

  it('auto-selects the only available target', () => {
    expect(cycleTargetIdentity('', ['sole-agent'])).toBe('sole-agent');
  });

  it('auto-selects the first target when current is not in the list', () => {
    expect(cycleTargetIdentity('stale-agent', ['agent-a', 'agent-b'])).toBe('agent-a');
  });

  it('cycles forward with multiple targets', () => {
    const targets = ['agent-a', 'agent-b', 'agent-c'];
    expect(cycleTargetIdentity('agent-a', targets)).toBe('agent-b');
    expect(cycleTargetIdentity('agent-b', targets)).toBe('agent-c');
    expect(cycleTargetIdentity('agent-c', targets)).toBe('agent-a');
  });

  it('wraps around to the first target', () => {
    expect(cycleTargetIdentity('agent-c', ['agent-a', 'agent-b', 'agent-c'])).toBe('agent-a');
  });
});

// ---------------------------------------------------------------------------
// matchCombo
// ---------------------------------------------------------------------------

describe('matchCombo', () => {
  it('matches Alt+C exactly', () => {
    const event = fakeKeyEvent({ altKey: true, key: 'c' });
    expect(matchCombo(event, 'Alt+C')).toBe(true);
  });

  it('matches Alt+T exactly', () => {
    const event = fakeKeyEvent({ altKey: true, key: 't' });
    expect(matchCombo(event, 'Alt+T')).toBe(true);
  });

  it('does not match on wrong modifiers', () => {
    const event = fakeKeyEvent({ altKey: false, ctrlKey: true, key: 'c' });
    expect(matchCombo(event, 'Alt+C')).toBe(false);
  });

  it('does not match on wrong key', () => {
    const event = fakeKeyEvent({ altKey: true, key: 'x' });
    expect(matchCombo(event, 'Alt+C')).toBe(false);
  });

  it('does not match when keySpec is empty', () => {
    const event = fakeKeyEvent({ altKey: true, key: 'c' });
    expect(matchCombo(event, '')).toBe(false);
  });

  it('handles case-insensitive key comparison', () => {
    const event = fakeKeyEvent({ altKey: true, key: 'C' });
    expect(matchCombo(event, 'Alt+c')).toBe(true);
  });

  it('matches Ctrl+Shift+A correctly', () => {
    const event = fakeKeyEvent({ ctrlKey: true, shiftKey: true, key: 'A' });
    expect(matchCombo(event, 'Ctrl+Shift+A')).toBe(true);
  });

  it('does not match Ctrl+Shift+A when only Ctrl is held', () => {
    const event = fakeKeyEvent({ ctrlKey: true, key: 'a' });
    expect(matchCombo(event, 'Ctrl+Shift+A')).toBe(false);
  });

  it('allows extra modifiers like CapsLock when not specified', () => {
    // CapsLock is not a modifier we check, so this is fine
    const event = fakeKeyEvent({ altKey: true, ctrlKey: false, key: 'c' });
    expect(matchCombo(event, 'Alt+C')).toBe(true);
  });
});

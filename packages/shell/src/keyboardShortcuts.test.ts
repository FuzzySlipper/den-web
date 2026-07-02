import { describe, expect, it } from 'vitest';
import type { KeyboardPreferences } from '@den-web/features/preferences/types';
import {
  resolveKeyboardAction,
  type KeyboardShortcutContext,
} from './keyboardShortcuts';

const KEYBOARD: KeyboardPreferences = {
  closePanel: 'Escape',
  openPreferences: '?',
  switchProject: 'Ctrl+Tab',
  cycleMainPanel: 'Shift+Tab',
  cycleTaskFilter: 'F3',
  jumpToTasks: '1',
  jumpToAgents: '2',
  jumpToMessages: '3',
  jumpToDocs: '4',
  jumpToGit: '5',
  jumpToSessions: '6',
  jumpToLibrarian: '7',
  jumpToAgentStream: '8',
  composerCycleSendMode: 'Alt+C',
  composerCycleTarget: 'Alt+T',
};

function fakeKeyEvent(overrides: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    defaultPrevented: false,
    ...overrides,
  } as KeyboardEvent;
}

function context(overrides: Partial<KeyboardShortcutContext> = {}): KeyboardShortcutContext {
  return {
    editable: false,
    showPreferences: false,
    viewMode: 'tasks',
    dmConversationOpen: false,
    dmAgentOpen: false,
    hasDetailSelection: false,
    ...overrides,
  };
}

describe('close-panel precedence', () => {
  it('closes preferences first', () => {
    const res = resolveKeyboardAction(fakeKeyEvent({ key: 'Escape' }), KEYBOARD, context({ showPreferences: true, hasDetailSelection: true }));
    expect(res).toEqual({ action: { type: 'closePreferences' }, preventDefault: true });
  });

  it('closes the dm conversation before the dm agent in the dm view', () => {
    const res = resolveKeyboardAction(
      fakeKeyEvent({ key: 'Escape' }),
      KEYBOARD,
      context({ viewMode: 'dm', dmConversationOpen: true, dmAgentOpen: true }),
    );
    expect(res?.action).toEqual({ type: 'closeDmConversation' });
  });

  it('closes the dm agent when only the agent thread is open', () => {
    const res = resolveKeyboardAction(
      fakeKeyEvent({ key: 'Escape' }),
      KEYBOARD,
      context({ viewMode: 'dm', dmAgentOpen: true }),
    );
    expect(res?.action).toEqual({ type: 'closeDmAgent' });
  });

  it('does not treat dm state as closeable outside the dm view', () => {
    const res = resolveKeyboardAction(
      fakeKeyEvent({ key: 'Escape' }),
      KEYBOARD,
      context({ viewMode: 'tasks', dmAgentOpen: true, hasDetailSelection: true }),
    );
    expect(res?.action).toEqual({ type: 'closeDetail' });
  });

  it('closes a detail overlay when one is open', () => {
    const res = resolveKeyboardAction(fakeKeyEvent({ key: 'Escape' }), KEYBOARD, context({ hasDetailSelection: true }));
    expect(res).toEqual({ action: { type: 'closeDetail' }, preventDefault: true });
  });

  it('consumes the close key without preventing default when nothing is open', () => {
    const res = resolveKeyboardAction(fakeKeyEvent({ key: 'Escape' }), KEYBOARD, context());
    expect(res).toEqual({ action: { type: 'noop' }, preventDefault: false });
  });

  it('works even while typing in an editable element', () => {
    const res = resolveKeyboardAction(
      fakeKeyEvent({ key: 'Escape' }),
      KEYBOARD,
      context({ editable: true, hasDetailSelection: true }),
    );
    expect(res?.action).toEqual({ type: 'closeDetail' });
  });
});

describe('navigation shortcuts', () => {
  it('are suppressed while typing in an editable element', () => {
    expect(resolveKeyboardAction(fakeKeyEvent({ key: '1' }), KEYBOARD, context({ editable: true }))).toBeNull();
  });

  it('opens preferences', () => {
    const res = resolveKeyboardAction(fakeKeyEvent({ key: '?' }), KEYBOARD, context());
    expect(res?.action).toEqual({ type: 'openPreferences' });
  });

  it('switches project on Ctrl+Tab', () => {
    const res = resolveKeyboardAction(fakeKeyEvent({ key: 'Tab', ctrlKey: true }), KEYBOARD, context());
    expect(res?.action).toEqual({ type: 'switchProject' });
  });

  it('cycles the main panel on Shift+Tab', () => {
    const res = resolveKeyboardAction(fakeKeyEvent({ key: 'Tab', shiftKey: true }), KEYBOARD, context());
    expect(res?.action).toEqual({ type: 'cycleMainPanel' });
  });

  it('cycles the task filter only in the tasks view', () => {
    const inTasks = resolveKeyboardAction(fakeKeyEvent({ key: 'F3' }), KEYBOARD, context({ viewMode: 'tasks' }));
    expect(inTasks?.action).toEqual({ type: 'cycleTaskFilter' });

    const elsewhere = resolveKeyboardAction(fakeKeyEvent({ key: 'F3' }), KEYBOARD, context({ viewMode: 'documents' }));
    expect(elsewhere).toEqual({ action: { type: 'noop' }, preventDefault: false });
  });

  it('jumps directly to views by number key', () => {
    expect(resolveKeyboardAction(fakeKeyEvent({ key: '1' }), KEYBOARD, context())?.action).toEqual({ type: 'jump', view: 'tasks' });
    expect(resolveKeyboardAction(fakeKeyEvent({ key: '5' }), KEYBOARD, context())?.action).toEqual({ type: 'jump', view: 'git' });
    expect(resolveKeyboardAction(fakeKeyEvent({ key: '8' }), KEYBOARD, context())).toBeNull();
  });

  it('returns null for unbound keys', () => {
    expect(resolveKeyboardAction(fakeKeyEvent({ key: 'q' }), KEYBOARD, context())).toBeNull();
  });

  it('ignores disabled (empty) bindings', () => {
    const disabled = { ...KEYBOARD, jumpToTasks: '' };
    expect(resolveKeyboardAction(fakeKeyEvent({ key: '1' }), disabled, context())).toBeNull();
  });
});

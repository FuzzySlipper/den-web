import { useEffect, useRef } from 'react';
import type { KeyboardPreferences } from '../features/preferences/types';
import { editableTarget } from '../utils';
import {
  resolveKeyboardAction,
  type KeyboardAction,
  type KeyboardShortcutContext,
} from './keyboardShortcuts';
import type { WorkspaceViewMode } from './workspaceViewModes';

export interface KeyboardShortcutActions {
  closePreferences: () => void;
  closeDmConversation: () => void;
  closeDmAgent: () => void;
  closeDetail: () => void;
  openPreferences: () => void;
  switchProject: () => void;
  cycleMainPanel: () => void;
  cycleTaskFilter: () => void;
  jump: (view: WorkspaceViewMode) => void;
}

export interface KeyboardShortcutParams {
  keyboard: KeyboardPreferences;
  /** Current shell state the resolver needs; `editable` is computed per-event. */
  context: Omit<KeyboardShortcutContext, 'editable'>;
  actions: KeyboardShortcutActions;
}

function dispatchKeyboardAction(action: KeyboardAction, actions: KeyboardShortcutActions): void {
  switch (action.type) {
    case 'closePreferences': actions.closePreferences(); break;
    case 'closeDmConversation': actions.closeDmConversation(); break;
    case 'closeDmAgent': actions.closeDmAgent(); break;
    case 'closeDetail': actions.closeDetail(); break;
    case 'openPreferences': actions.openPreferences(); break;
    case 'switchProject': actions.switchProject(); break;
    case 'cycleMainPanel': actions.cycleMainPanel(); break;
    case 'cycleTaskFilter': actions.cycleTaskFilter(); break;
    case 'jump': actions.jump(action.view); break;
    case 'noop': break;
  }
}

/**
 * Registers the app-level keydown handler. The pure decision lives in
 * {@link resolveKeyboardAction}; this hook only wires it to the window and the
 * provided actions. A ref keeps the latest params so we subscribe once rather
 * than re-binding the listener on every render.
 */
export function useKeyboardShortcuts(params: KeyboardShortcutParams): void {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const { keyboard, context, actions } = paramsRef.current;
      const resolution = resolveKeyboardAction(event, keyboard, {
        ...context,
        editable: editableTarget(event.target),
      });
      if (!resolution) return;
      if (resolution.preventDefault) event.preventDefault();
      dispatchKeyboardAction(resolution.action, actions);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

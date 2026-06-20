import type { KeyboardPreferences } from '@den-web/features/preferences/types';
import { matchHotkey } from '@den-web/features/preferences/hotkeyParse';
import type { WorkspaceViewMode } from './workspaceViewModes';

/**
 * Context the resolver needs to decide what a keypress should do, derived from
 * the app shell's current state. Keeping this a plain data object (rather than
 * reading the DOM or React state directly) makes shortcut resolution a pure,
 * unit-testable function.
 */
export interface KeyboardShortcutContext {
  /** True when focus is in an editable element (input/textarea/select/contenteditable). */
  editable: boolean;
  showPreferences: boolean;
  viewMode: WorkspaceViewMode;
  dmConversationOpen: boolean;
  dmAgentOpen: boolean;
  hasDetailSelection: boolean;
}

export type KeyboardAction =
  | { type: 'closePreferences' }
  | { type: 'closeDmConversation' }
  | { type: 'closeDmAgent' }
  | { type: 'closeDetail' }
  | { type: 'openPreferences' }
  | { type: 'switchProject' }
  | { type: 'cycleMainPanel' }
  | { type: 'cycleTaskFilter' }
  | { type: 'jump'; view: WorkspaceViewMode }
  /** The close-panel key matched but there was nothing to close — swallow it. */
  | { type: 'noop' };

export interface KeyboardResolution {
  action: KeyboardAction;
  preventDefault: boolean;
}

const JUMP_BINDINGS: Array<{ key: keyof KeyboardPreferences; view: WorkspaceViewMode }> = [
  { key: 'jumpToTasks', view: 'tasks' },
  { key: 'jumpToAgents', view: 'agents' },
  { key: 'jumpToMessages', view: 'messages' },
  { key: 'jumpToDocs', view: 'documents' },
  { key: 'jumpToGit', view: 'git' },
  { key: 'jumpToSessions', view: 'sessions' },
  { key: 'jumpToLibrarian', view: 'librarian' },
  { key: 'jumpToAgentStream', view: 'agent-stream' },
];

/** Decide which close-panel target (if any) applies given the current overlay state. */
function resolveClosePanelAction(ctx: KeyboardShortcutContext): KeyboardAction {
  if (ctx.showPreferences) return { type: 'closePreferences' };
  if (ctx.viewMode === 'dm' && ctx.dmConversationOpen) return { type: 'closeDmConversation' };
  if (ctx.viewMode === 'dm' && ctx.dmAgentOpen) return { type: 'closeDmAgent' };
  if (ctx.hasDetailSelection) return { type: 'closeDetail' };
  return { type: 'noop' };
}

/**
 * Map a keyboard event to a shell action, or null when no shortcut matched.
 *
 * Mirrors the precedence of the original inline keydown handler:
 *  1. Close-panel works even while typing and always consumes its key.
 *  2. All other shortcuts are suppressed while focus is in an editable element.
 */
export function resolveKeyboardAction(
  event: KeyboardEvent,
  keyboard: KeyboardPreferences,
  ctx: KeyboardShortcutContext,
): KeyboardResolution | null {
  if (keyboard.closePanel && matchHotkey(event, keyboard.closePanel)) {
    const action = resolveClosePanelAction(ctx);
    return { action, preventDefault: action.type !== 'noop' };
  }

  // Navigation shortcuts require the user not to be typing in an editable element.
  if (ctx.editable) return null;

  if (keyboard.openPreferences && matchHotkey(event, keyboard.openPreferences)) {
    return { action: { type: 'openPreferences' }, preventDefault: true };
  }
  if (keyboard.switchProject && matchHotkey(event, keyboard.switchProject)) {
    return { action: { type: 'switchProject' }, preventDefault: true };
  }
  if (keyboard.cycleMainPanel && matchHotkey(event, keyboard.cycleMainPanel)) {
    return { action: { type: 'cycleMainPanel' }, preventDefault: true };
  }
  if (keyboard.cycleTaskFilter && matchHotkey(event, keyboard.cycleTaskFilter)) {
    // Task-filter cycling only applies in the tasks view, but still consumes the key elsewhere.
    if (ctx.viewMode !== 'tasks') {
      return { action: { type: 'noop' }, preventDefault: false };
    }
    return { action: { type: 'cycleTaskFilter' }, preventDefault: true };
  }
  for (const binding of JUMP_BINDINGS) {
    const hotkey = keyboard[binding.key];
    if (hotkey && matchHotkey(event, hotkey)) {
      return { action: { type: 'jump', view: binding.view }, preventDefault: true };
    }
  }

  return null;
}

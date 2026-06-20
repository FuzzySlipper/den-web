/**
 * Composer-local hotkeys for cycling send mode and direct-agent target.
 *
 * These hotkeys are scoped to only fire when the composer textarea (or a
 * descendent of the composer form) has focus.  They do NOT fire on global
 * keydown — that avoids stealing normal typing or browser/app shortcuts.
 *
 * Default key bindings (configurable via KeyboardPreferences in future):
 *   Alt+C — cycle send mode (channel <-> direct agent)
 *   Alt+T — cycle direct-agent target (when in direct mode)
 *
 * These were chosen to be:
 *   1. Easy to reach on QWERTY/QWERTZ/AZERTY.
 *   2. Not reserved by major browsers (unlike Ctrl+W, Ctrl+T, Ctrl+N, etc.).
 *   3. Unlikely to conflict with normal text-entry or IDE shortcuts.
 *   4. Composables: Alt combos are safe because the composer textarea
 *      does not use Alt for anything else.
 */

import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelSendMode = 'channel' | 'direct';

export interface UseComposerHotkeysConfig {
  /** Current send mode */
  sendMode: ChannelSendMode;
  /** Callback to change send mode */
  onSetSendMode: (mode: ChannelSendMode) => void;
  /** Currently selected target member identity */
  targetMemberIdentity: string;
  /** Callback to change target */
  onSetTargetMemberIdentity: (identity: string) => void;
  /** Available active agent targets (ordered list of member identities) */
  availableTargets: string[];
}

export interface ComposerHotkeyBindings {
  /** Key def for cycling send mode — user-visible label */
  cycleModeKey: string;
  /** Key def for cycling target — user-visible label */
  cycleTargetKey: string;
}

const DEFAULT_BINDINGS: ComposerHotkeyBindings = {
  cycleModeKey: 'Alt+C',
  cycleTargetKey: 'Alt+T',
};

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Cycle the send mode: channel -> direct -> channel.
 */
export function cycleSendMode(current: ChannelSendMode): ChannelSendMode {
  return current === 'channel' ? 'direct' : 'channel';
}

/**
 * Cycle the direct-agent target identity.
 *
 * Behaviour by number of eligible targets:
 *   - 0 targets: returns the current identity unchanged (no-op).
 *   - 1 target:  returns that target identity (auto-select).
 *   - 2+ targets: cycle forward through the array; current identity
 *     must match one of the available targets (or we auto-select the first).
 */
export function cycleTargetIdentity(
  current: string,
  availableTargets: string[],
): string {
  if (availableTargets.length === 0) return current;
  if (availableTargets.length === 1) return availableTargets[0];

  const currentIndex = availableTargets.indexOf(current);
  if (currentIndex === -1) {
    // Current isn't in the list — auto-select the first available target
    return availableTargets[0];
  }
  // Cycle forward
  const nextIndex = (currentIndex + 1) % availableTargets.length;
  return availableTargets[nextIndex];
}

/**
 * Check whether a given KeyboardEvent matches a key combo string
 * like "Alt+C" or "Alt+T".
 *
 * Only checks Ctrl/Shift/Alt/Meta modifiers + key.  Returns false for
 * empty or malformed keySpec.
 */
export function matchCombo(event: KeyboardEvent, keySpec: string): boolean {
  if (!keySpec) return false;
  const parts = keySpec.split('+').map(p => p.trim()).filter(Boolean);
  if (parts.length < 1) return false;

  let wantCtrl = false;
  let wantShift = false;
  let wantAlt = false;
  let wantMeta = false;
  let wantKey = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') wantCtrl = true;
    else if (lower === 'shift') wantShift = true;
    else if (lower === 'alt' || lower === 'option') wantAlt = true;
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command') wantMeta = true;
    else wantKey = part;
  }

  if (!wantKey) return false;

  if (event.ctrlKey !== wantCtrl) return false;
  if (event.shiftKey !== wantShift) return false;
  if (event.altKey !== wantAlt) return false;
  if (event.metaKey !== wantMeta) return false;

  // Case-insensitive key comparison
  return event.key.toLowerCase() === wantKey.toLowerCase();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns an onKeyDown handler for the composer textarea that handles
 * the send-mode-cycle and target-cycle hotkeys.
 *
 * Also returns bindings metadata for UI hint display.
 */
export function useComposerHotkeys(
  config: UseComposerHotkeysConfig,
): {
  onComposerHotkey: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  bindings: ComposerHotkeyBindings;
} {
  const {
    sendMode,
    onSetSendMode,
    targetMemberIdentity,
    onSetTargetMemberIdentity,
    availableTargets,
  } = config;

  const onComposerHotkey = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const bindings = DEFAULT_BINDINGS;

      // Alt+C — cycle send mode
      if (matchCombo(event, bindings.cycleModeKey)) {
        event.preventDefault();
        event.stopPropagation();
        onSetSendMode(cycleSendMode(sendMode));
        return;
      }

      // Alt+T — cycle direct-agent target (only meaningful in direct mode)
      if (matchCombo(event, bindings.cycleTargetKey)) {
        event.preventDefault();
        event.stopPropagation();
        const next = cycleTargetIdentity(targetMemberIdentity, availableTargets);
        onSetTargetMemberIdentity(next);
        return;
      }
    },
    [sendMode, onSetSendMode, targetMemberIdentity, onSetTargetMemberIdentity, availableTargets],
  );

  return {
    onComposerHotkey,
    bindings: DEFAULT_BINDINGS,
  };
}

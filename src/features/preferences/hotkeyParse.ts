/**
 * Hotkey string parsing and event matching utilities.
 *
 * Supports modifier+key combos like "Ctrl+Tab", "Shift+Tab", "Alt+1",
 * "Ctrl+Shift+A", and simple keys like "Escape", "F3", "?".
 *
 * Modifier order does not matter: "Ctrl+Shift+X" === "Shift+Ctrl+X".
 * Case-insensitive for letter keys: "Ctrl+a" === "Ctrl+A".
 */

export interface ParsedHotkey {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  /** Normalized key string (e.g. 'Tab', 'A', 'Escape', 'F3', '?') */
  key: string;
}

/**
 * Normalise a hotkey string for storage/comparison.
 * Returns a canonical form: modifiers in ctrl+shift+alt+meta order, then key.
 * Empty input returns empty string.
 */
export function normalizeHotkey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parsed = parseHotkey(trimmed);
  if (!parsed) return '';

  const parts: string[] = [];
  if (parsed.ctrl) parts.push('Ctrl');
  if (parsed.shift) parts.push('Shift');
  if (parsed.alt) parts.push('Alt');
  if (parsed.meta) parts.push('Meta');
  parts.push(parsed.key);
  return parts.join('+');
}

/**
 * Parse a hotkey string like "Ctrl+Tab", "Shift+Tab", "F3", "Escape",
 * "Ctrl+Shift+A" into a ParsedHotkey struct.
 *
 * Returns null if the string cannot be parsed.
 */
export function parseHotkey(value: string): ParsedHotkey | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('+').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;

  const keyParts: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      ctrl = true;
    } else if (lower === 'shift') {
      shift = true;
    } else if (lower === 'alt' || lower === 'option') {
      alt = true;
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'win' || lower === 'windows') {
      meta = true;
    } else {
      keyParts.push(part);
    }
  }

  if (keyParts.length === 0) return null;

  // Rejoin remaining parts (e.g. "Page" + "Up" in "Ctrl+Page+Up"? unlikely but safe)
  const key = canonicalizeKey(keyParts.join(''));

  return { ctrl, shift, alt, meta, key };
}

/**
 * Match a KeyboardEvent against a parsed hotkey string.
 * Returns true if the event matches the hotkey.
 *
 * For single-key hotkeys (no modifiers), the event key must match exactly,
 * and no modifier keys may be held (to avoid accidental matches while typing).
 *
 * For modifier+key combos, only the specified modifiers are checked;
 * extra modifiers are still allowed (e.g. CapsLock doesn't disqualify).
 */
export function matchHotkey(event: KeyboardEvent, hotkey: string): boolean {
  if (!hotkey) return false;

  const parsed = parseHotkey(hotkey);
  if (!parsed) return false;

  // Check required modifier state
  if (parsed.ctrl !== event.ctrlKey) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.alt !== event.altKey) return false;
  if (parsed.meta !== event.metaKey) return false;

  // For simple key hotkeys (no modifiers), also require no modifiers held
  if (!parsed.ctrl && !parsed.shift && !parsed.alt && !parsed.meta) {
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return false;
  }

  return eventKeyMatches(event.key, parsed.key);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Compare event key against our canonical key.
 * Handles case-insensitive letter matching and aliases.
 */
function eventKeyMatches(eventKey: string, canonicalKey: string): boolean {
  const a = eventKey.toLowerCase();
  const b = canonicalKey.toLowerCase();

  if (a === b) return true;

  // Aliases
  const aliases: Record<string, string[]> = {
    'escape': ['esc'],
    ' ': ['spacebar'],
  };

  const aAliases = [a, ...(aliases[a] ?? [])];
  const bAliases = [b, ...(aliases[b] ?? [])];

  return aAliases.some(alias => bAliases.includes(alias));
}

/**
 * Normalise a key name to a canonical form.
 * Single letters are upper-cased; other keys are Capitalized.
 */
function canonicalizeKey(key: string): string {
  if (!key) return key;
  // Single letters -> uppercase
  if (key.length === 1) return key.toUpperCase();
  // Aliases
  const lower = key.toLowerCase();
  if (lower === 'esc') return 'Escape';
  if (lower === 'space' || lower === 'spacebar') return ' ';
  if (lower === 'option') return 'Alt';
  if (lower === 'control') return 'Ctrl';
  if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') return 'Meta';
  if (lower === 'win' || lower === 'windows') return 'Meta';
  if (lower === 'ins' || lower === 'insert') return 'Insert';
  if (lower === 'del' || lower === 'delete') return 'Delete';
  if (lower === 'pgup' || lower === 'pageup') return 'PageUp';
  if (lower === 'pgdn' || lower === 'pagedown') return 'PageDown';
  if (lower === 'arrowup') return 'ArrowUp';
  if (lower === 'arrowdown') return 'ArrowDown';
  if (lower === 'arrowleft') return 'ArrowLeft';
  if (lower === 'arrowright') return 'ArrowRight';
  // Return first-char upper-cased for multi-char keys
  return key[0].toUpperCase() + key.slice(1);
}

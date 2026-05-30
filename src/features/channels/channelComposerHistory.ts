/**
 * channelComposerHistory.ts — localStorage-backed composer history
 *
 * Stores recent sent message bodies with a capped limit and no consecutive
 * duplicate entries. The history is intentionally browser-global across
 * projects, channels, and composer instances.
 */

const STORAGE_KEY = 'den-channel-composer-history:v1';
const DEFAULT_MAX_ENTRIES = 50;
const MAX_BODY_LENGTH = 500;

export interface ComposerHistoryEntry {
  body: string;
  timestamp: number;
}

export function storageKey(_senderIdentity = ''): string {
  void _senderIdentity;
  return STORAGE_KEY;
}

export function readHistory(senderIdentity: string): ComposerHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = storageKey(senderIdentity);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, DEFAULT_MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function persistHistory(
  senderIdentity: string,
  entries: ComposerHistoryEntry[],
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = storageKey(senderIdentity);
    const trimmed = entries.slice(0, DEFAULT_MAX_ENTRIES);
    window.localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable; silently ignore
  }
}

/**
 * Append a new entry to the history, avoiding consecutive duplicates.
 * Returns the updated history array (caller should persist if needed).
 */
export function appendHistory(
  entries: ComposerHistoryEntry[],
  body: string,
  maxEntries = DEFAULT_MAX_ENTRIES,
): ComposerHistoryEntry[] {
  const trimmed = body.trim().slice(0, MAX_BODY_LENGTH);
  if (!trimmed) return entries;

  // Skip consecutive duplicates
  const last = entries[entries.length - 1];
  if (last && last.body === trimmed) return entries;

  const updated = [
    ...entries,
    { body: trimmed, timestamp: Date.now() },
  ];

  // Keep only the most recent N entries
  const overflow = updated.length - maxEntries;
  if (overflow > 0) return updated.slice(overflow);
  return updated;
}

/**
 * Read history and append + persist in one call. Returns the new entry list.
 */
export function recordAndPersistHistory(
  senderIdentity: string,
  body: string,
): ComposerHistoryEntry[] {
  const current = readHistory(senderIdentity);
  const updated = appendHistory(current, body);
  persistHistory(senderIdentity, updated);
  return updated;
}

/**
 * Clear the browser-global composer history.
 */
export function clearHistory(senderIdentity: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(senderIdentity));
  } catch {
    // silently ignore
  }
}

/**
 * Subscribe to cross-tab composer history changes via the `storage` event.
 * Returns an unsubscribe function. The callback fires when another tab writes
 * to the same localStorage key (the key is the composer history key).
 */
export function subscribeToHistoryChanges(
  senderIdentity: string,
  callback: (entries: ComposerHistoryEntry[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = storageKey(senderIdentity);
  const handler = (event: StorageEvent) => {
    if (event.key === key) {
      callback(readHistory(senderIdentity));
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

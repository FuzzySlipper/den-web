/**
 * Sender-identity persistence shared by the channel chat panel and the focused
 * session view. Both surfaces let the operator pick the identity they post as
 * and remember it across reloads via the same localStorage key.
 */

export const SENDER_IDENTITY_STORAGE_KEY = 'den-channel-sender-identity';
export const DIRECT_TARGET_STORAGE_KEY = 'den-channel-direct-targets';

export function readStoredSenderIdentity(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SENDER_IDENTITY_STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function persistSenderIdentity(identity: string): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = identity.trim();
    if (normalized) {
      window.localStorage.setItem(SENDER_IDENTITY_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(SENDER_IDENTITY_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in private/embedded contexts; the in-memory
    // state still provides the identity seam for this session.
  }
}

function readDirectTargetMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DIRECT_TARGET_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
      .map(([channelId, identity]) => [channelId, identity.trim()]);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function readStoredDirectTarget(channelId: number | null | undefined): string {
  if (!channelId) return '';
  return readDirectTargetMap()[String(channelId)] ?? '';
}

export function persistDirectTarget(channelId: number | null | undefined, identity: string): void {
  if (typeof window === 'undefined' || !channelId) return;
  try {
    const targets = readDirectTargetMap();
    const key = String(channelId);
    const normalized = identity.trim();
    if (normalized) {
      targets[key] = normalized;
    } else {
      delete targets[key];
    }
    window.localStorage.setItem(DIRECT_TARGET_STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // Keep the in-memory target even when storage is unavailable.
  }
}

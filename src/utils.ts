export function formatTimeAgo(iso: string): string {
  const trimmed = iso.trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = hasExplicitTimezone ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const timestamp = new Date(normalized).getTime();

  if (Number.isNaN(timestamp)) return '—';

  const diff = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

/**
 * Check whether a keyboard event target is an editable element
 * (input, textarea, select, or contentEditable).
 *
 * When true, navigation keyboard shortcuts should be suppressed
 * so the user can type freely. Dismiss/close actions (Escape)
 * should still fire regardless.
 */
export function editableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

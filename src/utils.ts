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

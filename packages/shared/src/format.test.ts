import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatTimeAgo } from './format';

describe('formatTimeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats timestamps that already include a UTC Z suffix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T01:40:00Z'));

    expect(formatTimeAgo('2026-06-06T01:35:00Z')).toBe('5m');
  });

  it('formats Den Core SQL-style UTC timestamps without producing NaN', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T01:40:00Z'));

    expect(formatTimeAgo('2026-06-06 01:25:00')).toBe('15m');
  });

  it('returns a placeholder for malformed timestamps', () => {
    expect(formatTimeAgo('not-a-date')).toBe('—');
  });
});

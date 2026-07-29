import { describe, expect, it } from 'vitest';
import { formatLocalTime } from './local-time-display';

const losAngeles = 'America/Los_Angeles';
const locale = 'en-US';

describe('formatLocalTime', () => {
  it('renders canonical UTC in the requested local timezone without changing datetime', () => {
    const value = '2026-07-29T00:57:23.730966Z';
    const display = formatLocalTime(value, {
      locale,
      timeZone: losAngeles,
      now: new Date('2026-08-10T00:00:00Z'),
    });

    expect(display?.datetime).toBe(value);
    expect(display?.exactLabel).toContain('Jul 28, 2026');
    expect(display?.exactLabel).toContain('5:57:23 PM');
    expect(display?.exactLabel).toContain('PDT');
    expect(display?.visibleLabel).toBe(display?.exactLabel);
  });

  it('uses the DST-aware timezone label for winter and summer instants', () => {
    const winter = formatLocalTime('2026-01-15T20:00:00Z', {
      locale,
      timeZone: losAngeles,
      relative: false,
    });
    const summer = formatLocalTime('2026-07-15T19:00:00Z', {
      locale,
      timeZone: losAngeles,
      relative: false,
    });

    expect(winter?.exactLabel).toContain('PST');
    expect(summer?.exactLabel).toContain('PDT');
  });

  it.each([
    ['2026-07-29T00:59:31Z', '29 seconds ago'],
    ['2026-07-29T00:57:00Z', '3 minutes ago'],
    ['2026-07-28T22:00:00Z', '3 hours ago'],
    ['2026-07-27T01:00:00Z', '2 days ago'],
  ])('renders recent value %s as %s', (value, expected) => {
    const display = formatLocalTime(value, {
      locale,
      timeZone: losAngeles,
      now: new Date('2026-07-29T01:00:00Z'),
    });

    expect(display?.relativeLabel).toBe(expected);
    expect(display?.visibleLabel).toBe(expected);
    expect(display?.exactLabel).toContain('PDT');
  });

  it('switches from relative days to exact local time at one week', () => {
    const display = formatLocalTime('2026-07-22T01:00:00Z', {
      locale,
      timeZone: losAngeles,
      now: new Date('2026-07-29T01:00:00Z'),
    });

    expect(display?.relativeLabel).toBeNull();
    expect(display?.visibleLabel).toBe(display?.exactLabel);
  });

  it.each([undefined, null, '', 'not-a-timestamp'])(
    'degrades safely for %s',
    (value) => {
      expect(
        formatLocalTime(value, { locale, timeZone: losAngeles }),
      ).toBeNull();
    },
  );
});

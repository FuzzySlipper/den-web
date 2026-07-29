export interface LocalTimeFormatOptions {
  readonly locale?: string;
  readonly timeZone?: string;
  readonly now?: Date;
  readonly relative?: boolean;
}

export interface LocalTimeDisplay {
  readonly datetime: string;
  readonly exactLabel: string;
  readonly relativeLabel: string | null;
  readonly visibleLabel: string;
}

const relativeTimeThresholds = {
  minute: 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
} as const;

export function formatLocalTime(
  value: string | null | undefined,
  options: LocalTimeFormatOptions = {},
): LocalTimeDisplay | null {
  const canonicalValue = value?.trim();
  if (!canonicalValue) {
    return null;
  }
  const instant = new Date(canonicalValue);
  if (!Number.isFinite(instant.getTime())) {
    return null;
  }

  try {
    const exactLabel = createExactFormatter(options).format(instant);
    const relativeLabel =
      options.relative === false
        ? null
        : formatRelativeTime(
            instant,
            options.now ?? new Date(),
            options.locale,
          );
    return {
      datetime: canonicalValue,
      exactLabel,
      relativeLabel,
      visibleLabel: relativeLabel ?? exactLabel,
    };
  } catch {
    return null;
  }
}

function createExactFormatter(
  options: LocalTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(options.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timeZone: options.timeZone,
  });
}

function formatRelativeTime(
  instant: Date,
  now: Date,
  locale: string | undefined,
): string | null {
  const secondsFromNow = (instant.getTime() - now.getTime()) / 1000;
  const absoluteSeconds = Math.abs(secondsFromNow);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absoluteSeconds < relativeTimeThresholds.minute) {
    return formatter.format(Math.round(secondsFromNow), 'second');
  }
  if (absoluteSeconds < relativeTimeThresholds.hour) {
    return formatter.format(
      Math.round(secondsFromNow / relativeTimeThresholds.minute),
      'minute',
    );
  }
  if (absoluteSeconds < relativeTimeThresholds.day) {
    return formatter.format(
      Math.round(secondsFromNow / relativeTimeThresholds.hour),
      'hour',
    );
  }
  if (absoluteSeconds < relativeTimeThresholds.week) {
    return formatter.format(
      Math.round(secondsFromNow / relativeTimeThresholds.day),
      'day',
    );
  }
  return null;
}

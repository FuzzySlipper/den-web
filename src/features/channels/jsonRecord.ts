/**
 * Small, pure JSON/record parsing helpers shared by direct-message evidence
 * extraction and focused-session display logic. Kept provider-agnostic so both
 * call sites read metadata the same way instead of carrying copy-paste parsers.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** First non-empty string found by scanning each record for any of the given keys, in order. */
export function firstString(records: Array<Record<string, unknown> | null>, keys: string[]): string | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = stringFromUnknown(record[key]);
      if (value) return value;
    }
  }
  return null;
}

export function parseJsonRecord(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return asRecord(JSON.parse(json));
  } catch {
    return null;
  }
}


export function parseJsonObject(value: string | null): Record<string, unknown> {
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

export function parseJsonValue(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

export function firstIdentifier(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 1) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 1) return parsed;
    }
  }
  return null;
}

export function firstAnyNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function firstPositiveInteger(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

export function summarizePreview(preview: unknown, fallback: string | null): string | null {
  const direct = firstString(
    typeof preview === 'string' ? preview : null,
    preview && typeof preview === 'object' && !Array.isArray(preview) ? (preview as Record<string, unknown>).preview : null,
    preview && typeof preview === 'object' && !Array.isArray(preview) ? (preview as Record<string, unknown>).command : null,
    preview && typeof preview === 'object' && !Array.isArray(preview) ? (preview as Record<string, unknown>).result : null,
    fallback,
  );
  if (direct) return truncate(direct);
  if (preview && typeof preview === 'object') return truncate(JSON.stringify(preview));
  return null;
}

export function truncate(value: string, max = 180): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > max ? `${singleLine.slice(0, max - 1)}…` : singleLine;
}

export function humanizeEventType(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function matchFirst(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1]?.trim() ?? null;
}

export function legacyDeliveryRequestIdFromDedupeKey(dedupeKey: string): string | null {
  const gatewayDelivery = /^gateway-delivery:(.+):final$/i.exec(dedupeKey);
  if (gatewayDelivery?.[1]) return gatewayDelivery[1];
  const named = /(?:^|[:|;,\s])(?:deliveryRequestId|delivery_request_id|channelMessageDeliveryRequestId|channel_message_delivery_request_id)=([^:|;,\s]+)/i.exec(dedupeKey);
  return named?.[1] ?? null;
}

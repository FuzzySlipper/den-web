import type { DenArtifactMetadata } from '@den-web/protocol';

export interface ArtifactReference {
  readonly ref: string;
  readonly label: string;
  readonly mimeType: string | null;
  readonly sensitive: boolean | null;
}

const artifactRefPattern = /den-artifact:\/\/[^\s"'<>]+/g;
const trailingPunctuationPattern = /[),.;\]}]+$/;

export function extractArtifactReferences(value: unknown): readonly ArtifactReference[] {
  const refs = new Map<string, ArtifactReference>();
  visitArtifactValue(value, [], refs);
  return [...refs.values()];
}

export function isDenArtifactRef(value: string): boolean {
  return value.trim().startsWith('den-artifact://');
}

export function artifactDisplayName(ref: ArtifactReference, metadata: DenArtifactMetadata | null | undefined): string {
  return metadata?.logical_name || ref.label || ref.ref;
}

export function artifactDimensions(metadata: DenArtifactMetadata): string {
  return metadata.width && metadata.height ? `${metadata.width} x ${metadata.height}` : 'unknown';
}

export function artifactRetentionLabel(metadata: DenArtifactMetadata): string {
  if (metadata.deleted_at) return `deleted ${metadata.deleted_at}`;
  if (metadata.expires_at) return `expires ${metadata.expires_at}`;
  return 'retained';
}

export function formatArtifactByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

function visitArtifactValue(value: unknown, path: readonly string[], refs: Map<string, ArtifactReference>): void {
  if (typeof value === 'string') {
    for (const ref of artifactRefsInString(value)) {
      addArtifactReference(refs, { ref, label: labelFromPath(path), mimeType: null, sensitive: null });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitArtifactValue(item, [...path, String(index)], refs));
    return;
  }
  if (!isRecord(value)) return;

  const recordRef = typeof value['ref'] === 'string' ? value['ref'] : null;
  if (recordRef && isDenArtifactRef(recordRef)) {
    addArtifactReference(refs, {
      ref: recordRef,
      label: recordLabel(value, path),
      mimeType: stringField(value, 'mime_type') ?? stringField(value, 'mimeType'),
      sensitive: booleanField(value, 'sensitive'),
    });
  }

  for (const [key, child] of Object.entries(value)) {
    visitArtifactValue(child, [...path, key], refs);
  }
}

function artifactRefsInString(value: string): readonly string[] {
  return [...value.matchAll(artifactRefPattern)]
    .map((match) => (match[0] ?? '').replace(trailingPunctuationPattern, ''))
    .filter(isDenArtifactRef);
}

function addArtifactReference(refs: Map<string, ArtifactReference>, next: ArtifactReference): void {
  const current = refs.get(next.ref);
  if (!current) {
    refs.set(next.ref, next);
    return;
  }
  refs.set(next.ref, {
    ref: next.ref,
    label: current.label || next.label,
    mimeType: current.mimeType ?? next.mimeType,
    sensitive: current.sensitive ?? next.sensitive,
  });
}

function recordLabel(record: Readonly<Record<string, unknown>>, path: readonly string[]): string {
  return stringField(record, 'logical_name')
    ?? stringField(record, 'logicalName')
    ?? stringField(record, 'screenshot_id')
    ?? stringField(record, 'screenshotId')
    ?? stringField(record, 'id')
    ?? labelFromPath(path);
}

function labelFromPath(path: readonly string[]): string {
  const useful = [...path].reverse().find((part) => Number.isNaN(Number.parseInt(part, 10)));
  return useful ? useful.replace(/_/g, ' ') : 'Artifact';
}

function stringField(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanField(record: Readonly<Record<string, unknown>>, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

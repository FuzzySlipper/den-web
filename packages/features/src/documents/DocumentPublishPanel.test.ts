/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeDocumentPublishTimestamp } from './documentPublishTimestamp';

const cwd = process.cwd();

function readFeatureSource(file: string): string {
  return readFileSync(resolve(cwd, 'packages/features/src/documents', file), 'utf8');
}

describe('Document blog publishing UI (#2567)', () => {
  it('keeps blog publishing in a dedicated document feature component', () => {
    const detail = readFeatureSource('DocumentDetail.tsx');
    const panel = readFeatureSource('DocumentPublishPanel.tsx');

    expect(detail).toContain('<DocumentPublishPanel document={doc}');
    expect(detail).toContain('Share via blog');
    expect(panel).toContain('previewDocumentPublication');
    expect(panel).toContain('publishDocument');
  });

  it('does not post browser-supplied document content during publish without previewing first', () => {
    const panel = readFeatureSource('DocumentPublishPanel.tsx');

    expect(panel).toContain("requested_by: 'den-web'");
    expect(panel).toContain("const canPublish = preview !== null");
    expect(panel).toContain('disabled={busy || !canPublish}');
  });

  it('normalizes Core document timestamps to RFC3339 for doc-publish', () => {
    expect(normalizeDocumentPublishTimestamp('2026-06-22T04:45:06')).toBe('2026-06-22T04:45:06Z');
    expect(normalizeDocumentPublishTimestamp('2026-06-22T04:45:06Z')).toBe('2026-06-22T04:45:06Z');
    expect(normalizeDocumentPublishTimestamp('2026-06-22T04:45:06-07:00')).toBe('2026-06-22T04:45:06-07:00');
  });
});

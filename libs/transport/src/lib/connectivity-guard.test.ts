import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rootsToScan = ['apps/den-web/src', 'libs'];
const forbiddenPatterns = [
  /\/api\/(?!v1(?:\/|['"`?#]|$))/,
  /denChannelsApiBase/,
  /denCoreApiBase/,
  /den-channels/i,
  /worker[-_ ]?pool/i,
  /hermes/i,
  /pi[-_ ]?crew/i,
];

describe('successor connectivity guard', () => {
  it('keeps product code off legacy Den routes and dropped domains', () => {
    const offenders: string[] = [];

    for (const file of productFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

function productFiles(): string[] {
  const files: string[] = [];
  for (const root of rootsToScan) collect(root, files);
  return files.filter((file) => /\.(ts|html|css)$/.test(file) && !file.endsWith('.test.ts'));
}

function collect(path: string, files: string[]): void {
  const stat = statSync(path);
  if (stat.isFile()) {
    files.push(path);
    return;
  }
  for (const entry of readdirSync(path)) {
    collect(join(path, entry), files);
  }
}


import { describe, expect, it } from 'vitest';
import { parseMarkdownBlocks } from './markdown-blocks';

describe('parseMarkdownBlocks', () => {
  it('parses GitHub-flavored pipe tables as table blocks', () => {
    const blocks = parseMarkdownBlocks([
      '# Matrix',
      '',
      '| Surface | Owner | Notes |',
      '|---|---|---|',
      '| Runtime | ASHA main | Public facade only |',
      '| Demo | asha-demo | Uses public views |',
    ].join('\n'));

    expect(blocks).toEqual([
      { kind: 'heading', depth: 1, text: 'Matrix' },
      {
        kind: 'table',
        headers: ['Surface', 'Owner', 'Notes'],
        rows: [
          ['Runtime', 'ASHA main', 'Public facade only'],
          ['Demo', 'asha-demo', 'Uses public views'],
        ],
      },
    ]);
  });

  it('pads short rows and preserves escaped pipes inside cells', () => {
    const blocks = parseMarkdownBlocks([
      '| A | B | C |',
      '| :--- | ---: | :---: |',
      '| one \\| uno | two |',
    ].join('\n'));

    expect(blocks).toEqual([
      {
        kind: 'table',
        headers: ['A', 'B', 'C'],
        rows: [['one | uno', 'two', '']],
      },
    ]);
  });
});

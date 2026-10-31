import { describe, expect, it } from 'vitest';
import { inlineText, parseInline, parseRichMarkdown } from './rich-markdown';

describe('parseRichMarkdown', () => {
  it('numbers footnotes by first reference and keeps their citation links', () => {
    const doc = parseRichMarkdown(
      [
        '# SQLite WAL',
        '',
        'Readers do not block writers.[^wal2] Only one writer at a time.[^wal1]',
        '',
        '[^wal1]: [SQLite WAL documentation](/sources/sqlite/write-ahead-logging.md) "only one writer"',
        '',
        '[^wal2]: [Same](/sources/sqlite/write-ahead-logging.md) "readers',
        '  do not block writers"',
      ].join('\n'),
    );

    expect(doc.blocks[0]).toEqual({ kind: 'heading', depth: 1, spans: [{ kind: 'text', text: 'SQLite WAL' }] });
    expect(doc.blocks[1]).toEqual({
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'Readers do not block writers.' },
        { kind: 'footnote-ref', id: 'wal2', number: 1 },
        { kind: 'text', text: ' Only one writer at a time.' },
        { kind: 'footnote-ref', id: 'wal1', number: 2 },
      ],
    });
    expect(doc.footnotes.map((note) => [note.id, note.number])).toEqual([
      ['wal2', 1],
      ['wal1', 2],
    ]);
    expect(doc.footnotes[0]?.spans[0]).toEqual({
      kind: 'link',
      href: '/sources/sqlite/write-ahead-logging.md',
      children: [{ kind: 'text', text: 'Same' }],
    });
    expect(inlineText(doc.footnotes[0]?.spans ?? [])).toBe('Same "readers do not block writers"');
  });

  it('parses ordered and nested lists, tables with inline cells, code and rules', () => {
    const doc = parseRichMarkdown(
      ['1. First', '2. Second', '   - nested `code`', '', '| A | B |', '|---|---|', '| **x** | [y](/wiki/y.md) |', '', '```', '<b>raw</b>', '```', '---'].join('\n'),
    );
    expect(doc.blocks.map((block) => block.kind)).toEqual(['list', 'table', 'code', 'rule']);
    expect(doc.blocks[0]).toMatchObject({
      ordered: true,
      items: [
        { depth: 0, ordered: true },
        { depth: 0, ordered: true },
        { depth: 1, ordered: false, spans: [{ kind: 'text', text: 'nested ' }, { kind: 'code', text: 'code' }] },
      ],
    });
    expect(doc.blocks[1]).toMatchObject({
      rows: [[[{ kind: 'strong' }], [{ kind: 'link', href: '/wiki/y.md' }]]],
    });
    expect(doc.blocks[2]).toEqual({ kind: 'code', text: '<b>raw</b>' });
  });
});

describe('parseInline', () => {
  it('handles emphasis, code, autolinks and snake_case words', () => {
    expect(parseInline('a **bold** and *em* `x_y` snake_case_word <https://a.b/c>')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'bold' }] },
      { kind: 'text', text: ' and ' },
      { kind: 'em', children: [{ kind: 'text', text: 'em' }] },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'x_y' },
      { kind: 'text', text: ' snake_case_word ' },
      { kind: 'link', href: 'https://a.b/c', children: [{ kind: 'text', text: 'https://a.b/c' }] },
    ]);
  });

  it('leaves an undefined footnote reference and raw HTML as text', () => {
    expect(parseInline('see [^missing] <script>x</script>')).toEqual([
      { kind: 'text', text: 'see [^missing] <script>x</script>' },
    ]);
  });
});

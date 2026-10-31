// A Markdown parser for documents whose links and footnotes matter: inline
// code, emphasis, links and footnote references are kept as spans, and
// footnote definitions are gathered into one numbered list at the end.
// Raw HTML is shown as text, never interpreted.

export type InlineSpan =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'strong'; readonly children: readonly InlineSpan[] }
  | { readonly kind: 'em'; readonly children: readonly InlineSpan[] }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly InlineSpan[] }
  | { readonly kind: 'footnote-ref'; readonly id: string; readonly number: number };

export interface RichListItem {
  readonly depth: number;
  /** A nested item keeps its own marker: a bullet under a numbered item stays a bullet. */
  readonly ordered: boolean;
  readonly spans: readonly InlineSpan[];
}

export interface RichFootnote {
  readonly id: string;
  readonly number: number;
  readonly spans: readonly InlineSpan[];
}

export type RichBlock =
  | { readonly kind: 'heading'; readonly depth: number; readonly spans: readonly InlineSpan[] }
  | { readonly kind: 'paragraph'; readonly spans: readonly InlineSpan[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly RichListItem[] }
  | {
      readonly kind: 'table';
      readonly headers: readonly (readonly InlineSpan[])[];
      readonly rows: readonly (readonly (readonly InlineSpan[])[])[];
    }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'quote'; readonly spans: readonly InlineSpan[] }
  | { readonly kind: 'rule' };

export interface RichDocument {
  readonly blocks: readonly RichBlock[];
  /** Referenced footnotes in order of first reference, then any unreferenced ones. */
  readonly footnotes: readonly RichFootnote[];
}

type RawBlock =
  | { readonly kind: 'heading'; readonly depth: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly { depth: number; ordered: boolean; text: string }[] }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'rule' };

const footnoteDefinition = /^\[\^([^\]\s]+)\]:\s?(.*)$/;
const listLine = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

/** Parses a Markdown body. Strip any frontmatter first. */
export function parseRichMarkdown(markdown: string): RichDocument {
  const definitions = new Map<string, string>();
  const raw = parseRawBlocks(markdown.replace(/\r\n/g, '\n'), definitions);

  const order: string[] = [];
  const numberFor = (id: string): number | null => {
    if (!definitions.has(id)) return null;
    const existing = order.indexOf(id);
    if (existing >= 0) return existing + 1;
    order.push(id);
    return order.length;
  };
  const inline = (text: string): readonly InlineSpan[] => parseInline(text, numberFor);

  const blocks = raw.map((block): RichBlock => {
    switch (block.kind) {
      case 'heading':
        return { kind: 'heading', depth: block.depth, spans: inline(block.text) };
      case 'paragraph':
        return { kind: 'paragraph', spans: inline(block.text) };
      case 'quote':
        return { kind: 'quote', spans: inline(block.text) };
      case 'list':
        return {
          kind: 'list',
          ordered: block.ordered,
          items: block.items.map((item) => ({ depth: item.depth, ordered: item.ordered, spans: inline(item.text) })),
        };
      case 'table':
        return {
          kind: 'table',
          headers: block.headers.map(inline),
          rows: block.rows.map((row) => row.map(inline)),
        };
      default:
        return block;
    }
  });

  // Footnotes may cite other footnotes, which then join `order` as this loop runs.
  const footnotes: RichFootnote[] = [];
  for (let index = 0; index < order.length; index += 1) {
    const id = order[index] ?? '';
    footnotes.push({ id, number: index + 1, spans: inline(definitions.get(id) ?? '') });
  }
  for (const [id, text] of definitions) {
    if (!order.includes(id)) footnotes.push({ id, number: footnotes.length + 1, spans: inline(text) });
  }
  return { blocks, footnotes };
}

function parseRawBlocks(markdown: string, definitions: Map<string, string>): RawBlock[] {
  const blocks: RawBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: { depth: number; ordered: boolean; text: string }[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;
  let footnote: { id: string; lines: string[] } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = (): void => {
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushQuote = (): void => {
    if (quote.length > 0) blocks.push({ kind: 'quote', text: quote.join(' ') });
    quote = [];
  };
  const flushFootnote = (): void => {
    if (footnote) definitions.set(footnote.id, footnote.lines.join(' '));
    footnote = null;
  };
  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
    flushFootnote();
  };

  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (code === null) {
        flushAll();
        code = [];
      } else {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushQuote();
      flushFootnote();
      // A blank line between list items keeps the list going.
      if (list && !listLine.test(lines[index + 1] ?? '')) flushList();
      continue;
    }

    const definition = footnoteDefinition.exec(trimmed);
    if (definition && line === line.trimStart()) {
      flushAll();
      footnote = { id: definition[1] ?? '', lines: [definition[2] ?? ''] };
      continue;
    }
    if (footnote && /^\s{2,}/.test(line)) {
      footnote.lines.push(trimmed);
      continue;
    }
    flushFootnote();

    const table = parseTable(lines, index);
    if (table) {
      flushAll();
      blocks.push(table.block);
      index = table.nextIndex - 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
    if (heading) {
      flushAll();
      blocks.push({ kind: 'heading', depth: Math.min(heading[1]?.length ?? 3, 4), text: heading[2] ?? '' });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const item = listLine.exec(line);
    if (item) {
      flushParagraph();
      flushQuote();
      const ordered = /\d/.test(item[2] ?? '');
      if (list && list.ordered !== ordered && (item[1] ?? '').length === 0) flushList();
      list ??= { ordered, items: [] };
      list.items.push({ depth: Math.floor((item[1] ?? '').replace(/\t/g, '  ').length / 2), ordered, text: item[3] ?? '' });
      continue;
    }
    if (list && /^\s+/.test(line)) {
      const last = list.items[list.items.length - 1];
      if (last) last.text = `${last.text} ${trimmed}`;
      continue;
    }

    const quoteLine = /^>\s?(.*)$/.exec(trimmed);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1] ?? '');
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  if (code !== null) blocks.push({ kind: 'code', text: code.join('\n') });
  flushAll();
  return blocks;
}

/** Parses inline Markdown. `numberFor` numbers a footnote reference, or returns null for an undefined one. */
export function parseInline(text: string, numberFor: (id: string) => number | null = () => null): readonly InlineSpan[] {
  const spans: InlineSpan[] = [];
  let buffer = '';
  const flush = (): void => {
    if (buffer) spans.push({ kind: 'text', text: buffer });
    buffer = '';
  };

  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? '';
    const rest = text.slice(index);

    if (char === '\\' && index + 1 < text.length && /[\\`*_[\]()#+\-.!|<>~]/.test(text[index + 1] ?? '')) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (char === '`') {
      const fence = /^`+/.exec(rest)?.[0] ?? '`';
      const end = text.indexOf(fence, index + fence.length);
      if (end > 0) {
        flush();
        spans.push({ kind: 'code', text: text.slice(index + fence.length, end).trim() });
        index = end + fence.length;
        continue;
      }
    }

    const footnote = /^\[\^([^\]\s]+)\]/.exec(rest);
    if (footnote) {
      const number = numberFor(footnote[1] ?? '');
      if (number !== null) {
        flush();
        spans.push({ kind: 'footnote-ref', id: footnote[1] ?? '', number });
        index += footnote[0].length;
        continue;
      }
    }

    if (char === '[' || (char === '!' && text[index + 1] === '[')) {
      const link = matchLink(text, char === '!' ? index + 1 : index);
      if (link) {
        flush();
        spans.push({ kind: 'link', href: link.href, children: parseInline(link.label, numberFor) });
        index = link.end;
        continue;
      }
    }

    const autolink = /^<(https?:\/\/[^\s>]+)>/.exec(rest);
    if (autolink) {
      flush();
      spans.push({ kind: 'link', href: autolink[1] ?? '', children: [{ kind: 'text', text: autolink[1] ?? '' }] });
      index += autolink[0].length;
      continue;
    }

    const bare = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/.exec(rest);
    if (bare && !/[\w/]$/.test(buffer)) {
      flush();
      spans.push({ kind: 'link', href: bare[0], children: [{ kind: 'text', text: bare[0] }] });
      index += bare[0].length;
      continue;
    }

    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (strong && !(char === '_' && /\w$/.test(buffer))) {
      flush();
      spans.push({ kind: 'strong', children: parseInline(strong[2] ?? '', numberFor) });
      index += strong[0].length;
      continue;
    }

    const em = /^([*_])(?=\S)([\s\S]*?\S)\1(?!\1)/.exec(rest);
    if (em && !(char === '_' && /\w$/.test(buffer)) && !(char === '_' && /^\w/.test(text.slice(index + em[0].length)))) {
      flush();
      spans.push({ kind: 'em', children: parseInline(em[2] ?? '', numberFor) });
      index += em[0].length;
      continue;
    }

    buffer += char;
    index += 1;
  }
  flush();
  return spans;
}

/** Matches `[label](href "title")` at `start`, allowing nested brackets in the label. */
function matchLink(text: string, start: number): { label: string; href: string; end: number } | null {
  let depth = 0;
  let labelEnd = -1;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        labelEnd = index;
        break;
      }
    }
  }
  if (labelEnd < 0 || text[labelEnd + 1] !== '(') return null;
  const target = /^\(\s*<?([^\s)>]*)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/.exec(text.slice(labelEnd + 1));
  if (!target) return null;
  return { label: text.slice(start + 1, labelEnd), href: target[1] ?? '', end: labelEnd + 1 + target[0].length };
}

function parseTable(
  lines: readonly string[],
  startIndex: number,
): { readonly block: Extract<RawBlock, { readonly kind: 'table' }>; readonly nextIndex: number } | null {
  const headerLine = lines[startIndex]?.trim() ?? '';
  const separatorLine = lines[startIndex + 1]?.trim() ?? '';
  if (!isTableRow(headerLine) || !isTableRow(separatorLine)) return null;
  const headers = splitTableRow(headerLine);
  const separators = splitTableRow(separatorLine);
  if (separators.length < headers.length || !separators.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;

  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length && isTableRow(lines[index]?.trim() ?? '')) {
    const cells = splitTableRow(lines[index]?.trim() ?? '');
    rows.push(headers.map((_, column) => cells[column] ?? ''));
    index += 1;
  }
  return { block: { kind: 'table', headers, rows }, nextIndex: index };
}

function isTableRow(line: string): boolean {
  return line.includes('|') && splitTableRow(line).length > 1;
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  let inCode = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** The plain text of some spans, for titles and tooltips. */
export function inlineText(spans: readonly InlineSpan[]): string {
  return spans
    .map((span) => {
      switch (span.kind) {
        case 'text':
        case 'code':
          return span.text;
        case 'footnote-ref':
          return `[${span.number}]`;
        default:
          return inlineText(span.children);
      }
    })
    .join('');
}

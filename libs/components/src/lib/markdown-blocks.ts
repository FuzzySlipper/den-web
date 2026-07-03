export type MarkdownBlock =
  | { readonly kind: 'heading'; readonly depth: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'rule' };

export function parseMarkdownBlocks(markdown: string): readonly MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = (): void => {
    if (list.length === 0) return;
    blocks.push({ kind: 'list', items: list });
    list = [];
  };
  const flushQuote = (): void => {
    if (quote.length === 0) return;
    blocks.push({ kind: 'quote', text: quote.join('\n') });
    quote = [];
  };
  const flushLoose = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim().startsWith('```')) {
      if (code === null) {
        flushLoose();
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

    const trimmed = line.trim();
    if (!trimmed) {
      flushLoose();
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      flushLoose();
      blocks.push(table.block);
      index = table.nextIndex - 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushLoose();
      blocks.push({ kind: 'heading', depth: Math.min(heading[1]?.length ?? 3, 3), text: heading[2] ?? '' });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushLoose();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      flushQuote();
      list.push(listItem[1] ?? '');
      continue;
    }

    const quoteLine = /^>\s?(.+)$/.exec(trimmed);
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
  flushLoose();
  return blocks;
}

function parseTable(lines: readonly string[], startIndex: number): { readonly block: Extract<MarkdownBlock, { readonly kind: 'table' }>; readonly nextIndex: number } | null {
  const headerLine = lines[startIndex]?.trim() ?? '';
  const separatorLine = lines[startIndex + 1]?.trim() ?? '';
  if (!isTableRow(headerLine) || !isTableSeparator(separatorLine)) return null;

  const headers = splitTableRow(headerLine);
  const separatorCells = splitTableRow(separatorLine);
  if (headers.length === 0 || separatorCells.length < headers.length || !separatorCells.every(isSeparatorCell)) return null;

  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    if (!isTableRow(line)) break;
    rows.push(normalizeTableRow(splitTableRow(line), headers.length));
    index += 1;
  }

  return { block: { kind: 'table', headers, rows }, nextIndex: index };
}

function isTableRow(line: string): boolean {
  return line.includes('|') && splitTableRow(line).length > 1;
}

function isTableSeparator(line: string): boolean {
  return isTableRow(line) && splitTableRow(line).every(isSeparatorCell);
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    const next = trimmed[index + 1];
    if (char === '\\' && next === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeTableRow(cells: readonly string[], width: number): string[] {
  if (cells.length === width) return [...cells];
  if (cells.length < width) return [...cells, ...Array.from({ length: width - cells.length }, () => '')];
  return [...cells.slice(0, width - 1), cells.slice(width - 1).join(' | ')];
}

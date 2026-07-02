import { Component, Input, computed, signal } from '@angular/core';

type MarkdownBlock =
  | { readonly kind: 'heading'; readonly depth: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'rule' };

@Component({
  selector: 'den-markdown-view',
  standalone: true,
  styles: [
    `
      :host {
        color: var(--den-text);
        display: block;
        min-width: 0;
      }

      .markdown {
        display: grid;
        gap: 12px;
      }

      h1,
      h2,
      h3,
      p,
      ul,
      pre,
      blockquote {
        margin: 0;
      }

      h1 {
        font-size: var(--den-font-size-xl);
        line-height: var(--den-line-height-tight);
      }

      h2 {
        font-size: var(--den-font-size-lg);
        line-height: var(--den-line-height-tight);
      }

      h3 {
        font-size: var(--den-font-size-base);
        line-height: var(--den-line-height-snug);
      }

      p,
      li,
      blockquote {
        font-size: var(--den-font-size-md);
        line-height: var(--den-line-height-normal);
      }

      ul {
        display: grid;
        gap: 5px;
        padding-left: 20px;
      }

      pre {
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        box-sizing: border-box;
        color: var(--den-text);
        font-size: var(--den-font-size-sm);
        line-height: var(--den-line-height-normal);
        overflow: auto;
        padding: 10px;
        white-space: pre-wrap;
      }

      blockquote {
        border-left: 3px solid var(--den-border-strong);
        color: var(--den-muted);
        padding-left: 12px;
        white-space: pre-wrap;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--den-border);
        margin: 2px 0;
      }

      .empty {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
      }
    `,
  ],
  template: `
    @if (blocks().length === 0) {
      <p class="empty">Empty document</p>
    } @else {
      <div class="markdown">
        @for (block of blocks(); track $index) {
          @switch (block.kind) {
            @case ('heading') {
              @switch (block.depth) {
                @case (1) { <h1>{{ block.text }}</h1> }
                @case (2) { <h2>{{ block.text }}</h2> }
                @default { <h3>{{ block.text }}</h3> }
              }
            }
            @case ('paragraph') { <p>{{ block.text }}</p> }
            @case ('list') {
              <ul>
                @for (item of block.items; track $index) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
            @case ('code') { <pre><code>{{ block.text }}</code></pre> }
            @case ('quote') { <blockquote>{{ block.text }}</blockquote> }
            @case ('rule') { <hr /> }
          }
        }
      </div>
    }
  `,
})
export class MarkdownViewComponent {
  private readonly contentSignal = signal('');
  protected readonly blocks = computed(() => parseMarkdownBlocks(this.contentSignal()));

  @Input() set content(value: string | null | undefined) {
    this.contentSignal.set(value ?? '');
  }
}

function parseMarkdownBlocks(markdown: string): readonly MarkdownBlock[] {
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

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
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

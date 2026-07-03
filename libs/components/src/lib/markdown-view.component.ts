import { Component, Input, computed, signal } from '@angular/core';
import { parseMarkdownBlocks, type MarkdownBlock } from './markdown-blocks';

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
      table,
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

      .table-scroll {
        border: 1px solid var(--den-border);
        border-radius: 6px;
        max-width: 100%;
        overflow-x: auto;
      }

      table {
        border-collapse: collapse;
        font-size: var(--den-font-size-sm);
        line-height: var(--den-line-height-normal);
        min-width: 760px;
        table-layout: auto;
        width: 100%;
      }

      th,
      td {
        border-bottom: 1px solid var(--den-border);
        border-right: 1px solid var(--den-border);
        min-width: 130px;
        padding: 9px 10px;
        text-align: left;
        vertical-align: top;
      }

      th:last-child,
      td:last-child {
        border-right: 0;
      }

      tbody tr:last-child td {
        border-bottom: 0;
      }

      th {
        background: var(--den-surface);
        color: var(--den-text);
        font-weight: 700;
      }

      td {
        color: var(--den-text);
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

      @media (max-width: 720px) {
        .table-scroll {
          border: 0;
          overflow: visible;
        }

        table,
        thead,
        tbody,
        tr,
        th,
        td {
          display: block;
        }

        table {
          min-width: 0;
        }

        thead {
          clip: rect(0 0 0 0);
          height: 1px;
          overflow: hidden;
          position: absolute;
          white-space: nowrap;
          width: 1px;
        }

        tbody {
          display: grid;
          gap: 10px;
        }

        tr {
          border: 1px solid var(--den-border);
          border-radius: 6px;
          overflow: hidden;
        }

        td {
          border-bottom: 1px solid var(--den-border);
          border-right: 0;
          display: grid;
          gap: 6px;
          grid-template-columns: minmax(110px, 34%) minmax(0, 1fr);
          min-width: 0;
        }

        td::before {
          color: var(--den-muted);
          content: attr(data-label);
          font-weight: 700;
        }

        td:last-child {
          border-bottom: 0;
        }
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
            @case ('table') {
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      @for (header of block.headers; track $index) {
                        <th scope="col">{{ header }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of block.rows; track $index) {
                      <tr>
                        @for (cell of row; track $index) {
                          <td [attr.data-label]="tableHeader(block, $index)">{{ cell }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
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

  protected tableHeader(block: Extract<MarkdownBlock, { readonly kind: 'table' }>, index: number): string {
    return block.headers[index] || `Column ${index + 1}`;
  }
}

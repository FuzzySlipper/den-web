import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { inlineText, parseRichMarkdown, type InlineSpan, type RichFootnote } from './rich-markdown';

/** Maps a link's href to the href rendered, and says whether a click is handled in-app. */
export interface RichMarkdownLinkPolicy {
  readonly href: (href: string) => string;
  readonly internal: (href: string) => boolean;
}

const externalLinks: RichMarkdownLinkPolicy = { href: (href) => href, internal: () => false };

@Component({
  selector: 'den-rich-inline',
  standalone: true,
  styles: [
    `
      code {
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 4px;
        font-size: 0.92em;
        padding: 0 4px;
      }

      a {
        color: var(--den-accent);
      }

      sup {
        font-size: 0.75em;
        line-height: 0;
      }

      sup a {
        text-decoration: none;
      }
    `,
  ],
  template: `@for (span of spans; track $index) {@switch (span.kind) {@case ('text') {{{ span.text }}}@case ('code') {<code>{{ span.text }}</code>}@case ('strong') {<strong><den-rich-inline [spans]="span.children" [policy]="policy" [notes]="notes" (linkActivated)="linkActivated.emit($event)" /></strong>}@case ('em') {<em><den-rich-inline [spans]="span.children" [policy]="policy" [notes]="notes" (linkActivated)="linkActivated.emit($event)" /></em>}@case ('link') {<a [attr.href]="policy.href(span.href)" [attr.target]="policy.internal(span.href) ? null : '_blank'" [attr.rel]="policy.internal(span.href) ? null : 'noopener'" (click)="activate($event, span.href)"><den-rich-inline [spans]="span.children" [policy]="policy" [notes]="notes" (linkActivated)="linkActivated.emit($event)" /></a>}@case ('footnote-ref') {<sup><a [attr.href]="'#fn-' + span.id" [attr.title]="noteText(span.id)" (click)="activate($event, '#fn-' + span.id)">[{{ span.number }}]</a></sup>}}}`,
})
export class RichInlineComponent {
  @Input({ required: true }) spans: readonly InlineSpan[] = [];
  @Input() policy: RichMarkdownLinkPolicy = externalLinks;
  @Input() notes: readonly RichFootnote[] = [];
  /** An in-app link (per the policy) or a `#fn-<id>` footnote reference was clicked. */
  @Output() readonly linkActivated = new EventEmitter<string>();

  protected activate(event: MouseEvent, href: string): void {
    if (!href.startsWith('#')) {
      if (!this.policy.internal(href)) return;
      // Let the browser open an in-app link in a new tab or window.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    }
    event.preventDefault();
    this.linkActivated.emit(href);
  }

  protected noteText(id: string): string {
    const note = this.notes.find((candidate) => candidate.id === id);
    return note ? inlineText(note.spans) : '';
  }
}

@Component({
  selector: 'den-rich-markdown',
  standalone: true,
  imports: [RichInlineComponent],
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
      h4,
      p,
      ul,
      ol,
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
        margin-top: 8px;
      }

      h3,
      h4 {
        font-size: var(--den-font-size-base);
        line-height: var(--den-line-height-snug);
      }

      p,
      li,
      blockquote {
        font-size: var(--den-font-size-md);
        line-height: var(--den-line-height-normal);
        overflow-wrap: anywhere;
      }

      ul,
      ol {
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
        width: 100%;
      }

      th,
      td {
        border-bottom: 1px solid var(--den-border);
        border-right: 1px solid var(--den-border);
        padding: 7px 9px;
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
        font-weight: 700;
      }

      pre {
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        box-sizing: border-box;
        font-size: var(--den-font-size-sm);
        line-height: var(--den-line-height-normal);
        overflow: auto;
        padding: 10px;
      }

      blockquote {
        border-left: 3px solid var(--den-border-strong);
        color: var(--den-muted);
        padding-left: 12px;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--den-border);
        margin: 2px 0;
      }

      .footnotes {
        border-top: 1px solid var(--den-border);
        color: var(--den-muted);
        display: grid;
        gap: 6px;
        margin: 8px 0 0;
        padding: 12px 0 0 24px;
      }

      .footnotes li {
        font-size: var(--den-font-size-sm);
        scroll-margin-top: 16px;
      }

      .footnotes li.flash {
        background: var(--den-surface);
        border-radius: 4px;
        outline: 2px solid var(--den-accent);
      }

      .empty {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
      }
    `,
  ],
  template: `
    @if (document().blocks.length === 0 && document().footnotes.length === 0) {
      <p class="empty">Empty document</p>
    } @else {
      <div class="markdown">
        @for (block of document().blocks; track $index) {
          @switch (block.kind) {
            @case ('heading') {
              @switch (block.depth) {
                @case (1) { <h1><den-rich-inline [spans]="block.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></h1> }
                @case (2) { <h2><den-rich-inline [spans]="block.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></h2> }
                @case (3) { <h3><den-rich-inline [spans]="block.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></h3> }
                @default { <h4><den-rich-inline [spans]="block.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></h4> }
              }
            }
            @case ('paragraph') {
              <p><den-rich-inline [spans]="block.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></p>
            }
            @case ('list') {
              @if (block.ordered) {
                <ol>
                  @for (item of block.items; track $index) {
                    <li [style.margin-left.px]="item.depth * 18" [style.list-style-type]="item.ordered ? null : 'disc'"><den-rich-inline [spans]="item.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></li>
                  }
                </ol>
              } @else {
                <ul>
                  @for (item of block.items; track $index) {
                    <li [style.margin-left.px]="item.depth * 18"><den-rich-inline [spans]="item.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></li>
                  }
                </ul>
              }
            }
            @case ('table') {
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      @for (header of block.headers; track $index) {
                        <th scope="col"><den-rich-inline [spans]="header" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of block.rows; track $index) {
                      <tr>
                        @for (cell of row; track $index) {
                          <td><den-rich-inline [spans]="cell" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @case ('code') { <pre><code>{{ block.text }}</code></pre> }
            @case ('quote') {
              <blockquote><den-rich-inline [spans]="block.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" /></blockquote>
            }
            @case ('rule') { <hr /> }
          }
        }
        @if (document().footnotes.length > 0) {
          <ol class="footnotes" aria-label="Footnotes">
            @for (note of document().footnotes; track note.id) {
              <li [attr.value]="note.number" [class.flash]="highlighted() === note.id" [attr.data-footnote]="note.id">
                <den-rich-inline [spans]="note.spans" [policy]="policy" [notes]="document().footnotes" (linkActivated)="onLink($event)" />
              </li>
            }
          </ol>
        }
      </div>
    }
  `,
})
export class RichMarkdownViewComponent {
  private readonly contentSignal = signal('');
  protected readonly document = computed(() => parseRichMarkdown(this.contentSignal()));
  /** The footnote last jumped to from its reference. */
  protected readonly highlighted = signal<string | null>(null);

  @Input() set content(value: string | null | undefined) {
    this.contentSignal.set(value ?? '');
    this.highlighted.set(null);
  }

  @Input() policy: RichMarkdownLinkPolicy = externalLinks;

  /** An in-app link was clicked; the href is as written in the Markdown. */
  @Output() readonly linkActivated = new EventEmitter<string>();

  protected onLink(href: string): void {
    if (href.startsWith('#fn-')) {
      this.highlighted.set(href.slice(4));
      return;
    }
    this.linkActivated.emit(href);
  }
}

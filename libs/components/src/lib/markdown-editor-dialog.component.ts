import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'den-markdown-editor-dialog',
  standalone: true,
  styles: [
    `
      :host {
        display: contents;
      }

      .backdrop {
        align-items: center;
        background: rgba(18, 24, 38, 0.46);
        box-sizing: border-box;
        display: grid;
        inset: 0;
        justify-items: center;
        padding: 24px;
        position: fixed;
        z-index: 40;
      }

      .dialog {
        background: var(--den-panel);
        border: 1px solid var(--den-border-strong);
        border-radius: 8px;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);
        color: var(--den-text);
        display: grid;
        grid-template-rows: auto minmax(260px, 1fr) auto;
        max-height: min(760px, calc(100vh - 48px));
        max-width: min(860px, calc(100vw - 48px));
        min-height: 460px;
        overflow: hidden;
        width: 100%;
      }

      header,
      footer {
        align-items: center;
        display: flex;
        gap: 12px;
        padding: 14px 16px;
      }

      header {
        border-bottom: 1px solid var(--den-border);
        justify-content: space-between;
      }

      h2 {
        font-size: var(--den-font-size-lg);
        line-height: var(--den-line-height-tight);
        margin: 0;
      }

      textarea {
        background: var(--den-input);
        border: 0;
        box-sizing: border-box;
        color: var(--den-text);
        font: inherit;
        line-height: var(--den-line-height-normal);
        min-height: 0;
        padding: 16px;
        resize: none;
        width: 100%;
      }

      textarea:focus {
        outline: 2px solid var(--den-accent);
        outline-offset: -2px;
      }

      footer {
        border-top: 1px solid var(--den-border);
        justify-content: flex-end;
      }

      button {
        appearance: none;
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        font: inherit;
        min-height: 36px;
        padding: 0 14px;
      }

      button:hover,
      button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      .primary {
        background: var(--den-accent);
        border-color: var(--den-accent);
        color: var(--den-accent-contrast);
      }

      @media (max-width: 720px) {
        .backdrop {
          align-items: stretch;
          padding: 12px;
        }

        .dialog {
          max-height: calc(100vh - 24px);
          max-width: calc(100vw - 24px);
          min-height: 0;
        }
      }
    `,
  ],
  template: `
    @if (open) {
      <div class="backdrop" role="presentation" (click)="requestCancel()">
        <section
          class="dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title"
          (click)="$event.stopPropagation()"
        >
          <header>
            <h2>{{ title }}</h2>
            <button type="button" aria-label="Close editor" (click)="requestCancel()">Cancel</button>
          </header>

          <textarea
            aria-label="Markdown editor"
            [value]="draft()"
            (input)="updateDraft($event)"
          ></textarea>

          <footer>
            <button type="button" (click)="requestCancel()">Cancel</button>
            <button type="button" class="primary" (click)="requestDone()">Done</button>
          </footer>
        </section>
      </div>
    }
  `,
})
export class MarkdownEditorDialogComponent implements OnChanges {
  @Input() title = 'Edit Markdown';
  @Input() value = '';
  @Input() open = false;
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly done = new EventEmitter<string>();

  protected readonly draft = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['open']) {
      this.draft.set(this.value);
    }
  }

  protected updateDraft(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) this.draft.set(target.value);
  }

  protected requestCancel(): void {
    this.cancel.emit();
  }

  protected requestDone(): void {
    this.done.emit(this.draft());
  }
}

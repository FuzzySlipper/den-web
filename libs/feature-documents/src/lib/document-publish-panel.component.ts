import { Component, computed, EventEmitter, inject, Input, Output } from '@angular/core';
import type { DenDocPublishRequest, DenDocumentDetail } from '@den-web/protocol';
import { DOCUMENT_PUBLISH_STORE, stateValue } from '@den-web/store';
import { documentMarkdownBody } from '@den-web/domain';

@Component({
  selector: 'den-document-publish-panel',
  standalone: true,
  styles: [
    `
      :host {
        display: block;
      }

      .publish-panel {
        border: 1px solid var(--den-border);
        border-radius: 8px;
        display: grid;
        gap: 12px;
        padding: 12px;
      }

      .publish-head,
      .actions,
      .toggle {
        align-items: center;
        display: flex;
        gap: 10px;
      }

      .publish-head {
        justify-content: space-between;
      }

      h3 {
        font-size: var(--den-font-size-md);
        margin: 0;
      }

      .toggle {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
      }

      button {
        appearance: none;
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        font: inherit;
        min-height: 32px;
        padding: 0 10px;
      }

      button:hover,
      button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
      }

      .primary {
        background: var(--den-accent);
        border-color: var(--den-accent);
        color: var(--den-accent-contrast);
      }

      .close {
        min-width: 32px;
        padding: 0;
      }

      .result,
      .preview {
        border: 1px solid var(--den-border);
        border-radius: 6px;
        display: grid;
        gap: 8px;
        padding: 10px;
      }

      .result a {
        color: var(--den-accent);
      }

      .commit,
      .muted,
      .warning,
      .error {
        color: var(--den-muted);
        font-size: var(--den-font-size-sm);
      }

      .warning {
        color: var(--den-warning);
      }

      .error {
        color: var(--den-danger);
      }

      dl {
        display: grid;
        gap: 4px 10px;
        grid-template-columns: max-content minmax(0, 1fr);
        margin: 0;
      }

      dt {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        font-weight: 700;
        text-transform: uppercase;
      }

      dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      pre {
        background: var(--den-input);
        border-radius: 6px;
        margin: 0;
        max-height: 260px;
        overflow: auto;
        padding: 10px;
        white-space: pre-wrap;
      }
    `,
  ],
  template: `
    @if (document) {
      <div class="publish-panel" role="region" aria-label="Document blog publishing">
        <div class="publish-head">
          <h3>Share via blog</h3>
          <button type="button" class="close" aria-label="Close share panel" [disabled]="busy()" (click)="requestClose()">x</button>
        </div>

        <label class="toggle">
          <input type="checkbox" [checked]="overwrite()" [disabled]="busy()" (change)="setOverwrite($event)" />
          Overwrite an existing generated post at the same path
        </label>

        <div class="actions">
          <button type="button" [disabled]="busy()" (click)="preview()">{{ previewLabel() }}</button>
          <button type="button" class="primary" [disabled]="busy() || !canPublish()" (click)="publish()">{{ publishLabel() }}</button>
        </div>

        @if (errorText()) {
          <div class="error" role="alert">Publish failed: {{ errorText() }}</div>
        }

        @if (published()) {
          @let result = published();
          @if (result) {
            <div class="result" role="status">
              @if (result.public_url) {
                <span>Published to <a [href]="result.public_url" target="_blank" rel="noreferrer">{{ result.public_url }}</a></span>
              } @else {
                <span>Published</span>
              }
              @if (result.git_commit) {
                <span class="commit">commit {{ shortCommit(result.git_commit) }}</span>
              }
            </div>
          }
        }

        @if (previewResult()) {
          @let result = previewResult();
          @if (result) {
            <div class="preview">
              <dl>
                <dt>Post path</dt>
                <dd>{{ result.post_path || 'pending' }}</dd>
                <dt>Public URL</dt>
                <dd>{{ result.public_url || 'pending' }}</dd>
              </dl>
              @if ((result.warnings ?? []).length > 0) {
                <div class="warning">{{ (result.warnings ?? []).join(' ') }}</div>
              }
              @if (result.preview_markdown) {
                <pre>{{ result.preview_markdown }}</pre>
              }
            </div>
          }
        }
      </div>
    }
  `,
})
export class DocumentPublishPanelComponent {
  private readonly store = inject(DOCUMENT_PUBLISH_STORE);

  @Input() document: DenDocumentDetail | null = null;
  @Output() readonly close = new EventEmitter<void>();

  protected readonly overwrite = this.store.overwrite;
  protected readonly previewResult = computed(() => stateValue(this.store.previewResult()) ?? null);
  protected readonly published = computed(() => stateValue(this.store.publishedResult()) ?? null);
  protected readonly busy = computed(() => this.store.previewResult().kind === 'loading' || this.store.publishedResult().kind === 'loading');
  protected readonly canPublish = computed(() => this.previewResult() !== null);
  protected readonly errorText = computed(() => {
    const previewState = this.store.previewResult();
    if (previewState.kind === 'error') return previewState.error.message;
    const publishedState = this.store.publishedResult();
    return publishedState.kind === 'error' ? publishedState.error.message : null;
  });
  protected readonly previewLabel = computed(() => this.store.previewResult().kind === 'loading' ? 'Previewing...' : 'Preview');
  protected readonly publishLabel = computed(() => this.store.publishedResult().kind === 'loading' ? 'Publishing...' : 'Publish');

  protected setOverwrite(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.store.setOverwrite(target.checked);
  }

  protected preview(): void {
    const request = this.request();
    if (request) void this.store.preview(request);
  }

  protected publish(): void {
    const request = this.request();
    if (request) void this.store.publish(request);
  }

  protected requestClose(): void {
    this.store.reset();
    this.close.emit();
  }

  protected shortCommit(commit: string): string {
    return commit.slice(0, 12);
  }

  private request(): DenDocPublishRequest | null {
    const document = this.document;
    if (!document) return null;
    const updatedAt = normalizeDocumentPublishTimestamp(document.updated_at);
    return {
      source: {
        project_id: document.project_id,
        document_project_id: document.project_id,
        document_slug: document.slug,
      },
      options: {
        tags: document.tags ?? [],
        overwrite: this.overwrite(),
      },
      requested_by: 'den-web',
      document: {
        title: document.title,
        slug: document.slug,
        markdown: documentMarkdownBody(document),
        ...(updatedAt ? { updated_at: updatedAt } : {}),
      },
    };
  }
}

function normalizeDocumentPublishTimestamp(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) return `${trimmed}Z`;

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

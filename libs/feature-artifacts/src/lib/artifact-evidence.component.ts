import { Component, input, signal } from '@angular/core';

export type ArtifactEvidenceStatus = 'loading' | 'ready' | 'error';

export interface ArtifactEvidenceItem {
  readonly ref: string;
  readonly label: string;
  readonly status: ArtifactEvidenceStatus;
  readonly contentUrl: string | null;
  readonly error: string | null;
  readonly mimeType: string | null;
  readonly byteCount: string | null;
  readonly dimensions: string | null;
  readonly sha256: string | null;
  readonly sensitive: boolean;
  readonly retention: string | null;
}

@Component({
  selector: 'den-artifact-evidence',
  standalone: true,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .artifacts {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }

    .card {
      border: 1px solid var(--den-border);
      border-radius: 8px;
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(96px, 150px) minmax(0, 1fr);
      padding: 8px;
    }

    .card.sensitive {
      border-color: var(--den-warning-border);
    }

    .thumbnail {
      appearance: none;
      background: var(--den-input);
      border: 1px solid var(--den-border);
      border-radius: 6px;
      cursor: pointer;
      min-height: 90px;
      overflow: hidden;
      padding: 0;
    }

    .thumbnail img {
      display: block;
      height: 100%;
      max-height: 130px;
      object-fit: contain;
      width: 100%;
    }

    .details {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .title {
      font-size: var(--den-font-size-md);
      font-weight: 700;
      line-height: var(--den-line-height-snug);
      overflow-wrap: anywhere;
    }

    dl {
      display: grid;
      gap: 4px 8px;
      grid-template-columns: max-content minmax(0, 1fr);
      margin: 0;
    }

    dt,
    dd,
    .state {
      font-size: var(--den-font-size-sm);
      line-height: var(--den-line-height-snug);
    }

    dt {
      color: var(--den-muted);
      font-weight: 700;
    }

    dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .state {
      color: var(--den-muted);
      margin: 0;
    }

    .error {
      color: var(--den-danger);
    }

    .viewer {
      align-items: center;
      background: color-mix(in srgb, var(--den-surface) 88%, transparent);
      bottom: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      left: 0;
      padding: 18px;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 20;
    }

    .viewer-head {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }

    .viewer-title {
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .close {
      appearance: none;
      background: var(--den-input);
      border: 1px solid var(--den-border);
      border-radius: 6px;
      color: var(--den-text);
      cursor: pointer;
      font: inherit;
      min-height: 34px;
      padding: 0 12px;
    }

    .viewer img {
      align-self: center;
      justify-self: center;
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }

    @media (max-width: 640px) {
      .card {
        grid-template-columns: 1fr;
      }
    }
  `],
  template: `
    @if (items().length > 0) {
      <section class="artifacts" aria-label="Artifact evidence">
        @for (item of items(); track item.ref) {
          <article class="card" [class.sensitive]="item.sensitive">
            @if (item.status === 'ready' && item.contentUrl) {
              <button type="button" class="thumbnail" (click)="open(item)" [attr.aria-label]="'Open artifact ' + item.label">
                <img [src]="item.contentUrl" [alt]="item.label" loading="lazy" />
              </button>
              <div class="details">
                <div class="title">{{ item.label }}</div>
                <dl>
                  <dt>MIME</dt><dd>{{ item.mimeType || 'unknown' }}</dd>
                  <dt>Bytes</dt><dd>{{ item.byteCount || 'unknown' }}</dd>
                  <dt>Dimensions</dt><dd>{{ item.dimensions || 'unknown' }}</dd>
                  <dt>SHA-256</dt><dd>{{ item.sha256 || 'unknown' }}</dd>
                  <dt>Sensitivity</dt><dd>{{ item.sensitive ? 'sensitive' : 'normal' }}</dd>
                  <dt>Retention</dt><dd>{{ item.retention || 'unknown' }}</dd>
                </dl>
              </div>
            } @else if (item.status === 'error') {
              <div class="thumbnail" aria-hidden="true"></div>
              <div class="details">
                <div class="title">{{ item.label }}</div>
                <p class="state error">Artifact unavailable: {{ item.error || 'Unable to load artifact' }}</p>
                <p class="state">{{ item.ref }}</p>
              </div>
            } @else {
              <div class="thumbnail" aria-hidden="true"></div>
              <div class="details">
                <div class="title">{{ item.label }}</div>
                <p class="state">Loading artifact metadata</p>
                <p class="state">{{ item.ref }}</p>
              </div>
            }
          </article>
        }
      </section>
    }

    @if (selected(); as item) {
      <div class="viewer" role="dialog" aria-modal="true" aria-label="Artifact preview">
        <div class="viewer-head">
          <span class="viewer-title">{{ item.label }}</span>
          <button type="button" class="close" (click)="close()">Close</button>
        </div>
        @if (item.contentUrl) {
          <img [src]="item.contentUrl" [alt]="item.label" />
        }
      </div>
    }
  `,
})
export class ArtifactEvidenceComponent {
  readonly items = input<readonly ArtifactEvidenceItem[]>([]);
  protected readonly selected = signal<ArtifactEvidenceItem | null>(null);

  protected open(item: ArtifactEvidenceItem): void {
    this.selected.set(item);
  }

  protected close(): void {
    this.selected.set(null);
  }
}

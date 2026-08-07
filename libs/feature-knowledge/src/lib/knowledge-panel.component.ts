import { Component, computed, effect, inject, signal } from '@angular/core';
import { LocalTimeComponent, MarkdownViewComponent } from '@den-web/components';
import type { DenKnowledgeEntrySummary } from '@den-web/protocol';
import { KNOWLEDGE_STORE, stateValue } from '@den-web/store';
import { knowledgePanelStyles } from './knowledge-panel.styles';

type MobilePane = 'list' | 'detail';

@Component({
  selector: 'den-knowledge-panel',
  standalone: true,
  imports: [LocalTimeComponent, MarkdownViewComponent],
  styles: [knowledgePanelStyles],
  template: `
    <section class="knowledge" aria-label="Knowledge" [class.show-detail]="mobilePane() === 'detail'">
      <aside class="list" aria-label="Knowledge list">
        <header>
          <h2>Knowledge</h2>
          <div class="muted">Global entries</div>
        </header>

        <div class="items">
          @switch (entries().kind) {
            @case ('loading') { <p class="state">Loading knowledge</p> }
            @case ('error') { <p class="state error">{{ errorText(entriesError()) }}</p> }
            @case ('data') {
              @if (entryItems().length === 0) {
                <p class="state">No knowledge entries</p>
              } @else {
                @for (entry of entryItems(); track entry.slug) {
                  <button
                    class="entry-button"
                    data-testid="knowledge-list-item"
                    type="button"
                    [attr.aria-label]="entry.title + ' ' + entry.slug"
                    [attr.aria-pressed]="entry.slug === selectedSlug()"
                    (click)="select(entry)"
                  >
                    <strong class="entry-title">{{ entry.title }}</strong>
                    <span class="meta">{{ entry.slug }}</span>
                    <span class="chips">
                      <span class="chip">{{ entry.kind }}</span>
                      <span class="chip">{{ entry.status }}</span>
                    </span>
                  </button>
                }
              }
            }
            @default { <p class="state">No knowledge loaded</p> }
          }
        </div>
      </aside>

      <article class="detail" aria-label="Knowledge detail">
        @switch (detail().kind) {
          @case ('loading') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showList()">Back to knowledge</button>
              <p class="state">Loading knowledge entry</p>
            </div>
          }
          @case ('error') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showList()">Back to knowledge</button>
              <p class="state error">{{ errorText(detailError()) }}</p>
            </div>
          }
          @case ('data') {
            @let entry = detailValue();
            @if (entry) {
              <header>
                <button type="button" class="mobile-back" (click)="showList()">Back to knowledge</button>
                <h3>{{ entry.title }}</h3>
                <div class="meta">{{ entry.slug }} · global</div>
              </header>

              <div class="detail-body">
                <section class="section" aria-label="Knowledge metadata">
                  <div class="meta-grid">
                    <div class="meta-item"><span class="label">Kind</span><span class="value">{{ entry.kind }}</span></div>
                    <div class="meta-item"><span class="label">Status</span><span class="value">{{ entry.status }}</span></div>
                    <div class="meta-item"><span class="label">Curation</span><span class="value">{{ entry.curation_state }}</span></div>
                    <div class="meta-item"><span class="label">Updated</span><span class="value"><den-local-time [value]="entry.updated_at" [relative]="false" /></span></div>
                    <div class="meta-item"><span class="label">Created</span><span class="value"><den-local-time [value]="entry.created_at" [relative]="false" /></span></div>
                    <div class="meta-item"><span class="label">Tags</span><span class="value">{{ tagList(entry.tags) }}</span></div>
                    <div class="meta-item"><span class="label">Audience</span><span class="value">{{ tagList(entry.audience) }}</span></div>
                  </div>
                  @if (entry.summary) { <p class="summary">{{ entry.summary }}</p> }
                  @if (entry.accuracy_notes) { <p class="summary">{{ entry.accuracy_notes }}</p> }
                </section>

                <section class="section" aria-label="Knowledge content">
                  <div class="section-head"><h3>Content</h3><span class="muted">{{ entry.body_markdown.length }} chars</span></div>
                  <den-markdown-view [content]="entry.body_markdown" />
                </section>

                <section class="section" aria-label="Knowledge sources">
                  <div class="section-head"><h3>Sources</h3><span class="muted">{{ entry.source_refs?.length ?? 0 }}</span></div>
                  @if (!entry.source_refs || entry.source_refs.length === 0) {
                    <p class="state">No source references</p>
                  } @else {
                    <div class="source-list">
                      @for (source of entry.source_refs; track source.source_kind + source.source_id) {
                        <article class="source-ref">
                          <strong>{{ source.source_kind }} · {{ source.source_id }}</strong>
                          @if (source.project_id) { <span class="meta">Project: {{ source.project_id }}</span> }
                          @if (source.note) { <span>{{ source.note }}</span> }
                          @if (source.url) { <a [href]="source.url" target="_blank" rel="noreferrer">{{ source.url }}</a> }
                        </article>
                      }
                    </div>
                  }
                </section>
              </div>
            }
          }
          @default {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showList()">Back to knowledge</button>
              <p class="state">Select a knowledge entry</p>
            </div>
          }
        }
      </article>
    </section>
  `,
})
export class KnowledgePanelComponent {
  private readonly store = inject(KNOWLEDGE_STORE);

  protected readonly entries = this.store.entries;
  protected readonly detail = this.store.detail;
  protected readonly selected = this.store.selected;
  protected readonly mobilePane = signal<MobilePane>('list');
  protected readonly entryItems = computed(() => stateValue(this.entries()) ?? []);
  protected readonly detailValue = computed(() => stateValue(this.detail()) ?? null);
  protected readonly selectedSlug = computed(() => this.selected()?.slug ?? null);
  protected readonly entriesError = computed(() => errorOf(this.entries()));
  protected readonly detailError = computed(() => errorOf(this.detail()));

  constructor() {
    void this.store.refresh();
    effect(() => {
      const firstEntry = this.entryItems()[0];
      if (firstEntry && !this.selected()) queueMicrotask(() => void this.store.select(firstEntry));
    });
  }

  protected select(entry: DenKnowledgeEntrySummary): void {
    void this.store.select(entry);
    this.mobilePane.set('detail');
  }

  protected showList(): void {
    this.mobilePane.set('list');
  }

  protected tagList(values: readonly string[] | null | undefined): string {
    return values && values.length > 0 ? values.join(', ') : 'none';
  }

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load';
  }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}

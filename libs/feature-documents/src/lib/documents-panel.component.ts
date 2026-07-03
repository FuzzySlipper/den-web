import { Component, computed, effect, inject, signal } from '@angular/core';
import { MarkdownEditorDialogComponent, MarkdownViewComponent } from '@den-web/components';
import { discussionAuthor, discussionBody, discussionThreads, documentMarkdownBody } from '@den-web/domain';
import type { DenDocumentSummary } from '@den-web/protocol';
import { DOCUMENTS_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';
import { DocumentPublishPanelComponent } from './document-publish-panel.component';
import { documentsPanelStyles } from './documents-panel.styles';

type MobilePane = 'list' | 'detail';

@Component({
  selector: 'den-documents-panel',
  standalone: true,
  imports: [DocumentPublishPanelComponent, MarkdownEditorDialogComponent, MarkdownViewComponent],
  styles: [documentsPanelStyles],
  template: `
    <section class="documents" aria-label="Documents" [class.show-detail]="mobilePane() === 'detail'">
      <aside class="list" aria-label="Document list">
        <header>
          <h2>Documents</h2>
          <div class="muted">{{ selectedProjectId() || 'Select a project' }}</div>
        </header>

        <div class="items">
          @switch (documents().kind) {
            @case ('loading') { <p class="state">Loading documents</p> }
            @case ('error') { <p class="state error">{{ errorText(documentsError()) }}</p> }
            @case ('data') {
              @if (documentItems().length === 0) {
                <p class="state">No documents</p>
              } @else {
                @for (document of documentItems(); track documentIdentity(document)) {
                  <button
                    class="doc-button"
                    data-testid="document-list-item"
                    type="button"
                    [attr.aria-pressed]="documentIdentity(document) === selectedIdentity()"
                    (click)="select(document)"
                  >
                    <strong class="doc-title">{{ document.title }}</strong>
                    <span class="meta">{{ document.slug }}</span>
                    <span class="chips">
                      @if (document.doc_type) { <span class="chip">{{ document.doc_type }}</span> }
                      @if (document.updated_at) { <span class="chip">{{ shortDate(document.updated_at) }}</span> }
                    </span>
                  </button>
                }
              }
            }
            @default { <p class="state">Select a project</p> }
          }
        </div>
      </aside>

      <article class="detail" aria-label="Document detail">
        @switch (detail().kind) {
          @case ('loading') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showDocumentList()">Back to documents</button>
              <p class="state">Loading document</p>
            </div>
          }
          @case ('error') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showDocumentList()">Back to documents</button>
              <p class="state error">{{ errorText(detailError()) }}</p>
            </div>
          }
          @case ('data') {
            @let doc = detailValue();
            @if (doc) {
              <header>
                <button type="button" class="mobile-back" (click)="showDocumentList()">Back to documents</button>
                <h3>{{ doc.title }}</h3>
                <div class="meta">{{ doc.project_id }} / {{ doc.slug }}</div>
              </header>

              <div class="detail-body">
                <section class="section metadata-section" aria-label="Document metadata">
                  <div class="meta-grid">
                    <div class="meta-item tags-item">
                      <span class="label">Type</span>
                      <span class="value">{{ doc.doc_type || 'document' }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">Visibility</span>
                      <span class="value">{{ doc.visibility || 'normal' }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">Updated</span>
                      <span class="value">{{ doc.updated_at ? displayDate(doc.updated_at) : 'unknown' }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">Tags</span>
                      <span class="value">{{ tagList(doc.tags) }}</span>
                    </div>
                  </div>
                  @if (doc.summary) {
                    <p class="summary">{{ doc.summary }}</p>
                  }
                </section>

                <section class="section" aria-label="Document content">
                  <div class="section-head">
                    <h3>Content</h3>
                    <div class="section-actions">
                      <span class="muted">{{ body().length }} chars</span>
                      <button type="button" class="edit-button" [disabled]="contentEditorOpen()" (click)="openPublishPanel()">Share via blog</button>
                      <button type="button" class="edit-button" (click)="openContentEditor()">Edit</button>
                    </div>
                  </div>
                  @if (publishPanelOpen()) {
                    <den-document-publish-panel [document]="doc" (close)="closePublishPanel()" />
                  }
                  @if (editError()) {
                    <p class="state error">{{ editError() }}</p>
                  }
                  <den-markdown-view [content]="body()" />
                </section>

                <section class="section" aria-label="Discussion">
                  <div class="section-head">
                    <h3>Discussion</h3>
                    <span class="muted">{{ commentCount() }} comments</span>
                  </div>
                  @switch (discussion().kind) {
                    @case ('loading') { <p class="state">Loading discussion</p> }
                    @case ('error') { <p class="state error">{{ errorText(discussionError()) }}</p> }
                    @case ('data') {
                      @if (threads().length === 0) {
                        <p class="state">No discussion comments</p>
                      } @else {
                        @for (thread of threads(); track thread.comment.id) {
                          <article class="comment">
                            <strong>{{ author(thread.comment) }}</strong>
                            <span class="comment-body">{{ commentBody(thread.comment) }}</span>
                            @for (reply of thread.replies; track reply.id) {
                              <div class="reply">
                                <strong>{{ author(reply) }}</strong>
                                <span class="comment-body">{{ commentBody(reply) }}</span>
                              </div>
                            }
                          </article>
                        }
                      }
                    }
                    @default { <p class="state">No document selected</p> }
                  }
                </section>
              </div>
            }
          }
          @default {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showDocumentList()">Back to documents</button>
              <p class="state">Select a document</p>
            </div>
          }
        }
      </article>

      <den-markdown-editor-dialog
        title="Edit Document"
        [open]="contentEditorOpen()"
        [value]="contentDraft()"
        (cancel)="closeContentEditor()"
        (done)="saveContent($event)"
      />
    </section>
  `,
})
export class DocumentsPanelComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly store = inject(DOCUMENTS_STORE);
  private loadedProjectId: string | null = null;

  protected readonly documents = this.store.documents;
  protected readonly detail = this.store.detail;
  protected readonly discussion = this.store.discussion;
  protected readonly selected = this.store.selected;
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly contentEditorOpen = signal(false);
  protected readonly contentDraft = signal('');
  protected readonly publishPanelOpen = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly mobilePane = signal<MobilePane>('list');
  protected readonly documentItems = computed(() => stateValue(this.documents()) ?? []);
  protected readonly detailValue = computed(() => stateValue(this.detail()) ?? null);
  protected readonly body = computed(() => {
    const detail = this.detailValue();
    return detail ? documentMarkdownBody(detail) : '';
  });
  protected readonly threads = computed(() => discussionThreads(stateValue(this.discussion())));
  protected readonly commentCount = computed(() => stateValue(this.discussion())?.comments?.length ?? 0);
  protected readonly selectedIdentity = computed(() => {
    const selected = this.selected();
    return selected ? this.documentIdentity(selected) : null;
  });
  protected readonly documentsError = computed(() => errorOf(this.documents()));
  protected readonly detailError = computed(() => errorOf(this.detail()));
  protected readonly discussionError = computed(() => errorOf(this.discussion()));

  private readonly refreshEffect = effect(() => {
    const projectId = this.workspace.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    this.mobilePane.set('list');
    queueMicrotask(() => void this.store.refresh(projectId));
  });

  private readonly autoSelectEffect = effect(() => {
    const first = this.documentItems()[0];
    if (!first || this.selected()) return;
    queueMicrotask(() => void this.store.select(first));
  });

  protected select(document: DenDocumentSummary): void {
    void this.store.select(document);
    this.mobilePane.set('detail');
  }

  protected showDocumentList(): void {
    this.mobilePane.set('list');
  }

  protected openPublishPanel(): void {
    this.publishPanelOpen.set(true);
  }

  protected closePublishPanel(): void {
    this.publishPanelOpen.set(false);
  }

  protected openContentEditor(): void {
    this.contentDraft.set(this.body());
    this.editError.set(null);
    this.store.setDirty(true);
    this.contentEditorOpen.set(true);
  }

  protected closeContentEditor(): void {
    this.contentEditorOpen.set(false);
    this.store.setDirty(false);
  }

  protected saveContent(contentMarkdown: string): void {
    const document = this.detailValue();
    if (!document) return;
    void this.store.updateDocumentContent(document.project_id, document.slug, contentMarkdown).then((result) => {
      this.editError.set(result.ok ? null : this.errorText(result.error));
      if (result.ok) this.contentEditorOpen.set(false);
    });
  }

  protected documentIdentity(document: DenDocumentSummary): string {
    return `${document.project_id}/${document.slug}`;
  }

  protected tagList(tags: readonly string[] | null | undefined): string {
    return tags && tags.length > 0 ? tags.join(', ') : 'none';
  }

  protected displayDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  protected shortDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  protected author = discussionAuthor;
  protected commentBody = discussionBody;

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load';
  }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}

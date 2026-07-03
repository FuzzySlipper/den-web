import { Component, computed, effect, inject } from '@angular/core';
import {
  artifactDimensions,
  artifactDisplayName,
  artifactRetentionLabel,
  formatArtifactByteCount,
  type ArtifactReference,
  type MessageViewItem,
} from '@den-web/domain';
import { ArtifactEvidenceComponent, type ArtifactEvidenceItem } from '@den-web/feature-artifacts';
import { ARTIFACTS_STORE, MESSAGES_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';

@Component({
  selector: 'den-messages-inbox',
  standalone: true,
  imports: [ArtifactEvidenceComponent],
  styles: [`
    .surface { display: grid; gap: 14px; padding: 20px; }
    h2 { margin: 0; font-size: var(--den-font-size-xl); }
    .grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; }
    .panel, .item { background: var(--den-panel); border: 1px solid var(--den-border); border-radius: 8px; }
    .panel { padding: 12px; display: grid; gap: 10px; }
    .item { padding: 10px; text-align: left; }
    button.item { cursor: pointer; }
    button.item[aria-pressed='true'] { background: var(--den-selected); border-color: var(--den-accent); }
    .muted, .state { color: var(--den-muted); font-size: var(--den-font-size-md); }
    .error { color: var(--den-danger); }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `],
  template: `
    <section class="surface" aria-label="Messages">
      <h2>Messages</h2>
      <div class="grid">
        <div class="panel">
          <strong>Inbox</strong>
          @switch (inbox().kind) {
            @case ('loading') { <p class="state">Loading messages</p> }
            @case ('error') { <p class="state error">{{ errorText(inboxError()) }}</p> }
            @case ('data') {
              @if (inboxItems().length === 0) { <p class="state">No messages</p> }
              @for (message of inboxItems(); track message.id) {
                <button class="item" type="button" [attr.aria-pressed]="message.id === selectedThreadId()" (click)="select(message)">
                  <strong>{{ message.intentLabel }}</strong>
                  <span class="muted">{{ message.sender }} · {{ message.body }}</span>
                </button>
              }
            }
            @default { <p class="state">Select a project</p> }
          }
        </div>
        <div class="panel">
          <strong>Thread</strong>
          @switch (thread().kind) {
            @case ('loading') { <p class="state">Loading thread</p> }
            @case ('error') { <p class="state error">{{ errorText(threadError()) }}</p> }
            @case ('data') {
              @if (threadItems().length === 0) { <p class="state">No thread messages</p> }
              @for (message of threadItems(); track message.id) {
                <article class="item">
                  <strong>{{ message.sender }}</strong>
                  <span class="muted">{{ message.body }}</span>
                  <den-artifact-evidence [items]="artifactEvidenceItems(message.artifactRefs)" />
                </article>
              }
            }
            @default { <p class="state">Select a message</p> }
          }
        </div>
      </div>
    </section>
  `,
})
export class MessagesInboxComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly store = inject(MESSAGES_STORE);
  private readonly artifacts = inject(ARTIFACTS_STORE);
  private loadedProjectId: string | null = null;
  protected readonly inbox = this.store.inbox;
  protected readonly thread = this.store.thread;
  protected readonly selectedThreadId = this.store.selectedThreadId;
  protected readonly inboxItems = computed(() => stateValue(this.inbox()) ?? []);
  protected readonly threadItems = computed(() => stateValue(this.thread()) ?? []);
  protected readonly inboxError = computed(() => errorOf(this.inbox()));
  protected readonly threadError = computed(() => errorOf(this.thread()));

  private readonly refreshEffect = effect(() => {
    const projectId = this.workspace.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    queueMicrotask(() => void this.store.refresh(projectId));
  });

  private readonly artifactLoadEffect = effect(() => {
    for (const message of this.threadItems()) {
      for (const ref of message.artifactRefs) void this.artifacts.load(ref.ref);
    }
  });

  protected select(message: MessageViewItem): void {
    const projectId = this.workspace.selectedProjectId();
    if (projectId) void this.store.selectThread(projectId, message.id);
  }
  protected artifactEvidenceItems(refs: readonly ArtifactReference[]): readonly ArtifactEvidenceItem[] {
    return refs.map((ref) => {
      const state = this.artifacts.stateFor(ref.ref);
      const metadata = stateValue(state) ?? null;
      return {
        ref: ref.ref,
        label: artifactDisplayName(ref, metadata),
        status: state.kind === 'error' ? 'error' : metadata ? 'ready' : 'loading',
        contentUrl: metadata ? this.artifacts.contentUrl(metadata) : null,
        error: state.kind === 'error' ? state.error.message : null,
        mimeType: metadata?.mime_type ?? ref.mimeType,
        byteCount: metadata ? formatArtifactByteCount(metadata.byte_count) : null,
        dimensions: metadata ? artifactDimensions(metadata) : null,
        sha256: metadata?.sha256 ?? null,
        sensitive: metadata?.sensitive ?? ref.sensitive ?? false,
        retention: metadata ? artifactRetentionLabel(metadata) : null,
      };
    });
  }
  protected errorText(error: { readonly kind: string; readonly message: string } | null): string { return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load'; }
}

function errorOf<T>(state: { readonly kind: string; readonly error?: T }): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}

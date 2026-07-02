import { Component, computed, inject, signal } from '@angular/core';
import { LIBRARIAN_STORE, stateValue, WORKSPACE_STORE } from '@den-web/store';

@Component({
  selector: 'den-librarian-panel',
  standalone: true,
  styles: [`
    .surface { display: grid; gap: 14px; padding: 20px; }
    h2 { margin: 0; font-size: var(--den-font-size-xl); }
    .panel { background: var(--den-panel); border: 1px solid var(--den-border); border-radius: 8px; padding: 12px; display: grid; gap: 10px; }
    input { min-height: 38px; border: 1px solid var(--den-border); border-radius: 6px; padding: 0 10px; font: inherit; }
    button { border: 1px solid var(--den-border); border-radius: 6px; background: var(--den-input); min-height: 36px; padding: 0 10px; justify-self: start; }
    .muted, .state { color: var(--den-muted); font-size: var(--den-font-size-md); }
    .error { color: var(--den-danger); }
  `],
  template: `
    <section class="surface" aria-label="Librarian">
      <h2>Librarian</h2>
      <div class="panel">
        <input aria-label="Librarian query" placeholder="Ask about this project" [value]="draft()" (input)="setDraft($event)" />
        <button type="button" (click)="submit()">Query</button>
        @switch (result().kind) {
          @case ('loading') { <p class="state">Searching</p> }
          @case ('error') { <p class="state error">{{ errorText(error()) }}</p> }
          @case ('data') {
            <strong>{{ answer() || 'No answer' }}</strong>
            <span class="muted">{{ sourceCount() }} sources</span>
          }
          @default { <p class="state">Ready for a project-scoped query</p> }
        }
      </div>
    </section>
  `,
})
export class LibrarianPanelComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly store = inject(LIBRARIAN_STORE);
  protected readonly draft = signal('');
  protected readonly result = this.store.result;
  protected readonly value = computed(() => stateValue(this.result()) ?? null);
  protected readonly answer = computed(() => this.value()?.answer ?? '');
  protected readonly sourceCount = computed(() => this.value()?.sources?.length ?? 0);
  protected readonly error = computed(() => {
    const state = this.result();
    return state.kind === 'error' ? state.error : null;
  });
  protected setDraft(event: Event): void { if (event.target instanceof HTMLInputElement) this.draft.set(event.target.value); }
  protected submit(): void {
    const projectId = this.workspace.selectedProjectId();
    if (projectId) void this.store.submit(projectId, this.draft());
  }
  protected errorText(error: { readonly kind: string; readonly message: string } | null): string { return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load'; }
}

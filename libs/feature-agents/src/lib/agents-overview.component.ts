import { Component, computed, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { AGENTS_STORE, stateValue } from '@den-web/store';

@Component({
  selector: 'den-agents-overview',
  standalone: true,
  styles: [`
    .surface { display: grid; gap: 14px; padding: 20px; }
    h2 { margin: 0; font-size: var(--den-font-size-xl); }
    .item { background: var(--den-panel); border: 1px solid var(--den-border); border-radius: 8px; padding: 12px; display: grid; gap: 6px; }
    .muted, .state { color: var(--den-muted); font-size: var(--den-font-size-md); }
    .error { color: var(--den-danger); }
  `],
  template: `
    <section class="surface" aria-label="Agents">
      <h2>Agents</h2>
      @if (degraded()) { <p class="state">Observation source is degraded; unsupported worker management is intentionally absent.</p> }
      @switch (overview().kind) {
        @case ('loading') { <p class="state">Loading agents</p> }
        @case ('error') { <p class="state error">{{ errorText(error()) }}</p> }
        @case ('data') {
          @if (items().length === 0) { <p class="state">No observed agent activity</p> }
          @for (item of items(); track item.id) {
            <article class="item">
              <strong>{{ item.identity }}</strong>
              <span class="muted">{{ item.title }} · {{ item.severity }}</span>
              <span class="muted">{{ item.summary }}</span>
            </article>
          }
          @for (source of health(); track source.source) {
            <article class="item"><strong>{{ source.source }}</strong><span class="muted">{{ source.status }} {{ source.detail || '' }}</span></article>
          }
        }
        @default { <p class="state">Ready</p> }
      }
    </section>
  `,
})
export class AgentsOverviewComponent implements OnInit {
  private readonly store = inject(AGENTS_STORE);
  protected readonly overview = this.store.overview;
  protected readonly degraded = this.store.degraded;
  protected readonly model = computed(() => stateValue(this.overview()) ?? null);
  protected readonly items = computed(() => this.model()?.items ?? []);
  protected readonly health = computed(() => this.model()?.health ?? []);
  protected readonly error = computed(() => {
    const state = this.overview();
    return state.kind === 'error' ? state.error : null;
  });
  ngOnInit(): void { void this.store.refresh(); }
  protected errorText(error: { readonly kind: string; readonly message: string } | null): string { return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load'; }
}

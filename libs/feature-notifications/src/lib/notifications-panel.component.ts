import { Component, computed, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import type { NotificationViewItem } from '@den-web/domain';
import { NOTIFICATIONS_STORE, stateValue } from '@den-web/store';

@Component({
  selector: 'den-notifications-panel',
  standalone: true,
  styles: [`
    .surface { display: grid; gap: 14px; padding: 20px; }
    h2 { margin: 0; font-size: var(--den-font-size-xl); }
    .item { background: var(--den-panel); border: 1px solid var(--den-border); border-radius: 8px; padding: 12px; display: grid; gap: 6px; }
    .muted, .state { color: var(--den-muted); font-size: var(--den-font-size-md); }
    .error { color: var(--den-danger); }
    button { border: 1px solid var(--den-border); border-radius: 6px; background: var(--den-input); min-height: 34px; padding: 0 10px; justify-self: start; }
  `],
  template: `
    <section class="surface" aria-label="Notifications">
      <h2>Notifications</h2>
      <div class="muted">{{ unreadCount() }} unread</div>
      @switch (notifications().kind) {
        @case ('loading') { <p class="state">Loading notifications</p> }
        @case ('error') { <p class="state error">{{ errorText(error()) }}</p> }
        @case ('data') {
          @if (items().length === 0) { <p class="state">No notifications</p> }
          @for (item of items(); track item.id) {
            <article class="item">
              <strong>{{ item.summary }}</strong>
              <span class="muted">{{ item.source }} · {{ item.severity }} · {{ item.read ? 'read' : 'unread' }}</span>
              @if (!item.read) { <button type="button" (click)="markRead(item)">Mark read</button> }
            </article>
          }
        }
        @default { <p class="state">Ready</p> }
      }
    </section>
  `,
})
export class NotificationsPanelComponent implements OnInit {
  private readonly store = inject(NOTIFICATIONS_STORE);
  protected readonly notifications = this.store.notifications;
  protected readonly unreadCount = this.store.unreadCount;
  protected readonly items = computed(() => stateValue(this.notifications()) ?? []);
  protected readonly error = computed(() => {
    const state = this.notifications();
    return state.kind === 'error' ? state.error : null;
  });

  ngOnInit(): void { void this.store.refresh(); }
  protected markRead(item: NotificationViewItem): void { void this.store.markRead([item.id]); }
  protected errorText(error: { readonly kind: string; readonly message: string } | null): string { return error ? `${error.kind}: ${error.message}` : 'unknown: Unable to load'; }
}

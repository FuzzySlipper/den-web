import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { PREFERENCES_STORE } from '@den-web/store';

@Component({
  selector: 'den-preferences-panel',
  standalone: true,
  styles: [`
    .surface { display: grid; gap: 14px; padding: 20px; }
    h2 { margin: 0; font-size: var(--den-font-size-xl); }
    .panel { background: var(--den-panel); border: 1px solid var(--den-border); border-radius: 8px; padding: 12px; display: grid; gap: 12px; max-width: 520px; }
    label { display: flex; align-items: center; gap: 10px; color: var(--den-text); }
    select { min-height: 36px; border: 1px solid var(--den-border); border-radius: 6px; padding: 0 10px; font: inherit; }
    .muted { color: var(--den-muted); font-size: var(--den-font-size-md); }
  `],
  template: `
    <section class="surface" aria-label="Preferences">
      <h2>Preferences</h2>
      <div class="panel">
        <label>
          Density
          <select aria-label="Density" [value]="preferences().density" (change)="setDensity($event)">
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label>
          <input type="checkbox" [checked]="preferences().theme === 'dark'" (change)="setTheme($event)" />
          Dark mode
        </label>
        <label>
          <input type="checkbox" [checked]="preferences().highContrast" (change)="setContrast($event)" />
          High contrast
        </label>
        <p class="muted">Preferences persist through the platform storage port and apply through document effects.</p>
      </div>
    </section>
  `,
})
export class PreferencesPanelComponent implements OnInit {
  private readonly store = inject(PREFERENCES_STORE);
  protected readonly preferences = this.store.preferences;
  ngOnInit(): void { this.store.apply(); }
  protected setDensity(event: Event): void {
    if (event.target instanceof HTMLSelectElement) this.store.setDensity(event.target.value === 'compact' ? 'compact' : 'comfortable');
  }
  protected setTheme(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.store.setTheme(event.target.checked ? 'dark' : 'light');
  }
  protected setContrast(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.store.setHighContrast(event.target.checked);
  }
}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'den-root',
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--den-bg);
        color: var(--den-text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .app {
        box-sizing: border-box;
        display: grid;
        gap: 16px;
        min-height: 100vh;
        padding: 20px;
      }

      h1 {
        font-size: 18px;
        line-height: 1.2;
        margin: 0;
      }
    `,
  ],
  template: `
    <main class="app">
      <h1>Den Web</h1>
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {}

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
        font-family: var(--den-font-family);
        font-size: var(--den-font-size-base);
        line-height: var(--den-line-height-base);
      }

      .app {
        box-sizing: border-box;
        display: grid;
        gap: 16px;
        min-height: 100vh;
        padding: 20px;
      }

      h1 {
        font-size: var(--den-font-size-lg);
        line-height: var(--den-line-height-tight);
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

import { Component, effect, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ProjectWorkspacePanelComponent } from '@den-web/feature-projects';
import {
  NAVIGATION_STORE,
  PREFERENCES_STORE,
  type DenWebTab,
} from '@den-web/store';

interface NavItem {
  readonly id: DenWebTab;
  readonly label: string;
}

interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

const navGroups: readonly NavGroup[] = [
  {
    label: 'Operate',
    items: [
      { id: 'tasks', label: 'Tasks' },
      { id: 'conversation', label: 'Conversation' },
      { id: 'messages', label: 'Messages' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    label: 'Library',
    items: [
      { id: 'documents', label: 'Documents' },
      { id: 'board', label: 'Board' },
      { id: 'knowledge', label: 'Knowledge' },
      { id: 'guidance', label: 'Guidance' },
      { id: 'librarian', label: 'Librarian' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'agents', label: 'Agents' },
      { id: 'visual-contract', label: 'Visual proof' },
      { id: 'preferences', label: 'Preferences' },
    ],
  },
];

@Component({
  imports: [
    ProjectWorkspacePanelComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
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

      .shell {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
        height: 100dvh;
        overflow: hidden;
      }

      .rail {
        background: var(--den-panel);
        border-bottom: 1px solid var(--den-border);
        border-right: 1px solid var(--den-border);
        display: flex;
        flex-direction: column;
        gap: 10px;
        grid-column: 1;
        grid-row: 1;
        max-height: 100%;
        min-height: 0;
        overflow-y: auto;
        padding: 12px 10px;
      }

      .brand {
        font-size: var(--den-font-size-md);
        font-weight: 600;
        line-height: var(--den-line-height-tight);
        margin: 0;
        padding: 0 4px;
      }

      .rail-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .rail-group-label {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        letter-spacing: 0.06em;
        padding: 0 4px 2px;
        text-transform: uppercase;
      }

      .nav-item {
        border-radius: 6px;
        color: var(--den-muted);
        display: block;
        font-size: var(--den-font-size-md);
        overflow: hidden;
        padding: 6px 8px;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nav-item:hover {
        color: var(--den-text);
      }

      .nav-item[aria-current='page'] {
        background: var(--den-selected);
        color: var(--den-text);
      }

      .workspace {
        background: var(--den-panel);
        grid-column: 1;
        grid-row: 2;
        min-height: 0;
        overflow: hidden;
      }

      .main {
        background: var(--den-surface);
        grid-column: 2;
        grid-row: 1 / -1;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }

      @media (max-width: 840px) {
        .shell {
          display: flex;
          flex-direction: column;
          height: auto;
          overflow: visible;
        }

        .rail {
          border-bottom: 1px solid var(--den-border);
          border-right: 0;
          flex-direction: row;
          gap: 6px;
          max-height: none;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px;
        }

        .brand {
          display: none;
        }

        .rail-group {
          flex-direction: row;
        }

        .rail-group-label {
          display: none;
        }

        .nav-item {
          flex: 0 0 auto;
          padding: 6px 9px;
        }

        .workspace {
          border-bottom: 1px solid var(--den-border);
        }

        .main {
          min-height: calc(100vh - 250px);
        }
      }
    `,
  ],
  template: `
    <div class="shell">
      <nav class="rail" aria-label="Primary">
        <h1 class="brand">Den Web</h1>
        @for (group of navGroups; track group.label) {
          <div class="rail-group" [attr.aria-label]="group.label">
            <span class="rail-group-label">{{ group.label }}</span>
            @for (item of group.items; track item.id) {
              <a
                class="nav-item"
                [routerLink]="['/', item.id]"
                routerLinkActive
                ariaCurrentWhenActive="page"
              >
                {{ item.label }}
              </a>
            }
          </div>
        }
      </nav>
      <section class="workspace">
        <den-project-workspace-panel />
      </section>
      <section class="main">
        <router-outlet />
      </section>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  private readonly preferencesStore = inject(PREFERENCES_STORE);
  private readonly navigationStore = inject(NAVIGATION_STORE);
  private readonly router = inject(Router);

  protected readonly navGroups = navGroups;

  private readonly tabRequestEffect = effect(() => {
    const tab = this.navigationStore.activeTabRequest();
    if (!tab) return;
    queueMicrotask(() => {
      void this.router.navigate(['/', tab]);
      this.navigationStore.clearActiveTabRequest();
    });
  });

  ngOnInit(): void {
    this.preferencesStore.apply();
  }
}

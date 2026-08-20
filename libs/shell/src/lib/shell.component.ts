import { Component, effect, inject, signal } from '@angular/core';
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

const operateGroup: NavGroup = {
  label: 'Operate',
  items: [
    { id: 'tasks', label: 'Tasks' },
    { id: 'conversation', label: 'Conversation' },
    { id: 'messages', label: 'Messages' },
    { id: 'notifications', label: 'Notifications' },
  ],
};

const libraryGroup: NavGroup = {
  label: 'Library',
  items: [
    { id: 'documents', label: 'Documents' },
    { id: 'board', label: 'Board' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'guidance', label: 'Guidance' },
    { id: 'librarian', label: 'Librarian' },
  ],
};

const adminGroup: NavGroup = {
  label: 'Admin',
  items: [
    { id: 'agents', label: 'Agents' },
    { id: 'visual-contract', label: 'Visual proof' },
    { id: 'preferences', label: 'Preferences' },
  ],
};

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
        grid-template-columns: 112px auto minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        height: 100dvh;
        overflow: hidden;
      }

      .rail {
        background: var(--den-panel);
        border-right: 1px solid var(--den-border);
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        overflow-y: auto;
        padding: 10px 6px;
      }

      .brand {
        font-size: var(--den-font-size-md);
        font-weight: 600;
        line-height: var(--den-line-height-tight);
        margin: 0;
        overflow: hidden;
        text-align: center;
        text-overflow: ellipsis;
      }

      .rail-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .rail-group.admin {
        margin-top: auto;
      }

      .rail-group-label {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        letter-spacing: 0.06em;
        padding: 0 4px 2px;
        text-align: center;
        text-transform: uppercase;
      }

      .nav-item {
        border-radius: 6px;
        color: var(--den-muted);
        display: block;
        font-size: var(--den-font-size-sm);
        overflow: hidden;
        padding: 6px 4px;
        text-align: center;
        text-decoration: none;
        text-overflow: ellipsis;
      }

      .nav-item:hover {
        color: var(--den-text);
      }

      .nav-item[aria-current='page'] {
        background: var(--den-selected);
        color: var(--den-text);
      }

      .workspace-toggle {
        appearance: none;
        background: transparent;
        border: 1px solid var(--den-border);
        border-radius: 6px;
        color: var(--den-muted);
        cursor: pointer;
        font-size: var(--den-font-size-xs);
        padding: 5px 4px;
      }

      .workspace-toggle:hover {
        color: var(--den-text);
      }

      .workspace {
        background: var(--den-panel);
        border-right: 1px solid var(--den-border);
        min-height: 0;
        overflow: hidden;
        width: 280px;
      }

      .main {
        background: var(--den-surface);
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
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px;
        }

        .brand {
          display: none;
        }

        .rail-group,
        .rail-group.admin {
          flex-direction: row;
          margin-top: 0;
        }

        .rail-group-label {
          display: none;
        }

        .nav-item {
          flex: 0 0 auto;
          font-size: var(--den-font-size-md);
          padding: 6px 9px;
        }

        .workspace-toggle {
          align-self: center;
          flex: 0 0 auto;
        }

        .workspace {
          border-bottom: 1px solid var(--den-border);
          border-right: 0;
          max-height: 190px;
          width: auto;
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
          <div
            class="rail-group"
            [class.admin]="group.label === 'Admin'"
            [attr.aria-label]="group.label"
          >
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
        <button
          type="button"
          class="workspace-toggle"
          [attr.aria-label]="
            workspaceOpen() ? 'Collapse workspace panel' : 'Expand workspace panel'
          "
          [attr.aria-expanded]="workspaceOpen()"
          aria-controls="workspace-panel"
          (click)="toggleWorkspace()"
        >
          {{ workspaceOpen() ? '«' : '»' }}
        </button>
      </nav>
      @if (workspaceOpen()) {
        <section class="workspace" id="workspace-panel">
          <den-project-workspace-panel />
        </section>
      }
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

  protected readonly navGroups: readonly NavGroup[] = [
    operateGroup,
    libraryGroup,
    adminGroup,
  ];
  protected readonly workspaceOpen = signal(true);

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

  protected toggleWorkspace(): void {
    this.workspaceOpen.update((open) => !open);
  }
}

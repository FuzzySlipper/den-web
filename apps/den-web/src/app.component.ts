import { Component, effect, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentsOverviewComponent } from '@den-web/feature-agents';
import { ConversationCockpitComponent } from '@den-web/feature-conversation';
import { DocumentsPanelComponent } from '@den-web/feature-documents';
import { LibrarianPanelComponent } from '@den-web/feature-librarian';
import { MessagesInboxComponent } from '@den-web/feature-messages';
import { NotificationsPanelComponent } from '@den-web/feature-notifications';
import { PreferencesPanelComponent } from '@den-web/feature-preferences';
import { ProjectWorkspacePanelComponent } from '@den-web/feature-projects';
import { TaskCockpitComponent } from '@den-web/feature-tasks';
import { NAVIGATION_STORE, PREFERENCES_STORE, type DenWebTab } from '@den-web/store';

type CockpitTab = DenWebTab;

interface TabItem {
  readonly id: CockpitTab;
  readonly label: string;
}

const tabs: readonly TabItem[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'messages', label: 'Messages' },
  { id: 'documents', label: 'Documents' },
  { id: 'librarian', label: 'Librarian' },
  { id: 'agents', label: 'Agents' },
  { id: 'preferences', label: 'Preferences' },
];

@Component({
  imports: [
    AgentsOverviewComponent,
    ConversationCockpitComponent,
    DocumentsPanelComponent,
    LibrarianPanelComponent,
    MessagesInboxComponent,
    NotificationsPanelComponent,
    PreferencesPanelComponent,
    ProjectWorkspacePanelComponent,
    RouterOutlet,
    TaskCockpitComponent,
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

      .app {
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        min-height: 100vh;
      }

      .topbar {
        align-items: center;
        background: var(--den-panel);
        border-bottom: 1px solid var(--den-border);
        display: flex;
        gap: 18px;
        min-height: 56px;
        padding: 0 20px;
      }

      h1 {
        font-size: var(--den-font-size-lg);
        line-height: var(--den-line-height-tight);
        margin: 0;
      }

      nav {
        align-items: center;
        display: flex;
        gap: 6px;
        overflow-x: auto;
      }

      .nav-item {
        appearance: none;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--den-muted);
        cursor: pointer;
        font-size: var(--den-font-size-md);
        min-height: 32px;
        padding: 6px 9px;
      }

      .nav-item[aria-current='page'] {
        background: var(--den-selected);
        color: var(--den-text);
      }

      .layout {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        height: calc(100dvh - 57px);
        min-height: 0;
        overflow: hidden;
      }

      .workspace {
        background: var(--den-panel);
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }

      .main {
        background: var(--den-surface);
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }

      @media (max-width: 840px) {
        .topbar {
          align-items: start;
          display: grid;
          gap: 8px;
          min-height: 0;
          padding: 10px 12px;
        }

        nav {
          margin: 0 -4px;
          padding: 0 4px 2px;
          width: calc(100vw - 24px);
        }

        .nav-item {
          flex: 0 0 auto;
        }

        .layout {
          grid-template-columns: 1fr;
          height: auto;
          overflow: visible;
        }

        .workspace {
          border-bottom: 1px solid var(--den-border);
          min-height: 0;
          max-height: 190px;
          overflow: hidden;
        }

        .main {
          min-height: calc(100vh - 250px);
        }
      }
    `,
  ],
  template: `
    <main class="app">
      <header class="topbar">
        <h1>Den Web</h1>
        <nav aria-label="Primary">
          @for (tab of tabs; track tab.id) {
            <button type="button" class="nav-item" [attr.aria-current]="activeTab() === tab.id ? 'page' : null" (click)="selectTab(tab.id)">
              {{ tab.label }}
            </button>
          }
        </nav>
      </header>

      <div class="layout">
        <section class="workspace">
          <den-project-workspace-panel />
        </section>
        <section class="main">
          @switch (activeTab()) {
            @case ('tasks') { <den-task-cockpit /> }
            @case ('conversation') { <den-conversation-cockpit /> }
            @case ('notifications') { <den-notifications-panel /> }
            @case ('messages') { <den-messages-inbox /> }
            @case ('documents') { <den-documents-panel /> }
            @case ('librarian') { <den-librarian-panel /> }
            @case ('agents') { <den-agents-overview /> }
            @case ('preferences') { <den-preferences-panel /> }
          }
        </section>
        <router-outlet />
      </div>
    </main>
  `,
})
export class AppComponent implements OnInit {
  private readonly preferencesStore = inject(PREFERENCES_STORE);
  private readonly navigationStore = inject(NAVIGATION_STORE);
  protected readonly tabs = tabs;
  protected readonly activeTab = signal<CockpitTab>('tasks');

  private readonly tabRequestEffect = effect(() => {
    const tab = this.navigationStore.activeTabRequest();
    if (!tab) return;
    this.activeTab.set(tab);
    queueMicrotask(() => this.navigationStore.clearActiveTabRequest());
  });

  ngOnInit(): void {
    this.preferencesStore.apply();
  }

  protected selectTab(tab: CockpitTab): void {
    this.activeTab.set(tab);
  }
}

import { Component, computed, inject } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { stateValue, WORKSPACE_STORE } from '@den-web/store';
import { workspaceItems, type WorkspaceItem } from './workspace-items';

@Component({
  selector: 'den-project-workspace-panel',
  standalone: true,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        min-width: 0;
      }

      .workspace-panel {
        border-right: 1px solid var(--den-border);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        height: 100%;
        min-height: 0;
      }

      header {
        border-bottom: 1px solid var(--den-border);
        padding: 10px 12px;
      }

      h2 {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        font-weight: 700;
        letter-spacing: 0.06em;
        line-height: var(--den-line-height-tight);
        margin: 0;
        text-transform: uppercase;
      }

      .meta {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        margin-top: 4px;
      }

      .scope-toggle {
        align-items: center;
        color: var(--den-muted);
        cursor: pointer;
        display: flex;
        font-size: var(--den-font-size-xs);
        gap: 6px;
        margin-top: 8px;
      }

      .scope-toggle input {
        accent-color: var(--den-accent);
      }

      .body {
        align-content: start;
        display: grid;
        gap: 10px;
        min-height: 0;
        overflow: auto;
        padding: 8px 10px;
      }

      .section-title {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
        font-weight: 700;
        letter-spacing: 0;
        margin: 0 0 8px;
        text-transform: uppercase;
      }

      .workspace-list {
        display: grid;
        gap: 6px;
      }

      button {
        appearance: none;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        display: grid;
        gap: 2px;
        min-width: 0;
        padding: 5px 8px;
        text-align: left;
      }

      button:hover,
      button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      button[aria-pressed='true'] {
        background: var(--den-selected);
        border-color: var(--den-accent);
      }

      strong {
        font-size: var(--den-font-size-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-line {
        align-items: center;
        display: flex;
        gap: 6px;
        min-width: 0;
      }

      span {
        color: var(--den-muted);
        font-size: var(--den-font-size-xs);
      }

      .item-id {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chip {
        border: 1px solid var(--den-border);
        border-radius: 999px;
        flex: 0 0 auto;
        font-size: var(--den-font-size-xs);
        padding: 1px 6px;
      }

      .state {
        color: var(--den-muted);
        font-size: var(--den-font-size-md);
        padding: 10px;
      }

      .error {
        color: var(--den-danger);
      }

      footer {
        border-top: 1px solid var(--den-border);
        padding: 6px 10px;
      }

      .refresh {
        align-items: center;
        border-color: var(--den-border);
        display: inline-grid;
        font-size: var(--den-font-size-xs);
        min-height: 26px;
        padding: 0 10px;
      }

      @media (max-width: 840px) {
        .workspace-panel {
          border-right: 0;
          grid-template-rows: auto minmax(0, 1fr);
          min-height: 0;
          max-height: 190px;
        }

        header {
          padding: 10px 12px;
        }

        .meta {
          margin-top: 4px;
        }

        .scope-toggle {
          margin-top: 8px;
        }

        .body {
          display: block;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px;
        }

        .section-title {
          margin-bottom: 6px;
        }

        .workspace-list {
          display: flex;
          gap: 8px;
          padding-bottom: 2px;
        }

        button {
          flex: 0 0 180px;
          min-height: 54px;
        }

        footer {
          display: none;
        }
      }
    `,
  ],
  template: `
    <aside class="workspace-panel" aria-label="Workspace">
      <header>
        <h2>Workspace</h2>
        <div class="meta">{{ selectedProjectId() || 'No project selected' }}</div>
        <label class="scope-toggle">
          <input
            type="checkbox"
            [checked]="includeArchivedHidden()"
            (change)="setIncludeArchivedHidden($event)"
          />
          <span>Show archived and hidden</span>
        </label>
        <label class="scope-toggle">
          <input
            type="checkbox"
            [checked]="showSpaces()"
            (change)="setShowSpaces($event)"
          />
          <span>Show spaces</span>
        </label>
      </header>

      <div class="body">
        <section aria-label="Workspaces">
          <p class="section-title">Projects and spaces</p>
          @if (workspaceItems().length === 0) {
            @if (loading()) {
              <p class="state">Loading workspaces</p>
            } @else if (loadError()) {
              <p class="state error">{{ errorText(loadError()) }}</p>
            } @else {
              <p class="state">No workspaces</p>
            }
          } @else {
            <div class="workspace-list">
              @for (item of workspaceItems(); track item.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="item.id === selectedProjectId()"
                  (click)="selectWorkspace(item)"
                >
                  <strong>{{ item.name || item.id }}</strong>
                  <span class="item-line">
                    <span class="item-id">{{ item.id }}</span>
                    <span class="chip">{{ workspaceKind(item) }}</span>
                  </span>
                </button>
              }
            </div>
          }
        </section>
      </div>

      <footer>
        <button type="button" class="refresh" (click)="refresh()">Refresh</button>
      </footer>
    </aside>
  `,
})
export class ProjectWorkspacePanelComponent implements OnInit, OnDestroy {
  private readonly workspace = inject(WORKSPACE_STORE);
  private stopPolling: (() => void) | null = null;

  protected readonly projects = this.workspace.projects;
  protected readonly spaces = this.workspace.spaces;
  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly selectedSpaceId = this.workspace.selectedSpaceId;
  protected readonly includeArchivedHidden = this.workspace.includeArchivedHidden;
  protected readonly showSpaces = this.workspace.showSpaces;
  protected readonly projectItems = computed(() => stateValue(this.projects()) ?? []);
  protected readonly spaceItems = computed(() => stateValue(this.spaces()) ?? []);
  protected readonly workspaceItems = computed(() =>
    workspaceItems(this.projectItems(), this.spaceItems(), this.showSpaces()),
  );
  protected readonly loading = computed(() => this.projects().kind === 'loading' || this.spaces().kind === 'loading');
  protected readonly loadError = computed(() => {
    const state = this.projects();
    if (state.kind === 'error') return state.error;
    const spaceState = this.spaces();
    return spaceState.kind === 'error' ? spaceState.error : null;
  });

  ngOnInit(): void {
    this.stopPolling = this.workspace.startPolling(5000);
  }

  ngOnDestroy(): void {
    this.stopPolling?.();
  }

  protected refresh(): void {
    void this.workspace.refresh();
  }

  protected setIncludeArchivedHidden(event: Event): void {
    this.workspace.setIncludeArchivedHidden(eventTargetChecked(event));
  }

  protected setShowSpaces(event: Event): void {
    this.workspace.setShowSpaces(eventTargetChecked(event));
  }

  protected selectWorkspace(item: WorkspaceItem): void {
    if (item.source === 'space') {
      this.workspace.selectSpace(item.id);
      return;
    }
    this.workspace.selectProject(item.id);
  }

  protected workspaceKind(item: WorkspaceItem): string {
    return item.kind || item.visibility || item.source;
  }

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    if (!error) return 'unknown: Unable to load';
    return `${error.kind}: ${error.message}`;
  }
}

function eventTargetChecked(event: Event): boolean {
  return event.target instanceof HTMLInputElement ? event.target.checked : false;
}

import { Component, computed, inject } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import type { DenProject, DenSpace } from '@den-web/protocol';
import { stateValue, WORKSPACE_STORE } from '@den-web/store';

@Component({
  selector: 'den-project-workspace-panel',
  standalone: true,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .workspace-panel {
        border-right: 1px solid var(--den-border);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        min-height: 100%;
      }

      header {
        border-bottom: 1px solid var(--den-border);
        padding: 18px;
      }

      h2 {
        font-size: 18px;
        line-height: 1.2;
        margin: 0;
      }

      .meta {
        color: var(--den-muted);
        font-size: 12px;
        margin-top: 6px;
      }

      .body {
        display: grid;
        gap: 20px;
        overflow: auto;
        padding: 14px;
      }

      .section-title {
        color: var(--den-muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0;
        margin: 0 0 8px;
        text-transform: uppercase;
      }

      .project-list,
      .space-list {
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
        gap: 3px;
        min-height: 44px;
        padding: 9px 10px;
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
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      span {
        color: var(--den-muted);
        font-size: 12px;
      }

      .state {
        color: var(--den-muted);
        font-size: 13px;
        padding: 10px;
      }

      .error {
        color: var(--den-danger);
      }

      footer {
        border-top: 1px solid var(--den-border);
        padding: 12px 14px;
      }

      .refresh {
        align-items: center;
        border-color: var(--den-border);
        display: inline-grid;
        min-height: 36px;
        padding: 0 12px;
      }
    `,
  ],
  template: `
    <aside class="workspace-panel" aria-label="Workspace">
      <header>
        <h2>Workspace</h2>
        <div class="meta">{{ selectedProjectId() || 'No project selected' }}</div>
      </header>

      <div class="body">
        <section aria-label="Projects">
          <p class="section-title">Projects</p>
          @switch (projects().kind) {
            @case ('idle') {
              <p class="state">Ready</p>
            }
            @case ('loading') {
              <p class="state">Loading projects</p>
            }
            @case ('error') {
              <p class="state error">{{ errorText(projectError()) }}</p>
            }
            @case ('data') {
              @if (projectItems().length === 0) {
                <p class="state">No projects</p>
              } @else {
                <div class="project-list">
                  @for (project of projectItems(); track project.id) {
                    <button
                      type="button"
                      [attr.aria-pressed]="project.id === selectedProjectId()"
                      (click)="selectProject(project)"
                    >
                      <strong>{{ project.name || project.id }}</strong>
                      <span>{{ project.id }}</span>
                    </button>
                  }
                </div>
              }
            }
          }
        </section>

        <section aria-label="Spaces">
          <p class="section-title">Spaces</p>
          @switch (spaces().kind) {
            @case ('loading') {
              <p class="state">Loading spaces</p>
            }
            @case ('error') {
              <p class="state error">{{ errorText(spaceError()) }}</p>
            }
            @case ('data') {
              @if (spaceItems().length === 0) {
                <p class="state">No spaces</p>
              } @else {
                <div class="space-list">
                  @for (space of spaceItems(); track space.id) {
                    <button
                      type="button"
                      [attr.aria-pressed]="space.id === selectedSpaceId()"
                      (click)="selectSpace(space)"
                    >
                      <strong>{{ space.name || space.id }}</strong>
                      <span>{{ space.kind || space.visibility || 'space' }}</span>
                    </button>
                  }
                </div>
              }
            }
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
  protected readonly projectItems = computed(() => stateValue(this.projects()) ?? []);
  protected readonly spaceItems = computed(() => stateValue(this.spaces()) ?? []);
  protected readonly projectError = computed(() => {
    const state = this.projects();
    return state.kind === 'error' ? state.error : null;
  });
  protected readonly spaceError = computed(() => {
    const state = this.spaces();
    return state.kind === 'error' ? state.error : null;
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

  protected selectProject(project: DenProject): void {
    this.workspace.selectProject(project.id);
  }

  protected selectSpace(space: DenSpace): void {
    this.workspace.selectSpace(space.id);
  }

  protected errorText(error: { readonly kind: string; readonly message: string } | null): string {
    if (!error) return 'unknown: Unable to load';
    return `${error.kind}: ${error.message}`;
  }
}

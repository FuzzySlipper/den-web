import { Component, computed, effect, inject, signal } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { LocalTimeComponent } from '@den-web/components';
import {
  filterResources,
  projectResourcesOverview,
  projectWorkLedger,
  RESOURCE_LIFECYCLES,
  type ResourcesOverview,
} from '@den-web/domain';
import type { ClassifiedError, DenResource } from '@den-web/protocol';
import { RESOURCES_STORE, stateValue } from '@den-web/store';
import {
  ResourceEditDialogComponent,
  ResourceUseDialogComponent,
  ResourcesCheckInDialogComponent,
} from './resources-dialogs.component';
import { resourcesPanelStyles } from './resources-panel.styles';

type ResourcesDialog =
  | { readonly kind: 'check-in'; readonly host: string | null; readonly resource: string | null }
  | { readonly kind: 'edit'; readonly resource: DenResource | null }
  | { readonly kind: 'use'; readonly resource: DenResource };

@Component({
  selector: 'den-resources-panel',
  standalone: true,
  imports: [LocalTimeComponent, ResourceEditDialogComponent, ResourceUseDialogComponent, ResourcesCheckInDialogComponent],
  styles: [resourcesPanelStyles],
  template: `
    <section class="surface" aria-label="Resources">
      <header>
        <div class="heading">
          <h2>Resources</h2>
          <span class="muted">What’s using the machines? Live activity, shared installations, and the people and agents using them.</span>
        </div>
        <div class="toolbar">
          @if (error()) {
            <span class="connection lost">Connection lost</span>
          } @else if (overview(); as view) {
            <span class="connection live">Live · <den-local-time [value]="view.generatedAt" [relative]="false" /></span>
          }
          <button type="button" aria-label="Refresh resources" (click)="refresh()" [disabled]="loading()">↻ Refresh</button>
          <button type="button" class="primary" [disabled]="!snapshot()" (click)="openCheckIn(null, null)">＋ Check in</button>
        </div>
      </header>

      @if (error(); as failure) {
        @if (snapshot()) {
          <p class="notice" role="status" data-testid="resources-connection-lost">
            <span>Connection lost, showing last values. Cannot refresh the board ({{ errorText(failure) }}). Displayed values are from the last successful refresh.</span>
          </p>
        } @else {
          <p class="notice danger" role="alert">Could not load Resources ({{ errorText(failure) }}). What is using the machines is unknown.</p>
        }
      }

      @if (notice(); as message) {
        <p class="notice info" role="status" data-testid="resources-notice">
          <span>{{ message }}</span>
          <button type="button" aria-label="Dismiss notice" (click)="dismissNotice()">×</button>
        </p>
      }

      @if (overview(); as view) {
        <div class="summary-grid" aria-label="Workshop summary">
          @for (card of view.summary; track card.id) {
            <div class="summary-card" [attr.data-testid]="'resources-summary-' + card.id">
              <strong>{{ card.value }}</strong>
              <span class="muted">{{ card.label }}</span>
            </div>
          }
        </div>

        <section aria-label="Machines">
          <div class="section-heading">
            <div class="heading">
              <h3>Machines</h3>
              <span class="muted">Measured activity and reported work, together. Each source keeps its own timestamp.</span>
            </div>
            <span class="small-label">{{ view.pollLabel }}</span>
          </div>
          @if (view.hosts.length === 0) {
            <p class="state">No machines have registered yet. Waiting for the first report…</p>
          }
          <div class="host-grid">
            @for (host of view.hosts; track host.id) {
              <article class="host-card" data-testid="resources-host" [attr.aria-label]="host.name">
                <div class="host-top">
                  <h4>{{ host.name }}</h4>
                  <span class="pill tone-{{ host.tone }}" data-testid="resources-host-status">{{ host.statusLabel }}</span>
                </div>
                @if (host.role) { <p class="host-role">{{ host.role }}</p> }
                <div class="metrics">
                  @for (metric of [host.cpu, host.ram]; track metric.label) {
                    <div class="metric">
                      {{ metric.label }}
                      <strong>{{ metric.main }} <small class="muted">{{ metric.sub }}</small></strong>
                      <div class="bar"><i [style.width.%]="metric.fill"></i></div>
                    </div>
                  }
                </div>
                @for (gpu of host.gpus; track $index) {
                  <div class="gpu-line">
                    <b>{{ gpu.name }}</b>{{ ' ' }}<span>{{ gpu.utilization }}</span><br />
                    {{ gpu.vram }}
                    @if (gpu.gtt) { <br />{{ gpu.gtt }} }
                    @if (gpu.note) { <span [attr.title]="gpu.note" [attr.aria-label]="gpu.note"> ⓘ</span> }
                  </div>
                }
                @for (app of host.apps; track app.name) {
                  <div class="app-line">
                    <span>{{ app.name }}</span>
                    <span [class]="app.healthy ? 'app-count' : 'offline'" [attr.title]="app.title">{{ app.text }}</span>
                  </div>
                }
                @if (host.appsCheckedAge) { <p class="host-note">App queues checked {{ host.appsCheckedAge }}</p> }
                @if (host.nativeJobs.length > 0) {
                  <details class="detail-block">
                    <summary>Inspect {{ host.nativeJobs.length }} native queue job{{ host.nativeJobs.length === 1 ? '' : 's' }}</summary>
                    @for (job of host.nativeJobs; track job.key) {
                      <p class="command">{{ job.app }} · {{ job.state }}<br />{{ job.id }}<br />{{ job.nodeTypes }}</p>
                    }
                  </details>
                }
                @if (host.expiredCheckIns > 0) {
                  <p class="host-note">
                    {{ host.expiredCheckIns }} expired check-in{{ host.expiredCheckIns === 1 ? '' : 's' }} ·
                    <button type="button" class="link" (click)="ledger.scrollIntoView({ behavior: 'smooth' })">inspect the work ledger</button>
                  </p>
                }
                @for (work of host.currentWork; track work.id) {
                  <div class="work-snippet">
                    <span class="pill tone-{{ work.state === 'queued' ? 'queued' : 'active' }}">{{ work.state }}</span> {{ work.title }}<br />
                    <span class="muted">{{ work.owner }} · {{ work.age }}</span>
                  </div>
                }
                @if (host.error) {
                  <p class="error-note" data-testid="resources-host-error">Machine telemetry unavailable. Last values retained.<br />{{ host.error }}</p>
                }
                <details class="detail-block">
                  <summary>Processes, containers &amp; storage</summary>
                  <p>{{ host.access }}<br />{{ host.platform }}</p>
                  <p class="muted">Processes: CPU is a short sample (100% = one core). Largest CPU and RAM consumers are included.</p>
                  @if (host.processes.length > 0) {
                    <table>
                      <thead><tr><th>Process / PID</th><th>CPU</th><th>RAM</th></tr></thead>
                      <tbody>
                        @for (process of host.processes; track process.key) {
                          <tr>
                            <td class="command" [attr.title]="process.command">{{ process.command }}<small>{{ process.detail }}</small></td>
                            <td>{{ process.cpu }}</td>
                            <td>{{ process.ram }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="muted">No process data.</p>
                  }
                  @if (host.containers.length > 0) {
                    <p><b>Containers · all configured daemons</b></p>
                    <table>
                      <tbody>
                        @for (container of host.containers; track container.key) {
                          <tr>
                            <td class="command">{{ container.name }}<small>{{ container.socket }}<br />{{ container.image }}</small></td>
                            <td>{{ container.state }}<small>{{ container.cpu }}<br />{{ container.memory }}</small></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="muted">No containers reported.</p>
                  }
                  @for (disk of host.disks; track disk.path) {
                    <div class="disk"><span>{{ disk.path }}</span><span>{{ disk.space }}</span></div>
                  }
                  @for (warning of host.warnings; track $index) {
                    <p class="error-note">{{ warning }}</p>
                  }
                </details>
                @if (host.note) { <p class="host-note">{{ host.note }}</p> }
                <div class="host-footer">
                  <span class="host-note">
                    {{ host.telemetryLabel }}
                    @if (host.telemetryAt) { · <den-local-time [value]="host.telemetryAt" [relative]="false" /> }
                  </span>
                  <button type="button" [attr.aria-label]="'Check in on ' + host.name" (click)="openCheckIn(host.id, null)">Check in ↗</button>
                </div>
              </article>
            }
          </div>
        </section>

        <section aria-label="Shared resources">
          <div class="section-heading">
            <div class="heading">
              <h3>Shared resources</h3>
              <span class="muted">Find an existing install, model cache or workspace before creating another.</span>
            </div>
            <button type="button" (click)="openEdit(null)">＋ Add resource</button>
          </div>
          <div class="filters">
            <input type="search" placeholder="Search names, paths, notes…" aria-label="Search resources" [value]="search()" (input)="search.set(value($event))" />
            <select aria-label="Filter resource host" (change)="hostFilter.set(value($event))">
              <option value="" [selected]="hostFilter() === ''">Every machine</option>
              @for (host of hosts(); track host.id) {
                <option [value]="host.id" [selected]="hostFilter() === host.id">{{ host.name }}</option>
              }
            </select>
            <select aria-label="Filter lifecycle" (change)="lifecycleFilter.set(value($event))">
              <option value="" [selected]="lifecycleFilter() === ''">Every lifecycle</option>
              @for (lifecycle of lifecycles; track lifecycle) {
                <option [value]="lifecycle" [selected]="lifecycleFilter() === lifecycle">{{ lifecycle }}</option>
              }
            </select>
          </div>
          <div class="resource-list">
            @for (row of resourceRows(); track row.id) {
              <details class="resource-row" data-testid="resources-resource">
                <summary>
                  <span class="resource-name">{{ row.name }}<small>{{ row.path }}</small></span>
                  <span class="resource-host">{{ row.host }}</span>
                  <span class="pill tone-{{ lifecycleTone(row.lifecycle) }}">{{ row.lifecycle }}</span>
                  <span class="resource-used">Recorded use
                    <span><den-local-time [value]="row.lastUsedAt" [relative]="false" fallback="No use recorded" /></span>
                  </span>
                </summary>
                <div class="resource-body">
                  <p><b>{{ row.id }}</b> · {{ row.kind }} · {{ row.host }}</p>
                  <p>Host path<code>{{ row.path }}</code></p>
                  @if (row.runtimePath) { <p>Container path<code>{{ row.runtimePath }}</code></p> }
                  @if (row.access) { <p>Access<code>{{ row.access }}</code></p> }
                  @if (row.probePath) { <p>Probe path<code>{{ row.probePath }}</code></p> }
                  @if (row.match) { <p>Process match<code>{{ row.match }}</code></p> }
                  @if (row.guide) { <p>Guide<code>{{ row.guide }}</code></p> }
                  <p>{{ row.sharing }}</p>
                  @if (row.notes) { <p>{{ row.notes }}</p> }
                  <dl class="dates">
                    <dt>Recorded use</dt>
                    <dd><den-local-time [value]="row.lastUsedAt" [relative]="false" fallback="No record" />@if (row.lastUsedBy) { by {{ row.lastUsedBy }}}</dd>
                    <dt>Observed activity</dt>
                    <dd><den-local-time [value]="row.observedActivityAt" [relative]="false" fallback="No record" /></dd>
                    <dt>Lifecycle confirmed</dt>
                    <dd><den-local-time [value]="row.confirmedAt" [relative]="false" fallback="No record" />@if (row.confirmedBy) { by {{ row.confirmedBy }}}</dd>
                    <dt>Path</dt>
                    <dd>{{ row.pathLabel }}@if (row.pathCheckedAt) { · <den-local-time [value]="row.pathCheckedAt" [relative]="false" />}</dd>
                    <dt>Record updated</dt>
                    <dd><den-local-time [value]="row.updatedAt" [relative]="false" fallback="No record" /></dd>
                  </dl>
                  <div class="resource-actions">
                    <button type="button" (click)="openEditById(row.id)">Edit &amp; confirm lifecycle</button>
                    <button type="button" (click)="openUse(row.id)">Record use today</button>
                    <button type="button" (click)="openCheckIn(row.host, row.id)">Check in with this resource</button>
                  </div>
                </div>
              </details>
            } @empty {
              <p class="state">No resources match these filters.</p>
            }
          </div>
          <p class="footnote">
            “No use recorded” means the history is incomplete. Path presence and quiet telemetry do not establish that an installation is abandoned.
          </p>
        </section>

        <section #ledger aria-label="Work ledger">
          <div class="section-heading">
            <div class="heading">
              <h3>Work ledger</h3>
              <span class="muted">Check-ins and app reports. Native ComfyUI queues are shown on the machine cards.</span>
            </div>
            <select aria-label="Filter work ledger" (change)="setWorkScope($event)">
              <option value="active" [selected]="workScope() === 'active'">Current &amp; stale</option>
              <option value="all" [selected]="workScope() === 'all'">All history</option>
            </select>
          </div>
          <div class="table-wrap">
            @if (workRows().length > 0) {
              <table>
                <thead><tr><th>Work / source</th><th>Machine / owner</th><th>Status</th><th>Last report</th><th>Actions</th></tr></thead>
                <tbody>
                  @for (row of workRows(); track row.id) {
                    <tr data-testid="resources-work">
                      <td>{{ row.title }}<small>{{ row.source }}@if (row.project) { · {{ row.project }}}</small>@if (row.note) {<small>{{ row.note }}</small>}</td>
                      <td>{{ row.host }}<small>{{ row.owner }}</small>@if (row.resources) {<small>{{ row.resources }}</small>}</td>
                      <td><span class="pill tone-{{ row.tone }}">{{ row.statusLabel }}</span></td>
                      <td>
                        {{ row.age }}
                        <small>{{ row.detail }}{{ row.detail && row.detailAt ? ' ' : '' }}@if (row.detailAt) {<den-local-time [value]="row.detailAt" [relative]="false" />}</small>
                      </td>
                      <td>
                        @switch (row.actions) {
                          @case ('renew') {
                            <div class="row-actions">
                              <button type="button" [disabled]="busyWork() === row.id" (click)="renew(row.id)">Renew</button>
                              <button type="button" [disabled]="busyWork() === row.id" (click)="checkOut(row.id)">Check out</button>
                            </div>
                          }
                          @case ('workbench') { <small>Managed by Workbench</small> }
                          @default { — }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="state">No check-ins yet. Native queues and measured activity still appear above.</p>
            }
          </div>
          <p class="footnote">
            Check-ins are advisory and never lock or stop work. Heartbeats expire after 3 minutes by default; stale reports remain visible.
          </p>
        </section>
      } @else if (loading()) {
        <p class="state">Waiting for the first report…</p>
      }
    </section>

    @if (dialog(); as open) {
      @switch (open.kind) {
        @case ('check-in') {
          <den-resources-check-in-dialog
            [hosts]="hosts()"
            [resources]="resources()"
            [initialHost]="checkInHost()"
            [initialResource]="checkInResource()"
            (closed)="closeDialog()"
          />
        }
        @case ('edit') {
          <den-resource-edit-dialog [hosts]="hosts()" [resource]="editResource()" (closed)="closeDialog()" />
        }
        @case ('use') {
          @if (useResource(); as resource) {
            <den-resource-use-dialog [resource]="resource" (closed)="closeDialog()" />
          }
        }
      }
    }
  `,
})
export class ResourcesPanelComponent implements OnInit, OnDestroy {
  private readonly store = inject(RESOURCES_STORE);
  protected readonly lifecycles = RESOURCE_LIFECYCLES;
  protected readonly notice = this.store.notice;
  protected readonly search = signal('');
  protected readonly hostFilter = signal('');
  protected readonly lifecycleFilter = signal('');
  protected readonly workScope = signal<'active' | 'all'>('active');
  protected readonly dialog = signal<ResourcesDialog | null>(null);
  protected readonly busyWork = signal<string | null>(null);

  protected readonly loading = computed(() => this.store.state().kind === 'loading');
  protected readonly error = computed(() => {
    const state = this.store.state();
    return state.kind === 'error' ? state.error : null;
  });
  protected readonly snapshot = computed(() => stateValue(this.store.state()) ?? null);
  protected readonly overview = computed((): ResourcesOverview | null => {
    const value = this.snapshot();
    return value ? projectResourcesOverview(value) : null;
  });
  protected readonly hosts = computed(() => this.snapshot()?.hosts ?? []);
  protected readonly resources = computed(() => this.snapshot()?.resources ?? []);
  protected readonly resourceRows = computed(() =>
    filterResources(this.resources(), { search: this.search(), host: this.hostFilter(), lifecycle: this.lifecycleFilter() }),
  );
  protected readonly workRows = computed(() => {
    const value = this.snapshot();
    return value ? projectWorkLedger(value, this.workScope()) : [];
  });
  protected readonly checkInHost = computed(() => {
    const open = this.dialog();
    return open?.kind === 'check-in' ? open.host : null;
  });
  protected readonly checkInResource = computed(() => {
    const open = this.dialog();
    return open?.kind === 'check-in' ? open.resource : null;
  });
  protected readonly editResource = computed(() => {
    const open = this.dialog();
    return open?.kind === 'edit' ? open.resource : null;
  });
  protected readonly useResource = computed(() => {
    const open = this.dialog();
    return open?.kind === 'use' ? open.resource : null;
  });

  /** The board does not refresh underneath an open dialog. */
  private readonly pauseEffect = effect(() => this.store.setPaused(this.dialog() !== null));

  ngOnInit(): void {
    this.store.startPolling();
  }

  ngOnDestroy(): void {
    this.store.stopPolling();
    this.store.setPaused(false);
  }

  protected refresh(): void {
    void this.store.refresh();
  }

  protected dismissNotice(): void {
    this.store.dismissNotice();
  }

  protected openCheckIn(host: string | null, resource: string | null): void {
    if (!this.snapshot()) return;
    this.dialog.set({ kind: 'check-in', host, resource });
  }

  protected openEdit(resource: DenResource | null): void {
    if (!this.snapshot()) return;
    this.dialog.set({ kind: 'edit', resource });
  }

  protected openEditById(id: string): void {
    this.openEdit(this.resources().find((resource) => resource.id === id) ?? null);
  }

  protected openUse(id: string): void {
    const resource = this.resources().find((candidate) => candidate.id === id);
    if (resource) this.dialog.set({ kind: 'use', resource });
  }

  protected closeDialog(): void {
    this.dialog.set(null);
  }

  protected setWorkScope(event: Event): void {
    this.workScope.set(this.value(event) === 'all' ? 'all' : 'active');
  }

  protected async renew(workId: string): Promise<void> {
    this.busyWork.set(workId);
    await this.store.renew(workId);
    this.busyWork.set(null);
  }

  protected async checkOut(workId: string): Promise<void> {
    this.busyWork.set(workId);
    await this.store.checkOut(workId);
    this.busyWork.set(null);
  }

  protected lifecycleTone(lifecycle: string): string {
    if (lifecycle === 'maintained') return 'ok';
    if (lifecycle === 'experimental') return 'queued';
    if (lifecycle === 'retired') return 'danger';
    return 'unknown';
  }

  protected value(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return target.value;
    return '';
  }

  protected errorText(error: ClassifiedError | null): string {
    return error ? `${error.kind}: ${error.message}` : 'unknown error';
  }
}

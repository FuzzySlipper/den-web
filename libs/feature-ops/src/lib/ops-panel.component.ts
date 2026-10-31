import { Component, computed, inject } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { LocalTimeComponent } from '@den-web/components';
import { checkLine, projectOpsOverview, runLine, type OpsOverview } from '@den-web/domain';
import type { ClassifiedError } from '@den-web/protocol';
import { OPS_STORE, stateValue } from '@den-web/store';
import { opsPanelStyles } from './ops-panel.styles';

@Component({
  selector: 'den-ops-panel',
  standalone: true,
  imports: [LocalTimeComponent],
  styles: [opsPanelStyles],
  template: `
    <section class="surface" aria-label="Operations">
      <header>
        <div class="heading">
          <h2>Operations</h2>
          <span class="muted">Backups and maintenance reported to Ops. Ops only records reports; it never runs jobs.</span>
        </div>
        <div class="toolbar">
          @if (overview(); as view) {
            <span class="muted">Status as of <den-local-time [value]="view.generatedAt" /></span>
          }
          <button type="button" aria-label="Refresh backup status" (click)="refresh()" [disabled]="loading()">{{ loading() ? 'Refreshing' : 'Refresh' }}</button>
        </div>
      </header>

      @if (error(); as failure) {
        <p class="notice danger" role="alert">
          Could not load backup status ({{ errorText(failure) }}).
          @if (!overview()) { Backup protection is unknown. }
        </p>
      }

      @if (overview(); as view) {
        @if (view.trustNotice) {
          <p class="notice" role="status">{{ view.trustNotice }}</p>
        }
        <div class="summary" aria-label="Backup summary">
          <span class="pill tone-{{ view.overallTone }}" data-testid="ops-overall">{{ view.overallLabel }}</span>
          @for (count of view.counts; track count.status) {
            <span class="pill tone-{{ count.tone }}">{{ count.count }} {{ count.label }}</span>
          }
        </div>

        <section aria-label="Machine coverage" class="heading">
          <h3>Machines</h3>
          @if (view.hosts.length === 0) {
            <p class="state">No machines are known to Ops, so no machine is known to be protected.</p>
          }
          <div class="hosts">
            @for (host of view.hosts; track host.id) {
              <div class="host" data-testid="ops-host">
                <strong>{{ host.name }}</strong>
                @if (host.role) { <span class="muted">{{ host.role }}</span> }
                <span class="tone-{{ host.tone }}">{{ host.coverageLabel }} · {{ host.statusLabel }}</span>
                <span class="muted">{{ host.jobCount }} job{{ host.jobCount === 1 ? '' : 's' }}</span>
              </div>
            }
          </div>
        </section>

        <section aria-label="Backup jobs" class="jobs">
          <h3>Backups</h3>
          @if (view.jobs.length === 0) {
            <p class="state">No backup or maintenance jobs are registered, so nothing is being tracked.</p>
          }
          @for (job of view.jobs; track job.id) {
            <article class="job" data-testid="ops-job" [attr.aria-label]="job.title">
              <div class="job-head">
                <div class="job-title">
                  <strong>{{ job.title }}</strong>
                  <span class="muted">{{ job.id }} · {{ job.hostId }} · {{ job.engine }} {{ job.kind }}@if (!job.registered) { · not registered}</span>
                  <span class="tone-{{ job.tone }}">{{ job.reason }}</span>
                </div>
                <span class="pill tone-{{ job.tone }}" data-testid="ops-job-status">{{ job.statusLabel }}</span>
              </div>

              <div class="facts">
                <div class="fact">
                  <h4>Last successful backup</h4>
                  @if (job.lastSuccess; as run) {
                    <span class="value tone-{{ run.tone }}"><den-local-time [value]="run.startedAt" /></span>
                    @if (run.archiveName) { <code>{{ run.archiveName }}</code> }
                    <span class="muted">
                      @if (run.newBytesLabel) { {{ run.newBytesLabel }} new }
                      @if (run.totalBytesLabel) { of {{ run.totalBytesLabel }} }
                      @if (run.durationLabel) { · {{ run.durationLabel }} }
                    </span>
                  } @else {
                    <span class="tone-danger">None reported</span>
                  }
                </div>

                <div class="fact">
                  <h4>Last attempt</h4>
                  @if (job.lastAttempt; as run) {
                    <span class="value"><span class="tone-{{ run.tone }}">{{ run.state }}</span> · <den-local-time [value]="run.startedAt" /></span>
                    <span class="muted">{{ run.runId }}@if (run.exitCode !== null) { · exit {{ run.exitCode }}}@if (run.durationLabel) { · {{ run.durationLabel }}}</span>
                    @if (run.reason) { <span class="muted">{{ run.reason }}</span> }
                    @if (run.error) { <pre class="problem">{{ run.error }}</pre> }
                    @if (run.warnings.length > 0) {
                      <details>
                        <summary class="warn-text">{{ run.warnings.length }} warning{{ run.warnings.length === 1 ? '' : 's' }}</summary>
                        @for (warning of run.warnings; track $index) { <pre class="problem warn-text">{{ warning }}</pre> }
                      </details>
                    }
                  } @else {
                    <span class="muted">Never attempted</span>
                  }
                </div>

                <div class="fact">
                  <h4>Current run</h4>
                  @if (job.currentRun; as current) {
                    <span class="value">{{ current.runId }}@if (current.phase) { · {{ current.phase }}}</span>
                    <span [class]="current.heartbeatStale ? 'tone-danger' : 'muted'">
                      Heartbeat {{ current.heartbeatAgeLabel }}@if (current.heartbeatStale) { — reporting stopped}
                    </span>
                  } @else {
                    <span class="muted">Not running</span>
                  }
                </div>

                <div class="fact">
                  <h4>Schedule</h4>
                  <span class="value">{{ job.scheduleLabel }}</span>
                  @if (job.nextDueAt) { <span class="muted">Next due <den-local-time [value]="job.nextDueAt" [relative]="false" /></span> }
                  @if (job.expectedBy) { <span class="muted">Latest slot due by <den-local-time [value]="job.expectedBy" [relative]="false" /></span> }
                </div>

                <div class="fact">
                  <h4>Verification</h4>
                  @if (job.verification; as check) {
                    <span class="value"><span class="tone-{{ check.tone }}">{{ check.state }}</span> · {{ check.label }}</span>
                    <span class="muted"><den-local-time [value]="check.at" />@if (check.fullDataRead) { · full data read}</span>
                  } @else {
                    <span class="muted">No repository check reported</span>
                  }
                </div>

                <div class="fact">
                  <h4>Restore test</h4>
                  @if (job.restoreTest; as check) {
                    <span class="value"><span class="tone-{{ check.tone }}">{{ check.state }}</span> · <den-local-time [value]="check.at" /></span>
                    @if (check.archive) { <code>{{ check.archive }}</code> }
                    @if (check.scope) { <span class="muted">{{ check.scope }}</span> }
                  } @else {
                    <span class="muted">No restore test reported</span>
                  }
                </div>

                <div class="fact">
                  <h4>Source and target</h4>
                  <span class="value">{{ job.source || 'Source not declared' }}</span>
                  @if (job.scope) { <span class="muted">{{ job.scope }}</span> }
                  <span class="muted">→ {{ job.target || 'target not declared' }}</span>
                </div>

                <div class="fact">
                  <h4>Retention and recovery</h4>
                  <span class="value">{{ job.retention || 'Retention not declared' }}</span>
                  @if (job.recoveryPointer) { <code>{{ job.recoveryPointer }}</code> }
                  @if (job.lastAttempt; as run) {
                    @if (run.runDirectory) { <span class="muted">Run files: <code>{{ run.runDirectory }}</code></span> }
                    @if (run.logPath) { <span class="muted">Log: <code>{{ run.logPath }}</code></span> }
                  }
                </div>

                @if (job.notes) {
                  <div class="fact" data-testid="ops-job-notes">
                    <h4>Notes</h4>
                    <span class="muted">{{ job.notes }}</span>
                  </div>
                }
              </div>

              <div class="toolbar">
                <button type="button" (click)="toggleHistory(job.id)" [attr.aria-expanded]="selectedJobId() === job.id">
                  {{ selectedJobId() === job.id ? 'Hide history' : 'Show history' }}
                </button>
              </div>

              @if (selectedJobId() === job.id) {
                <div class="history" data-testid="ops-history">
                  @switch (detail().kind) {
                    @case ('loading') { @if (!detailValue()) { <p class="state">Loading history</p> } }
                    @case ('error') { <p class="notice danger">Could not load history ({{ errorText(detailError()) }}).</p> }
                  }
                  @if (history(); as rows) {
                    <h4>Recent runs</h4>
                    <table>
                      <thead><tr><th>Started</th><th>State</th><th>Run</th><th>Archive</th><th>New data</th><th>Duration</th><th>Detail</th></tr></thead>
                      <tbody>
                        @for (run of rows.runs; track run.runId) {
                          <tr>
                            <td><den-local-time [value]="run.startedAt" [relative]="false" /></td>
                            <td class="tone-{{ run.tone }}">{{ run.state }}@if (run.exitCode !== null) { ({{ run.exitCode }})}</td>
                            <td><code>{{ run.runId }}</code></td>
                            <td>{{ run.archiveName || '—' }}</td>
                            <td>{{ run.newBytesLabel || '—' }}</td>
                            <td>{{ run.durationLabel || '—' }}</td>
                            <td>{{ firstProblem(run.error, run.warnings, run.reason) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    <h4>Checks and restore tests</h4>
                    @if (rows.checks.length === 0) { <p class="state">None reported</p> }
                    <table>
                      <tbody>
                        @for (check of rows.checks; track check.id) {
                          <tr>
                            <td><den-local-time [value]="check.at" [relative]="false" /></td>
                            <td class="tone-{{ check.tone }}">{{ check.state }}</td>
                            <td>{{ check.label }}</td>
                            <td>{{ check.archive || '—' }}</td>
                            <td>@if (check.evidencePath) { <code>{{ check.evidencePath }}</code> }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              }
            </article>
          }
        </section>
      } @else if (loading()) {
        <p class="state">Loading backup status</p>
      }
    </section>
  `,
})
export class OpsPanelComponent implements OnInit, OnDestroy {
  private readonly store = inject(OPS_STORE);
  protected readonly summary = this.store.summary;
  protected readonly detail = this.store.detail;
  protected readonly selectedJobId = this.store.selectedJobId;
  protected readonly loading = computed(() => this.summary().kind === 'loading');
  protected readonly error = computed(() => {
    const state = this.summary();
    return state.kind === 'error' ? state.error : null;
  });
  protected readonly overview = computed((): OpsOverview | null => {
    const state = this.summary();
    const value = stateValue(state);
    if (!value) return null;
    return projectOpsOverview(value, this.store.now(), { refreshFailed: state.kind === 'error' });
  });
  protected readonly detailValue = computed(() => stateValue(this.detail()) ?? null);
  protected readonly detailError = computed(() => {
    const state = this.detail();
    return state.kind === 'error' ? state.error : null;
  });
  protected readonly history = computed(() => {
    const value = this.detailValue();
    if (!value) return null;
    const trusted = this.detail().kind !== 'error';
    return {
      runs: value.runs.flatMap((run) => {
        const line = runLine(run, trusted);
        return line ? [line] : [];
      }),
      checks: value.verifications.flatMap((check) => {
        const line = checkLine(check, trusted);
        return line ? [line] : [];
      }),
    };
  });

  ngOnInit(): void {
    this.store.startPolling();
  }

  ngOnDestroy(): void {
    this.store.stopPolling();
  }

  protected refresh(): void {
    void this.store.refresh();
  }

  protected toggleHistory(jobId: string): void {
    void this.store.selectJob(this.selectedJobId() === jobId ? null : jobId);
  }

  protected errorText(error: ClassifiedError | null): string {
    return error ? `${error.kind}: ${error.message}` : 'unknown error';
  }

  protected firstProblem(error: string, warnings: readonly string[], reason: string): string {
    const text = error || warnings[0] || reason;
    const line = text.split('\n')[0] ?? '';
    return line.length > 140 ? `${line.slice(0, 140)}…` : line;
  }
}

import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { RESOURCE_LIFECYCLES } from '@den-web/domain';
import type { DenResource, DenResourceLifecycle, DenResourcesHost } from '@den-web/protocol';
import { RESOURCES_STORE } from '@den-web/store';
import { resourcesDialogStyles } from './resources-panel.styles';

export const CHECK_IN_TTL_OPTIONS: readonly { readonly seconds: number; readonly label: string }[] = [
  { seconds: 180, label: '3 minutes' },
  { seconds: 1800, label: '30 minutes' },
  { seconds: 7200, label: '2 hours' },
];

const LIFECYCLE_LABELS: Readonly<Record<DenResourceLifecycle, string>> = {
  unknown: 'Unknown / unconfirmed',
  maintained: 'Maintained',
  experimental: 'Experimental',
  retired: 'Retired',
};

function eventValue(event: Event): string {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target.value;
  }
  return '';
}

@Component({
  selector: 'den-resources-check-in-dialog',
  standalone: true,
  styles: [resourcesDialogStyles],
  template: `
    <div class="dialog-backdrop" (keydown.escape)="closed.emit()">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="check-in-title" (submit)="submit($event)">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">Leave a useful record</p>
            <h3 id="check-in-title">Check in to the workshop</h3>
          </div>
          <button type="button" class="close" aria-label="Close" (click)="closed.emit()">×</button>
        </div>
        <label>What are you doing?
          <input name="title" required placeholder="e.g. Training a character LoRA" [value]="title()" (input)="title.set(value($event))" />
        </label>
        <div class="form-row">
          <label>Machine
            <select name="host" required [value]="host()" (change)="setHost($event)">
              @for (option of hosts(); track option.id) {
                <option [value]="option.id" [selected]="option.id === host()">{{ option.name }}</option>
              }
            </select>
          </label>
          <label>Your name / agent
            <input name="owner" required placeholder="owner, agent or task name" [value]="owner()" (input)="owner.set(value($event))" />
          </label>
        </div>
        <label>Project
          <input name="project" placeholder="Repository, task or output location" [value]="project()" (input)="project.set(value($event))" />
        </label>
        <label>Resources
          <select name="resources" multiple size="4" (change)="setResources($event)">
            @for (option of hostResources(); track option.id) {
              <option [value]="option.id" [selected]="selectedResources().includes(option.id)">{{ option.name }} · {{ option.id }}</option>
            }
          </select>
          <small>Optional. Select the installs or caches you will use.</small>
        </label>
        <div class="form-row">
          <label>State
            <select name="state" [value]="state()" (change)="setState($event)">
              <option value="running">Running</option>
              <option value="queued">Queued</option>
            </select>
          </label>
          <label>Heartbeat expires in
            <select name="ttl" (change)="ttl.set(numberValue($event))">
              @for (option of ttlOptions; track option.seconds) {
                <option [value]="option.seconds" [selected]="option.seconds === ttl()">{{ option.label }}</option>
              }
            </select>
          </label>
        </div>
        <label>Notes
          <textarea name="note" rows="2" placeholder="What should the next person know?" [value]="note()" (input)="note.set(value($event))"></textarea>
        </label>
        <p class="form-help">
          Manual check-ins need “Renew” before expiry. Use the CLI wrapper for automatic heartbeats.
          The board reports use; it does not reserve the machine.
        </p>
        @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          <button type="button" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="primary" [disabled]="busy()">Check in</button>
        </div>
      </form>
    </div>
  `,
})
export class ResourcesCheckInDialogComponent implements OnInit {
  private readonly store = inject(RESOURCES_STORE);
  readonly hosts = input.required<readonly DenResourcesHost[]>();
  readonly resources = input.required<readonly DenResource[]>();
  readonly initialHost = input<string | null>(null);
  readonly initialResource = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly ttlOptions = CHECK_IN_TTL_OPTIONS;
  protected readonly title = signal('');
  protected readonly host = signal('');
  protected readonly owner = signal('');
  protected readonly project = signal('');
  protected readonly selectedResources = signal<readonly string[]>([]);
  protected readonly state = signal<'running' | 'queued'>('running');
  protected readonly ttl = signal(CHECK_IN_TTL_OPTIONS[0]?.seconds ?? 180);
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hostResources = computed(() => this.resources().filter((resource) => resource.host === this.host()));
  protected readonly value = eventValue;

  ngOnInit(): void {
    this.host.set(this.initialHost() ?? this.hosts()[0]?.id ?? '');
    const resource = this.initialResource();
    this.selectedResources.set(resource ? [resource] : []);
    this.owner.set(this.store.owner());
  }

  protected setHost(event: Event): void {
    this.host.set(eventValue(event));
    this.selectedResources.set([]);
  }

  protected setResources(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.selectedResources.set(Array.from(target.selectedOptions, (option) => option.value));
    }
  }

  protected setState(event: Event): void {
    this.state.set(eventValue(event) === 'queued' ? 'queued' : 'running');
  }

  protected numberValue(event: Event): number {
    return Number(eventValue(event));
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.title().trim() || !this.owner().trim() || !this.host()) {
      this.error.set('Machine, what you are doing, and your name are required.');
      return;
    }
    this.busy.set(true);
    const result = await this.store.checkIn({
      host: this.host(),
      title: this.title().trim(),
      owner: this.owner().trim(),
      project: this.project().trim(),
      resources: this.selectedResources(),
      state: this.state(),
      ttl_seconds: this.ttl(),
      source: 'check-in',
      note: this.note().trim(),
    });
    this.busy.set(false);
    if (result.ok) this.closed.emit();
    else this.error.set(result.error.message);
  }
}

@Component({
  selector: 'den-resource-edit-dialog',
  standalone: true,
  styles: [resourcesDialogStyles],
  template: `
    <div class="dialog-backdrop" (keydown.escape)="closed.emit()">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="resource-title" (submit)="submit($event)">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">Make it easy to reuse</p>
            <h3 id="resource-title">{{ editing() ? 'Edit shared resource' : 'Add shared resource' }}</h3>
          </div>
          <button type="button" class="close" aria-label="Close" (click)="closed.emit()">×</button>
        </div>
        <div class="form-row">
          <label>Resource ID
            <input name="id" required placeholder="m5-my-tool" [readOnly]="editing()" [value]="id()" (input)="id.set(value($event))" />
          </label>
          <label>Machine
            <select name="host" required [disabled]="editing()" (change)="host.set(value($event))">
              @for (option of hosts(); track option.id) {
                <option [value]="option.id" [selected]="option.id === host()">{{ option.name }}</option>
              }
            </select>
          </label>
        </div>
        <label>Name
          <input name="name" required placeholder="A clear name for this installation" [value]="name()" (input)="name.set(value($event))" />
        </label>
        <div class="form-row">
          <label>Kind
            <input name="kind" required [value]="kind()" (input)="kind.set(value($event))" />
          </label>
          <label>Lifecycle
            <select name="lifecycle" (change)="setLifecycle($event)">
              @for (option of lifecycles; track option) {
                <option [value]="option" [selected]="option === lifecycle()">{{ lifecycleLabel(option) }}</option>
              }
            </select>
          </label>
        </div>
        <label>Path on this host
          <input name="path" required placeholder="/home/agent/existing-install" [value]="path()" (input)="path.set(value($event))" />
        </label>
        <label>Path inside a container (if different)
          <input name="runtime_path" placeholder="container:/workspace/tool" [value]="runtimePath()" (input)="runtimePath.set(value($event))" />
        </label>
        <label>Access command or URL
          <input name="access" placeholder="ssh den-m5 or http://…" [value]="access()" (input)="access.set(value($event))" />
        </label>
        <label>Sharing and change guidance
          <textarea name="sharing" rows="2" placeholder="What can be shared? Who should be consulted before changes?" [value]="sharing()" (input)="sharing.set(value($event))"></textarea>
        </label>
        <label>Notes
          <textarea name="notes" rows="2" [value]="notes()" (input)="notes.set(value($event))"></textarea>
        </label>
        <label>Who is confirming this?
          <input name="owner" required placeholder="owner or agent name" [value]="owner()" (input)="owner.set(value($event))" />
        </label>
        <p class="form-help">Saving confirms this lifecycle today. It does not invent a last-used date.</p>
        @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          <button type="button" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="primary" [disabled]="busy()">Save resource</button>
        </div>
      </form>
    </div>
  `,
})
export class ResourceEditDialogComponent implements OnInit {
  private readonly store = inject(RESOURCES_STORE);
  readonly hosts = input.required<readonly DenResourcesHost[]>();
  /** The resource to edit, or null to add one. */
  readonly resource = input<DenResource | null>(null);
  readonly closed = output<void>();

  protected readonly lifecycles = RESOURCE_LIFECYCLES;
  protected readonly editing = computed(() => this.resource() !== null);
  protected readonly id = signal('');
  protected readonly host = signal('');
  protected readonly name = signal('');
  protected readonly kind = signal('installation');
  protected readonly lifecycle = signal<DenResourceLifecycle>('unknown');
  protected readonly path = signal('');
  protected readonly runtimePath = signal('');
  protected readonly access = signal('');
  protected readonly sharing = signal('');
  protected readonly notes = signal('');
  protected readonly owner = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly value = eventValue;

  ngOnInit(): void {
    const resource = this.resource();
    this.owner.set(this.store.owner());
    this.host.set(resource?.host ?? this.hosts()[0]?.id ?? '');
    if (!resource) return;
    this.id.set(resource.id);
    this.name.set(resource.name);
    this.kind.set(resource.kind || 'installation');
    this.lifecycle.set(resource.lifecycle || 'unknown');
    this.path.set(resource.path);
    this.runtimePath.set(resource.runtime_path);
    this.access.set(resource.access);
    this.sharing.set(resource.sharing);
    this.notes.set(resource.notes);
  }

  protected lifecycleLabel(lifecycle: DenResourceLifecycle): string {
    return LIFECYCLE_LABELS[lifecycle];
  }

  protected setLifecycle(event: Event): void {
    const next = eventValue(event);
    const match = RESOURCE_LIFECYCLES.find((lifecycle) => lifecycle === next);
    if (match) this.lifecycle.set(match);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const required = [this.id(), this.host(), this.name(), this.kind(), this.path(), this.owner()];
    if (required.some((field) => !field.trim())) {
      this.error.set('ID, machine, name, kind, path and who is confirming are required.');
      return;
    }
    this.busy.set(true);
    const result = await this.store.saveResource(
      {
        id: this.id().trim(),
        // An existing resource cannot move host, so its host is left out of an edit.
        ...(this.editing() ? {} : { host: this.host() }),
        name: this.name().trim(),
        kind: this.kind().trim(),
        lifecycle: this.lifecycle(),
        path: this.path().trim(),
        runtime_path: this.runtimePath().trim(),
        access: this.access().trim(),
        sharing: this.sharing().trim(),
        notes: this.notes().trim(),
      },
      this.owner(),
    );
    this.busy.set(false);
    if (result.ok) this.closed.emit();
    else this.error.set(result.error.message);
  }
}

@Component({
  selector: 'den-resource-use-dialog',
  standalone: true,
  styles: [resourcesDialogStyles],
  template: `
    <div class="dialog-backdrop" (keydown.escape)="closed.emit()">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="use-title" (submit)="submit($event)">
        <div class="dialog-heading">
          <h3 id="use-title">Record actual use today</h3>
          <button type="button" class="close" aria-label="Close" (click)="closed.emit()">×</button>
        </div>
        <p class="form-help">{{ resource().name }} · {{ resource().id }}</p>
        <label>Your name / agent
          <input name="owner" required placeholder="owner or agent name" [value]="owner()" (input)="owner.set(value($event))" />
        </label>
        <p class="form-help">Records when you used this resource. Its lifecycle and maintenance notes stay as recorded.</p>
        @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          <button type="button" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="primary" [disabled]="busy()">Record use</button>
        </div>
      </form>
    </div>
  `,
})
export class ResourceUseDialogComponent implements OnInit {
  private readonly store = inject(RESOURCES_STORE);
  readonly resource = input.required<DenResource>();
  readonly closed = output<void>();

  protected readonly owner = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly value = eventValue;

  ngOnInit(): void {
    this.owner.set(this.store.owner());
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.owner().trim()) {
      this.error.set('Your name is required.');
      return;
    }
    this.busy.set(true);
    const result = await this.store.recordUse(this.resource().id, this.owner());
    this.busy.set(false);
    if (result.ok) this.closed.emit();
    else this.error.set(result.error.message);
  }
}

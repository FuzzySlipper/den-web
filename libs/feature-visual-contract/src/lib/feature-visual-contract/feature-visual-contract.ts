import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe, KeyValuePipe } from '@angular/common';
import { projectVisualCanvas, formatVisualContract } from '@den-web/domain';
import type {
  VisualConstraintType,
  VisualImportance,
  VisualObjectPromotionRule,
} from '@den-web/protocol';
import {
  ARTIFACTS_STORE,
  DEN_FILE_EXCHANGE,
  VISUAL_CONTRACT_STORE,
} from '@den-web/store';

@Component({
  selector: 'den-visual-contract-workspace',
  imports: [FormsModule, JsonPipe, KeyValuePipe],
  templateUrl: './feature-visual-contract.html',
  styleUrl: './feature-visual-contract.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualContractWorkspaceComponent {
  protected readonly store = inject(VISUAL_CONTRACT_STORE);
  private readonly artifactsStore = inject(ARTIFACTS_STORE);
  private readonly files = inject(DEN_FILE_EXCHANGE);
  protected readonly canvasObjects = computed(() =>
    projectVisualCanvas(this.store.referenceDraft()),
  );
  protected readonly evidenceItems = computed<readonly VisualEvidenceItem[]>(
    () => {
      const ref = this.store.referenceDraft()?.evidence.source_ref;
      if (!ref?.startsWith('den-artifact://')) return [];
      const state = this.artifactsStore.stateFor(ref);
      if (state.kind === 'data') {
        const artifact = state.value;
        const dimensions =
          artifact.width && artifact.height
            ? `${artifact.width} × ${artifact.height}`
            : null;
        return [
          {
            ref,
            label: artifact.logical_name,
            status: 'ready',
            contentUrl: this.artifactsStore.contentUrl(artifact),
            error: null,
            mimeType: artifact.mime_type,
            byteCount: String(artifact.byte_count),
            dimensions,
            sha256: artifact.sha256,
            sensitive: artifact.sensitive,
            retention: artifact.expires_at ?? 'retained',
          },
        ];
      }
      if (state.kind === 'error') {
        return [
          {
            ref,
            label: 'Reference evidence',
            status: 'error',
            contentUrl: null,
            error: state.error.message,
            mimeType: null,
            byteCount: null,
            dimensions: null,
            sha256: null,
            sensitive: false,
            retention: null,
          },
        ];
      }
      return [
        {
          ref,
          label: 'Reference evidence',
          status: 'loading',
          contentUrl: null,
          error: null,
          mimeType: null,
          byteCount: null,
          dimensions: null,
          sha256: null,
          sensitive: false,
          retention: null,
        },
      ];
    },
  );
  protected readonly renameValue = signal('');
  protected readonly roleValue = signal('');
  protected readonly domainRoleValue = signal('');
  protected readonly importanceValue = signal<VisualImportance>('major');
  protected readonly evidenceRefValue = signal('');
  protected readonly constraintId = signal('selected_object_exists');
  protected readonly constraintType =
    signal<VisualConstraintType>('object_exists');
  protected readonly constraintImportance = signal<VisualImportance>('major');

  protected async importFile(
    event: Event,
    destination: 'reference' | 'candidate',
  ): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.item(0);
    if (!file) return;
    const text = await this.files.readText(file);
    if (destination === 'reference') this.store.importReference(text);
    else this.store.importCandidate(text);
    input.value = '';
  }

  protected selectObject(objectId: string): void {
    this.store.selectObject(objectId);
    const object = this.store
      .referenceDraft()
      ?.objects.find((item) => item.id === objectId);
    this.renameValue.set(object?.id ?? '');
    this.roleValue.set(object?.role ?? '');
    this.domainRoleValue.set(object?.domain_role ?? '');
    this.importanceValue.set(object?.importance ?? 'major');
  }

  protected applyObjectEdits(): void {
    const selected = this.store.selectedObject();
    if (!selected) return;
    const targetId = this.renameValue().trim() || selected.id;
    const rule: VisualObjectPromotionRule = {
      source_id: selected.id,
      target_id: targetId,
      role: this.roleValue().trim() || selected.role,
      domain_role: this.domainRoleValue().trim(),
      importance: this.importanceValue(),
    };
    void this.store.promoteSelected(rule);
  }

  protected useEvidenceRef(): void {
    const ref = this.evidenceRefValue().trim();
    if (!ref) return;
    this.store.setEvidenceSource(ref);
    if (ref.startsWith('den-artifact://')) void this.artifactsStore.load(ref);
  }

  protected addConstraint(): void {
    const object = this.store.selectedObject();
    const id = this.constraintId().trim();
    if (!object || !id) return;
    if (this.constraintType() === 'area_ratio') {
      void this.store.addConstraint({
        id,
        type: 'area_ratio',
        object: object.id,
        importance: this.constraintImportance(),
        min_viewport_area_ratio: 0.05,
      });
      return;
    }
    void this.store.addConstraint({
      id,
      type: 'object_exists',
      object: object.id,
      importance: this.constraintImportance(),
    });
  }

  protected exportReference(): void {
    const contract = this.store.referenceDraft();
    if (contract)
      this.files.downloadJson(
        `${contract.scene.id}.visual-contract.json`,
        formatVisualContract(contract),
      );
  }

  protected setText(
    target: 'rename' | 'role' | 'domain' | 'evidence' | 'constraint',
    value: string,
  ): void {
    if (target === 'rename') this.renameValue.set(value);
    else if (target === 'role') this.roleValue.set(value);
    else if (target === 'domain') this.domainRoleValue.set(value);
    else if (target === 'evidence') this.evidenceRefValue.set(value);
    else this.constraintId.set(value);
  }

  protected setImportance(
    value: string,
    target: 'object' | 'constraint',
  ): void {
    if (!isImportance(value)) return;
    if (target === 'object') this.importanceValue.set(value);
    else this.constraintImportance.set(value);
  }

  protected setConstraintType(value: string): void {
    if (value === 'object_exists' || value === 'area_ratio')
      this.constraintType.set(value);
  }
}

interface VisualEvidenceItem {
  readonly ref: string;
  readonly label: string;
  readonly status: 'loading' | 'ready' | 'error';
  readonly contentUrl: string | null;
  readonly error: string | null;
  readonly mimeType: string | null;
  readonly byteCount: string | null;
  readonly dimensions: string | null;
  readonly sha256: string | null;
  readonly sensitive: boolean;
  readonly retention: string | null;
}

function isImportance(value: string): value is VisualImportance {
  return (
    value === 'critical' ||
    value === 'major' ||
    value === 'minor' ||
    value === 'advisory'
  );
}

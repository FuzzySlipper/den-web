import { computed, signal, type Signal } from '@angular/core';
import {
  ignoreVisualObject,
  parseVisualContractJson,
  renameVisualObject,
  updateEvidenceSource,
  updateVisualObject,
} from '@den-web/domain';
import type {
  DenResult,
  VisualComparisonReport,
  VisualConstraint,
  VisualContract,
  VisualContractRun,
  VisualImportance,
  VisualObject,
  VisualObjectPromotionRule,
  VisualPromotionResponse,
  VisualValidationResponse,
} from '@den-web/protocol';
import {
  dataState,
  errorState,
  idleState,
  loadingState,
  resultState,
  type AsyncState,
  unknownStoreError,
} from './async-state';

export interface VisualContractTransportPort {
  readonly validate: (
    contract: VisualContract,
  ) => Promise<DenResult<VisualValidationResponse>>;
  readonly buildAuthored: (
    contract: VisualContract,
    constraints: readonly VisualConstraint[],
  ) => Promise<DenResult<{ readonly contract: VisualContract }>>;
  readonly promote: (
    contract: VisualContract,
    objects: readonly VisualObjectPromotionRule[],
    ignoreObjects: readonly string[],
  ) => Promise<DenResult<VisualPromotionResponse>>;
  readonly compare: (
    reference: VisualContract,
    candidate: VisualContract,
  ) => Promise<DenResult<VisualComparisonReport>>;
  readonly getRun: (runId: string) => Promise<DenResult<VisualContractRun>>;
}

export interface VisualProofResult {
  readonly report: VisualComparisonReport;
  readonly run: VisualContractRun;
}

export interface VisualContractStore {
  readonly referenceDraft: Signal<VisualContract | null>;
  readonly candidateDraft: Signal<VisualContract | null>;
  readonly selectedObjectId: Signal<string | null>;
  readonly selectedObject: Signal<VisualObject | null>;
  readonly validation: Signal<AsyncState<VisualValidationResponse>>;
  readonly promotion: Signal<AsyncState<VisualPromotionResponse>>;
  readonly proof: Signal<AsyncState<VisualProofResult>>;
  readonly importError: Signal<string | null>;
  readonly dirty: Signal<boolean>;
  readonly importReference: (text: string) => void;
  readonly importCandidate: (text: string) => void;
  readonly selectObject: (objectId: string) => void;
  readonly renameSelected: (targetId: string) => void;
  readonly updateSelected: (updates: {
    readonly role?: string;
    readonly domainRole?: string;
    readonly importance?: VisualImportance;
  }) => void;
  readonly ignoreSelected: () => void;
  readonly setEvidenceSource: (sourceRef: string) => void;
  readonly addConstraint: (constraint: VisualConstraint) => Promise<void>;
  readonly promoteSelected: (rule: VisualObjectPromotionRule) => Promise<void>;
  readonly validateReference: () => Promise<void>;
  readonly runProof: () => Promise<void>;
}

export function createVisualContractStore(
  transport: VisualContractTransportPort,
): VisualContractStore {
  const referenceDraft = signal<VisualContract | null>(null);
  const candidateDraft = signal<VisualContract | null>(null);
  const selectedObjectId = signal<string | null>(null);
  const validation = signal<AsyncState<VisualValidationResponse>>(idleState());
  const promotion = signal<AsyncState<VisualPromotionResponse>>(idleState());
  const proof = signal<AsyncState<VisualProofResult>>(idleState());
  const importError = signal<string | null>(null);
  const dirty = signal(false);
  const selectedObject = computed(() => {
    const contract = referenceDraft();
    const id = selectedObjectId();
    return contract?.objects.find((object) => object.id === id) ?? null;
  });

  const importContract = (
    text: string,
    destination: 'reference' | 'candidate',
  ): void => {
    const parsed = parseVisualContractJson(text);
    if (!parsed.ok) {
      importError.set(parsed.error);
      return;
    }
    importError.set(null);
    if (destination === 'reference') {
      referenceDraft.set(parsed.value);
      selectedObjectId.set(parsed.value.objects[0]?.id ?? null);
      dirty.set(false);
      validation.set(idleState());
      promotion.set(idleState());
    } else {
      candidateDraft.set(parsed.value);
    }
    proof.set(idleState());
  };

  const replaceReference = (contract: VisualContract): void => {
    referenceDraft.set(contract);
    dirty.set(true);
    validation.set(idleState());
    proof.set(idleState());
  };

  return {
    referenceDraft: referenceDraft.asReadonly(),
    candidateDraft: candidateDraft.asReadonly(),
    selectedObjectId: selectedObjectId.asReadonly(),
    selectedObject,
    validation: validation.asReadonly(),
    promotion: promotion.asReadonly(),
    proof: proof.asReadonly(),
    importError: importError.asReadonly(),
    dirty: dirty.asReadonly(),
    importReference: (text) => importContract(text, 'reference'),
    importCandidate: (text) => importContract(text, 'candidate'),
    selectObject: (objectId) => selectedObjectId.set(objectId),
    renameSelected: (targetId) => {
      const contract = referenceDraft();
      const sourceId = selectedObjectId();
      if (!contract || !sourceId) return;
      const renamed = renameVisualObject(contract, sourceId, targetId);
      if (renamed === contract) return;
      replaceReference(renamed);
      selectedObjectId.set(targetId.trim());
    },
    updateSelected: (updates) => {
      const contract = referenceDraft();
      const objectId = selectedObjectId();
      if (!contract || !objectId) return;
      replaceReference(updateVisualObject(contract, objectId, updates));
    },
    ignoreSelected: () => {
      const contract = referenceDraft();
      const objectId = selectedObjectId();
      if (!contract || !objectId) return;
      const next = ignoreVisualObject(contract, objectId);
      replaceReference(next);
      selectedObjectId.set(next.objects[0]?.id ?? null);
    },
    setEvidenceSource: (sourceRef) => {
      const contract = referenceDraft();
      if (contract) replaceReference(updateEvidenceSource(contract, sourceRef));
    },
    addConstraint: async (constraint) => {
      const contract = referenceDraft();
      if (!contract) return;
      const existingConstraints = contract.constraints?.filter(
        (item) => item.id !== constraint.id,
      );
      const baseContract: VisualContract = {
        ...contract,
        ...(existingConstraints ? { constraints: existingConstraints } : {}),
      };
      validation.set(loadingState());
      try {
        const result = await transport.buildAuthored(baseContract, [
          constraint,
        ]);
        if (result.ok) {
          replaceReference(result.value.contract);
          validation.set(
            dataState({
              schema: result.value.contract.schema,
              valid: true,
              scene_id: result.value.contract.scene.id,
              counts: {
                constraints: result.value.contract.constraints?.length ?? 0,
              },
            }),
          );
        } else {
          validation.set(errorState(result.error));
        }
      } catch (error: unknown) {
        validation.set(errorState(unknownStoreError(error)));
      }
    },
    promoteSelected: async (rule) => {
      const contract = referenceDraft();
      if (!contract) return;
      promotion.set(loadingState());
      try {
        const result = await transport.promote(contract, [rule], []);
        promotion.set(resultState(result));
        if (result.ok) {
          referenceDraft.set(result.value.contract);
          selectedObjectId.set(rule.target_id ?? rule.source_id);
          dirty.set(true);
        }
      } catch (error: unknown) {
        promotion.set(errorState(unknownStoreError(error)));
      }
    },
    validateReference: async () => {
      const contract = referenceDraft();
      if (!contract) return;
      validation.set(loadingState());
      try {
        validation.set(resultState(await transport.validate(contract)));
      } catch (error: unknown) {
        validation.set(errorState(unknownStoreError(error)));
      }
    },
    runProof: async () => {
      const reference = referenceDraft();
      const candidate = candidateDraft();
      if (!reference || !candidate) return;
      proof.set(loadingState());
      try {
        const comparison = await transport.compare(reference, candidate);
        if (!comparison.ok) {
          proof.set(errorState(comparison.error));
          return;
        }
        const run = await transport.getRun(comparison.value.run_id);
        proof.set(
          run.ok
            ? dataState({ report: comparison.value, run: run.value })
            : errorState(run.error),
        );
      } catch (error: unknown) {
        proof.set(errorState(unknownStoreError(error)));
      }
    },
  };
}

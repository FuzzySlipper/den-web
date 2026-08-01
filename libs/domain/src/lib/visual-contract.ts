import type {
  VisualConstraint,
  VisualContract,
  VisualEvidenceRecord,
  VisualImportance,
  VisualObject,
} from '@den-web/protocol';

export type VisualContractParseResult =
  | { readonly ok: true; readonly value: VisualContract }
  | { readonly ok: false; readonly error: string };

export interface VisualCanvasObject {
  readonly object: VisualObject;
  readonly leftPercent: number;
  readonly topPercent: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
}

export function projectVisualCanvas(
  contract: VisualContract | null,
): readonly VisualCanvasObject[] {
  if (!contract) return [];
  return contract.objects.map((object) => ({
    object,
    leftPercent: object.bounds.x * 100,
    topPercent: object.bounds.y * 100,
    widthPercent: object.bounds.w * 100,
    heightPercent: object.bounds.h * 100,
  }));
}

export function parseVisualContractJson(
  text: string,
): VisualContractParseResult {
  try {
    const value: unknown = JSON.parse(text);
    if (!isVisualContract(value)) {
      return {
        ok: false,
        error:
          'Expected a layered-visual-contract/v0.1 document with scene, layers, objects, spaces, and evidence.',
      };
    }
    return { ok: true, value };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON document.',
    };
  }
}

export function renameVisualObject(
  contract: VisualContract,
  sourceId: string,
  targetId: string,
): VisualContract {
  const normalizedTarget = targetId.trim();
  if (
    !normalizedTarget ||
    sourceId === normalizedTarget ||
    contract.objects.some((object) => object.id === normalizedTarget)
  )
    return contract;
  const rename = (id: string): string =>
    id === sourceId ? normalizedTarget : id;
  return {
    ...contract,
    layers: contract.layers.map((layer) => ({
      ...layer,
      ...(layer.contains ? { contains: layer.contains.map(rename) } : {}),
    })),
    objects: contract.objects.map((object) => ({
      ...object,
      id: rename(object.id),
      parent: rename(object.parent),
      ...(object.children ? { children: object.children.map(rename) } : {}),
    })),
    ...(contract.relations
      ? {
          relations: contract.relations.map((relation) => ({
            ...relation,
            ...(relation.a ? { a: rename(relation.a) } : {}),
            ...(relation.b ? { b: rename(relation.b) } : {}),
            ...(relation.items ? { items: relation.items.map(rename) } : {}),
          })),
        }
      : {}),
    ...(contract.constraints
      ? {
          constraints: contract.constraints.map((constraint) =>
            renameConstraintObjects(constraint, rename),
          ),
        }
      : {}),
    evidence: {
      ...contract.evidence,
      ...(contract.evidence.records
        ? {
            records: contract.evidence.records.map((record) => ({
              ...record,
              ...(record.object_refs
                ? { object_refs: record.object_refs.map(rename) }
                : {}),
            })),
          }
        : {}),
    },
  };
}

export function updateVisualObject(
  contract: VisualContract,
  objectId: string,
  updates: {
    readonly role?: string;
    readonly domainRole?: string;
    readonly importance?: VisualImportance;
  },
): VisualContract {
  return {
    ...contract,
    objects: contract.objects.map((object) =>
      object.id === objectId
        ? {
            ...object,
            ...(updates.role !== undefined
              ? { role: updates.role.trim() }
              : {}),
            ...(updates.domainRole !== undefined && updates.domainRole.trim()
              ? { domain_role: updates.domainRole.trim() }
              : {}),
            ...(updates.importance !== undefined
              ? { importance: updates.importance }
              : {}),
          }
        : object,
    ),
  };
}

export function ignoreVisualObject(
  contract: VisualContract,
  objectId: string,
): VisualContract {
  const references = (constraint: VisualConstraint): boolean =>
    constraint.object === objectId ||
    constraint.a === objectId ||
    constraint.b === objectId ||
    constraint.items?.includes(objectId) === true;
  return {
    ...contract,
    layers: contract.layers.map((layer) => ({
      ...layer,
      ...(layer.contains
        ? { contains: layer.contains.filter((id) => id !== objectId) }
        : {}),
    })),
    objects: contract.objects
      .filter((object) => object.id !== objectId)
      .map((object) => ({
        ...object,
        ...(object.children
          ? { children: object.children.filter((id) => id !== objectId) }
          : {}),
      })),
    ...(contract.relations
      ? {
          relations: contract.relations.filter(
            (relation) =>
              relation.a !== objectId &&
              relation.b !== objectId &&
              relation.items?.includes(objectId) !== true,
          ),
        }
      : {}),
    ...(contract.constraints
      ? {
          constraints: contract.constraints.filter(
            (constraint) => !references(constraint),
          ),
        }
      : {}),
    evidence: {
      ...contract.evidence,
      ...(contract.evidence.records
        ? {
            records: contract.evidence.records
              .map((record) => ({
                ...record,
                ...(record.object_refs
                  ? {
                      object_refs: record.object_refs.filter(
                        (id) => id !== objectId,
                      ),
                    }
                  : {}),
              }))
              .filter(
                (record) =>
                  record.object_refs === undefined ||
                  record.object_refs.length > 0,
              ),
          }
        : {}),
    },
  };
}

export function updateEvidenceSource(
  contract: VisualContract,
  sourceRef: string,
): VisualContract {
  return {
    ...contract,
    evidence: { ...contract.evidence, source_ref: sourceRef.trim() },
  };
}

export function formatVisualContract(contract: VisualContract): string {
  return JSON.stringify(contract, null, 2);
}

function renameConstraintObjects(
  constraint: VisualConstraint,
  rename: (id: string) => string,
): VisualConstraint {
  return {
    ...constraint,
    ...(constraint.object ? { object: rename(constraint.object) } : {}),
    ...(constraint.a ? { a: rename(constraint.a) } : {}),
    ...(constraint.b ? { b: rename(constraint.b) } : {}),
    ...(constraint.items ? { items: constraint.items.map(rename) } : {}),
  };
}

function isVisualContract(value: unknown): value is VisualContract {
  if (!isRecord(value) || value['schema'] !== 'layered-visual-contract/v0.1')
    return false;
  if (!isRecord(value['scene']) || !isRecord(value['evidence'])) return false;
  if (
    !Array.isArray(value['spaces']) ||
    !Array.isArray(value['layers']) ||
    !Array.isArray(value['objects'])
  )
    return false;
  const scene = value['scene'];
  if (
    typeof scene['id'] !== 'string' ||
    typeof scene['type'] !== 'string' ||
    typeof scene['coordinate_mode'] !== 'string' ||
    !isViewport(scene['viewport'])
  )
    return false;
  return (
    value['layers'].every(isLayer) &&
    value['objects'].every(isVisualObject) &&
    isEvidence(value['evidence'])
  );
}

function isViewport(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['width_px'] === 'number' &&
    typeof value['height_px'] === 'number'
  );
}

function isLayer(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['z'] === 'number' &&
    optionalStringArray(value['contains'])
  );
}

function isVisualObject(value: unknown): value is VisualObject {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['kind'] === 'string' &&
    typeof value['role'] === 'string' &&
    typeof value['parent'] === 'string' &&
    typeof value['layer'] === 'string' &&
    isBounds(value['bounds']) &&
    isImportance(value['importance']) &&
    typeof value['confidence'] === 'number'
  );
}

function isBounds(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['x'] === 'number' &&
    typeof value['y'] === 'number' &&
    typeof value['w'] === 'number' &&
    typeof value['h'] === 'number'
  );
}

function isEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['source_type'] === 'string' &&
    typeof value['generated_by'] === 'string' &&
    typeof value['overall_confidence'] === 'number' &&
    (value['records'] === undefined ||
      (Array.isArray(value['records']) &&
        value['records'].every(isEvidenceRecord)))
  );
}

function isEvidenceRecord(value: unknown): value is VisualEvidenceRecord {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['kind'] === 'string' &&
    typeof value['confidence'] === 'number'
  );
}

function optionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isImportance(value: unknown): value is VisualImportance {
  return (
    value === 'critical' ||
    value === 'major' ||
    value === 'minor' ||
    value === 'advisory'
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

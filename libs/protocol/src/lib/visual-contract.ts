// Schema-derived from den-services/visual-contract layered-visual-contract/v0.1.
export type VisualImportance = 'critical' | 'major' | 'minor' | 'advisory';
export type VisualConstraintType =
  | 'object_exists'
  | 'layout_relation'
  | 'relative_position'
  | 'alignment'
  | 'area_ratio'
  | 'bounds_tolerance'
  | 'containment';
export type VisualRelationType =
  | 'left_of'
  | 'right_of'
  | 'above'
  | 'below'
  | 'inside'
  | 'contains'
  | 'overlaps'
  | 'aligned_left'
  | 'aligned_right'
  | 'aligned_top'
  | 'aligned_bottom'
  | 'dominant_over';

export interface VisualViewport {
  readonly width_px: number;
  readonly height_px: number;
}
export interface VisualPixelBounds {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface VisualBounds {
  readonly space?: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly px?: VisualPixelBounds;
}
export interface VisualScene {
  readonly id: string;
  readonly type: string;
  readonly viewport: VisualViewport;
  readonly coordinate_mode: string;
}
export interface VisualProject {
  readonly id: string;
  readonly vocabulary?: string;
  readonly roles?: readonly string[];
}
export interface VisualSpace {
  readonly id: string;
  readonly kind: string;
  readonly bounds: VisualBounds;
}
export interface VisualLayer {
  readonly id: string;
  readonly z: number;
  readonly contains?: readonly string[];
}
export interface VisualObject {
  readonly id: string;
  readonly kind: string;
  readonly role: string;
  readonly domain_role?: string;
  readonly parent: string;
  readonly layer: string;
  readonly text?: string;
  readonly bounds: VisualBounds;
  readonly children?: readonly string[];
  readonly importance: VisualImportance;
  readonly confidence: number;
  readonly evidence_refs?: readonly string[];
  readonly style?: Readonly<Record<string, string>>;
  readonly semantic_description?: string;
}
export interface VisualRelation {
  readonly type: VisualRelationType;
  readonly a?: string;
  readonly b?: string;
  readonly items?: readonly string[];
  readonly confidence: number;
  readonly evidence_ref?: string;
}
export interface VisualConstraint {
  readonly id: string;
  readonly type: VisualConstraintType;
  readonly object?: string;
  readonly role?: string;
  readonly domain_role?: string;
  readonly a?: string;
  readonly b?: string;
  readonly relation?: VisualRelationType;
  readonly items?: readonly string[];
  readonly edge?: 'left' | 'right' | 'top' | 'bottom';
  readonly importance: VisualImportance;
  readonly tolerance_norm?: number;
  readonly min_viewport_area_ratio?: number;
  readonly max_delta_norm?: number;
}
export interface VisualEvidenceRecord {
  readonly id: string;
  readonly kind: string;
  readonly source_ref?: string;
  readonly object_refs?: readonly string[];
  readonly confidence: number;
}
export interface VisualEvidenceSet {
  readonly source_type: string;
  readonly source_ref?: string;
  readonly generated_by: string;
  readonly overall_confidence: number;
  readonly records?: readonly VisualEvidenceRecord[];
}
export interface VisualContract {
  readonly schema: 'layered-visual-contract/v0.1';
  readonly scene: VisualScene;
  readonly project?: VisualProject;
  readonly spaces: readonly VisualSpace[];
  readonly layers: readonly VisualLayer[];
  readonly objects: readonly VisualObject[];
  readonly relations?: readonly VisualRelation[];
  readonly constraints?: readonly VisualConstraint[];
  readonly evidence: VisualEvidenceSet;
}

export interface VisualArtifactRefs {
  readonly reference_overlay?: string;
  readonly candidate_overlay?: string;
  readonly diff_overlay?: string;
  readonly reference_contract?: string;
  readonly candidate_contract?: string;
  readonly report?: string;
}
export interface VisualCheckResult {
  readonly status: 'pass' | 'fail' | 'warn';
  readonly severity: VisualImportance;
  readonly constraint: string;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly match_confidence: number;
  readonly match_strategy: string;
  readonly evidence?: Readonly<Record<string, string>>;
  readonly involved_objects?: readonly string[];
  readonly measured?: Readonly<Record<string, number>>;
  readonly reference_bounds?: VisualBounds;
  readonly candidate_bounds?: VisualBounds;
  readonly repair_hint?: string;
}
export interface VisualDiagnosticGroup {
  readonly key: string;
  readonly severity: VisualImportance;
  readonly count: number;
  readonly constraints: readonly string[];
}
export interface VisualComparisonReport {
  readonly schema: string;
  readonly run_id: string;
  readonly score: number;
  readonly verdict: 'pass' | 'needs_revision' | 'fail';
  readonly passes?: readonly VisualCheckResult[];
  readonly failures?: readonly VisualCheckResult[];
  readonly warnings?: readonly VisualCheckResult[];
  readonly groups?: readonly VisualDiagnosticGroup[];
  readonly artifacts: VisualArtifactRefs;
}
export interface VisualValidationResponse {
  readonly schema: string;
  readonly valid: boolean;
  readonly scene_id: string;
  readonly counts: Readonly<Record<string, number>>;
}
export interface VisualContractRun {
  readonly run_id: string;
  readonly created_at: string;
  readonly artifacts: Readonly<Record<string, string>>;
  readonly names: readonly string[];
}
export interface VisualObjectPromotionRule {
  readonly source_id: string;
  readonly target_id?: string;
  readonly role?: string;
  readonly domain_role?: string;
  readonly parent_id?: string;
  readonly kind?: string;
  readonly importance?: VisualImportance;
  readonly semantic_description?: string;
  readonly ignore?: boolean;
}
export interface VisualPromotionDiagnostic {
  readonly severity: string;
  readonly code: string;
  readonly message: string;
  readonly source_id?: string;
  readonly target_id?: string;
}
export interface VisualPromotionResponse {
  readonly contract: VisualContract;
  readonly diagnostics?: readonly VisualPromotionDiagnostic[];
}

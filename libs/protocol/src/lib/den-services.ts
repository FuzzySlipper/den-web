export const DEN_GLOBAL_PROJECT_ID = '_global';

export interface DenProject {
  readonly id: string;
  readonly name?: string;
  readonly visibility?: string;
}

export interface DenSpace {
  readonly id: string;
  readonly name?: string;
  readonly kind?: string;
  readonly visibility?: string;
}

export interface DenTaskSummary {
  readonly id: number;
  readonly project_id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly priority?: number | null;
  readonly assigned_to?: string | null;
  readonly parent_id?: number | null;
  readonly tags?: readonly string[] | null;
  readonly availability?: string | null;
  readonly dependency_count?: number | null;
  readonly unfinished_dependency_count?: number | null;
  readonly subtask_count?: number | null;
  readonly description?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface DenTaskDetail {
  readonly task: DenTaskSummary;
  readonly dependencies?: readonly DenTaskSummary[];
  readonly subtasks?: readonly DenTaskSummary[];
  readonly recent_messages?: readonly DenMessage[];
  readonly human_acceptance_reviews?: readonly DenHumanAcceptanceReview[];
}

export type DenManualReviewMode = 'exact' | 'best_effort';

export interface DenManualReviewSource {
  readonly repository: string;
  readonly commit_sha: string;
  readonly ref: string;
}

export interface DenManualReviewCapability {
  readonly eligible: boolean;
  readonly mode: DenManualReviewMode;
  readonly label?: string;
  readonly detail?: string;
  readonly source?: DenManualReviewSource;
}

export interface DenManualReviewReceipt {
  readonly mode: DenManualReviewMode;
  readonly status: string;
  readonly message: string;
  readonly job_id?: string;
  readonly round_id?: number;
}

export type DenHumanAcceptanceLifecycleEffect =
  | 'record_only'
  | 'complete_task'
  | 'complete_task_and_parent';

export interface DenHumanAcceptanceReview {
  readonly id: number;
  readonly task_id: number;
  readonly project_id: string;
  readonly reviewer_identity: string;
  readonly verdict: 'looks_good';
  readonly rationale: string;
  readonly reviewed_revision?: string;
  readonly reviewed_build?: string;
  readonly reviewed_environment?: string;
  readonly evidence_links?: readonly string[];
  readonly lifecycle_effect: DenHumanAcceptanceLifecycleEffect;
  readonly note_markdown: string;
  readonly task_status_before: string;
  readonly task_status_after: string;
  readonly parent_task_id?: number;
  readonly parent_status_before?: string;
  readonly parent_status_after?: string;
  readonly created_at: string;
}

export interface DenRecordHumanAcceptanceRequest {
  readonly reviewer_identity: string;
  readonly verdict: 'looks_good';
  readonly rationale?: string;
  readonly reviewed_revision?: string;
  readonly reviewed_build?: string;
  readonly reviewed_environment?: string;
  readonly evidence_links?: readonly string[];
  readonly lifecycle_effect: DenHumanAcceptanceLifecycleEffect;
  readonly idempotency_key: string;
  readonly expected_task_updated_at?: string;
}

export interface DenRecordHumanAcceptanceResponse {
  readonly acceptance: DenHumanAcceptanceReview;
  readonly task: DenTaskSummary;
  readonly parent?: DenTaskSummary;
  readonly changed_task_ids: readonly number[];
  readonly unchanged_task_ids: readonly number[];
  readonly independent_review_state: {
    readonly agent_review_rounds_changed: boolean;
    readonly agent_findings_changed: boolean;
    readonly github_gates_changed: boolean;
  };
  readonly warnings: readonly string[];
  readonly audit_handle: string;
}

export interface DenTaskUpdateRequest {
  readonly agent?: string;
  readonly status?: string;
  readonly description?: string | null;
}

export interface DenMessage {
  readonly id: number;
  readonly project_id?: string;
  readonly task_id?: number | null;
  readonly thread_id?: number | null;
  readonly sender?: string;
  readonly intent?: string | null;
  readonly content?: string;
  readonly summary?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly created_at?: string;
}

export interface DenMessageThread {
  readonly root?: DenMessage;
  readonly replies?: readonly DenMessage[];
}

export type DenMessageThreadResponse = readonly DenMessage[] | DenMessageThread;

export interface DenArtifactMetadata {
  readonly artifact_id: string;
  readonly artifact_ref: string;
  readonly project_id?: string;
  readonly task_id?: number | null;
  readonly review_round_id?: number | null;
  readonly finding_id?: number | null;
  readonly owner_kind?: string;
  readonly owner_id?: string;
  readonly logical_name: string;
  readonly mime_type: string;
  readonly byte_count: number;
  readonly sha256: string;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly sensitive: boolean;
  readonly storage_backend?: string;
  readonly storage_key?: string;
  readonly created_by?: string;
  readonly created_at?: string;
  readonly expires_at?: string | null;
  readonly deleted_at?: string | null;
}

export interface DenDocumentSummary {
  readonly id?: number;
  readonly project_id: string;
  readonly slug: string;
  readonly title: string;
  readonly doc_type?: string;
  readonly visibility?: string;
  readonly tags?: readonly string[] | null;
  readonly summary?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface DenDocumentDetail extends DenDocumentSummary {
  readonly content?: string;
  readonly content_markdown?: string;
  readonly tags?: readonly string[] | null;
}

export interface DenDocumentUpdateRequest {
  readonly agent?: string;
  readonly title?: string;
  readonly content?: string;
  readonly content_markdown?: string;
  readonly doc_type?: string;
  readonly tags?: readonly string[] | null;
  readonly summary?: string | null;
}

export interface DenKnowledgeSourceRef {
  readonly source_kind: string;
  readonly source_id: string;
  readonly project_id?: string;
  readonly task_id?: number;
  readonly message_id?: number;
  readonly url?: string;
  readonly note?: string;
}

export interface DenKnowledgeEntrySummary {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly summary?: string;
  readonly kind: string;
  readonly status: string;
  readonly curation_state: string;
  readonly tags?: readonly string[];
  readonly audience?: readonly string[];
  readonly aliases?: readonly string[];
  readonly source_refs?: readonly DenKnowledgeSourceRef[];
  readonly accuracy_notes?: string;
  readonly replacement_slug?: string;
  readonly last_reviewed_at?: string;
  readonly review_due_at?: string;
  readonly created_by?: string;
  readonly updated_by?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DenKnowledgeEntryDetail extends DenKnowledgeEntrySummary {
  readonly body_markdown: string;
}

export interface DenKnowledgeListResponse {
  readonly items: readonly DenKnowledgeEntrySummary[];
  readonly count: number;
}

export interface DenGuidanceEntry {
  readonly id: number;
  readonly project_id: string;
  readonly document_project_id: string;
  readonly document_slug: string;
  readonly importance: string;
  readonly audience?: readonly string[] | null;
  readonly sort_order: number;
  readonly notes?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface DenGuidanceEntryListResponse {
  readonly entries: readonly DenGuidanceEntry[];
  readonly count: number;
}

export interface DenGuidanceEntryRequest {
  readonly document_project_id?: string;
  readonly document_slug: string;
  readonly importance?: string;
  readonly audience?: readonly string[];
  readonly sort_order?: number;
  readonly notes?: string;
}

export interface DenGuidanceDeleteResponse {
  readonly deleted: boolean;
  readonly message?: string;
}

export interface DenGuidancePacket {
  readonly project_id: string;
  readonly resolved_at?: string;
  readonly sources?: readonly DenGuidanceSource[];
  readonly skipped_sources?: readonly DenGuidanceSkippedSource[];
  readonly content_markdown?: string;
  readonly content_sha256?: string;
  readonly content_bytes?: number;
  readonly truncated?: boolean;
  readonly incomplete?: boolean;
}

export interface DenGuidanceSource {
  readonly entry_id: number;
  readonly source_scope: string;
  readonly document_project_id: string;
  readonly document_slug: string;
  readonly document_title?: string;
  readonly document_type?: string;
  readonly document_updated_at?: string;
  readonly visibility?: string;
  readonly tags?: readonly string[] | null;
  readonly importance: string;
  readonly audience?: readonly string[] | null;
  readonly sort_order: number;
  readonly notes?: string | null;
  readonly content_bytes?: number;
}

export interface DenGuidanceSkippedSource {
  readonly entry_id: number;
  readonly source_scope: string;
  readonly document_project_id: string;
  readonly document_slug: string;
  readonly importance: string;
  readonly reason: string;
  readonly required: boolean;
}

export interface DenDiscussion {
  readonly comments?: readonly DenDiscussionComment[];
}

export interface DenDiscussionComment {
  readonly id: number;
  readonly author?: string;
  readonly author_identity?: string;
  readonly content?: string;
  readonly body_markdown?: string;
  readonly parent_id?: number | null;
  readonly parent_comment_id?: number | null;
  readonly created_at?: string;
}

export interface DenBoardPost {
  readonly id: number;
  readonly project_id: string;
  readonly title: string;
  readonly body_markdown: string;
  readonly author_identity: string;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DenBoardPostSummary {
  readonly id: number;
  readonly project_id: string;
  readonly title: string;
  readonly author_identity: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DenBoardComment {
  readonly id: number;
  readonly post_id: number;
  readonly parent_comment_id?: number;
  readonly author_identity?: string;
  readonly body_markdown?: string;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly status: string;
  readonly deleted?: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DenBoardSearchResult {
  readonly kind: string;
  readonly id: number;
  readonly post_id: number;
  readonly project_id: string;
  readonly title?: string;
  readonly author_identity?: string;
  readonly snippet: string;
  readonly rank: number;
  readonly created_at: string;
}

export interface DenBoardPostPage {
  readonly posts: readonly DenBoardPostSummary[];
  readonly next_after_id?: number | null;
}

export interface DenBoardCommentPage {
  readonly comments: readonly DenBoardComment[];
  readonly next_after_id?: number | null;
}

export interface DenBoardSearchPage {
  readonly results: readonly DenBoardSearchResult[];
  readonly next_after_id?: number | null;
}

export interface DenBoardCommentPath {
  readonly post: DenBoardPost;
  readonly comments: readonly DenBoardComment[];
  readonly truncated: boolean;
}

export interface DenBoardCreatePostRequest {
  readonly title: string;
  readonly body_markdown: string;
  readonly author_identity: string;
}

export interface DenBoardCreateCommentRequest {
  readonly parent_comment_id?: number;
  readonly body_markdown: string;
  readonly author_identity: string;
}

export interface DenBoardPurgeRequest {
  readonly actor_identity: string;
  readonly reason: string;
}

export interface DenTimelineResponse {
  readonly items?: readonly DenTimelineItem[];
  readonly next_cursor?: string | null;
  readonly nextCursor?: string | null;
}

export interface DenTimelineItem {
  readonly id?: string | number;
  readonly timeline_id?: string;
  readonly timelineId?: string;
  readonly cursor?: string | null;
  readonly kind?: string;
  readonly type?: string;
  readonly event_kind?: string;
  readonly eventKind?: string;
  readonly render_kind?: string;
  readonly renderKind?: string;
  readonly source_domain?: string;
  readonly sourceDomain?: string;
  readonly source_id?: string;
  readonly sourceId?: string;
  readonly title?: string | null;
  readonly body?: string | null;
  readonly summary?: string | null;
  readonly created_at?: string;
  readonly createdAt?: string;
  readonly occurred_at?: string;
  readonly occurredAt?: string;
  readonly sender_identity?: string;
  readonly sender?: string;
  readonly agent_identity?: string;
  readonly actor?: {
    readonly type?: string;
    readonly identity?: string;
    readonly profile_identity?: string | null;
    readonly profileIdentity?: string | null;
    readonly agent_instance_id?: string | null;
    readonly agentInstanceId?: string | null;
  } | null;
  readonly payload?: Readonly<Record<string, unknown>> | null;
  readonly metadata?: Readonly<Record<string, unknown>> | string | null;
}

export interface DenObservationLane {
  readonly items?: readonly DenObservationItem[];
  readonly source_health?: readonly DenObservationSourceHealth[];
}

export interface DenObservationItem {
  readonly id?: string | number;
  readonly agent?: string | null;
  readonly agent_identity?: string | null;
  readonly title?: string | null;
  readonly summary?: string | null;
  readonly status?: string | null;
  readonly severity?: string | null;
  readonly project_id?: string | null;
  readonly task_id?: number | null;
  readonly updated_at?: string | null;
}

export interface DenObservationSourceHealth {
  readonly source?: string | null;
  readonly status?: string | null;
  readonly checked_at?: string | null;
  readonly detail?: string | null;
}

export interface DenDeliveryTargetIdentity {
  readonly profile: string;
  readonly instance_id: string;
  readonly session_key?: string;
}

export interface DenDeliveryIntentRequest {
  readonly target_identity: DenDeliveryTargetIdentity;
  readonly idempotency_key: string;
  readonly ttl_seconds?: number;
  readonly source_ref?: string;
  readonly channel_message_id?: number;
}

export interface DenDeliveryIntent {
  readonly id?: string | number;
  readonly state?: string;
  readonly status?: string;
  readonly target_identity?: DenDeliveryTargetIdentity;
  readonly idempotency_key?: string;
  readonly source_ref?: string | null;
  readonly channel_message_id?: number | null;
}

export interface DenLibrarianQueryRequest {
  readonly query: string;
}

export interface DenLibrarianQueryResponse {
  readonly answer?: string;
  readonly sources?: readonly unknown[];
}

export interface DenDocPublishRequest {
  readonly source: {
    readonly project_id?: string;
    readonly document_project_id: string;
    readonly document_slug: string;
  };
  readonly options?: {
    readonly tags?: readonly string[];
    readonly overwrite?: boolean;
  };
  readonly requested_by?: string;
  readonly document?: {
    readonly title: string;
    readonly slug?: string;
    readonly markdown: string;
    readonly updated_at?: string;
  };
}

export interface DenDocPublishResponse {
  readonly id?: string;
  readonly publication_id?: string;
  readonly status?: string;
  readonly dry_run?: boolean;
  readonly title?: string;
  readonly slug?: string;
  readonly post_path?: string;
  readonly public_url?: string;
  readonly git_commit?: string;
  readonly preview_markdown?: string;
  readonly warnings?: readonly string[];
}

// Ops: central backup and maintenance status (den-services docs/ops-api-contract.md).

export type DenOpsJobStatus =
  | 'unknown'
  | 'failed'
  | 'overdue'
  | 'never_reported'
  | 'warning'
  | 'running'
  | 'ok'
  | 'disabled';

export type DenOpsRunState = 'running' | 'success' | 'warning' | 'failed' | 'skipped';

export interface DenOpsRun {
  readonly job_id: string;
  readonly run_id: string;
  readonly host: string;
  readonly kind: string;
  readonly engine: string;
  readonly runner: string;
  readonly state: DenOpsRunState;
  readonly terminal: boolean;
  readonly phase: string;
  readonly started_at: string;
  readonly updated_at: string;
  readonly finished_at: string | null;
  readonly exit_code: number | null;
  readonly error: string;
  readonly reason: string;
  readonly warnings: readonly string[];
  readonly notices: readonly string[];
  readonly target: string;
  readonly archive_id: string;
  readonly archive_name: string;
  readonly original_bytes: number | null;
  readonly compressed_bytes: number | null;
  readonly deduplicated_bytes: number | null;
  readonly file_count: number | null;
  readonly duration_seconds: number | null;
  readonly complete: boolean;
  readonly log_path: string;
  readonly manifest_path: string;
  readonly run_directory: string;
  readonly recovery_pointer: string;
  readonly received_at: string;
  readonly report_count: number;
}

export interface DenOpsVerification {
  readonly job_id: string;
  readonly verification_id: string;
  readonly run_id: string;
  readonly kind: 'verification' | 'restore_test';
  readonly check_type: string;
  readonly state: 'success' | 'warning' | 'failed';
  readonly at: string;
  readonly scope: string;
  readonly archive: string;
  readonly full_data_read: boolean | null;
  readonly evidence_path: string;
  readonly checked: readonly string[];
  readonly received_at: string;
}

export interface DenOpsSchedule {
  readonly timezone: string;
  readonly times: readonly string[];
  readonly weekdays: readonly string[];
  readonly grace_seconds: number;
}

export interface DenOpsJob {
  readonly job_id: string;
  readonly host_id: string;
  readonly display_name: string;
  readonly engine: string;
  readonly kind: string;
  readonly source: string;
  readonly scope: string;
  readonly target: string;
  readonly schedule: DenOpsSchedule | null;
  readonly heartbeat_stale_after_seconds: number;
  readonly retention: string;
  readonly recovery_pointer: string;
  readonly notes: string;
  readonly registered: boolean;
  readonly enabled: boolean;
  readonly status: DenOpsJobStatus;
  readonly status_reason: string;
  readonly freshness: 'fresh' | 'overdue' | 'unscheduled';
  readonly expected_by: string | null;
  readonly next_due_at: string | null;
  readonly evaluated_at: string;
  readonly current_run: DenOpsRun | null;
  readonly heartbeat_state: 'fresh' | 'stale' | null;
  readonly heartbeat_age_seconds: number | null;
  readonly last_attempt: DenOpsRun | null;
  readonly last_finished: DenOpsRun | null;
  readonly last_success: DenOpsRun | null;
  readonly last_archive: DenOpsRun | null;
  readonly last_verification: DenOpsVerification | null;
  readonly last_restore_test: DenOpsVerification | null;
}

export interface DenOpsHost {
  readonly host_id: string;
  readonly display_name: string;
  readonly role: string;
  readonly notes: string;
  readonly registered: boolean;
  readonly coverage: 'configured' | 'not_configured';
  readonly job_count: number;
  readonly status: DenOpsJobStatus;
}

export interface DenOpsSummary {
  readonly generated_at: string;
  readonly status: DenOpsJobStatus;
  readonly counts: Readonly<Record<string, number>>;
  readonly hosts: readonly DenOpsHost[];
  readonly jobs: readonly DenOpsJob[];
}

export interface DenOpsJobDetail {
  readonly job: DenOpsJob;
  readonly runs: readonly DenOpsRun[];
  readonly verifications: readonly DenOpsVerification[];
}

// Resources: advisory record of what is using the workshop machines
// (den-services docs/resources-api-contract.md). Times are RFC 3339 strings,
// except telemetry.sampled_at, which the probe reports in Unix seconds.

export type DenResourcesHostStatus = 'unknown' | 'working' | 'queued' | 'quiet';
export type DenResourceLifecycle = 'maintained' | 'experimental' | 'retired' | 'unknown';
export type DenResourcesWorkState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DenResourcesGpu {
  readonly name?: string | null;
  readonly utilization_percent?: number | null;
  readonly memory_total_bytes?: number | null;
  readonly memory_used_bytes?: number | null;
  readonly gtt_used_bytes?: number | null;
  readonly memory_note?: string | null;
}

export interface DenResourcesProcess {
  readonly pid?: number | null;
  readonly command?: string | null;
  readonly cwd?: string | null;
  readonly cpu_percent?: number | null;
  readonly rss_bytes?: number | null;
}

export interface DenResourcesContainer {
  readonly name?: string | null;
  readonly image?: string | null;
  readonly state?: string | null;
  readonly status?: string | null;
  readonly cpu?: string | null;
  readonly memory?: string | null;
  readonly socket?: string | null;
}

export interface DenResourcesDisk {
  readonly path?: string | null;
  readonly total_bytes?: number | null;
  readonly free_bytes?: number | null;
}

/** The probe snapshot, passed through unchanged; any metric may be missing or null. */
export interface DenResourcesTelemetry {
  readonly sampled_at?: number | null;
  readonly platform?: string | null;
  readonly cpu_count?: number | null;
  readonly cpu_percent?: number | null;
  readonly load_average?: readonly (number | null)[] | null;
  readonly memory?: {
    readonly total_bytes?: number | null;
    readonly available_bytes?: number | null;
    readonly swap_total_bytes?: number | null;
    readonly swap_free_bytes?: number | null;
  } | null;
  readonly gpus?: readonly DenResourcesGpu[] | null;
  readonly processes?: readonly DenResourcesProcess[] | null;
  readonly containers?: readonly DenResourcesContainer[] | null;
  readonly disks?: readonly DenResourcesDisk[] | null;
  readonly paths?: Readonly<Record<string, boolean>> | null;
  readonly warnings?: readonly string[] | null;
}

export interface DenResourcesAppJob {
  readonly id: string;
  readonly state: string;
  readonly node_types: readonly string[];
}

export interface DenResourcesApp {
  readonly name: string;
  readonly kind: string;
  readonly url: string;
  readonly resources: readonly string[];
  readonly online: boolean;
  /** Null for `kind:"health"` apps: health is known, the queue is not. */
  readonly running: number | null;
  readonly queued: number | null;
  readonly jobs: readonly DenResourcesAppJob[];
  readonly error: string | null;
  readonly checked_at: string | null;
  readonly stale: boolean;
}

export interface DenResourcesHost {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly access: string;
  readonly note: string;
  readonly position: number;
  readonly status: DenResourcesHostStatus;
  readonly stale: boolean;
  readonly error: string | null;
  readonly attempted_at: string | null;
  readonly sampled_at: string | null;
  readonly received_at: string | null;
  readonly telemetry: DenResourcesTelemetry | null;
  readonly apps: readonly DenResourcesApp[];
  readonly apps_checked_at: string | null;
}

export interface DenResource {
  readonly id: string;
  readonly host: string;
  readonly name: string;
  readonly kind: string;
  readonly path: string;
  readonly probe_path: string;
  readonly runtime_path: string;
  readonly access: string;
  readonly sharing: string;
  readonly lifecycle: DenResourceLifecycle;
  readonly notes: string;
  readonly guide: string;
  readonly match: string;
  readonly updated_at: string | null;
  readonly last_used_at: string | null;
  readonly last_used_by: string | null;
  readonly observed_activity_at: string | null;
  readonly confirmed_at: string | null;
  readonly confirmed_by: string | null;
  readonly path_present: boolean | null;
  readonly path_checked_at: string | null;
}

export interface DenResourcesWork {
  readonly id: string;
  readonly host: string;
  readonly source: string;
  readonly external_id: string | null;
  readonly title: string;
  readonly owner: string;
  readonly project: string;
  readonly resources: readonly string[];
  readonly state: DenResourcesWorkState;
  readonly note: string;
  readonly url: string;
  readonly ttl_seconds: number;
  readonly created_at: string | null;
  readonly started_at: string | null;
  readonly updated_at: string | null;
  readonly expires_at: string | null;
  readonly ended_at: string | null;
  /** Queued or running but the heartbeat expired. Never means free or abandoned. */
  readonly stale: boolean;
}

export interface DenResourcesCounts {
  readonly hosts: number;
  readonly hosts_fresh: number;
  readonly running: number;
  readonly native_queued: number;
  readonly resources: number;
}

export interface DenResourcesState {
  readonly generated_at: string;
  readonly poll_seconds: number;
  readonly stale_after_seconds: number;
  readonly counts: DenResourcesCounts;
  readonly hosts: readonly DenResourcesHost[];
  readonly resources: readonly DenResource[];
  readonly work: readonly DenResourcesWork[];
}

export interface DenResourcesWorkReport {
  readonly host: string;
  readonly title: string;
  readonly owner: string;
  readonly project?: string;
  readonly resources?: readonly string[];
  readonly state?: 'queued' | 'running';
  readonly ttl_seconds?: number;
  readonly source?: string;
  readonly note?: string;
}

export interface DenResourcesWorkUpdate {
  readonly state?: 'completed' | 'failed' | 'cancelled';
  readonly note?: string;
}

export interface DenResourcesWorkReportResponse extends DenResourcesWork {
  readonly warnings?: readonly string[];
}

export interface DenResourceSaveRequest {
  readonly id: string;
  readonly host?: string;
  readonly name?: string;
  readonly kind?: string;
  readonly path?: string;
  readonly runtime_path?: string;
  readonly access?: string;
  readonly sharing?: string;
  readonly lifecycle?: DenResourceLifecycle;
  readonly notes?: string;
  readonly touch?: boolean;
  readonly confirm?: boolean;
  readonly owner?: string;
}

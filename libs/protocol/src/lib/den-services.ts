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

export interface DenNotification {
  readonly id: number;
  readonly project_id?: string;
  readonly task_id?: number | null;
  readonly sender?: string;
  readonly content?: string;
  readonly urgency?: string | null;
  readonly is_read?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly created_at?: string;
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
  readonly content_markdown?: string;
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

export interface DenConversationChannel {
  readonly id: number;
  readonly project_id?: string;
  readonly name?: string;
  readonly slug?: string;
  readonly kind?: string;
}

export interface DenConversationMembership {
  readonly id?: number;
  readonly channel_id?: number;
  readonly channelId?: number;
  readonly member_type?: string;
  readonly memberType?: string;
  readonly member_identity?: string;
  readonly memberIdentity?: string;
  readonly profile_identity?: string | null;
  readonly profileIdentity?: string | null;
  readonly membership_status?: string;
  readonly membershipStatus?: string;
  readonly wake_policy?: string;
  readonly wakePolicy?: string;
  readonly can_send?: boolean;
  readonly canSend?: boolean;
  readonly can_react?: boolean;
  readonly canReact?: boolean;
  readonly can_invite?: boolean;
  readonly canInvite?: boolean;
  readonly settings?: Readonly<Record<string, unknown>> | null;
  readonly agent_instance_id?: string | null;
  readonly agentInstanceId?: string | null;
  readonly target_identity?: DenDeliveryTargetIdentity | null;
  readonly targetIdentity?: DenDeliveryTargetIdentity | null;
  readonly wake_target?: DenDeliveryTargetIdentity | null;
  readonly wakeTarget?: DenDeliveryTargetIdentity | null;
  readonly updated_at?: string | null;
  readonly updatedAt?: string | null;
}

export interface DenConversationPutMembershipRequest {
  readonly member_type: string;
  readonly member_identity: string;
  readonly profile_identity?: string | null;
  readonly membership_status: string;
  readonly wake_policy: string;
  readonly can_send?: boolean;
  readonly can_react?: boolean;
  readonly can_invite?: boolean;
  readonly membership_purpose: string;
  readonly settings?: Readonly<Record<string, unknown>> | null;
}

export interface DenChannelMessage {
  readonly id: number;
  readonly channel_id?: number;
  readonly sender?: string;
  readonly sender_identity?: string;
  readonly sender_type?: string;
  readonly body?: string;
  readonly summary?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly created_at?: string;
}

export interface DenConversationPostMessageRequest {
  readonly sender_type: string;
  readonly sender_identity: string;
  readonly body: string;
  readonly message_kind: string;
  readonly source_kind: string;
  readonly dedupe_key: string;
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

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
  readonly created_at?: string;
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
  readonly updated_at?: string | null;
  readonly updatedAt?: string | null;
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

export interface DenTimelineResponse {
  readonly items?: readonly unknown[];
  readonly next_cursor?: string | null;
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

export interface DenDeliveryIntent {
  readonly id?: string;
  readonly status?: string;
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

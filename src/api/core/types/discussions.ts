export interface DiscussionComment {
  id: number;
  thread_id: number;
  /**
   * Core omits this field for root comments in older discussion responses.
   * Client normalization fills it as null before UI code consumes comments.
   */
  parent_comment_id?: number | null;
  author_identity: string;
  body_markdown: string;
  comment_kind: string;
  status: string;
  created_at: string;
  edited_at: string | null;
}

export interface DocumentDiscussion {
  thread: {
    id: number;
    title: string;
    status: string;
  } | null;
  comments: DiscussionComment[];
}

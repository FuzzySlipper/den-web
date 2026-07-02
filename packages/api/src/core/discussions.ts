import type { DiscussionComment, DocumentDiscussion } from './types';
import { esc } from './http';
import { successorApiUrl, successorPost } from './successorHttp';

// Document Discussion (#1680)

export function getDocumentDiscussion(projectId: string, slug: string): Promise<DocumentDiscussion | null> {
  return fetch(successorApiUrl(`/projects/${esc(projectId)}/documents/${esc(slug)}/discussion`), { cache: 'no-store' })
    .then(res => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET discussion: ${res.status}`);
      return res.json();
    })
    .then(normalizeDocumentDiscussion);
}

function normalizeDocumentDiscussion(discussion: DocumentDiscussion | null): DocumentDiscussion | null {
  if (!discussion) return null;

  return {
    ...discussion,
    comments: (discussion.comments ?? []).map(comment => ({
      ...comment,
      parent_comment_id: comment.parent_comment_id ?? null,
    })),
  };
}

export interface PostDiscussionCommentRequest {
  author_identity: string;
  body_markdown: string;
  parent_comment_id?: number | null;
  comment_kind?: string;
}

export function postDocumentDiscussionComment(
  projectId: string,
  slug: string,
  request: PostDiscussionCommentRequest,
): Promise<DiscussionComment> {
  return successorPost(`/projects/${esc(projectId)}/documents/${esc(slug)}/discussion/comments`, request);
}

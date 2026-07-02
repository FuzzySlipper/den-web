import type { DenDiscussion, DenDiscussionComment, DenDocumentSummary } from '@den-web/protocol';

export type DocumentSelectionAction = 'keep-current' | 'prompt-for-dirty-switch' | 'select';

export interface DiscussionThread {
  readonly comment: DenDiscussionComment;
  readonly replies: readonly DenDiscussionComment[];
}

export function documentIdentity(document: Pick<DenDocumentSummary, 'project_id' | 'slug'> | null | undefined): string | null {
  if (!document) return null;
  return `${document.project_id}/${document.slug}`;
}

export function documentSelectionAction(
  current: DenDocumentSummary | null | undefined,
  next: DenDocumentSummary,
  dirty: boolean,
): DocumentSelectionAction {
  if (documentIdentity(current) === documentIdentity(next)) return 'keep-current';
  if (dirty && current) return 'prompt-for-dirty-switch';
  return 'select';
}

export function documentMarkdownBody(document: { readonly content?: string; readonly content_markdown?: string }): string {
  return document.content_markdown ?? document.content ?? '';
}

export function discussionThreads(discussion: DenDiscussion | null | undefined): readonly DiscussionThread[] {
  const comments = [...(discussion?.comments ?? [])].sort(compareComments);
  const repliesByParent = new Map<number, DenDiscussionComment[]>();
  const roots: DenDiscussionComment[] = [];

  for (const comment of comments) {
    const parentId = discussionParentId(comment);
    if (parentId === null) roots.push(comment);
    else repliesByParent.set(parentId, [...(repliesByParent.get(parentId) ?? []), comment]);
  }

  return roots.map((comment) => ({ comment, replies: repliesByParent.get(comment.id) ?? [] }));
}

export function discussionAuthor(comment: DenDiscussionComment): string {
  return comment.author_identity ?? comment.author ?? 'unknown';
}

export function discussionBody(comment: DenDiscussionComment): string {
  return comment.body_markdown ?? comment.content ?? '';
}

function discussionParentId(comment: DenDiscussionComment): number | null {
  return comment.parent_comment_id ?? comment.parent_id ?? null;
}

function compareComments(left: DenDiscussionComment, right: DenDiscussionComment): number {
  return Date.parse(left.created_at ?? '') - Date.parse(right.created_at ?? '') || left.id - right.id;
}

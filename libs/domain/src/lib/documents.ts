import type { DenDiscussion, DenDiscussionComment, DenDocumentSummary } from '@den-web/protocol';

export type DocumentSelectionAction = 'keep-current' | 'prompt-for-dirty-switch' | 'select';

export interface DiscussionThread {
  readonly comment: DenDiscussionComment;
  readonly replies: readonly DiscussionThread[];
  readonly depth: number;
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
  const parentByCommentId = new Map(comments.map((comment) => [comment.id, discussionParentId(comment)]));
  const nodes = new Map<number, MutableDiscussionThread>();
  for (const comment of comments) nodes.set(comment.id, { comment, replies: [], depth: 0 });

  const roots: MutableDiscussionThread[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id);
    const parentId = discussionParentId(comment);
    const parent = parentId === null ? undefined : nodes.get(parentId);
    if (!node || parentId === null || !parent) {
      roots.push(node ?? { comment, replies: [], depth: 0 });
      continue;
    }
    if (discussionParentCycle(comment.id, parentId, parentByCommentId)) {
      roots.push(node);
      continue;
    }
    node.depth = parent.depth + 1;
    parent.replies.push(node);
  }
  return roots;
}

type MutableDiscussionThread = {
  comment: DenDiscussionComment;
  replies: MutableDiscussionThread[];
  depth: number;
};

export function discussionAuthor(comment: DenDiscussionComment): string {
  return comment.author_identity ?? comment.author ?? 'unknown';
}

export function discussionBody(comment: DenDiscussionComment): string {
  return comment.body_markdown ?? comment.content ?? '';
}

function discussionParentId(comment: DenDiscussionComment): number | null {
  return comment.parent_comment_id ?? comment.parent_id ?? null;
}

function discussionParentCycle(commentId: number, parentId: number, parentByCommentId: ReadonlyMap<number, number | null>): boolean {
  const visited = new Set<number>();
  for (let current: number | null = parentId; current !== null; current = parentByCommentId.get(current) ?? null) {
    if (current === commentId || visited.has(current)) return true;
    visited.add(current);
  }
  return false;
}

function compareComments(left: DenDiscussionComment, right: DenDiscussionComment): number {
  return Date.parse(left.created_at ?? '') - Date.parse(right.created_at ?? '') || left.id - right.id;
}

import type {
  DenBoardComment,
  DenBoardCommentPage,
  DenBoardPost,
  DenBoardPostPage,
  DenBoardPostSummary,
  DenBoardSearchPage,
} from '@den-web/protocol';

export type BoardBranchLoadState = 'idle' | 'loading' | 'data' | 'error';

export interface BoardCommentBranchSnapshot {
  readonly postId: number;
  readonly parentCommentId: number | null;
  readonly comments: readonly DenBoardComment[];
  readonly nextAfterId: number | null;
  readonly loaded: boolean;
  readonly state: BoardBranchLoadState;
  readonly errorMessage: string | null;
}

export interface BoardCommentTreeNode {
  readonly comment: DenBoardComment;
  readonly children: readonly BoardCommentTreeNode[];
  readonly depth: number;
  readonly childrenBranchKey: string;
  readonly childrenExpanded: boolean;
  readonly childrenLoaded: boolean;
  readonly childrenNextAfterId: number | null;
  readonly childrenState: BoardBranchLoadState;
  readonly childrenErrorMessage: string | null;
}

export function boardBranchKey(
  postId: number,
  parentCommentId: number | null,
): string {
  return `${postId}:${parentCommentId ?? 'root'}`;
}

export function boardPostSummary(post: DenBoardPost): DenBoardPostSummary {
  return {
    id: post.id,
    project_id: post.project_id,
    title: post.title,
    author_identity: post.author_identity,
    status: post.status,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

export function mergeBoardPostPage(
  previous: DenBoardPostPage | undefined,
  incoming: DenBoardPostPage,
  quarantinedPostIds: ReadonlySet<number> = new Set(),
): DenBoardPostPage {
  const postsById = new Map<number, DenBoardPostSummary>();
  for (const post of previous?.posts ?? []) {
    if (!quarantinedPostIds.has(post.id)) postsById.set(post.id, post);
  }
  for (const post of incoming.posts) {
    if (!quarantinedPostIds.has(post.id)) postsById.set(post.id, post);
  }
  return {
    posts: [...postsById.values()],
    next_after_id: incoming.next_after_id ?? null,
  };
}

export function mergeBoardSearchPage(
  previous: DenBoardSearchPage | undefined,
  incoming: DenBoardSearchPage,
  quarantinedPostIds: ReadonlySet<number> = new Set(),
  quarantinedCommentIds: ReadonlySet<number> = new Set(),
): DenBoardSearchPage {
  const resultsByKey = new Map<string, DenBoardSearchPage['results'][number]>();
  for (const result of previous?.results ?? []) {
    if (
      isQuarantinedSearchResult(
        result,
        quarantinedPostIds,
        quarantinedCommentIds,
      )
    )
      continue;
    resultsByKey.set(searchResultKey(result), result);
  }
  for (const result of incoming.results) {
    if (
      isQuarantinedSearchResult(
        result,
        quarantinedPostIds,
        quarantinedCommentIds,
      )
    )
      continue;
    resultsByKey.set(searchResultKey(result), result);
  }
  return {
    results: [...resultsByKey.values()],
    next_after_id: incoming.next_after_id ?? null,
  };
}

export function removeBoardPost(
  page: DenBoardPostPage,
  postId: number,
): DenBoardPostPage {
  return {
    ...page,
    posts: page.posts.filter((post) => post.id !== postId),
  };
}

export function removeBoardSearchContent(
  page: DenBoardSearchPage,
  postId: number,
): DenBoardSearchPage {
  return {
    ...page,
    results: page.results.filter((result) => result.post_id !== postId),
  };
}

export function removeBoardCommentSearchContent(
  page: DenBoardSearchPage,
  commentId: number,
): DenBoardSearchPage {
  return {
    ...page,
    results: page.results.filter(
      (result) => !(result.kind === 'comment' && result.id === commentId),
    ),
  };
}

export function mergeBoardCommentPage(
  previous: DenBoardCommentPage | undefined,
  incoming: DenBoardCommentPage,
  quarantinedCommentIds: ReadonlySet<number> = new Set(),
): DenBoardCommentPage {
  const commentsById = new Map<number, DenBoardComment>();
  for (const comment of previous?.comments ?? []) {
    commentsById.set(
      comment.id,
      sanitizeBoardComment(comment, quarantinedCommentIds),
    );
  }
  for (const comment of incoming.comments) {
    commentsById.set(
      comment.id,
      sanitizeBoardComment(comment, quarantinedCommentIds),
    );
  }
  return {
    comments: [...commentsById.values()].sort(compareBoardComments),
    next_after_id: incoming.next_after_id ?? null,
  };
}

export function sanitizeBoardCommentPage(
  page: DenBoardCommentPage,
  quarantinedCommentIds: ReadonlySet<number>,
): DenBoardCommentPage {
  return {
    ...page,
    comments: page.comments.map((comment) =>
      sanitizeBoardComment(comment, quarantinedCommentIds),
    ),
    next_after_id: page.next_after_id ?? null,
  };
}

export function sanitizeBoardComment(
  comment: DenBoardComment,
  quarantinedCommentIds: ReadonlySet<number> = new Set(),
): DenBoardComment {
  if (
    comment.deleted === true ||
    comment.status === 'deleted' ||
    quarantinedCommentIds.has(comment.id)
  ) {
    return boardCommentTombstone(comment);
  }
  return comment;
}

export function boardCommentIsTombstone(comment: DenBoardComment): boolean {
  return comment.deleted === true || comment.status === 'deleted';
}

export function boardCommentAuthor(comment: DenBoardComment): string {
  return boardCommentIsTombstone(comment)
    ? ''
    : (comment.author_identity ?? 'unknown');
}

export function boardCommentBody(comment: DenBoardComment): string {
  return boardCommentIsTombstone(comment) ? '' : (comment.body_markdown ?? '');
}

export function boardCommentTombstone(
  comment: Pick<
    DenBoardComment,
    'id' | 'post_id' | 'parent_comment_id' | 'created_at' | 'updated_at'
  >,
): DenBoardComment {
  return {
    id: comment.id,
    post_id: comment.post_id,
    ...(comment.parent_comment_id === undefined
      ? {}
      : { parent_comment_id: comment.parent_comment_id }),
    status: 'deleted',
    deleted: true,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  };
}

export function buildBoardCommentTree(
  postId: number,
  branches: ReadonlyMap<string, BoardCommentBranchSnapshot>,
  expandedBranchKeys: ReadonlySet<string>,
  quarantinedCommentIds: ReadonlySet<number> = new Set(),
): readonly BoardCommentTreeNode[] {
  const rootBranch = branches.get(boardBranchKey(postId, null));
  if (!rootBranch || !rootBranch.loaded) return [];

  const visit = (
    comment: DenBoardComment,
    depth: number,
    ancestorIds: ReadonlySet<number>,
  ): BoardCommentTreeNode => {
    const visibleComment = sanitizeBoardComment(comment, quarantinedCommentIds);
    const childrenBranchKey = boardBranchKey(postId, comment.id);
    const childrenBranch = branches.get(childrenBranchKey);
    const childrenExpanded = expandedBranchKeys.has(childrenBranchKey);
    const nextAncestorIds = new Set(ancestorIds);
    nextAncestorIds.add(comment.id);
    const childComments =
      childrenExpanded && childrenBranch?.loaded
        ? childrenBranch.comments
            .filter((child) => (child.parent_comment_id ?? null) === comment.id)
            .filter((child) => !nextAncestorIds.has(child.id))
        : [];

    return {
      comment: visibleComment,
      children: childComments.map((child) =>
        visit(child, depth + 1, nextAncestorIds),
      ),
      depth,
      childrenBranchKey,
      childrenExpanded,
      childrenLoaded: childrenBranch?.loaded ?? false,
      childrenNextAfterId: childrenBranch?.nextAfterId ?? null,
      childrenState: childrenBranch?.state ?? 'idle',
      childrenErrorMessage: childrenBranch?.errorMessage ?? null,
    };
  };

  return rootBranch.comments
    .filter((comment) => (comment.parent_comment_id ?? null) === null)
    .map((comment) => visit(comment, 0, new Set()));
}

function searchResultKey(
  result: DenBoardSearchPage['results'][number],
): string {
  return `${result.kind}:${result.id}`;
}

function isQuarantinedSearchResult(
  result: DenBoardSearchPage['results'][number],
  quarantinedPostIds: ReadonlySet<number>,
  quarantinedCommentIds: ReadonlySet<number>,
): boolean {
  return (
    quarantinedPostIds.has(result.post_id) ||
    (result.kind === 'post' && quarantinedPostIds.has(result.id)) ||
    (result.kind === 'comment' && quarantinedCommentIds.has(result.id))
  );
}

function compareBoardComments(
  left: DenBoardComment,
  right: DenBoardComment,
): number {
  const leftTime = parseTimestamp(left.created_at);
  const rightTime = parseTimestamp(right.created_at);
  return leftTime - rightTime || left.id - right.id;
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

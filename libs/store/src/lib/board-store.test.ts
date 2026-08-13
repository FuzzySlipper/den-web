import { describe, expect, it } from 'vitest';
import type {
  DenBoardComment,
  DenBoardCommentPage,
  DenBoardCommentPath,
  DenBoardPost,
  DenBoardPostPage,
  DenBoardPostSummary,
  DenBoardSearchPage,
  DenResult,
} from '@den-web/protocol';
import { createBoardStore } from './board-store';
import { stateValue } from './async-state';

const post = postFixture();
const root = commentFixture({ id: 10 });
const child = commentFixture({ id: 11, parent_comment_id: 10 });

describe('BoardStore', () => {
  it('loads project posts, selected detail, and direct root children through keyed branches', async () => {
    const commentCalls: Array<{
      readonly postId: number;
      readonly parentCommentId?: number;
    }> = [];
    const store = createBoardStore({
      createPost: async () => ok(post),
      listPosts: async () =>
        ok({ posts: [postSummary(post)], next_after_id: null }),
      searchPosts: async () => ok(emptySearch()),
      getPost: async () => ok(post),
      purgePost: async () => ok(undefined),
      createComment: async () => ok(root),
      listComments: async (postId, options) => {
        commentCalls.push({
          postId,
          ...(options?.parentCommentId === undefined
            ? {}
            : { parentCommentId: options.parentCommentId }),
        });
        return ok({
          comments: options?.parentCommentId === undefined ? [root] : [],
          next_after_id: null,
        });
      },
      getComment: async () => ok(root),
      getCommentPath: async () =>
        ok({ post, comments: [root], truncated: false }),
      purgeComment: async () => ok(undefined),
    });

    await store.refresh('den-web');
    await store.selectPost('den-web', post.id);

    expect(stateValue(store.posts())?.posts[0]?.id).toBe(post.id);
    expect(stateValue(store.selectedPost())?.id).toBe(post.id);
    expect(store.branches().get('1:root')?.state.kind).toBe('data');
    expect(store.commentTree()[0]?.comment.id).toBe(root.id);
    expect(
      commentCalls.some(
        (call) => call.postId === post.id && call.parentCommentId === undefined,
      ),
    ).toBe(true);
  });

  it('expands one direct-child branch at a time and retains arbitrary depth in the projection', async () => {
    const grandchild = commentFixture({ id: 12, parent_comment_id: 11 });
    const store = createBoardStore(
      boardTransportFixture({
        listComments: async (_postId, options) => {
          if (options?.parentCommentId === undefined)
            return ok({ comments: [root], next_after_id: null });
          if (options.parentCommentId === 10)
            return ok({ comments: [child], next_after_id: null });
          return ok({ comments: [grandchild], next_after_id: null });
        },
      }),
    );

    await store.refresh('den-web');
    await store.selectPost('den-web', post.id);
    await store.toggleBranch(post.id, root.id);
    await store.toggleBranch(post.id, child.id);

    expect(store.commentTree()[0]?.children[0]?.children[0]?.comment.id).toBe(
      grandchild.id,
    );
    expect(store.branches().has('1:10')).toBe(true);
    expect(store.branches().has('1:11')).toBe(true);
  });

  it('opens a deep comment search hit with its bounded ancestor path seeded into the tree', async () => {
    const grandchild = commentFixture({ id: 12, parent_comment_id: 11 });
    const requestedPath: DenBoardCommentPath = {
      post,
      comments: [root, child, grandchild],
      truncated: false,
    };
    const store = createBoardStore(
      boardTransportFixture({
        getCommentPath: async (commentId, options) => {
          expect(commentId).toBe(grandchild.id);
          expect(options?.limit).toBe(50);
          return ok(requestedPath);
        },
      }),
    );

    await store.selectCommentPath('den-web', grandchild.id);

    expect(store.selectedPostId()).toBe(post.id);
    expect(store.commentPathTargetId()).toBe(grandchild.id);
    expect(store.commentPath()?.comments.map((comment) => comment.id)).toEqual([
      root.id,
      child.id,
      grandchild.id,
    ]);
    expect(store.commentTree()[0]?.children[0]?.children[0]?.comment.id).toBe(
      grandchild.id,
    );
    expect(store.expandedBranchKeys()).toEqual(new Set(['1:10', '1:11']));
  });

  it('keeps a truncated comment-path suffix visible when the root is outside the bound', async () => {
    const grandchild = commentFixture({ id: 12, parent_comment_id: 11 });
    const store = createBoardStore(
      boardTransportFixture({
        getCommentPath: async () =>
          ok({
            post,
            comments: [child, grandchild],
            truncated: true,
          }),
      }),
    );

    await store.selectCommentPath('den-web', grandchild.id);

    expect(store.commentPath()?.truncated).toBe(true);
    expect(store.commentPath()?.comments.map((comment) => comment.id)).toEqual([
      child.id,
      grandchild.id,
    ]);
    expect(store.commentTree()).toEqual([]);
  });

  it('quarantines a purged comment so stale branch responses cannot restore authored content', async () => {
    let resolveRefresh:
      | ((result: DenResult<DenBoardCommentPage>) => void)
      | null = null;
    let commentRequestCount = 0;
    const store = createBoardStore(
      boardTransportFixture({
        listComments: async () => {
          commentRequestCount += 1;
          if (commentRequestCount === 2) {
            return new Promise<DenResult<DenBoardCommentPage>>((resolve) => {
              resolveRefresh = resolve;
            });
          }
          return ok({ comments: [root], next_after_id: null });
        },
        purgeComment: async () => ok(undefined),
      }),
    );

    await store.refresh('den-web');
    await store.selectPost('den-web', post.id);
    const staleRefresh = store.loadComments(post.id, null);
    await store.purgeComment(post.id, root.id, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });
    resolveRefresh?.(ok({ comments: [root], next_after_id: null }));
    await staleRefresh;

    const visibleComment = store.commentTree()[0]?.comment;
    expect(visibleComment?.status).toBe('deleted');
    expect(visibleComment).not.toHaveProperty('body_markdown');
    expect(JSON.stringify(visibleComment)).not.toContain('body');
  });

  it('settles every invalidated loading state when a purge wins concurrent reads', async () => {
    let resolvePosts: ((result: DenResult<DenBoardPostPage>) => void) | null =
      null;
    let resolveSearch: ((result: DenResult<DenBoardSearchPage>) => void) | null =
      null;
    let resolveBranch:
      | ((result: DenResult<DenBoardCommentPage>) => void)
      | null = null;
    const store = createBoardStore(
      boardTransportFixture({
        listPosts: async () =>
          new Promise<DenResult<DenBoardPostPage>>((resolve) => {
            resolvePosts = resolve;
          }),
        searchPosts: async () =>
          new Promise<DenResult<DenBoardSearchPage>>((resolve) => {
            resolveSearch = resolve;
          }),
        listComments: async () =>
          new Promise<DenResult<DenBoardCommentPage>>((resolve) => {
            resolveBranch = resolve;
          }),
        purgeComment: async () => ok(undefined),
      }),
    );

    const stalePosts = store.refresh('den-web');
    const staleSearch = store.searchPosts('den-web', 'comment');
    const staleBranch = store.loadComments(post.id, null);
    expect(store.posts().kind).toBe('loading');
    expect(store.search().kind).toBe('loading');
    expect(store.branchState(post.id, null).kind).toBe('loading');

    await store.purgeComment(post.id, root.id, {
      actor_identity: 'web-ui',
      reason: 'misleading information',
    });

    expect(store.posts().kind).not.toBe('loading');
    expect(store.search().kind).not.toBe('loading');
    expect(store.branchState(post.id, null).kind).not.toBe('loading');

    resolvePosts?.(ok({ posts: [postSummary(post)], next_after_id: null }));
    resolveSearch?.(
      ok({
        results: [
          {
            kind: 'comment',
            id: root.id,
            post_id: post.id,
            project_id: post.project_id,
            title: post.title,
            snippet: root.body_markdown ?? '',
            rank: 1,
            created_at: root.created_at,
          },
        ],
        next_after_id: null,
      }),
    );
    resolveBranch?.(ok({ comments: [root], next_after_id: null }));
    await Promise.all([stalePosts, staleSearch, staleBranch]);

    expect(store.posts().kind).not.toBe('loading');
    expect(store.search().kind).not.toBe('loading');
    expect(store.branchState(post.id, null).kind).not.toBe('loading');
    expect(JSON.stringify(store.posts())).not.toContain(post.body_markdown);
    expect(JSON.stringify(store.search())).not.toContain(root.body_markdown);
    expect(JSON.stringify(store.branchState(post.id, null))).not.toContain(
      root.body_markdown,
    );
  });

  it('removes a purged post from list/search/detail state', async () => {
    const searchPage: DenBoardSearchPage = {
      results: [
        {
          kind: 'post',
          id: post.id,
          post_id: post.id,
          project_id: 'den-web',
          title: post.title,
          snippet: post.body_markdown,
          rank: 1,
          created_at: post.created_at,
        },
      ],
      next_after_id: null,
    };
    const store = createBoardStore(
      boardTransportFixture({
        searchPosts: async () => ok(searchPage),
        purgePost: async () => ok(undefined),
      }),
    );

    await store.refresh('den-web');
    await store.searchPosts('den-web', 'body');
    await store.selectPost('den-web', post.id);
    await store.purgePost(post.id, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });

    expect(stateValue(store.posts())?.posts).toEqual([]);
    expect(stateValue(store.search())?.results).toEqual([]);
    expect(store.selectedPostId()).toBeNull();
    expect(store.selectedPost().kind).toBe('idle');
  });

  it('scrubs create payload states when their comment or post is purged', async () => {
    const store = createBoardStore(boardTransportFixture());

    await store.createPost('den-web', {
      title: post.title,
      body_markdown: post.body_markdown,
      author_identity: post.author_identity,
    });
    await store.createComment(post.id, {
      body_markdown: child.body_markdown ?? '',
      author_identity: child.author_identity ?? '',
    });
    expect(stateValue(store.createPostState())?.body_markdown).toBe(
      post.body_markdown,
    );
    expect(stateValue(store.createCommentState())?.body_markdown).toBe(
      child.body_markdown,
    );

    await store.purgePost(post.id, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });

    expect(store.createPostState().kind).toBe('idle');
    expect(store.createCommentState().kind).toBe('idle');

    const commentStore = createBoardStore(boardTransportFixture());
    await commentStore.createComment(post.id, {
      body_markdown: child.body_markdown ?? '',
      author_identity: child.author_identity ?? '',
    });
    await commentStore.purgeComment(post.id, child.id, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });

    expect(commentStore.createCommentState().kind).toBe('idle');
  });

  it('does not let an in-flight branch response erase a created reply', async () => {
    const createdReply = commentFixture({ id: 12 });
    let resolveStale:
      | ((result: DenResult<DenBoardCommentPage>) => void)
      | null = null;
    let listCommentCalls = 0;
    const store = createBoardStore(
      boardTransportFixture({
        createComment: async () => ok(createdReply),
        listComments: async () => {
          listCommentCalls += 1;
          if (listCommentCalls === 2) {
            return new Promise<DenResult<DenBoardCommentPage>>((resolve) => {
              resolveStale = resolve;
            });
          }
          return ok({ comments: [root], next_after_id: null });
        },
      }),
    );

    await store.selectPost('den-web', post.id);
    const staleBranch = store.loadComments(post.id, null);
    await store.createComment(post.id, {
      body_markdown: child.body_markdown ?? '',
      author_identity: child.author_identity ?? '',
    });
    expect(
      stateValue(store.branchState(post.id, null))?.comments.map(
        (comment) => comment.id,
      ),
    ).toContain(createdReply.id);

    resolveStale?.(ok({ comments: [root], next_after_id: null }));
    await staleBranch;

    expect(
      stateValue(store.branchState(post.id, null))?.comments.map(
        (comment) => comment.id,
      ),
    ).toContain(createdReply.id);
  });
});

function boardTransportFixture(
  overrides: Partial<Parameters<typeof createBoardStore>[0]> = {},
): Parameters<typeof createBoardStore>[0] {
  return {
    createPost: async () => ok(post),
    listPosts: async () =>
      ok({ posts: [postSummary(post)], next_after_id: null }),
    searchPosts: async () => ok(emptySearch()),
    getPost: async () => ok(post),
    purgePost: async () => ok(undefined),
    createComment: async () => ok(child),
    listComments: async () => ok({ comments: [root], next_after_id: null }),
    getComment: async () => ok(root),
    getCommentPath: async () =>
      ok({ post, comments: [root], truncated: false }),
    purgeComment: async () => ok(undefined),
    ...overrides,
  };
}

function postFixture(overrides: Partial<DenBoardPost> = {}): DenBoardPost {
  return {
    id: 1,
    project_id: 'den-web',
    title: 'Board post',
    body_markdown: 'Board body',
    author_identity: 'author',
    status: 'active',
    created_at: '2026-08-12T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
    ...overrides,
  };
}

function postSummary(value: DenBoardPost): DenBoardPostSummary {
  return {
    id: value.id,
    project_id: value.project_id,
    title: value.title,
    author_identity: value.author_identity,
    status: value.status,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function commentFixture(
  overrides: Partial<DenBoardComment> = {},
): DenBoardComment {
  return {
    id: 10,
    post_id: 1,
    author_identity: 'author',
    body_markdown: 'Comment body',
    status: 'active',
    created_at: '2026-08-12T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
    ...overrides,
  };
}

function emptySearch(): DenBoardSearchPage {
  return { results: [], next_after_id: null };
}

function ok<T>(value: T): DenResult<T> {
  return { ok: true, value };
}

import { describe, expect, it } from 'vitest';
import type {
  DenBoardComment,
  DenBoardCommentPage,
  DenBoardPost,
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
      getCommentPath: async () => ok({}),
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
    getCommentPath: async () => ok({}),
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

import { describe, expect, it } from 'vitest';
import {
  boardBranchKey,
  buildBoardCommentTree,
  mergeBoardCommentPage,
  mergeBoardSearchPage,
  type BoardCommentBranchSnapshot,
} from './board';
import type { DenBoardComment, DenBoardSearchPage } from '@den-web/protocol';

const rootComment = commentFixture({ id: 10 });
const childComment = commentFixture({ id: 11, parent_comment_id: 10 });
const grandchildComment = commentFixture({ id: 12, parent_comment_id: 11 });

describe('Board domain projections', () => {
  it('builds arbitrary-depth trees only from explicitly loaded branches', () => {
    const branches = new Map<string, BoardCommentBranchSnapshot>([
      [boardBranchKey(1, null), branchFixture(null, [rootComment])],
      [boardBranchKey(1, 10), branchFixture(10, [childComment])],
      [boardBranchKey(1, 11), branchFixture(11, [grandchildComment])],
      [boardBranchKey(1, 12), branchFixture(12, [])],
    ]);

    const collapsed = buildBoardCommentTree(1, branches, new Set());
    const expanded = buildBoardCommentTree(
      1,
      branches,
      new Set([boardBranchKey(1, 10), boardBranchKey(1, 11)]),
    );

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.children).toHaveLength(0);
    expect(expanded[0]?.children[0]?.children[0]?.depth).toBe(2);
    expect(expanded[0]?.children[0]?.children[0]?.comment.id).toBe(12);
  });

  it('keeps purged comments as content-free tombstones and blocks stale content', () => {
    const quarantined = new Set([11]);
    const merged = mergeBoardCommentPage(
      { comments: [childComment], next_after_id: null },
      {
        comments: [
          {
            ...childComment,
            body_markdown: 'stale authored body',
            author_identity: 'stale-author',
          },
        ],
        next_after_id: null,
      },
      quarantined,
    );

    expect(merged.comments[0]).toEqual(
      expect.objectContaining({ id: 11, status: 'deleted', deleted: true }),
    );
    expect(merged.comments[0]).not.toHaveProperty('body_markdown');
    expect(merged.comments[0]).not.toHaveProperty('author_identity');
  });

  it('removes quarantined posts and comments from search projections', () => {
    const searchPage: DenBoardSearchPage = {
      results: [
        {
          kind: 'post',
          id: 1,
          post_id: 1,
          project_id: 'den-web',
          title: 'Post',
          snippet: 'post',
          rank: 1,
          created_at: '2026-08-12T00:00:00Z',
        },
        {
          kind: 'comment',
          id: 11,
          post_id: 1,
          project_id: 'den-web',
          snippet: 'reply',
          rank: 0.9,
          created_at: '2026-08-12T00:00:00Z',
        },
      ],
      next_after_id: null,
    };

    expect(
      mergeBoardSearchPage(undefined, searchPage, new Set([1]), new Set()),
    ).toEqual({ results: [], next_after_id: null });
    expect(
      mergeBoardSearchPage(undefined, searchPage, new Set(), new Set([11]))
        .results,
    ).toHaveLength(1);
  });
});

function branchFixture(
  parentCommentId: number | null,
  comments: readonly DenBoardComment[],
): BoardCommentBranchSnapshot {
  return {
    postId: 1,
    parentCommentId,
    comments,
    nextAfterId: null,
    loaded: true,
    state: 'data',
    errorMessage: null,
  };
}

function commentFixture(
  overrides: Partial<DenBoardComment> = {},
): DenBoardComment {
  return {
    id: 1,
    post_id: 1,
    author_identity: 'author',
    body_markdown: 'body',
    status: 'active',
    created_at: '2026-08-12T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
    ...overrides,
  };
}

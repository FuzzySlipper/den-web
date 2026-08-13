import { describe, expect, it } from 'vitest';
import type { DenBoardPost, DenBoardPostPage } from '@den-web/protocol';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { createDenTransportClients } from './clients';
import { DenHttpClient } from './http';

const post: DenBoardPost = {
  id: 1,
  project_id: 'den-web',
  title: 'Board post',
  body_markdown: 'Board body',
  author_identity: 'web-ui',
  status: 'active',
  created_at: '2026-08-12T00:00:00Z',
  updated_at: '2026-08-12T00:00:00Z',
};

describe('Board transport', () => {
  it('uses same-origin Board routes and direct response payloads', async () => {
    const calls: string[] = [];
    const bodies: unknown[] = [];
    const http = new DenHttpClient({
      fetchImpl: async (input, init) => {
        calls.push(String(input));
        bodies.push(
          typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        );
        const path = String(input);
        if (init?.method === 'DELETE')
          return new Response(null, { status: 204 });
        if (path.includes('/search?'))
          return Response.json({ results: [], next_after_id: null });
        if (path.endsWith('/comments'))
          return Response.json({ comments: [], next_after_id: null });
        if (path.includes('/comments/') && path.endsWith('/path?limit=20'))
          return Response.json({ post, comments: [], truncated: false });
        if (path.includes('/comments/'))
          return Response.json({
            id: 10,
            post_id: 1,
            body_markdown: 'reply',
            author_identity: 'web-ui',
            status: 'active',
            created_at: post.created_at,
            updated_at: post.updated_at,
          });
        if (path.endsWith('/board/posts'))
          return init?.method === 'POST'
            ? Response.json(post, { status: 201 })
            : Response.json({ posts: [summary()], next_after_id: null });
        return Response.json(post);
      },
    });
    const board = createDenTransportClients(
      defaultRuntimeApiConfig,
      http,
    ).board;

    await board.createPost('den-web', {
      title: post.title,
      body_markdown: post.body_markdown,
      author_identity: 'web-ui',
    });
    await board.listPosts('den-web', { afterId: 1, limit: 10 });
    await board.searchPosts('den-web', 'board reply', {
      afterId: 2,
      limit: 10,
    });
    await board.getPost(1);
    await board.createComment(1, {
      body_markdown: 'reply',
      author_identity: 'web-ui',
    });
    await board.listComments(1, { parentCommentId: 10, afterId: 4, limit: 10 });
    await board.getComment(10);
    await board.getCommentPath(10, { limit: 20 });
    await board.purgePost(1, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });
    await board.purgeComment(10, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });

    expect(calls).toEqual([
      '/api/v1/projects/den-web/board/posts',
      '/api/v1/projects/den-web/board/posts?after_id=1&limit=10',
      '/api/v1/projects/den-web/board/posts/search?q=board+reply&after_id=2&limit=10',
      '/api/v1/board/posts/1',
      '/api/v1/board/posts/1/comments',
      '/api/v1/board/posts/1/comments?parent_comment_id=10&after_id=4&limit=10',
      '/api/v1/board/comments/10',
      '/api/v1/board/comments/10/path?limit=20',
      '/api/v1/board/posts/1',
      '/api/v1/board/comments/10',
    ]);
    expect(bodies[0]).toEqual({
      title: post.title,
      body_markdown: post.body_markdown,
      author_identity: 'web-ui',
    });
    expect(bodies[4]).toEqual({
      body_markdown: 'reply',
      author_identity: 'web-ui',
    });
    expect(bodies[8]).toEqual({
      actor_identity: 'web-ui',
      reason: 'moderation',
    });
  });

  it('classifies malformed Board payloads as invalid responses', async () => {
    const http = new DenHttpClient({
      fetchImpl: async () => Response.json({}),
    });
    const board = createDenTransportClients(
      defaultRuntimeApiConfig,
      http,
    ).board;

    const postResult = await board.getPost(1);
    const pageResult = await board.listPosts('den-web');

    expect(postResult).toEqual({
      ok: false,
      error: {
        kind: 'invalid-response',
        message: 'Board post response is missing required fields.',
      },
    });
    expect(pageResult).toEqual({
      ok: false,
      error: {
        kind: 'invalid-response',
        message: 'Board post list response is malformed.',
      },
    });
  });

  it('rejects a non-empty purge response instead of treating it as success', async () => {
    const http = new DenHttpClient({
      fetchImpl: async () => Response.json({ purged: true }),
    });
    const board = createDenTransportClients(
      defaultRuntimeApiConfig,
      http,
    ).board;

    const result = await board.purgePost(1, {
      actor_identity: 'web-ui',
      reason: 'moderation',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-response',
        message: 'Board purge response must be empty.',
      },
    });
  });
});

function summary(): DenBoardPostPage['posts'][number] {
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

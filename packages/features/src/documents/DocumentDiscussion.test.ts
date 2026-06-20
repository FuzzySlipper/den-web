/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDocumentDiscussion, resetClient } from '@den-web/api/client';

const cwd = process.cwd();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetClient();
});

function readClientSource(...relativeParts: string[]): string {
  const [area, ...rest] = relativeParts;
  const roots: Record<string, string> = {
    api: 'packages/api/src',
    features: 'packages/features/src',
  };
  return readFileSync(resolve(cwd, roots[area] ?? area, ...rest), 'utf8');
}

describe('Document Discussion panel (#1680)', () => {
  describe('separation from document content', () => {
    it('keeps discussion code in a separate component file', () => {
      expect(readClientSource('features', 'documents', 'DocumentDiscussion.tsx')).toBeTruthy();
    });

    it('does NOT inject discussion comments into document Markdown content rendering', () => {
      const content = readClientSource('features', 'documents', 'DocumentDetail.tsx');
      expect(content).toContain("panelTab === 'content'");
      expect(content).toContain("panelTab === 'discussion'");
      expect(content).toContain('<DocumentDiscussion summary={summary} />');
    });

    it('does NOT include discussion in the Markdown editor', () => {
      const detail = readClientSource('features', 'documents', 'DocumentDetail.tsx');
      // The textarea for document editing should not reference discussion
      expect(detail).toContain('document-editor');
      // Save document should not call discussion API
      expect(detail).not.toContain('postDocumentDiscussionComment');
    });
  });

  describe('empty state', () => {
    it('shows empty state message in the discussion component', () => {
      const component = readClientSource('features', 'documents', 'DocumentDiscussion.tsx');
      expect(component).toContain('No discussion comments yet');
      expect(component).toContain('Start the conversation below');
    });

    it('explains discussion is separate from canonical document content', () => {
      const component = readClientSource('features', 'documents', 'DocumentDiscussion.tsx');
      expect(component).toContain('separate from the canonical document content');
      expect(component).toContain('not part of the document Markdown body');
    });
  });

  describe('API integration', () => {
    it('fetches discussion via Core GET document discussion route', () => {
      // The discussion endpoints moved into the api/core/discussions domain module (#2148).
      const client = readClientSource('api', 'core', 'discussions.ts');
      expect(client).toContain('getDocumentDiscussion');
      expect(client).toContain('/api/projects/${esc(projectId)}/documents/${esc(slug)}/discussion');
      expect(client).toContain('DocumentDiscussion');
    });

    it('posts comments via Core POST document discussion comments route', () => {
      const client = readClientSource('api', 'core', 'discussions.ts');
      expect(client).toContain('postDocumentDiscussionComment');
      expect(client).toContain('/documents/${esc(slug)}/discussion/comments');
      expect(client).toContain('PostDiscussionCommentRequest');
    });

    it('handles 404 from discussion API returning null', () => {
      const client = readClientSource('api', 'core', 'discussions.ts');
      expect(client).toContain("res.status === 404");
      expect(client).toContain('return null');
    });

    it('normalizes Core root comments that omit parent_comment_id so bodies render', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          thread: { id: 5, title: 'Discussion for document', status: 'open' },
          comments: [
            {
              id: 5,
              thread_id: 5,
              author_identity: 'system-architect',
              body_markdown: '## System Architect\'s perspective\n\nReadable body text',
              comment_kind: 'comment',
              status: 'active',
              created_at: '2026-06-02T01:12:43',
            },
          ],
        }),
      }));

      const discussion = await getDocumentDiscussion(
        'den-hermes-bridge',
        'hermes-integration-pain-points-den-workflows',
      );

      expect(discussion?.comments).toHaveLength(1);
      expect(discussion?.comments[0]).toMatchObject({
        author_identity: 'system-architect',
        body_markdown: expect.stringContaining('Readable body text'),
        parent_comment_id: null,
      });
    });
  });

  describe('comment rendering', () => {
    it('renders chronologically with author and timestamp', () => {
      const component = readClientSource('features', 'documents', 'DocumentDiscussion.tsx');
      expect(component).toContain('discussion-comment-author');
      expect(component).toContain('discussion-comment-time');
      expect(component).toContain('discussion-comment-body');
    });

    it('supports reply threading with parent context', () => {
      const component = readClientSource('features', 'documents', 'DocumentDiscussion.tsx');
      expect(component).toContain('parent_comment_id');
      expect(component).toContain('parent_comment_id == null');
      expect(component).toContain('replyTo');
      expect(component).toContain('discussion-reply');
      expect(component).toContain('Replying to comment');
    });
  });

  describe('API error handling', () => {
    it('displays load errors gracefully', () => {
      const component = readClientSource('features', 'documents', 'DocumentDiscussion.tsx');
      expect(component).toContain('Failed to load discussion');
      expect(component).toContain('catch(error');
    });

    it('displays post errors gracefully', () => {
      const component = readClientSource('features', 'documents', 'DocumentDiscussion.tsx');
      expect(component).toContain('Post failed');
      expect(component).toContain('postError');
    });
  });
});

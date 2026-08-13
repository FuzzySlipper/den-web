import { describe, expect, it } from 'vitest';
import { boardNoticeText, type BoardNotice } from './board-notices';

describe('boardNoticeText', () => {
  const notice: BoardNotice = {
    kind: 'comment-created',
    projectId: 'den-web',
    postId: 7,
  };

  it('shows a notice only while its originating post remains selected', () => {
    expect(boardNoticeText(notice, 'den-web', 7)).toBe('Reply created.');
    expect(boardNoticeText(notice, 'den-web', 8)).toBeNull();
  });

  it('suppresses a notice after the project selection changes', () => {
    expect(boardNoticeText(notice, 'other-project', 7)).toBeNull();
    expect(boardNoticeText(notice, null, null)).toBeNull();
  });
});

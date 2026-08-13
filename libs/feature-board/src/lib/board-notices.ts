export type BoardNotice =
  | {
      readonly kind: 'post-created' | 'post-purged';
      readonly projectId: string;
      readonly postId: number;
    }
  | {
      readonly kind: 'comment-created' | 'comment-purged';
      readonly projectId: string;
      readonly postId: number;
    };

export function boardNoticeText(
  notice: BoardNotice | null,
  selectedProjectId: string | null,
  selectedPostId: number | null,
): string | null {
  if (
    notice === null ||
    notice.projectId !== selectedProjectId ||
    notice.postId !== selectedPostId
  )
    return null;

  switch (notice.kind) {
    case 'post-created':
      return 'Post created.';
    case 'comment-created':
      return 'Reply created.';
    case 'post-purged':
      return 'Post purged successfully.';
    case 'comment-purged':
      return 'Comment purged successfully.';
  }

  return null;
}

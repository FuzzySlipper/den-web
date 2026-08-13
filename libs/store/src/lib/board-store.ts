import { computed, signal, type Signal } from '@angular/core';
import {
  boardBranchKey,
  boardPostSummary,
  buildBoardCommentTree,
  mergeBoardCommentPage,
  mergeBoardPostPage,
  mergeBoardSearchPage,
  removeBoardCommentSearchContent,
  removeBoardPost,
  removeBoardSearchContent,
  sanitizeBoardComment,
  sanitizeBoardCommentPage,
  type BoardBranchLoadState,
  type BoardCommentBranchSnapshot,
  type BoardCommentTreeNode,
} from '@den-web/domain';
import type {
  DenBoardComment,
  DenBoardCommentPage,
  DenBoardCommentPath,
  DenBoardCreateCommentRequest,
  DenBoardCreatePostRequest,
  DenBoardPost,
  DenBoardPostPage,
  DenBoardPurgeRequest,
  DenBoardSearchPage,
  DenResult,
} from '@den-web/protocol';
import {
  dataState,
  errorState,
  idleState,
  loadingState,
  stateValue,
  type AsyncState,
  unknownStoreError,
} from './async-state';

const boardPageLimit = 50;

export interface BoardTransportPort {
  readonly createPost: (
    projectId: string,
    body: DenBoardCreatePostRequest,
  ) => Promise<DenResult<DenBoardPost>>;
  readonly listPosts: (
    projectId: string,
    options?: { readonly afterId?: number; readonly limit?: number },
  ) => Promise<DenResult<DenBoardPostPage>>;
  readonly searchPosts: (
    projectId: string,
    query: string,
    options?: { readonly afterId?: number; readonly limit?: number },
  ) => Promise<DenResult<DenBoardSearchPage>>;
  readonly getPost: (postId: number) => Promise<DenResult<DenBoardPost>>;
  readonly purgePost: (
    postId: number,
    body: DenBoardPurgeRequest,
  ) => Promise<DenResult<void>>;
  readonly createComment: (
    postId: number,
    body: DenBoardCreateCommentRequest,
  ) => Promise<DenResult<DenBoardComment>>;
  readonly listComments: (
    postId: number,
    options?: {
      readonly parentCommentId?: number;
      readonly afterId?: number;
      readonly limit?: number;
    },
  ) => Promise<DenResult<DenBoardCommentPage>>;
  readonly getComment: (
    commentId: number,
  ) => Promise<DenResult<DenBoardComment>>;
  readonly getCommentPath: (
    commentId: number,
    options?: { readonly limit?: number },
  ) => Promise<DenResult<DenBoardCommentPath>>;
  readonly purgeComment: (
    commentId: number,
    body: DenBoardPurgeRequest,
  ) => Promise<DenResult<void>>;
}

export interface BoardBranchState {
  readonly postId: number;
  readonly parentCommentId: number | null;
  readonly state: AsyncState<DenBoardCommentPage>;
}

export interface BoardStore {
  readonly posts: Signal<AsyncState<DenBoardPostPage>>;
  readonly search: Signal<AsyncState<DenBoardSearchPage>>;
  readonly searchQuery: Signal<string>;
  readonly selectedPostId: Signal<number | null>;
  readonly selectedPost: Signal<AsyncState<DenBoardPost>>;
  readonly commentPath: Signal<DenBoardCommentPath | null>;
  readonly commentPathTargetId: Signal<number | null>;
  readonly branches: Signal<ReadonlyMap<string, BoardBranchState>>;
  readonly expandedBranchKeys: Signal<ReadonlySet<string>>;
  readonly commentTree: Signal<readonly BoardCommentTreeNode[]>;
  readonly createPostState: Signal<AsyncState<DenBoardPost>>;
  readonly createCommentState: Signal<AsyncState<DenBoardComment>>;
  readonly purgePostState: Signal<AsyncState<void>>;
  readonly purgeCommentState: Signal<AsyncState<void>>;
  readonly refresh: (projectId: string) => Promise<void>;
  readonly searchPosts: (projectId: string, query: string) => Promise<void>;
  readonly loadMorePosts: (projectId: string) => Promise<void>;
  readonly loadMoreSearchResults: (projectId: string) => Promise<void>;
  readonly selectPost: (projectId: string, postId: number) => Promise<void>;
  readonly selectCommentPath: (
    projectId: string,
    commentId: number,
  ) => Promise<void>;
  readonly branchState: (
    postId: number,
    parentCommentId: number | null,
  ) => AsyncState<DenBoardCommentPage>;
  readonly loadComments: (
    postId: number,
    parentCommentId: number | null,
  ) => Promise<void>;
  readonly toggleBranch: (
    postId: number,
    parentCommentId: number,
  ) => Promise<void>;
  readonly loadMoreComments: (
    postId: number,
    parentCommentId: number | null,
  ) => Promise<void>;
  readonly createPost: (
    projectId: string,
    body: DenBoardCreatePostRequest,
  ) => Promise<DenResult<DenBoardPost>>;
  readonly createComment: (
    postId: number,
    body: DenBoardCreateCommentRequest,
  ) => Promise<DenResult<DenBoardComment>>;
  readonly purgePost: (
    postId: number,
    body: DenBoardPurgeRequest,
  ) => Promise<DenResult<void>>;
  readonly purgeComment: (
    postId: number,
    commentId: number,
    body: DenBoardPurgeRequest,
  ) => Promise<DenResult<void>>;
}

export function createBoardStore(transport: BoardTransportPort): BoardStore {
  const posts = signal<AsyncState<DenBoardPostPage>>(idleState());
  const search = signal<AsyncState<DenBoardSearchPage>>(idleState());
  const searchQuery = signal('');
  const selectedPostId = signal<number | null>(null);
  const selectedPost = signal<AsyncState<DenBoardPost>>(idleState());
  const commentPath = signal<DenBoardCommentPath | null>(null);
  const commentPathTargetId = signal<number | null>(null);
  const branches = signal<ReadonlyMap<string, BoardBranchState>>(new Map());
  const expandedBranchKeys = signal<ReadonlySet<string>>(new Set());
  const createPostState = signal<AsyncState<DenBoardPost>>(idleState());
  const createCommentState = signal<AsyncState<DenBoardComment>>(idleState());
  const purgePostState = signal<AsyncState<void>>(idleState());
  const purgeCommentState = signal<AsyncState<void>>(idleState());

  const quarantinedPostIds = new Set<number>();
  const quarantinedCommentIds = new Set<number>();
  const branchRequests = new Map<string, number>();
  let activeProjectId: string | null = null;
  let scopeGeneration = 0;
  let contentGeneration = 0;
  let postsRequest = 0;
  let searchRequest = 0;
  let selectedPostRequest = 0;
  let createPostRequest = 0;
  let createCommentRequest = 0;
  let purgePostRequest = 0;
  let purgeCommentRequest = 0;

  const commentTree = computed(() => {
    const postId = selectedPostId();
    if (postId === null) return [];
    return buildBoardCommentTree(
      postId,
      branchSnapshots(branches()),
      expandedBranchKeys(),
      quarantinedCommentIds,
    );
  });

  const refresh = async (projectId: string): Promise<void> => {
    ensureProjectScope(projectId);
    const request = ++postsRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    const previous = stateValue(posts());
    posts.set(loadingState(previous));
    try {
      const result = await transport.listPosts(projectId, {
        limit: boardPageLimit,
      });
      if (!isCurrentListRequest(projectId, scope, content, request)) return;
      if (result.ok) {
        posts.set(
          dataState(
            mergeBoardPostPage(undefined, result.value, quarantinedPostIds),
          ),
        );
      } else {
        posts.set(errorState(result.error, previous));
      }
    } catch (error: unknown) {
      if (!isCurrentListRequest(projectId, scope, content, request)) return;
      posts.set(errorState(unknownStoreError(error), previous));
    }
  };

  const searchPosts = async (
    projectId: string,
    query: string,
  ): Promise<void> => {
    ensureProjectScope(projectId);
    const normalizedQuery = query.trim();
    searchQuery.set(normalizedQuery);
    const request = ++searchRequest;
    if (!normalizedQuery) {
      search.set(idleState());
      return;
    }
    const scope = scopeGeneration;
    const content = contentGeneration;
    const previous = stateValue(search());
    search.set(loadingState(previous));
    try {
      const result = await transport.searchPosts(projectId, normalizedQuery, {
        limit: boardPageLimit,
      });
      if (
        !isCurrentSearchRequest(
          projectId,
          scope,
          content,
          request,
          normalizedQuery,
        )
      )
        return;
      if (result.ok) {
        search.set(
          dataState(
            mergeBoardSearchPage(
              undefined,
              result.value,
              quarantinedPostIds,
              quarantinedCommentIds,
            ),
          ),
        );
      } else {
        search.set(errorState(result.error, previous));
      }
    } catch (error: unknown) {
      if (
        !isCurrentSearchRequest(
          projectId,
          scope,
          content,
          request,
          normalizedQuery,
        )
      )
        return;
      search.set(errorState(unknownStoreError(error), previous));
    }
  };

  const loadMorePosts = async (projectId: string): Promise<void> => {
    ensureProjectScope(projectId);
    const previous = stateValue(posts());
    const afterId = previous?.next_after_id ?? null;
    if (!previous || afterId === null) return;
    const request = ++postsRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    posts.set(loadingState(previous));
    try {
      const options = { afterId, limit: boardPageLimit };
      const result = await transport.listPosts(projectId, options);
      if (!isCurrentListRequest(projectId, scope, content, request)) return;
      if (result.ok) {
        posts.set(
          dataState(
            mergeBoardPostPage(previous, result.value, quarantinedPostIds),
          ),
        );
      } else {
        posts.set(errorState(result.error, previous));
      }
    } catch (error: unknown) {
      if (!isCurrentListRequest(projectId, scope, content, request)) return;
      posts.set(errorState(unknownStoreError(error), previous));
    }
  };

  const loadMoreSearchResults = async (projectId: string): Promise<void> => {
    ensureProjectScope(projectId);
    const normalizedQuery = searchQuery();
    const previous = stateValue(search());
    const afterId = previous?.next_after_id ?? null;
    if (!normalizedQuery || !previous || afterId === null) return;
    const request = ++searchRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    search.set(loadingState(previous));
    try {
      const options = { afterId, limit: boardPageLimit };
      const result = await transport.searchPosts(
        projectId,
        normalizedQuery,
        options,
      );
      if (
        !isCurrentSearchRequest(
          projectId,
          scope,
          content,
          request,
          normalizedQuery,
        )
      )
        return;
      if (result.ok) {
        search.set(
          dataState(
            mergeBoardSearchPage(
              previous,
              result.value,
              quarantinedPostIds,
              quarantinedCommentIds,
            ),
          ),
        );
      } else {
        search.set(errorState(result.error, previous));
      }
    } catch (error: unknown) {
      if (
        !isCurrentSearchRequest(
          projectId,
          scope,
          content,
          request,
          normalizedQuery,
        )
      )
        return;
      search.set(errorState(unknownStoreError(error), previous));
    }
  };

  const selectPost = async (
    projectId: string,
    postId: number,
  ): Promise<void> => {
    ensureProjectScope(projectId);
    const request = ++selectedPostRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    commentPath.set(null);
    commentPathTargetId.set(null);
    if (quarantinedPostIds.has(postId)) {
      selectedPostId.set(null);
      selectedPost.set(idleState());
      return;
    }
    selectedPostId.set(postId);
    expandedBranchKeys.set(new Set());
    selectedPost.set(loadingState());
    try {
      const result = await transport.getPost(postId);
      if (!isCurrentSelectedPost(projectId, postId, scope, content, request))
        return;
      if (!result.ok) {
        selectedPost.set(errorState(result.error));
        return;
      }
      if (quarantinedPostIds.has(postId)) return;
      selectedPost.set(dataState(result.value));
      await loadComments(postId, null);
    } catch (error: unknown) {
      if (!isCurrentSelectedPost(projectId, postId, scope, content, request))
        return;
      selectedPost.set(errorState(unknownStoreError(error)));
    }
  };

  const selectCommentPath = async (
    projectId: string,
    commentId: number,
  ): Promise<void> => {
    ensureProjectScope(projectId);
    const request = ++selectedPostRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    selectedPostId.set(null);
    selectedPost.set(loadingState());
    commentPath.set(null);
    commentPathTargetId.set(commentId);
    branches.set(new Map());
    expandedBranchKeys.set(new Set());
    try {
      const result = await transport.getCommentPath(commentId, {
        limit: boardPageLimit,
      });
      if (!isCurrentSelectionRequest(projectId, scope, content, request))
        return;
      if (!result.ok) {
        commentPathTargetId.set(null);
        selectedPost.set(errorState(result.error));
        return;
      }
      const path = sanitizeCommentPath(result.value, quarantinedCommentIds);
      if (quarantinedPostIds.has(path.post.id)) {
        commentPath.set(null);
        commentPathTargetId.set(null);
        selectedPost.set(idleState());
        return;
      }
      selectedPostId.set(path.post.id);
      selectedPost.set(dataState(path.post));
      commentPath.set(path);
      const seeded = seedCommentPath(path.post.id, path.comments);
      branches.set(seeded.branches);
      expandedBranchKeys.set(seeded.expandedBranchKeys);
    } catch (error: unknown) {
      if (!isCurrentSelectionRequest(projectId, scope, content, request))
        return;
      commentPathTargetId.set(null);
      selectedPost.set(errorState(unknownStoreError(error)));
    }
  };

  const loadComments = async (
    postId: number,
    parentCommentId: number | null,
    options: { readonly loadMore?: boolean } = {},
  ): Promise<void> => {
    if (quarantinedPostIds.has(postId)) return;
    const key = boardBranchKey(postId, parentCommentId);
    const currentBranch = branches().get(key);
    const previous = currentBranch
      ? stateValue(currentBranch.state)
      : undefined;
    const loadMore = options.loadMore === true;
    const afterId = previous?.next_after_id ?? null;
    if (loadMore && (previous === undefined || afterId === null)) return;
    const request = (branchRequests.get(key) ?? 0) + 1;
    branchRequests.set(key, request);
    const scope = scopeGeneration;
    const content = contentGeneration;
    setBranchState(postId, parentCommentId, loadingState(previous));
    try {
      const requestOptions = {
        ...(parentCommentId === null ? {} : { parentCommentId }),
        ...(loadMore && afterId !== null ? { afterId } : {}),
        limit: boardPageLimit,
      };
      const result = await transport.listComments(postId, requestOptions);
      if (!isCurrentBranchRequest(postId, key, scope, content, request)) return;
      if (result.ok) {
        const nextPage = loadMore
          ? mergeBoardCommentPage(previous, result.value, quarantinedCommentIds)
          : sanitizeBoardCommentPage(result.value, quarantinedCommentIds);
        setBranchState(postId, parentCommentId, dataState(nextPage));
      } else {
        setBranchState(
          postId,
          parentCommentId,
          errorState(result.error, previous),
        );
      }
    } catch (error: unknown) {
      if (!isCurrentBranchRequest(postId, key, scope, content, request)) return;
      setBranchState(
        postId,
        parentCommentId,
        errorState(unknownStoreError(error), previous),
      );
    }
  };

  const toggleBranch = async (
    postId: number,
    parentCommentId: number,
  ): Promise<void> => {
    const key = boardBranchKey(postId, parentCommentId);
    const nextExpanded = new Set(expandedBranchKeys());
    if (nextExpanded.has(key)) {
      nextExpanded.delete(key);
      expandedBranchKeys.set(nextExpanded);
      return;
    }
    nextExpanded.add(key);
    expandedBranchKeys.set(nextExpanded);
    const currentState = branchState(postId, parentCommentId);
    if (currentState.kind === 'data') return;
    if (currentState.kind === 'loading') return;
    await loadComments(postId, parentCommentId);
  };

  const loadMoreComments = (
    postId: number,
    parentCommentId: number | null,
  ): Promise<void> => loadComments(postId, parentCommentId, { loadMore: true });

  const createPost = async (
    projectId: string,
    body: DenBoardCreatePostRequest,
  ): Promise<DenResult<DenBoardPost>> => {
    ensureProjectScope(projectId);
    const request = ++createPostRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    createPostState.set(loadingState());
    try {
      const result = await transport.createPost(projectId, body);
      if (
        scope !== scopeGeneration ||
        content !== contentGeneration ||
        request !== createPostRequest
      )
        return result;
      if (!result.ok) {
        createPostState.set(errorState(result.error));
        return result;
      }
      if (quarantinedPostIds.has(result.value.id)) return result;
      const previous = stateValue(posts());
      const summary = boardPostSummary(result.value);
      const nextPage = mergeBoardPostPage(
        previous,
        {
          posts: [summary],
          next_after_id: previous?.next_after_id ?? null,
        },
        quarantinedPostIds,
      );
      posts.set(dataState(nextPage));
      createPostState.set(dataState(result.value));
      selectedPostRequest += 1;
      selectedPostId.set(result.value.id);
      selectedPost.set(dataState(result.value));
      expandedBranchKeys.set(new Set());
      void loadComments(result.value.id, null);
      return result;
    } catch (error: unknown) {
      const classified = unknownStoreError(error);
      if (
        scope === scopeGeneration &&
        content === contentGeneration &&
        request === createPostRequest
      )
        createPostState.set(errorState(classified));
      return { ok: false, error: classified };
    }
  };

  const createComment = async (
    postId: number,
    body: DenBoardCreateCommentRequest,
  ): Promise<DenResult<DenBoardComment>> => {
    if (quarantinedPostIds.has(postId)) {
      return {
        ok: false,
        error: {
          kind: 'not-found',
          message: 'Board post is no longer available.',
          status: 404,
        },
      };
    }
    const request = ++createCommentRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    createCommentState.set(loadingState());
    try {
      const result = await transport.createComment(postId, body);
      if (
        scope !== scopeGeneration ||
        content !== contentGeneration ||
        request !== createCommentRequest
      )
        return result;
      if (!result.ok) {
        createCommentState.set(errorState(result.error));
        return result;
      }
      if (quarantinedCommentIds.has(result.value.id)) return result;
      createCommentState.set(dataState(result.value));
      const parentCommentId = result.value.parent_comment_id ?? null;
      const currentBranch = branches().get(
        boardBranchKey(postId, parentCommentId),
      );
      const previous = currentBranch
        ? stateValue(currentBranch.state)
        : undefined;
      if (previous) {
        invalidateBranchRequest(boardBranchKey(postId, parentCommentId));
        setBranchState(
          postId,
          parentCommentId,
          dataState(
            mergeBoardCommentPage(
              previous,
              {
                comments: [result.value],
                next_after_id: previous.next_after_id ?? null,
              },
              quarantinedCommentIds,
            ),
          ),
        );
      } else {
        void loadComments(postId, parentCommentId);
      }
      if (parentCommentId !== null) {
        const nextExpanded = new Set(expandedBranchKeys());
        nextExpanded.add(boardBranchKey(postId, parentCommentId));
        expandedBranchKeys.set(nextExpanded);
      }
      return result;
    } catch (error: unknown) {
      const classified = unknownStoreError(error);
      if (
        scope === scopeGeneration &&
        content === contentGeneration &&
        request === createCommentRequest
      )
        createCommentState.set(errorState(classified));
      return { ok: false, error: classified };
    }
  };

  const purgePost = async (
    postId: number,
    body: DenBoardPurgeRequest,
  ): Promise<DenResult<void>> => {
    const request = ++purgePostRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    purgePostState.set(loadingState());
    try {
      const result = await transport.purgePost(postId, body);
      if (
        scope !== scopeGeneration ||
        content !== contentGeneration ||
        request !== purgePostRequest
      )
        return result;
      if (!result.ok) {
        purgePostState.set(errorState(result.error));
        return result;
      }
      contentGeneration += 1;
      quarantinedPostIds.add(postId);
      purgePostState.set(dataState(undefined));
      if (stateValue(createPostState())?.id === postId)
        createPostState.set(idleState());
      if (stateValue(createCommentState())?.post_id === postId)
        createCommentState.set(idleState());
      if (commentPath()?.post.id === postId) {
        commentPath.set(null);
        commentPathTargetId.set(null);
      }
      posts.set(
        mapStateValue(posts(), (page) => removeBoardPost(page, postId)),
      );
      search.set(
        mapStateValue(search(), (page) =>
          removeBoardSearchContent(page, postId),
        ),
      );
      branches.set(
        new Map(
          [...branches()].filter(([, branch]) => branch.postId !== postId),
        ),
      );
      expandedBranchKeys.set(
        new Set(
          [...expandedBranchKeys()].filter(
            (key) => !key.startsWith(`${postId}:`),
          ),
        ),
      );
      if (selectedPostId() === postId) {
        selectedPostRequest += 1;
        selectedPostId.set(null);
        selectedPost.set(idleState());
      }
      return result;
    } catch (error: unknown) {
      const classified = unknownStoreError(error);
      if (
        scope === scopeGeneration &&
        content === contentGeneration &&
        request === purgePostRequest
      )
        purgePostState.set(errorState(classified));
      return { ok: false, error: classified };
    }
  };

  const purgeComment = async (
    postId: number,
    commentId: number,
    body: DenBoardPurgeRequest,
  ): Promise<DenResult<void>> => {
    const request = ++purgeCommentRequest;
    const scope = scopeGeneration;
    const content = contentGeneration;
    purgeCommentState.set(loadingState());
    try {
      const result = await transport.purgeComment(commentId, body);
      if (
        scope !== scopeGeneration ||
        content !== contentGeneration ||
        request !== purgeCommentRequest
      )
        return result;
      if (!result.ok) {
        purgeCommentState.set(errorState(result.error));
        return result;
      }
      contentGeneration += 1;
      quarantinedCommentIds.add(commentId);
      purgeCommentState.set(dataState(undefined));
      if (stateValue(createCommentState())?.id === commentId)
        createCommentState.set(idleState());
      const currentPath = commentPath();
      if (currentPath?.post.id === postId)
        commentPath.set(
          sanitizeCommentPath(currentPath, quarantinedCommentIds),
        );
      const nextBranches = new Map<string, BoardBranchState>();
      for (const [key, branch] of branches()) {
        nextBranches.set(key, {
          ...branch,
          state: mapStateValue(branch.state, (page) =>
            sanitizeBoardCommentPage(page, quarantinedCommentIds),
          ),
        });
      }
      branches.set(nextBranches);
      search.set(
        mapStateValue(search(), (page) =>
          removeBoardCommentSearchContent(page, commentId),
        ),
      );
      return result;
    } catch (error: unknown) {
      const classified = unknownStoreError(error);
      if (
        scope === scopeGeneration &&
        content === contentGeneration &&
        request === purgeCommentRequest
      )
        purgeCommentState.set(errorState(classified));
      return { ok: false, error: classified };
    }
  };

  const branchState = (
    postId: number,
    parentCommentId: number | null,
  ): AsyncState<DenBoardCommentPage> =>
    branches().get(boardBranchKey(postId, parentCommentId))?.state ??
    idleState();

  return {
    posts: posts.asReadonly(),
    search: search.asReadonly(),
    searchQuery: searchQuery.asReadonly(),
    selectedPostId: selectedPostId.asReadonly(),
    selectedPost: selectedPost.asReadonly(),
    commentPath: commentPath.asReadonly(),
    commentPathTargetId: commentPathTargetId.asReadonly(),
    branches: branches.asReadonly(),
    expandedBranchKeys: expandedBranchKeys.asReadonly(),
    commentTree,
    createPostState: createPostState.asReadonly(),
    createCommentState: createCommentState.asReadonly(),
    purgePostState: purgePostState.asReadonly(),
    purgeCommentState: purgeCommentState.asReadonly(),
    refresh,
    searchPosts,
    loadMorePosts,
    loadMoreSearchResults,
    selectPost,
    selectCommentPath,
    branchState,
    loadComments,
    toggleBranch,
    loadMoreComments,
    createPost,
    createComment,
    purgePost,
    purgeComment,
  };

  function ensureProjectScope(projectId: string): void {
    if (activeProjectId === projectId) return;
    activeProjectId = projectId;
    scopeGeneration += 1;
    contentGeneration += 1;
    postsRequest += 1;
    searchRequest += 1;
    selectedPostRequest += 1;
    createPostRequest += 1;
    createCommentRequest += 1;
    purgePostRequest += 1;
    purgeCommentRequest += 1;
    branchRequests.clear();
    posts.set(idleState());
    search.set(idleState());
    searchQuery.set('');
    selectedPostId.set(null);
    selectedPost.set(idleState());
    commentPath.set(null);
    commentPathTargetId.set(null);
    branches.set(new Map());
    expandedBranchKeys.set(new Set());
    createPostState.set(idleState());
    createCommentState.set(idleState());
    purgePostState.set(idleState());
    purgeCommentState.set(idleState());
  }

  function setBranchState(
    postId: number,
    parentCommentId: number | null,
    state: AsyncState<DenBoardCommentPage>,
  ): void {
    const key = boardBranchKey(postId, parentCommentId);
    const nextBranches = new Map(branches());
    nextBranches.set(key, { postId, parentCommentId, state });
    branches.set(nextBranches);
  }

  function invalidateBranchRequest(key: string): void {
    branchRequests.set(key, (branchRequests.get(key) ?? 0) + 1);
  }

  function isCurrentListRequest(
    projectId: string,
    scope: number,
    content: number,
    request: number,
  ): boolean {
    return (
      activeProjectId === projectId &&
      scope === scopeGeneration &&
      content === contentGeneration &&
      request === postsRequest
    );
  }

  function isCurrentSearchRequest(
    projectId: string,
    scope: number,
    content: number,
    request: number,
    query: string,
  ): boolean {
    return (
      activeProjectId === projectId &&
      searchQuery() === query &&
      scope === scopeGeneration &&
      content === contentGeneration &&
      request === searchRequest
    );
  }

  function isCurrentSelectedPost(
    projectId: string,
    postId: number,
    scope: number,
    content: number,
    request: number,
  ): boolean {
    return (
      activeProjectId === projectId &&
      selectedPostId() === postId &&
      scope === scopeGeneration &&
      content === contentGeneration &&
      request === selectedPostRequest
    );
  }

  function isCurrentSelectionRequest(
    projectId: string,
    scope: number,
    content: number,
    request: number,
  ): boolean {
    return (
      activeProjectId === projectId &&
      scope === scopeGeneration &&
      content === contentGeneration &&
      request === selectedPostRequest
    );
  }

  function isCurrentBranchRequest(
    postId: number,
    key: string,
    scope: number,
    content: number,
    request: number,
  ): boolean {
    return (
      !quarantinedPostIds.has(postId) &&
      scope === scopeGeneration &&
      content === contentGeneration &&
      request === branchRequests.get(key)
    );
  }
}

function branchSnapshots(
  branches: ReadonlyMap<string, BoardBranchState>,
): ReadonlyMap<string, BoardCommentBranchSnapshot> {
  const snapshots = new Map<string, BoardCommentBranchSnapshot>();
  for (const [key, branch] of branches) {
    const value = stateValue(branch.state);
    snapshots.set(key, {
      postId: branch.postId,
      parentCommentId: branch.parentCommentId,
      comments: value?.comments ?? [],
      nextAfterId: value?.next_after_id ?? null,
      loaded: value !== undefined,
      state: branchLoadState(branch.state),
      errorMessage:
        branch.state.kind === 'error' ? branch.state.error.message : null,
    });
  }
  return snapshots;
}

function branchLoadState(
  state: AsyncState<DenBoardCommentPage>,
): BoardBranchLoadState {
  return state.kind;
}

function sanitizeCommentPath(
  path: DenBoardCommentPath,
  quarantinedCommentIds: ReadonlySet<number>,
): DenBoardCommentPath {
  return {
    ...path,
    comments: path.comments.map((comment) =>
      sanitizeBoardComment(comment, quarantinedCommentIds),
    ),
  };
}

function seedCommentPath(
  postId: number,
  comments: readonly DenBoardComment[],
): {
  readonly branches: ReadonlyMap<string, BoardBranchState>;
  readonly expandedBranchKeys: ReadonlySet<string>;
} {
  const branches = new Map<string, BoardBranchState>();
  const expandedBranchKeys = new Set<string>();
  for (const comment of comments) {
    const parentCommentId = comment.parent_comment_id ?? null;
    const key = boardBranchKey(postId, parentCommentId);
    const existing = branches.get(key);
    const existingComments = existing
      ? (stateValue(existing.state)?.comments ?? [])
      : [];
    const commentsById = new Map(
      [...existingComments, comment].map((item) => [item.id, item]),
    );
    branches.set(key, {
      postId,
      parentCommentId,
      state: dataState({
        comments: [...commentsById.values()],
        next_after_id: null,
      }),
    });
    if (parentCommentId !== null)
      expandedBranchKeys.add(boardBranchKey(postId, parentCommentId));
  }
  return { branches, expandedBranchKeys };
}

function mapStateValue<T>(
  state: AsyncState<T>,
  map: (value: T) => T,
): AsyncState<T> {
  switch (state.kind) {
    case 'idle':
      return state;
    case 'loading':
      return state.previous === undefined
        ? loadingState()
        : loadingState(map(state.previous));
    case 'data':
      return dataState(map(state.value));
    case 'error':
      return state.previous === undefined
        ? errorState(state.error)
        : errorState(state.error, map(state.previous));
  }
}

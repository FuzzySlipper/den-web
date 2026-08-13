import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LocalTimeComponent, MarkdownViewComponent } from '@den-web/components';
import {
  boardCommentAuthor,
  boardCommentBody,
  boardCommentIsTombstone,
} from '@den-web/domain';
import type {
  DenBoardCreateCommentRequest,
  DenBoardCreatePostRequest,
  DenBoardPostSummary,
  DenBoardSearchResult,
} from '@den-web/protocol';
import {
  BOARD_STORE,
  PREFERENCES_STORE,
  stateValue,
  WORKSPACE_STORE,
} from '@den-web/store';
import { BoardCommentNodeComponent } from './board-comment-node.component';
import { boardNoticeText, type BoardNotice } from './board-notices';
import { boardPanelStyles } from './board-panel.styles';

type MobilePane = 'list' | 'detail';
type PurgeTarget =
  | { readonly kind: 'post'; readonly postId: number }
  | {
      readonly kind: 'comment';
      readonly postId: number;
      readonly commentId: number;
    };

@Component({
  selector: 'den-board-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BoardCommentNodeComponent,
    LocalTimeComponent,
    MarkdownViewComponent,
  ],
  styles: [boardPanelStyles],
  template: `
    <section
      class="board"
      aria-label="Board"
      [class.show-detail]="mobilePane() === 'detail'"
    >
      <aside class="list" aria-label="Board post list">
        <header class="list-header">
          <h2>Board</h2>
          <span class="muted">{{
            selectedProjectId() || 'Select a project'
          }}</span>
          <div class="toolbar">
            <label class="sr-only" for="board-search">Search Board</label>
            <input
              id="board-search"
              [value]="searchDraft()"
              placeholder="Search posts and replies"
              (input)="setSearchDraft($event)"
              (keydown.enter)="search()"
            />
            <button type="button" [disabled]="searchBusy()" (click)="search()">
              Search
            </button>
            @if (searchDraft()) {
              <button type="button" (click)="clearSearch()">Clear</button>
            }
          </div>
          <button type="button" class="primary" (click)="openNewPost()">
            New post
          </button>
        </header>

        <div class="items">
          @if (searchQuery()) {
            @switch (searchState().kind) {
              @case ('loading') {
                <p class="state">Searching Board</p>
              }
              @case ('error') {
                <p class="state error">{{ errorText(searchError()) }}</p>
              }
              @case ('data') {
                @if (searchItems().length === 0) {
                  <p class="state">No Board matches</p>
                } @else {
                  @for (
                    result of searchItems();
                    track result.kind + ':' + result.id
                  ) {
                    <button
                      type="button"
                      class="search-result"
                      [attr.aria-pressed]="result.post_id === selectedPostId()"
                      (click)="selectSearchResult(result)"
                    >
                      <strong class="result-title">{{
                        result.title ||
                          (result.kind === 'comment' ? 'Reply' : 'Post')
                      }}</strong>
                      <span class="meta"
                        >{{ result.kind }} #{{ result.id }} ·
                        {{ result.author_identity || 'unknown' }}</span
                      >
                      <span class="result-snippet">{{ result.snippet }}</span>
                    </button>
                  }
                  @if (searchHasMore()) {
                    <button
                      type="button"
                      (click)="loadMoreSearchResults()"
                      [disabled]="searchState().kind === 'loading'"
                    >
                      Load more matches
                    </button>
                  }
                }
              }
              @default {
                <p class="state">Enter a search term</p>
              }
            }
          } @else {
            @switch (postsState().kind) {
              @case ('loading') {
                <p class="state">Loading Board posts</p>
              }
              @case ('error') {
                <p class="state error">{{ errorText(postsError()) }}</p>
              }
              @case ('data') {
                @if (postItems().length === 0) {
                  <p class="state">No Board posts in this project</p>
                } @else {
                  @for (post of postItems(); track post.id) {
                    <button
                      type="button"
                      class="post-button"
                      [attr.aria-pressed]="post.id === selectedPostId()"
                      (click)="selectPost(post)"
                    >
                      <strong class="post-title"
                        >#{{ post.id }} {{ post.title }}</strong
                      >
                      <span class="meta"
                        >{{ post.author_identity }} ·
                        <den-local-time [value]="post.created_at"
                      /></span>
                    </button>
                  }
                  @if (postsHasMore()) {
                    <button
                      type="button"
                      (click)="loadMorePosts()"
                      [disabled]="postsState().kind === 'loading'"
                    >
                      Load more posts
                    </button>
                  }
                }
              }
              @default {
                <p class="state">Select a project</p>
              }
            }
          }
        </div>
      </aside>

      <article class="detail" aria-label="Board detail">
        @switch (selectedPostState().kind) {
          @case ('loading') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showList()">
                Back to Board
              </button>
              <p class="state">Loading Board post</p>
            </div>
          }
          @case ('error') {
            <div class="detail-body">
              <button type="button" class="mobile-back" (click)="showList()">
                Back to Board
              </button>
              <p class="state error">{{ errorText(selectedPostError()) }}</p>
            </div>
          }
          @case ('data') {
            @let post = selectedPostValue();
            @if (post) {
              <header class="detail-header">
                <button type="button" class="mobile-back" (click)="showList()">
                  Back to Board
                </button>
                <div class="section-head">
                  <div>
                    <h3>{{ post.title }}</h3>
                    <span class="meta"
                      >Post #{{ post.id }} · {{ post.author_identity }} ·
                      <den-local-time
                        [value]="post.created_at"
                        [relative]="false"
                    /></span>
                  </div>
                  <div class="detail-actions">
                    <button
                      type="button"
                      class="danger"
                      (click)="requestPostPurge(post.id)"
                    >
                      Purge post
                    </button>
                  </div>
                </div>
              </header>

              <div class="detail-body">
                @if (notice()) {
                  <p class="notice" role="status">{{ notice() }}</p>
                }
                <section class="section" aria-label="Board post content">
                  <div class="section-head">
                    <h4>Post</h4>
                    <span class="muted"
                      >Updated
                      <den-local-time
                        [value]="post.updated_at"
                        [relative]="false"
                    /></span>
                  </div>
                  <div class="post-body">
                    <den-markdown-view [content]="post.body_markdown" />
                  </div>
                </section>

                @if (commentPath(); as path) {
                  <section
                    class="section comment-path"
                    aria-label="Bounded path to matched Board comment"
                  >
                    <div class="section-head">
                      <h4>Path to matched reply</h4>
                      @if (path.truncated) {
                        <span class="muted">Showing bounded path suffix</span>
                      }
                    </div>
                    <ol class="path-list">
                      @for (comment of path.comments; track comment.id) {
                        <li
                          class="path-item"
                          [class.path-target]="
                            comment.id === commentPathTargetId()
                          "
                        >
                          <div class="meta">
                            @if (boardCommentIsTombstone(comment)) {
                              <strong>Content purged</strong>
                            } @else {
                              <strong>{{ boardCommentAuthor(comment) }}</strong>
                            }
                            · Comment #{{ comment.id }}
                          </div>
                          @if (!boardCommentIsTombstone(comment)) {
                            <div class="path-body">
                              <den-markdown-view
                                [content]="boardCommentBody(comment)"
                              />
                            </div>
                          }
                        </li>
                      }
                    </ol>
                  </section>
                }

                <section class="section" aria-label="Board comments">
                  <div class="section-head">
                    <h4>Replies</h4>
                    <button type="button" (click)="openRootReply()">
                      Reply to post
                    </button>
                  </div>
                  @switch (rootBranch().kind) {
                    @case ('loading') {
                      <p class="state">Loading direct replies</p>
                    }
                    @case ('error') {
                      <p class="state error">
                        {{ errorText(rootBranchError()) }}
                      </p>
                    }
                    @case ('data') {
                      @if (commentTree().length === 0) {
                        <p class="state">No direct replies yet</p>
                      } @else {
                        <div class="reply-list">
                          @for (node of commentTree(); track node.comment.id) {
                            <den-board-comment-node
                              [node]="node"
                              (replyRequested)="openCommentReply($event)"
                              (toggleRequested)="toggleBranch($event)"
                              (loadMoreRequested)="loadMoreBranch($event)"
                              (purgeRequested)="
                                requestCommentPurge(post.id, $event)
                              "
                            />
                          }
                        </div>
                      }
                      @if (rootHasMore()) {
                        <button
                          type="button"
                          (click)="loadMoreRootReplies()"
                          [disabled]="rootBranch().kind === 'loading'"
                        >
                          Load more direct replies
                        </button>
                      }
                    }
                    @default {
                      <p class="state">Replies are not loaded yet</p>
                    }
                  }
                </section>

                @if (replyOpen()) {
                  <form
                    class="composer"
                    aria-label="Board reply composer"
                    (submit)="submitReply($event)"
                  >
                    <h4>
                      {{
                        replyTargetId() === null
                          ? 'Reply to post'
                          : 'Reply to comment #' + replyTargetId()
                      }}
                    </h4>
                    <span class="form-note">Posting as {{ identity() }}</span>
                    <label for="board-reply-body">Reply</label>
                    <textarea
                      id="board-reply-body"
                      [value]="replyDraft()"
                      (input)="setReplyDraft($event)"
                      placeholder="Write a Markdown reply"
                    ></textarea>
                    @if (createCommentError()) {
                      <p class="error" role="alert">
                        {{ errorText(createCommentError()) }}
                      </p>
                    }
                    <div class="form-actions">
                      <button
                        type="submit"
                        class="primary"
                        [disabled]="replyBusy() || !canSubmitReply()"
                      >
                        {{ replyBusy() ? 'Posting...' : 'Post reply' }}
                      </button>
                      <button type="button" (click)="closeReply()">
                        Cancel
                      </button>
                    </div>
                  </form>
                }
              </div>
            }
          }
          @default {
            <div class="detail-body">
              <p class="state">
                Select a Board post to read its bounded reply branches.
              </p>
            </div>
          }
        }
      </article>
    </section>

    @if (newPostOpen()) {
      <div class="dialog-backdrop">
        <form
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-label="New Board post"
          (submit)="submitNewPost($event)"
        >
          <h3>New Board post</h3>
          <span class="form-note"
            >Posting as {{ identity() }} in {{ selectedProjectId() }}</span
          >
          <label for="board-post-title">Title</label>
          <input
            id="board-post-title"
            [value]="newPostTitle()"
            (input)="setNewPostTitle($event)"
          />
          <label for="board-post-body">Body</label>
          <textarea
            id="board-post-body"
            [value]="newPostBody()"
            (input)="setNewPostBody($event)"
            placeholder="Write a Markdown post"
          ></textarea>
          @if (createPostError()) {
            <p class="error" role="alert">{{ errorText(createPostError()) }}</p>
          }
          <div class="form-actions">
            <button
              type="submit"
              class="primary"
              [disabled]="createPostBusy() || !canSubmitNewPost()"
            >
              {{ createPostBusy() ? 'Creating...' : 'Create post' }}
            </button>
            <button type="button" (click)="closeNewPost()">Cancel</button>
          </div>
        </form>
      </div>
    }

    @if (purgeTarget(); as target) {
      <div class="dialog-backdrop">
        <section
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm Board purge"
        >
          <h3>Confirm purge</h3>
          <p>
            This permanently removes authored content from normal Board reads.
            Descendant comments may remain only as content-free structural
            tombstones.
          </p>
          <p class="form-note">
            {{
              target.kind === 'post'
                ? 'Purge post #' + target.postId
                : 'Purge comment #' + target.commentId
            }}
          </p>
          <label for="board-purge-reason">Reason</label>
          <textarea
            id="board-purge-reason"
            [value]="purgeReason()"
            (input)="setPurgeReason($event)"
            placeholder="Explain why this content is being purged"
          ></textarea>
          @if (purgeError()) {
            <p class="error" role="alert">{{ errorText(purgeError()) }}</p>
          }
          <div class="form-actions">
            <button
              type="button"
              class="danger"
              [disabled]="purgeBusy() || !canConfirmPurge()"
              (click)="confirmPurge()"
            >
              {{ purgeBusy() ? 'Purging...' : 'Confirm purge' }}
            </button>
            <button type="button" (click)="cancelPurge()">Cancel</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class BoardPanelComponent {
  private readonly workspace = inject(WORKSPACE_STORE);
  private readonly store = inject(BOARD_STORE);
  private readonly preferences = inject(PREFERENCES_STORE);
  private loadedProjectId: string | null = null;

  protected readonly selectedProjectId = this.workspace.selectedProjectId;
  protected readonly identity = computed(
    () => this.preferences.preferences().conversationSenderIdentity,
  );
  protected readonly boardCommentAuthor = boardCommentAuthor;
  protected readonly boardCommentBody = boardCommentBody;
  protected readonly boardCommentIsTombstone = boardCommentIsTombstone;
  protected readonly postsState = this.store.posts;
  protected readonly searchState = this.store.search;
  protected readonly searchQuery = this.store.searchQuery;
  protected readonly selectedPostId = this.store.selectedPostId;
  protected readonly selectedPostState = this.store.selectedPost;
  protected readonly commentPath = this.store.commentPath;
  protected readonly commentPathTargetId = this.store.commentPathTargetId;
  protected readonly rootBranch = computed(() => {
    const postId = this.selectedPostId();
    return postId === null
      ? this.store.branchState(-1, null)
      : this.store.branchState(postId, null);
  });
  protected readonly commentTree = this.store.commentTree;
  protected readonly createPostState = this.store.createPostState;
  protected readonly createCommentState = this.store.createCommentState;
  protected readonly purgePostState = this.store.purgePostState;
  protected readonly purgeCommentState = this.store.purgeCommentState;
  protected readonly postItems = computed(
    () => stateValue(this.postsState())?.posts ?? [],
  );
  protected readonly searchItems = computed(
    () => stateValue(this.searchState())?.results ?? [],
  );
  protected readonly selectedPostValue = computed(
    () => stateValue(this.selectedPostState()) ?? null,
  );
  protected readonly searchDraft = signal('');
  protected readonly newPostOpen = signal(false);
  protected readonly newPostTitle = signal('');
  protected readonly newPostBody = signal('');
  protected readonly replyOpen = signal(false);
  protected readonly replyTargetId = signal<number | null>(null);
  protected readonly replyDraft = signal('');
  protected readonly purgeTarget = signal<PurgeTarget | null>(null);
  protected readonly purgeReason = signal('');
  protected readonly mobilePane = signal<MobilePane>('list');
  protected readonly postsError = computed(() => stateError(this.postsState()));
  protected readonly searchError = computed(() =>
    stateError(this.searchState()),
  );
  protected readonly selectedPostError = computed(() =>
    stateError(this.selectedPostState()),
  );
  protected readonly rootBranchError = computed(() =>
    stateError(this.rootBranch()),
  );
  protected readonly createPostError = computed(() =>
    stateError(this.createPostState()),
  );
  protected readonly createCommentError = computed(() =>
    stateError(this.createCommentState()),
  );
  protected readonly purgeError = computed(() => {
    const postError = stateError(this.purgePostState());
    return postError ?? stateError(this.purgeCommentState());
  });
  protected readonly postsHasMore = computed(
    () => stateValue(this.postsState())?.next_after_id != null,
  );
  protected readonly searchHasMore = computed(
    () => stateValue(this.searchState())?.next_after_id != null,
  );
  protected readonly rootHasMore = computed(
    () => stateValue(this.rootBranch())?.next_after_id != null,
  );
  protected readonly searchBusy = computed(
    () => this.searchState().kind === 'loading',
  );
  protected readonly createPostBusy = computed(
    () => this.createPostState().kind === 'loading',
  );
  protected readonly replyBusy = computed(
    () => this.createCommentState().kind === 'loading',
  );
  protected readonly purgeBusy = computed(
    () =>
      this.purgePostState().kind === 'loading' ||
      this.purgeCommentState().kind === 'loading',
  );
  protected readonly canSubmitNewPost = computed(
    () =>
      this.newPostTitle().trim().length > 0 &&
      this.newPostBody().trim().length > 0,
  );
  protected readonly canSubmitReply = computed(
    () => this.replyDraft().trim().length > 0,
  );
  protected readonly canConfirmPurge = computed(
    () => this.purgeReason().trim().length > 0,
  );
  private readonly noticeState = signal<BoardNotice | null>(null);
  protected readonly notice = computed(() =>
    boardNoticeText(
      this.noticeState(),
      this.selectedProjectId(),
      this.selectedPostId(),
    ),
  );

  private readonly projectRefreshEffect = effect(() => {
    const projectId = this.workspace.selectedProjectId();
    if (!projectId || projectId === this.loadedProjectId) return;
    this.loadedProjectId = projectId;
    this.resetView();
    queueMicrotask(() => void this.store.refresh(projectId));
  });

  protected setSearchDraft(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.searchDraft.set(event.target.value);
  }

  protected search(): void {
    const projectId = this.selectedProjectId();
    if (projectId) void this.store.searchPosts(projectId, this.searchDraft());
  }

  protected clearSearch(): void {
    this.searchDraft.set('');
    const projectId = this.selectedProjectId();
    if (projectId) void this.store.searchPosts(projectId, '');
  }

  protected loadMorePosts(): void {
    const projectId = this.selectedProjectId();
    if (projectId) void this.store.loadMorePosts(projectId);
  }

  protected loadMoreSearchResults(): void {
    const projectId = this.selectedProjectId();
    if (projectId) void this.store.loadMoreSearchResults(projectId);
  }

  protected selectPost(post: DenBoardPostSummary): void {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    this.noticeState.set(null);
    this.closeReply();
    this.store
      .selectPost(projectId, post.id)
      .then(() => this.mobilePane.set('detail'));
  }

  protected selectSearchResult(result: DenBoardSearchResult): void {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    this.noticeState.set(null);
    this.closeReply();
    const selection =
      result.kind === 'comment'
        ? this.store.selectCommentPath(projectId, result.id)
        : this.store.selectPost(projectId, result.post_id);
    selection.then(() => this.mobilePane.set('detail'));
  }

  protected openNewPost(): void {
    this.newPostTitle.set('');
    this.newPostBody.set('');
    this.newPostOpen.set(true);
  }

  protected closeNewPost(): void {
    if (this.createPostBusy()) return;
    this.newPostOpen.set(false);
  }

  protected setNewPostTitle(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.newPostTitle.set(event.target.value);
  }

  protected setNewPostBody(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement)
      this.newPostBody.set(event.target.value);
  }

  protected submitNewPost(event: SubmitEvent): void {
    event.preventDefault();
    const projectId = this.selectedProjectId();
    if (!projectId || !this.canSubmitNewPost()) return;
    const request: DenBoardCreatePostRequest = {
      title: this.newPostTitle().trim(),
      body_markdown: this.newPostBody().trim(),
      author_identity: this.identity(),
    };
    void this.store.createPost(projectId, request).then((result) => {
      if (!result.ok) return;
      this.noticeState.set({
        kind: 'post-created',
        projectId,
        postId: result.value.id,
      });
      this.newPostOpen.set(false);
      this.newPostTitle.set('');
      this.newPostBody.set('');
      this.mobilePane.set('detail');
    });
  }

  protected openRootReply(): void {
    this.replyTargetId.set(null);
    this.replyDraft.set('');
    this.replyOpen.set(true);
  }

  protected openCommentReply(commentId: number): void {
    this.replyTargetId.set(commentId);
    this.replyDraft.set('');
    this.replyOpen.set(true);
  }

  protected closeReply(): void {
    if (this.replyBusy()) return;
    this.replyOpen.set(false);
    this.replyTargetId.set(null);
    this.replyDraft.set('');
  }

  protected setReplyDraft(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement)
      this.replyDraft.set(event.target.value);
  }

  protected submitReply(event: SubmitEvent): void {
    event.preventDefault();
    const postId = this.selectedPostId();
    const projectId = this.selectedProjectId();
    if (postId === null || projectId === null || !this.canSubmitReply()) return;
    const parentCommentId = this.replyTargetId();
    const request: DenBoardCreateCommentRequest = {
      ...(parentCommentId === null
        ? {}
        : { parent_comment_id: parentCommentId }),
      body_markdown: this.replyDraft().trim(),
      author_identity: this.identity(),
    };
    void this.store.createComment(postId, request).then((result) => {
      if (!result.ok) return;
      this.noticeState.set({
        kind: 'comment-created',
        projectId,
        postId,
      });
      if (
        this.selectedProjectId() !== projectId ||
        this.selectedPostId() !== postId
      )
        return;
      this.closeReply();
    });
  }

  protected toggleBranch(commentId: number): void {
    const postId = this.selectedPostId();
    if (postId !== null) void this.store.toggleBranch(postId, commentId);
  }

  protected loadMoreBranch(commentId: number): void {
    const postId = this.selectedPostId();
    if (postId !== null) void this.store.loadMoreComments(postId, commentId);
  }

  protected loadMoreRootReplies(): void {
    const postId = this.selectedPostId();
    if (postId !== null) void this.store.loadMoreComments(postId, null);
  }

  protected requestPostPurge(postId: number): void {
    this.noticeState.set(null);
    this.purgeTarget.set({ kind: 'post', postId });
    this.purgeReason.set('');
  }

  protected requestCommentPurge(postId: number, commentId: number): void {
    this.noticeState.set(null);
    this.purgeTarget.set({ kind: 'comment', postId, commentId });
    this.purgeReason.set('');
  }

  protected setPurgeReason(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement)
      this.purgeReason.set(event.target.value);
  }

  protected cancelPurge(): void {
    if (this.purgeBusy()) return;
    this.purgeTarget.set(null);
    this.purgeReason.set('');
  }

  protected confirmPurge(): void {
    const target = this.purgeTarget();
    if (!target || !this.canConfirmPurge()) return;
    const targetProjectId = this.selectedProjectId();
    const request = {
      actor_identity: this.identity(),
      reason: this.purgeReason().trim(),
    };
    if (target.kind === 'post') {
      void this.store.purgePost(target.postId, request).then((result) => {
        if (result.ok) this.cancelPurge();
      });
      return;
    }
    void this.store
      .purgeComment(target.postId, target.commentId, request)
      .then((result) => {
        if (!result.ok) return;
        if (
          targetProjectId !== null &&
          this.selectedProjectId() === targetProjectId &&
          this.selectedPostId() === target.postId
        ) {
          this.noticeState.set({
            kind: 'comment-purged',
            projectId: targetProjectId,
            postId: target.postId,
          });
        }
        if (this.replyTargetId() === target.commentId) this.closeReply();
        this.cancelPurge();
      });
  }

  protected showList(): void {
    this.mobilePane.set('list');
  }

  protected errorText(
    error: { readonly kind: string; readonly message: string } | null,
  ): string {
    return error
      ? `${error.kind}: ${error.message}`
      : 'unknown: Unable to load';
  }

  private resetView(): void {
    this.noticeState.set(null);
    this.searchDraft.set('');
    this.newPostOpen.set(false);
    this.newPostTitle.set('');
    this.newPostBody.set('');
    this.replyOpen.set(false);
    this.replyTargetId.set(null);
    this.replyDraft.set('');
    this.purgeTarget.set(null);
    this.purgeReason.set('');
    this.mobilePane.set('list');
  }
}

function stateError<T>(state: {
  readonly kind: string;
  readonly error?: T;
}): T | null {
  return state.kind === 'error' && state.error ? state.error : null;
}

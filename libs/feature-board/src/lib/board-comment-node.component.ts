import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  boardCommentAuthor,
  boardCommentBody,
  boardCommentIsTombstone,
  type BoardCommentTreeNode,
} from '@den-web/domain';
import { LocalTimeComponent, MarkdownViewComponent } from '@den-web/components';

@Component({
  selector: 'den-board-comment-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LocalTimeComponent, MarkdownViewComponent, NgTemplateOutlet],
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .comment {
        border-left: 2px solid var(--den-border);
        display: grid;
        gap: 8px;
        margin: 0 0 10px;
        min-width: 0;
        padding: 10px 0 10px 14px;
      }

      .comment.tombstone {
        border-left-style: dashed;
        color: var(--den-muted);
      }

      .comment-head,
      .comment-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .comment-head {
        color: var(--den-muted);
        font-size: var(--den-font-size-sm);
      }

      .comment-id {
        color: var(--den-text);
        font-weight: 700;
      }

      .comment-body {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .tombstone-copy,
      .branch-error,
      .branch-empty {
        color: var(--den-muted);
        font-size: var(--den-font-size-sm);
        margin: 0;
      }

      .branch-error {
        color: var(--den-danger);
      }

      button {
        appearance: none;
        background: var(--den-input);
        border: 1px solid var(--den-border);
        border-radius: 6px;
        color: var(--den-text);
        cursor: pointer;
        font: inherit;
        min-height: 30px;
        padding: 3px 8px;
      }

      button:hover,
      button:focus-visible {
        background: var(--den-hover);
        border-color: var(--den-border-strong);
        outline: none;
      }

      button:disabled {
        cursor: wait;
        opacity: 0.58;
      }

      .danger {
        color: var(--den-danger);
      }
    `,
  ],
  template: `
    <ng-template #commentTemplate let-current>
      <article
        class="comment"
        [class.tombstone]="boardCommentIsTombstone(current.comment)"
        [style.margin-left.px]="current.depth * 18"
        [attr.aria-label]="
          boardCommentIsTombstone(current.comment)
            ? 'Purged comment tombstone'
            : 'Board comment'
        "
      >
        <div class="comment-head">
          @if (boardCommentIsTombstone(current.comment)) {
            <strong>Content purged</strong>
          } @else {
            <strong>{{ boardCommentAuthor(current.comment) }}</strong>
          }
          <span class="comment-id">#{{ current.comment.id }}</span>
          <span
            ><den-local-time
              [value]="current.comment.created_at"
              [relative]="false"
          /></span>
        </div>

        @if (boardCommentIsTombstone(current.comment)) {
          <p class="tombstone-copy">
            This comment remains only as a structural placeholder for its
            replies.
          </p>
        } @else {
          <div class="comment-body">
            <den-markdown-view [content]="boardCommentBody(current.comment)" />
          </div>
        }

        <div class="comment-actions">
          @if (!boardCommentIsTombstone(current.comment)) {
            <button
              type="button"
              (click)="replyRequested.emit(current.comment.id)"
            >
              Reply
            </button>
            <button
              type="button"
              class="danger"
              (click)="purgeRequested.emit(current.comment.id)"
            >
              Purge comment
            </button>
          }
          <button
            type="button"
            [disabled]="current.childrenState === 'loading'"
            (click)="toggleRequested.emit(current.comment.id)"
          >
            @if (current.childrenState === 'loading') {
              Loading replies
            } @else if (current.childrenExpanded) {
              Collapse replies
            } @else {
              Expand replies
            }
          </button>
          @if (
            current.childrenExpanded && current.childrenNextAfterId !== null
          ) {
            <button
              type="button"
              [disabled]="current.childrenState === 'loading'"
              (click)="loadMoreRequested.emit(current.comment.id)"
            >
              Load more replies
            </button>
          }
        </div>

        @if (current.childrenState === 'error') {
          <p class="branch-error" role="alert">
            {{ current.childrenErrorMessage || 'Replies could not be loaded.' }}
          </p>
        }
        @if (
          current.childrenExpanded &&
          current.childrenLoaded &&
          current.children.length === 0 &&
          current.childrenNextAfterId === null &&
          current.childrenState !== 'error'
        ) {
          <p class="branch-empty">No direct replies.</p>
        }
        @for (child of current.children; track child.comment.id) {
          <ng-container
            [ngTemplateOutlet]="commentTemplate"
            [ngTemplateOutletContext]="{ $implicit: child }"
          />
        }
      </article>
    </ng-template>

    <ng-container
      [ngTemplateOutlet]="commentTemplate"
      [ngTemplateOutletContext]="{ $implicit: node() }"
    />
  `,
})
export class BoardCommentNodeComponent {
  readonly node = input.required<BoardCommentTreeNode>();
  readonly replyRequested = output<number>();
  readonly toggleRequested = output<number>();
  readonly loadMoreRequested = output<number>();
  readonly purgeRequested = output<number>();

  protected readonly boardCommentAuthor = boardCommentAuthor;
  protected readonly boardCommentBody = boardCommentBody;
  protected readonly boardCommentIsTombstone = boardCommentIsTombstone;
}

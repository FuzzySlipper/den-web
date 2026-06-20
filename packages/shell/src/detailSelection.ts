import type {
  AgentStreamEntry,
  DispatchEntry,
  DocumentSummary,
  Message,
  SubagentRunSummary,
} from '@den-web/api/types';

/**
 * Single mutually-exclusive model for the detail overlay.
 *
 * Before this existed, the app shell kept one nullable `useState` per detail
 * kind and every selection handler had to remember to clear all the others.
 * Representing the overlay as one discriminated union makes "only one detail is
 * open at a time" a type-level guarantee and removes the manual cross-clearing.
 */
export type DetailSelection =
  | { kind: 'task'; taskId: number; projectId: string | null }
  | { kind: 'message'; message: Message }
  | { kind: 'streamEntry'; entry: AgentStreamEntry }
  | { kind: 'subagentRun'; run: SubagentRunSummary }
  | { kind: 'dispatch'; dispatch: DispatchEntry }
  | { kind: 'assignmentTrace'; assignmentId: string }
  | { kind: 'document'; doc: DocumentSummary }
  | null;

export type DetailSelectionKind = NonNullable<DetailSelection>['kind'];

export function detailSelectionKind(selection: DetailSelection): DetailSelectionKind | null {
  return selection ? selection.kind : null;
}

/** True when a detail overlay is currently open (used by the Escape/close-panel handler). */
export function hasDetailSelection(selection: DetailSelection): boolean {
  return selection !== null;
}

/** True when the open overlay is the document editor, whose dirty/pending state needs extra cleanup. */
export function isDocumentSelection(selection: DetailSelection): boolean {
  return selection?.kind === 'document';
}

import { useCallback, useMemo, useState } from 'react';
import type {
  AgentStreamEntry,
  DispatchEntry,
  DocumentSummary,
  Message,
  SubagentRunSummary,
} from '@den-web/api/types';
import type { DetailSelection } from './detailSelection';

export interface DetailSelectionApi {
  /** The currently open detail overlay, or null. */
  value: DetailSelection;
  selectTask: (taskId: number, projectId: string | null) => void;
  selectMessage: (message: Message) => void;
  selectStreamEntry: (entry: AgentStreamEntry) => void;
  selectSubagentRun: (run: SubagentRunSummary) => void;
  selectDispatch: (dispatch: DispatchEntry) => void;
  selectAssignmentTrace: (assignmentId: string) => void;
  selectDocument: (doc: DocumentSummary) => void;
  /** Replace the active detail with an arbitrary selection (or null). */
  set: (selection: DetailSelection) => void;
  /** Dismiss the active detail overlay. */
  clear: () => void;
}

/**
 * Owns the single mutually-exclusive detail-overlay selection.
 *
 * Each `selectX` helper simply replaces the active selection, so there is no
 * longer any need to clear sibling selections by hand.
 */
export function useDetailSelection(): DetailSelectionApi {
  const [value, setValue] = useState<DetailSelection>(null);

  const selectTask = useCallback(
    (taskId: number, projectId: string | null) => setValue({ kind: 'task', taskId, projectId }),
    [],
  );
  const selectMessage = useCallback((message: Message) => setValue({ kind: 'message', message }), []);
  const selectStreamEntry = useCallback(
    (entry: AgentStreamEntry) => setValue({ kind: 'streamEntry', entry }),
    [],
  );
  const selectSubagentRun = useCallback(
    (run: SubagentRunSummary) => setValue({ kind: 'subagentRun', run }),
    [],
  );
  const selectDispatch = useCallback(
    (dispatch: DispatchEntry) => setValue({ kind: 'dispatch', dispatch }),
    [],
  );
  const selectAssignmentTrace = useCallback(
    (assignmentId: string) => setValue({ kind: 'assignmentTrace', assignmentId }),
    [],
  );
  const selectDocument = useCallback((doc: DocumentSummary) => setValue({ kind: 'document', doc }), []);
  const clear = useCallback(() => setValue(null), []);

  return useMemo(
    () => ({
      value,
      selectTask,
      selectMessage,
      selectStreamEntry,
      selectSubagentRun,
      selectDispatch,
      selectAssignmentTrace,
      selectDocument,
      set: setValue,
      clear,
    }),
    [
      value,
      selectTask,
      selectMessage,
      selectStreamEntry,
      selectSubagentRun,
      selectDispatch,
      selectAssignmentTrace,
      selectDocument,
      clear,
    ],
  );
}

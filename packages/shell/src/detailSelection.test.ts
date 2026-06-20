import { describe, expect, it } from 'vitest';
import type { Message } from '@den-web/api/types';
import {
  detailSelectionKind,
  hasDetailSelection,
  isDocumentSelection,
  type DetailSelection,
} from './detailSelection';

const message = { id: 1, project_id: 'p1' } as unknown as Message;

describe('detailSelectionKind', () => {
  it('returns the kind of the active selection', () => {
    expect(detailSelectionKind({ kind: 'task', taskId: 5, projectId: 'p1' })).toBe('task');
    expect(detailSelectionKind({ kind: 'message', message })).toBe('message');
    expect(detailSelectionKind({ kind: 'assignmentTrace', assignmentId: 'a1' })).toBe('assignmentTrace');
  });

  it('returns null when nothing is selected', () => {
    expect(detailSelectionKind(null)).toBeNull();
  });
});

describe('hasDetailSelection', () => {
  it('is true for any non-null selection', () => {
    const selections: DetailSelection[] = [
      { kind: 'task', taskId: 1, projectId: null },
      { kind: 'message', message },
      { kind: 'assignmentTrace', assignmentId: 'a1' },
    ];
    for (const selection of selections) {
      expect(hasDetailSelection(selection)).toBe(true);
    }
  });

  it('is false when nothing is selected', () => {
    expect(hasDetailSelection(null)).toBe(false);
  });
});

describe('isDocumentSelection', () => {
  it('is true only for the document overlay', () => {
    expect(isDocumentSelection({ kind: 'document', doc: { id: 1 } as never })).toBe(true);
    expect(isDocumentSelection({ kind: 'message', message })).toBe(false);
    expect(isDocumentSelection(null)).toBe(false);
  });
});

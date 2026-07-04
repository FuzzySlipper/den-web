import { signal, type Signal } from '@angular/core';
import { messageViewItem, sortMessagesChronologically, type MessageViewItem } from '@den-web/domain';
import type { DenMessage, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export interface MessagesTransportPort {
  readonly listMessages: (projectId: string, options?: { readonly taskId?: number; readonly limit?: number }) => Promise<DenResult<readonly DenMessage[]>>;
  readonly getThread: (projectId: string, threadId: number) => Promise<DenResult<readonly DenMessage[]>>;
}

export interface MessagesStore {
  readonly inbox: Signal<AsyncState<readonly MessageViewItem[]>>;
  readonly thread: Signal<AsyncState<readonly MessageViewItem[]>>;
  readonly selectedThreadId: Signal<number | null>;
  readonly refresh: (projectId: string) => Promise<void>;
  readonly selectThread: (projectId: string, threadId: number) => Promise<void>;
}

export function createMessagesStore(transport: MessagesTransportPort): MessagesStore {
  const inbox = signal<AsyncState<readonly MessageViewItem[]>>(idleState());
  const thread = signal<AsyncState<readonly MessageViewItem[]>>(idleState());
  const selectedThreadId = signal<number | null>(null);

  return {
    inbox: inbox.asReadonly(),
    thread: thread.asReadonly(),
    selectedThreadId: selectedThreadId.asReadonly(),
    refresh: async (projectId) => {
      const previous = stateValue(inbox());
      inbox.set(loadingState(previous));
      try {
        const result = await transport.listMessages(projectId, { limit: 50 });
        inbox.set(result.ok ? resultState({ ok: true, value: sortMessagesChronologically(result.value).map(messageViewItem) }, previous) : resultState(result, previous));
      } catch (error) {
        inbox.set(errorState(unknownStoreError(error), previous));
      }
    },
    selectThread: async (projectId, threadId) => {
      selectedThreadId.set(threadId);
      const previous = stateValue(thread());
      thread.set(loadingState(previous));
      try {
        const result = await transport.getThread(projectId, threadId);
        thread.set(result.ok ? resultState({ ok: true, value: sortMessagesChronologically(result.value).map(messageViewItem) }, previous) : resultState(result, previous));
      } catch (error) {
        thread.set(errorState(unknownStoreError(error), previous));
      }
    },
  };
}

export function firstThreadId(messages: readonly MessageViewItem[]): number | null {
  const first = messages[0];
  return first ? first.threadId ?? first.id : null;
}

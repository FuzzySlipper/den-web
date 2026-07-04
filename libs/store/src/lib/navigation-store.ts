import { signal, type Signal } from '@angular/core';

export type DenWebTab = 'tasks' | 'conversation' | 'notifications' | 'messages' | 'documents' | 'librarian' | 'agents' | 'preferences';

export interface MessageThreadNavigationTarget {
  readonly projectId: string;
  readonly threadId: number;
  readonly messageId?: number;
}

export interface NavigationStore {
  readonly activeTabRequest: Signal<DenWebTab | null>;
  readonly messageThreadTarget: Signal<MessageThreadNavigationTarget | null>;
  readonly openTab: (tab: DenWebTab) => void;
  readonly openMessageThread: (target: MessageThreadNavigationTarget) => void;
  readonly clearActiveTabRequest: () => void;
  readonly clearMessageThreadTarget: (target: MessageThreadNavigationTarget) => void;
}

export function createNavigationStore(): NavigationStore {
  const activeTabRequest = signal<DenWebTab | null>(null);
  const messageThreadTarget = signal<MessageThreadNavigationTarget | null>(null);

  return {
    activeTabRequest: activeTabRequest.asReadonly(),
    messageThreadTarget: messageThreadTarget.asReadonly(),
    openTab: (tab) => activeTabRequest.set(tab),
    openMessageThread: (target) => {
      messageThreadTarget.set(target);
      activeTabRequest.set('messages');
    },
    clearActiveTabRequest: () => activeTabRequest.set(null),
    clearMessageThreadTarget: (target) => {
      const current = messageThreadTarget();
      if (current?.projectId === target.projectId && current.threadId === target.threadId && current.messageId === target.messageId) {
        messageThreadTarget.set(null);
      }
    },
  };
}

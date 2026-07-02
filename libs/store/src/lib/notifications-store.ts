import { computed, signal, type Signal } from '@angular/core';
import {
  notificationCacheId,
  notificationViewItem,
  parseNotificationReadCache,
  serializeNotificationReadCache,
  unreadNotificationCount,
  type NotificationViewItem,
} from '@den-web/domain';
import type { KeyValueStoragePort } from '@den-web/platform';
import type { DenNotification, DenResult } from '@den-web/protocol';
import { errorState, idleState, loadingState, resultState, stateValue, type AsyncState, unknownStoreError } from './async-state';

export const NOTIFICATION_READ_CACHE_KEY = 'den-web.notification-read-cache.v2';

export interface NotificationsTransportPort {
  readonly listUserNotifications: (options?: { readonly readForAgent?: string; readonly limit?: number }) => Promise<DenResult<readonly DenNotification[]>>;
  readonly markRead: (ids: readonly number[], readForAgent: string) => Promise<DenResult<{ readonly marked?: number }>>;
}

export interface NotificationsStore {
  readonly notifications: Signal<AsyncState<readonly NotificationViewItem[]>>;
  readonly unreadCount: Signal<number>;
  readonly refresh: () => Promise<void>;
  readonly markRead: (ids: readonly string[]) => Promise<void>;
}

export function createNotificationsStore(
  transport: NotificationsTransportPort,
  storage: KeyValueStoragePort,
  readForAgent = 'web-ui',
): NotificationsStore {
  const cachedReadIds = signal(parseNotificationReadCache(storage.getItem(NOTIFICATION_READ_CACHE_KEY)));
  const notifications = signal<AsyncState<readonly NotificationViewItem[]>>(idleState());

  const persistCache = (ids: ReadonlySet<string>): void => {
    cachedReadIds.set(ids);
    storage.setItem(NOTIFICATION_READ_CACHE_KEY, serializeNotificationReadCache(ids));
  };

  return {
    notifications: notifications.asReadonly(),
    unreadCount: computed(() => unreadNotificationCount(stateValue(notifications()) ?? [])),
    refresh: async () => {
      const previous = stateValue(notifications());
      notifications.set(loadingState(previous));
      try {
        const result = await transport.listUserNotifications({ readForAgent, limit: 50 });
        notifications.set(result.ok ? resultState({ ok: true, value: result.value.map((item) => notificationViewItem(item, cachedReadIds())) }, previous) : resultState(result, previous));
      } catch (error) {
        notifications.set(errorState(unknownStoreError(error), previous));
      }
    },
    markRead: async (ids) => {
      const next = new Set([...cachedReadIds(), ...ids]);
      persistCache(next);
      const current = stateValue(notifications());
      if (current) {
        notifications.set(resultState({ ok: true, value: current.map((item) => ({ ...item, read: item.read || ids.includes(item.id) })) }));
      }
      const numericIds = ids.map(parseNotificationId).filter((id): id is number => id !== null);
      if (numericIds.length > 0) {
        const result = await transport.markRead(numericIds, readForAgent);
        if (!result.ok) notifications.set(errorState(result.error, stateValue(notifications())));
      }
    },
  };
}

function parseNotificationId(id: string): number | null {
  const prefix = notificationCacheId(0).replace('0', '');
  if (!id.startsWith(prefix)) return null;
  const parsed = Number(id.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : null;
}

import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { browserClock, browserDocumentEffects, browserStorage } from '@den-web/platform';
import type { RuntimeApiConfig } from '@den-web/protocol';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { createDenTransportClients, type DenTransportClients } from '@den-web/transport';
import { createAgentsStore, type AgentsStore } from './agents-store';
import { createArtifactsStore, type ArtifactsStore } from './artifacts-store';
import { createConversationStore, type ConversationStore } from './conversation-store';
import { createDocumentsStore, type DocumentsStore } from './documents-store';
import { createDocumentPublishStore, type DocumentPublishStore } from './document-publish-store';
import { createLibrarianStore, type LibrarianStore } from './librarian-store';
import { createMessagesStore, type MessagesStore } from './messages-store';
import { createNotificationsStore, type NotificationsStore } from './notifications-store';
import { createPreferencesStore, type PreferencesStore } from './preferences-store';
import { createTasksStore, type TasksStore } from './tasks-store';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store';

export const DEN_RUNTIME_CONFIG = new InjectionToken<RuntimeApiConfig>('DEN_RUNTIME_CONFIG');
export const DEN_TRANSPORT_CLIENTS = new InjectionToken<DenTransportClients>('DEN_TRANSPORT_CLIENTS');
export const WORKSPACE_STORE = new InjectionToken<WorkspaceStore>('WORKSPACE_STORE');
export const TASKS_STORE = new InjectionToken<TasksStore>('TASKS_STORE');
export const DOCUMENTS_STORE = new InjectionToken<DocumentsStore>('DOCUMENTS_STORE');
export const DOCUMENT_PUBLISH_STORE = new InjectionToken<DocumentPublishStore>('DOCUMENT_PUBLISH_STORE');
export const NOTIFICATIONS_STORE = new InjectionToken<NotificationsStore>('NOTIFICATIONS_STORE');
export const CONVERSATION_STORE = new InjectionToken<ConversationStore>('CONVERSATION_STORE');
export const AGENTS_STORE = new InjectionToken<AgentsStore>('AGENTS_STORE');
export const ARTIFACTS_STORE = new InjectionToken<ArtifactsStore>('ARTIFACTS_STORE');
export const MESSAGES_STORE = new InjectionToken<MessagesStore>('MESSAGES_STORE');
export const LIBRARIAN_STORE = new InjectionToken<LibrarianStore>('LIBRARIAN_STORE');
export const PREFERENCES_STORE = new InjectionToken<PreferencesStore>('PREFERENCES_STORE');

export function provideDenStoreKernel(config: RuntimeApiConfig = defaultRuntimeApiConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DEN_RUNTIME_CONFIG, useValue: config },
    {
      provide: DEN_TRANSPORT_CLIENTS,
      useFactory: (runtimeConfig: RuntimeApiConfig) => createDenTransportClients(runtimeConfig),
      deps: [DEN_RUNTIME_CONFIG],
    },
    {
      provide: WORKSPACE_STORE,
      useFactory: (clients: DenTransportClients) => createWorkspaceStore(clients.projects, browserClock),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: TASKS_STORE,
      useFactory: (clients: DenTransportClients) => createTasksStore(clients.tasks, clients.messages),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: DOCUMENTS_STORE,
      useFactory: (clients: DenTransportClients) => createDocumentsStore(clients.documents),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: DOCUMENT_PUBLISH_STORE,
      useFactory: (clients: DenTransportClients) => createDocumentPublishStore(clients.docPublish),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: NOTIFICATIONS_STORE,
      useFactory: (clients: DenTransportClients) => createNotificationsStore(clients.notifications, browserStorage()),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: MESSAGES_STORE,
      useFactory: (clients: DenTransportClients) => createMessagesStore(clients.messages),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: LIBRARIAN_STORE,
      useFactory: (clients: DenTransportClients) => createLibrarianStore(clients.librarian),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: PREFERENCES_STORE,
      useFactory: () => createPreferencesStore(browserStorage(), browserDocumentEffects()),
    },
    {
      provide: CONVERSATION_STORE,
      useFactory: (clients: DenTransportClients) => createConversationStore(clients.conversation, clients.timeline),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: AGENTS_STORE,
      useFactory: (clients: DenTransportClients) => createAgentsStore(clients.observation),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
    {
      provide: ARTIFACTS_STORE,
      useFactory: (clients: DenTransportClients) => createArtifactsStore(clients.artifacts),
      deps: [DEN_TRANSPORT_CLIENTS],
    },
  ]);
}

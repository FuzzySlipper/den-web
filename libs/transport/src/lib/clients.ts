import type {
  DenChannelMessage,
  DenConversationChannel,
  DenDeliveryIntent,
  DenDiscussion,
  DenDocPublishRequest,
  DenDocPublishResponse,
  DenDocumentDetail,
  DenDocumentSummary,
  DenLibrarianQueryRequest,
  DenLibrarianQueryResponse,
  DenMessage,
  DenNotification,
  DenObservationLane,
  DenProject,
  DenResult,
  DenSpace,
  DenTaskDetail,
  DenTaskSummary,
  DenTaskUpdateRequest,
  DenTimelineResponse,
  RuntimeApiConfig,
} from '@den-web/protocol';
import { defaultRuntimeApiConfig } from '@den-web/protocol';
import { DenHttpClient, joinUrl, query } from './http';

export interface DenTransportClients {
  readonly projects: ProjectsTransport;
  readonly tasks: TasksTransport;
  readonly messages: MessagesTransport;
  readonly notifications: NotificationsTransport;
  readonly documents: DocumentsTransport;
  readonly librarian: LibrarianTransport;
  readonly conversation: ConversationTransport;
  readonly timeline: TimelineTransport;
  readonly observation: ObservationTransport;
  readonly delivery: DeliveryTransport;
  readonly docPublish: DocPublishTransport;
}

export function createDenTransportClients(
  config: RuntimeApiConfig = defaultRuntimeApiConfig,
  http = new DenHttpClient(),
): DenTransportClients {
  return {
    projects: new ProjectsTransport(config, http),
    tasks: new TasksTransport(config, http),
    messages: new MessagesTransport(config, http),
    notifications: new NotificationsTransport(config, http),
    documents: new DocumentsTransport(config, http),
    librarian: new LibrarianTransport(config, http),
    conversation: new ConversationTransport(config, http),
    timeline: new TimelineTransport(config, http),
    observation: new ObservationTransport(config, http),
    delivery: new DeliveryTransport(config, http),
    docPublish: new DocPublishTransport(config, http),
  };
}

export class ProjectsTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listProjects(): Promise<DenResult<readonly DenProject[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, '/projects'));
  }

  listSpaces(options: { readonly includeHidden?: boolean; readonly includeArchived?: boolean } = {}): Promise<DenResult<readonly DenSpace[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/spaces${query({ include_hidden: options.includeHidden, include_archived: options.includeArchived })}`));
  }
}

export class TasksTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listTasks(projectId: string, options: { readonly limit?: number; readonly status?: string; readonly tree?: boolean } = {}): Promise<DenResult<readonly DenTaskSummary[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/tasks${query(options)}`));
  }

  getTask(projectId: string, taskId: number): Promise<DenResult<DenTaskDetail>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/tasks/${taskId}`));
  }

  updateTask(projectId: string, taskId: number, body: DenTaskUpdateRequest): Promise<DenResult<DenTaskDetail | DenTaskSummary | undefined>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/tasks/${taskId}`), {
      method: 'PATCH',
      body,
    });
  }
}

export class MessagesTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listMessages(projectId: string, options: { readonly taskId?: number; readonly limit?: number } = {}): Promise<DenResult<readonly DenMessage[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/messages${query({ task_id: options.taskId, limit: options.limit })}`));
  }

  getThread(projectId: string, threadId: number): Promise<DenResult<readonly DenMessage[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/messages/threads/${threadId}`));
  }
}

export class NotificationsTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listUserNotifications(options: { readonly readForAgent?: string; readonly limit?: number } = {}): Promise<DenResult<readonly DenNotification[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/user-notifications${query({ read_for_agent: options.readForAgent, limit: options.limit })}`));
  }

  markRead(ids: readonly number[], readForAgent: string): Promise<DenResult<{ readonly marked?: number }>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, '/user-notifications/read'), {
      method: 'POST',
      body: { ids, read_for_agent: readForAgent },
    });
  }
}

export class DocumentsTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listDocuments(projectId: string): Promise<DenResult<readonly DenDocumentSummary[]>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/documents`));
  }

  getDocument(projectId: string, slug: string): Promise<DenResult<DenDocumentDetail>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(slug)}`));
  }

  getDiscussion(projectId: string, slug: string): Promise<DenResult<DenDiscussion>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(slug)}/discussion`));
  }
}

export class LibrarianTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  query(projectId: string, request: DenLibrarianQueryRequest): Promise<DenResult<DenLibrarianQueryResponse>> {
    return this.http.json(joinUrl(this.config.servicesApiBase, `/projects/${encodeURIComponent(projectId)}/librarian/query`), {
      method: 'POST',
      body: request,
    });
  }
}

export class ConversationTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listChannels(projectId: string, options: { readonly limit?: number; readonly kind?: string } = {}): Promise<DenResult<readonly DenConversationChannel[]>> {
    return this.http.json(joinUrl(this.config.conversationApiBase, `/channels${query({ project_id: projectId, limit: options.limit, kind: options.kind })}`));
  }

  listMessages(channelId: number, options: { readonly afterId?: number; readonly limit?: number } = {}): Promise<DenResult<readonly DenChannelMessage[]>> {
    return this.http.json(joinUrl(this.config.conversationApiBase, `/channels/${channelId}/messages${query({ after_id: options.afterId, limit: options.limit })}`));
  }

  postMessage(channelId: number, body: { readonly sender: string; readonly body: string; readonly idempotency_key: string }): Promise<DenResult<DenChannelMessage>> {
    return this.http.json(joinUrl(this.config.conversationApiBase, `/channels/${channelId}/messages`), { method: 'POST', body });
  }
}

export class TimelineTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  listChannelItems(channelId: number, options: { readonly limit?: number; readonly after?: string } = {}): Promise<DenResult<DenTimelineResponse>> {
    return this.http.json(joinUrl(this.config.timelineApiBase, `/channels/${channelId}/items${query(options)}`));
  }

  streamUrl(channelId: number, options: { readonly after?: string; readonly includeDebug?: boolean } = {}): string {
    return joinUrl(this.config.timelineApiBase, `/channels/${channelId}/stream${query({ after: options.after, include_debug: options.includeDebug })}`);
  }
}

export class ObservationTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  lane(options: { readonly limit?: number } = {}): Promise<DenResult<DenObservationLane>> {
    return this.http.json(joinUrl(this.config.observationApiBase, `/lane${query(options)}`));
  }

  activeWork(): Promise<DenResult<unknown>> {
    return this.http.json(joinUrl(this.config.observationApiBase, '/active-work'));
  }
}

export class DeliveryTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  createIntent(body: unknown): Promise<DenResult<DenDeliveryIntent>> {
    return this.http.json(joinUrl(this.config.deliveryApiBase, '/intents'), { method: 'POST', body });
  }
}

export class DocPublishTransport {
  constructor(private readonly config: RuntimeApiConfig, private readonly http: DenHttpClient) {}

  publish(request: DenDocPublishRequest): Promise<DenResult<DenDocPublishResponse>> {
    return this.http.json(this.config.docPublishApiBase, { method: 'POST', body: request });
  }
}

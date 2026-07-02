export interface RuntimeApiConfig {
  readonly servicesApiBase: string;
  readonly conversationApiBase: string;
  readonly timelineApiBase: string;
  readonly observationApiBase: string;
  readonly deliveryApiBase: string;
  readonly docPublishApiBase: string;
  readonly environmentName: string;
}

export const defaultRuntimeApiConfig: RuntimeApiConfig = {
  servicesApiBase: '/api/v1',
  conversationApiBase: '/api/v1/conversation',
  timelineApiBase: '/api/v1/timeline',
  observationApiBase: '/api/v1/observation',
  deliveryApiBase: '/api/v1/delivery',
  docPublishApiBase: '/api/v1/blog/publications',
  environmentName: 'development',
};

export interface DenWebRuntimeConfigFile {
  readonly tasksSuccessorApiBase?: string;
  readonly messagesSuccessorApiBase?: string;
  readonly conversationSuccessorApiBase?: string;
  readonly timelineSuccessorApiBase?: string;
  readonly observationSuccessorApiBase?: string;
  readonly deliverySuccessorApiBase?: string;
  readonly docPublishApiBase?: string;
  readonly environmentName?: string;
}


export interface RuntimeApiConfig {
  readonly servicesApiBase: string;
  readonly timelineApiBase: string;
  readonly observationApiBase: string;
  readonly deliveryApiBase: string;
  readonly docPublishApiBase: string;
  readonly artifactsApiBase: string;
  readonly environmentName: string;
}

export const defaultRuntimeApiConfig: RuntimeApiConfig = {
  servicesApiBase: '/api/v1',
  timelineApiBase: '/api/v1/timeline',
  observationApiBase: '/api/v1/observation',
  deliveryApiBase: '/api/v1/delivery',
  docPublishApiBase: '/api/v1/blog/publications',
  artifactsApiBase: '/api/v1/artifacts',
  environmentName: 'development',
};

export interface DenWebRuntimeConfigFile {
  readonly tasksSuccessorApiBase?: string;
  readonly messagesSuccessorApiBase?: string;
  readonly timelineSuccessorApiBase?: string;
  readonly observationSuccessorApiBase?: string;
  readonly deliverySuccessorApiBase?: string;
  readonly docPublishApiBase?: string;
  readonly artifactsApiBase?: string;
  readonly environmentName?: string;
}

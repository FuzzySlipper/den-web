export interface Channel {
  id: number;
  slug: string;
  displayName: string;
  kind: string;
  projectId: string | null;
  spaceId: string | null;
  createdBy: string;
  visibility: string;
  settingsJson: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ChannelProjectLink {
  id: number;
  channelId: number;
  projectId: string;
  relationKind: string;
  isPrimary: boolean;
  settingsJson: string | null;
  createdAt: string;
}

export interface ChannelMessage {
  id: number;
  channelId: number;
  senderType: string;
  senderIdentity: string;
  body: string;
  messageKind: string;
  sourceKind: string | null;
  sourceId: string | null;
  sourceProjectId: string | null;
  targetProjectId?: string | null;
  targetTaskId?: number | null;
  assignmentId?: string | null;
  workerRunId?: string | null;
  workerRole?: string | null;
  profileIdentity?: string | null;
  agentInstanceId?: string | null;
  poolMemberId?: string | null;
  sessionOwnerId?: string | null;
  sessionId?: string | null;
  summary: string | null;
  deepLink: string | null;
  threadRootMessageId: number | null;
  replyToMessageId: number | null;
  metadataJson: string | null;
  deliveryRequestId: string | null;
  dedupeKey: string | null;
  finalChannelMessageId: number | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ChannelReactionSummary {
  channelMessageId: number;
  reactionKey: string;
  count: number;
  reactors: string[];
}

export interface ActiveWorkRouteHandles {
  transcriptUrl: string | null;
  traceUrl: string | null;
  deliveryHandle: string | null;
  agentDetailUrl: string | null;
}

export interface ActiveWorkRoute {
  targetProjectId: string | null;
  targetTaskId: number | null;
  assignmentId: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  agentInstanceId: string | null;
  profileIdentity: string | null;
  poolMemberId: string | null;
  sessionOwnerId: string | null;
  sessionId: string | null;
  sourceChannelId: number | null;
  sourceControlProjectId: string | null;
  lastActivityAt: string | null;
  assignmentPhase: string | null;
  isStale: boolean;
  allowedActions: string[];
  handles: ActiveWorkRouteHandles | null;
}

export interface ActiveWorkRouteSourceEvidence {
  source: string;
  available: boolean;
  recordsExamined: number;
  detail: string | null;
}

export interface ActiveWorkRouteEvidence {
  sources: ActiveWorkRouteSourceEvidence[];
  candidatesConsidered: number;
  resolvedAt: string;
}

export interface ActiveWorkRoutesResponse {
  routes: ActiveWorkRoute[];
  totalCount: number;
  evidence: ActiveWorkRouteEvidence;
}

export interface ActiveWorkRouteResponse {
  routeStatus: 'routed' | 'no_active_route' | 'stale' | string;
  reason: string;
  route: ActiveWorkRoute | null;
  evidence: ActiveWorkRouteEvidence;
}

export interface ChannelActivityEvent {
  id: number;
  channelId: number;
  projectId: string | null;
  agentIdentity: string;
  deliveryRequestId: string | null;
  hermesSessionKey: string | null;
  displayBlockId: string | null;
  parentHermesSessionKey: string | null;
  parentAgentIdentity: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  taskId: number | null;
  threadId: number | null;
  anchorMessageId: number | null;
  eventType: string;
  status: string;
  deliveryStage: string;
  terminal: boolean;
  sequence: number;
  updateVersion: number;
  title: string | null;
  summary: string | null;
  previewJson: string | null;
  metadataJson: string | null;
  dedupeKey: string | null;
  finalChannelMessageId: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ChannelWakePolicy =
  | 'never'
  | 'mentions_only'
  | 'direct_questions_only'
  | 'substantive_digest'
  | 'all_human_messages'
  | 'all_messages_except_self';

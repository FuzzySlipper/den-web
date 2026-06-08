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
  assignmentId?: string | null;
  agentInstanceId?: string | null;
  poolMemberId?: string | null;
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

export interface AgentWorkCurrentItem {
  agentIdentity: string;
  workerRunId: string | null;
  projectId: string | null;
  taskId: number | null;
  assignmentId: string | null;
  workerRole: string | null;
  profileIdentity: string | null;
  poolMemberId: string | null;
  agentInstanceId: string | null;
  state: string;
  stateReason: string | null;
  lastActivityAt: string | null;
  stalenessDeadline: string | null;
  lastActivityEventId: number | null;
  evidenceLink: string | null;
  evidenceProvenance: string[];
  evidenceLinks: string[];
  sessionId: string | null;
  deliveryRequestId: string | null;
  directAgentEventId: string | null;
  hostId: string | null;
  processId: string | null;
  currentWorkState: string | null;
  stalenessDiagnostic: string | null;
  flags: string[];
}

export interface AgentWorkCurrentResponse {
  items: AgentWorkCurrentItem[];
  totalCount: number;
  generatedAt: string;
  stalenessSummary: {
    totalTracked: number;
    stale: number;
    staleDiagnostics: string[];
  } | null;
  migrationNote: string | null;
}

export interface AgentWorkLifecycleEvent {
  id: number;
  channelId: number;
  projectId: string | null;
  taskId: number | null;
  agentIdentity: string;
  eventType: string;
  state: string | null;
  workerRunId: string | null;
  assignmentId: string | null;
  deliveryRequestId: string | null;
  sessionId: string | null;
  evidenceLink: string | null;
  summary: string | null;
  createdAt: string;
}

export interface AgentWorkEventsResponse {
  items: AgentWorkLifecycleEvent[];
  count: number;
  channelId: number | null;
  filters: Record<string, string | number | boolean | null>;
}

export interface DirectAgentEvent {
  id: number;
  channelId: number;
  messageKind: string;
  senderType: string;
  senderIdentity: string;
  sourceKind: string | null;
  sourceId: string | null;
  sourceProjectId: string | null;
  targetProjectId: string | null;
  targetTaskId: number | null;
  assignmentId: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  profileIdentity: string | null;
  poolMemberId: string | null;
  agentInstanceId: string | null;
  sessionOwnerId: string | null;
  sessionId: string | null;
  deliveryRequestId: string | null;
  dedupeKey: string | null;
  deepLink: string | null;
  summary: string | null;
  body: string | null;
  createdAt: string;
}

export interface DirectAgentEventsResponse {
  items: DirectAgentEvent[];
  nextAfterId: number | null;
  hasMore: boolean;
}

export type ChannelWakePolicy =
  | 'never'
  | 'mentions_only'
  | 'direct_questions_only'
  | 'substantive_digest'
  | 'all_human_messages'
  | 'all_messages_except_self';

// =========================================================================
// Direct Conversation / DM Transcript (task #2003 / den-web #2004)
// =========================================================================

export type DmDirection = 'human_to_agent' | 'agent_to_human' | 'system_note';

export interface DirectConversation {
  id: number;
  humanIdentity: string;
  agentIdentity: string;
  scopeProjectId: string | null;
  displayTitle: string | null;
  isArchived: boolean;
  isMuted: boolean;
  settingsJson: string | null;
  lastEntryAt: string | null;
  lastEntryPreview: string | null;
  lastEntrySender: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirectConversationEntry {
  id: number;
  conversationId: number;
  channelMessageId: number | null;
  direction: DmDirection;
  senderIdentity: string;
  recipientIdentity: string;
  sourceChannelId: number | null;
  sourceProjectId: string | null;
  sourceTaskId: number | null;
  sourceSessionOwnerId: string | null;
  sourceWorkerRunId: string | null;
  bodyPreview: string | null;
  createdAt: string;
}

export interface DirectConversationListResponse {
  conversations: DirectConversation[];
  nextCursor: number | null;
  hasMore: boolean;
}

export interface DirectConversationEntriesResponse {
  entries: DirectConversationEntry[];
  nextCursor: number | null;
  hasMore: boolean;
}

export interface DirectConversationSendRequest {
  senderIdentity: string;
  body: string;
  sourceProjectId?: string | null;
  targetTaskId?: number | null;
  workerRunId?: string | null;
  workerRole?: string | null;
  profileIdentity?: string | null;
  poolMemberId?: string | null;
  agentInstanceId?: string | null;
  sessionOwnerId?: string | null;
  sessionId?: string | null;
}

export interface DirectConversationSendResponse {
  status: string;
  eventId: number;
  channelId: number;
  conversationId: number;
  entryId: number;
  requestId: string;
  memberIdentity: string;
}

export interface DirectConversationCreateRequest {
  humanIdentity: string;
  agentIdentity: string;
  scopeProjectId?: string | null;
  displayTitle?: string | null;
}

export interface LinkMessageRequest {
  channelMessageId: number;
  direction: DmDirection;
  senderIdentity: string;
  recipientIdentity: string;
  bodyPreview?: string | null;
}

export interface ReadCursor {
  id?: number;
  conversationId: number;
  readerIdentity: string;
  lastReadEntryId: number | null;
  lastReadAt?: string;
  createdAt?: string;
  updatedAt?: string;
  unreadCount?: number;
  hasUnread?: boolean;
}

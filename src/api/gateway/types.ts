import type { ChannelWakePolicy } from '../channels/types';

export interface GatewayMember {
  id: number;
  memberType: string;
  memberIdentity: string;
  membershipStatus: string;
  wakePolicy: ChannelWakePolicy | string;
  canSend: boolean;
  canReact: boolean;
  canInvite: boolean;
  cooldownSeconds: number;
  maxAutoRepliesPerWindow: number;
  settingsLabel: string | null;
  membershipPurpose?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  leftAt?: string | null;
}

export interface GatewayMemberships {
  channelId: number;
  channelSlug: string;
  channelKind: string;
  projectId: string | null;
  members: GatewayMember[];
}

export interface PostGatewayTestWakeRequest {
  channelId?: number;
  projectId?: string;
  memberIdentity: string;
  requestedBy?: string;
  note?: string;
}

export interface GatewayTestWake {
  status: string;
  memberIdentity: string;
  wakePolicy: string;
  messageId: number;
  channelId: number;
  gatewayMessageUrl: string;
  gatewayEventsUrl: string;
  evidenceSummary: string;
}

export interface PostGatewayDirectAgentMessageRequest {
  channelId?: number;
  projectId?: string;
  memberIdentity: string;
  senderIdentity: string;
  body: string;
}

export interface GatewayDirectAgentMessage {
  status: string;
  deliveryStatus: string;
  claimStatus: string;
  completionStatus: string;
  suppressionStatus: string;
  memberIdentity: string;
  wakePolicy: string;
  messageId: number;
  channelId: number;
  requestId: string;
  gatewayMessageUrl: string;
  gatewayEventsUrl: string;
  evidenceSummary: string;
}

export interface UpsertChannelMembershipRequest {
  memberType: string;
  memberIdentity: string;
  membershipStatus?: string;
  wakePolicy?: string;
  canSend?: boolean;
  canReact?: boolean;
  canInvite?: boolean;
  cooldownSeconds?: number;
  maxAutoRepliesPerWindow?: number;
  settingsJson?: string | null;
}

// Agents Overview types (mapped from #1694 API)

export interface AgentsOverviewRequest {
  projectId?: string;
  channelId?: string;
  scope?: string;
  agentIdentity?: string;
  activityLimit?: number;
  includeLeft?: boolean;
  includeGateway?: boolean;
}

export interface AgentsOverviewResponse {
  agents: AgentOverviewItem[];
  totalCount: number;
  sourceHealth: SourceHealthDto;
}

export interface SourceHealthDto {
  channels: SourceServiceStatusDto | null;
  gateway: SourceServiceStatusDto | null;
}

export interface SourceServiceStatusDto {
  status: string;
  warning?: string | null;
}

export interface AgentOverviewItem {
  agentIdentity: string;
  operatorStatus: string | null;
  workState: string | null;
  severity: string | null;
  summary: AgentSummaryDto | null;
  flags: string[];
  links: AgentLinksDto | null;
  memberships: ChannelMembershipOverviewDto[] | null;
  bindings: GatewayBindingOverviewDto[] | null;
  deliverySummaries: DeliveryOverviewDto[] | null;
  recentActivity: ActivityEventOverviewDto[] | null;
}

export interface AgentSummaryDto {
  channelCount: number;
  activeMembershipCount: number;
  activeDeliveryCount: number;
  recentActivityCount: number;
  latestActivityAt: string | null;
  highestSeverity: string | null;
  staleDeliveryCount?: number;
}

export interface AgentLinksDto {
  self: string | null;
  memberships: string | null;
  bindings: string | null;
  activity: string | null;
}

export interface ChannelMembershipOverviewDto {
  channelId: number;
  channelSlug: string;
  channelDisplayName: string;
  channelKind: string;
  projectId: string | null;
  membershipStatus: string;
  wakePolicy: string;
  canSend: boolean;
  settingsLabel: string | null;
}

export interface GatewayBindingOverviewDto {
  agentKey: string | null;
  role: string | null;
  bindingFreshness: string | null;
  deliveryState: string | null;
  deliveryCounts: GatewayDeliveryCountsDto | null;
  adapterInstances: GatewayAdapterInstanceDto[] | null;
}

export interface GatewayDeliveryCountsDto {
  active: number;
  completed: number;
  failed: number;
  suppressed: number;
  total: number;
}

export interface GatewayAdapterInstanceDto {
  adapterKind: string | null;
  adapterInstanceId: string | null;
  status: string;
  lastSeenAt: string | null;
  expiresAt: string | null;
  isStale: boolean;
  stalenessReason: string | null;
  metadata: Record<string, string> | null;
}

export interface DeliveryOverviewDto {
  deliveryRequestId: string | null;
  deliveryMode: string | null;
  deliveryState: string | null;
  requestedAt: string | null;
  targetAgentIdentity: string | null;
  channelSlug: string | null;
  channelId: number | null;
  projectId: string | null;
  taskId: number | null;
  isTerminal: boolean | null;
  latestActivityAt: string | null;
  evidenceSummary: string | null;
  state: string | null;
  status: string | null;
  terminal: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  summary: string | null;
  isStale?: boolean;
}

export interface ActivityEventOverviewDto {
  id: number;
  channelId: number;
  projectId: string | null;
  agentIdentity: string;
  deliveryRequestId: string | null;
  hermesSessionKey: string | null;
  displayBlockId: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  taskId: number | null;
  eventType: string;
  status: string;
  deliveryStage: string;
  terminal: boolean;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDetailResponse {
  agentIdentity: string;
  operatorStatus: string | null;
  workState: string | null;
  severity: string | null;
  flags: string[];
  summary: AgentSummaryDto | null;
  memberships: ChannelMembershipOverviewDto[] | null;
  bindings: GatewayBindingOverviewDto[] | null;
  deliverySummaries: DeliveryOverviewDto[] | null;
  recentActivity: ActivityEventOverviewDto[] | null;
  currentDeliveries: DeliveryOverviewDto[] | null;
  recentDeliveries: DeliveryOverviewDto[] | null;
  activityEvents: ActivityEventOverviewDto[] | null;
  taskAssociations: TaskAssociationDto[] | null;
  sourceHealth: SourceHealthDto;
}

export interface TaskAssociationDto {
  taskId: number | null;
  projectId: string | null;
  title: string | null;
  status: string | null;
  activityCount: number;
  latestActivityAt: string | null;
}

// =============================================================================
// Worker-pool lobby presence (task #1781)
// =============================================================================

/**
 * Presence state for a single worker-pool member.
 * Represents the live snapshot from Core/Channels lobby readback.
 */
export interface WorkerPoolMemberPresence {
  /** The agent/worker identity (e.g. "hermes-coder", "den-hermes-runner") */
  identity: string;
  /** Worker role grouping (e.g. "coder", "reviewer", "pilot", "validator") */
  role: string;
  /** Availability state from Core/Channels readback */
  availabilityState: WorkerPoolAvailabilityState;
  /** Human-readable status detail, if any */
  statusDetail: string | null;
  /** Number of active/leased assignments */
  activeAssignmentCount: number;
  /** Count of completed assignments */
  completedAssignmentCount: number;
  /** Current assignment delivery request IDs, if leased/busy */
  activeAssignmentIds: string[];
  /** When this member was last seen/updated */
  lastSeenAt: string | null;
  /** True if this member is a legacy pilot (not a spawned candidate) */
  isLegacyPilot: boolean;
  /** True if the member is quarantined */
  isQuarantined: boolean;
}

// =============================================================================
// Raw Channels worker-pool lobby API shape
// =============================================================================

/** Raw member record from GET /api/worker-pool/lobby/presence. */
export interface RawWorkerPoolMember {
  id?: number;
  channelId?: number;
  memberIdentity?: string;
  identity?: string;
  agentInstanceId?: string | null;
  poolMemberId?: string | null;
  profile?: string | null;
  role?: string | null;
  status?: string | null;
  availabilityState?: string | null;
  currentAssignmentId?: string | number | null;
  currentTaskId?: number | null;
  currentProjectId?: string | null;
  lastActivityAt?: string | null;
  lastSeenAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isLegacyPilot?: boolean;
  isQuarantined?: boolean;
}

/** Raw role grouping from GET /api/worker-pool/lobby/presence. */
export interface RawWorkerPoolRoleGroup {
  role?: string | null;
  profile?: string | null;
  count?: number | null;
  members?: RawWorkerPoolMember[] | null;
}

/** Raw Channels response. Field names intentionally reflect the deployed API. */
export interface RawWorkerPoolLobbyResponse {
  lobbySlug?: string;
  lobbyDisplayName?: string;
  lobbyChannelId?: number;
  channelId?: number;
  totalMembers?: number;
  totalCandidateCount?: number;
  availableCount?: number;
  roleCounts?: Record<string, number>;
  byRole?: RawWorkerPoolRoleGroup[] | null;
  members?: RawWorkerPoolMember[] | null;
  observedAt?: string | null;
}

export type WorkerPoolAvailabilityState =
  | 'idle'
  | 'available'
  | 'leased'
  | 'busy'
  | 'draining'
  | 'cleanup'
  | 'quarantined'
  | 'offline'
  | 'unknown';

/**
 * Aggregate worker-pool lobby presence response.
 */
export interface WorkerPoolLobbyPresence {
  /** The lobby channel ID this presence data is drawn from */
  channelId: number;
  /** The count of currently available workers */
  availableCount: number;
  /** Total candidate worker count (excluding legacy pilots) */
  totalCandidateCount: number;
  /** Per-role breakdown */
  roleCounts: Record<string, number>;
  /** Individual member presence records */
  members: WorkerPoolMemberPresence[];
  /** Timestamp of the snapshot */
  observedAt: string;
}

// =============================================================================
// Worker-pool assignment trace (task #1729)
// =============================================================================

/**
 * Assignment trace — aggregates observable state from Core, Gateway, and
 * Channels into a single read-only projection for a tester/operator.
 *
 * Every section has an explicit sourceAvailability field so the UI can render
 * "core_unavailable" / "gateway_unavailable" / "no_assignment_messages" etc.
 * without guessing whether data is missing or not yet loaded.
 */

export interface AssignmentCoreState {
  /** e.g. 'assigned', 'leased', 'working', 'checkpointing', 'releasing', 'quarantined', 'completed' */
  phase: string | null;
  /** When the assignment was created */
  assignedAt: string | null;
  /** Agent identity the assignment was assigned to */
  assignedAgent: string | null;
  /** Lease / takeover evidence if available */
  leaseAcquiredAt: string | null;
  leaseExpiresAt: string | null;
  /** Checkpoint evidence: each checkpoint is a snapshot/response pair */
  checkpoints: AssignmentCheckpointDto[] | null;
  /** Final completion status, if terminal */
  finalStatus: string | null;
  finalStatusAt: string | null;
  /** Cleanup evidence */
  cleanupState: string | null;
  cleanupTriggeredAt: string | null;
  cleanupCompletedAt: string | null;
  /** Release / quarantine result */
  releaseState: string | null;
  quarantined: boolean;
  quarantinedAt: string | null;
}

export interface AssignmentCheckpointDto {
  sequence: number;
  checkpointRequestAt: string | null;
  checkpointResponseAt: string | null;
  status: string | null;
  snapshotPreview: string | null;
  error: string | null;
}

export interface AssignmentGatewayEvidence {
  deliveryRequestId: string | null;
  deliveryStatus: string | null;
  claimStatus: string | null;
  completionStatus: string | null;
  suppressionStatus: string | null;
  requestedAt: string | null;
  deliveredAt: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  evidenceSummary: string | null;
  gatewayMessageUrl: string | null;
  gatewayEventsUrl: string | null;
}

export type TraceSourceAvailability =
  | 'available'
  | 'core_unavailable'
  | 'gateway_unavailable'
  | 'no_assignment_messages'
  | 'no_activity_events'
  | 'delivery_missing'
  | 'pending';

// =============================================================================
// Fleet Ops cockpit (task #1797)
// Gateway FleetOps API types — aligned with den-gateway #1796 contract.
// =============================================================================

/** Maps to Gateway FleetServiceUnit */
export interface FleetOpsServiceUnit {
  unitName: string;
  profileName: string;
  activeState: string;
  subState: string;
  pid?: number | null;
  statusSummary?: string | null;
  description: string;
}

/** Schema for a single action argument */
export interface FleetOpsActionArgSchema {
  name: string;
  type: string;
  required: boolean;
  description: string;
  pattern?: string;
}

/** Maps to Gateway FleetActionDescriptor */
export interface FleetOpsAction {
  actionId: string;
  label: string;
  riskLevel: string;
  mutating: boolean;
  supportsDryRun: boolean;
  needsConfirmation: boolean;
  confirmationCopy?: string | null;
  timeoutSeconds: number;
  argsSchema?: FleetOpsActionArgSchema[] | null;
  disabledReason?: string | null;
}

/** Maps to Gateway FleetOpsActionRun */
export interface FleetOpsActionRun {
  runId: string;
  actionId: string;
  args?: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  stdoutTail?: string | null;
  stderrTail?: string | null;
  errorMessage?: string | null;
  wasDryRun: boolean;
}

/** Maps to Gateway FleetOpsOverviewResponse */
export interface FleetOpsResponse {
  service: string;
  generatedAt: string;
  serviceUnits: FleetOpsServiceUnit[];
  actions: FleetOpsAction[];
  discoveryDiagnostics?: string | null;
  recentRuns?: FleetOpsActionRun[] | null;
}

/** POST body for /actions/{actionId}/runs */
export interface FleetOpsActionRunRequest {
  actionId: string;
  dryRun?: boolean;
  args?: Record<string, unknown> | null;
  confirmation?: string | null;
}

/**
 * POST /actions/{actionId}/runs returns a FleetOpsActionRun directly
 * (not wrapped). Error responses may also be run-shaped with errorMessage.
 */
export type FleetOpsActionRunResponse = FleetOpsActionRun;

/** GET /runs/{runId} returns { run: FleetOpsActionRun | null } */
export interface FleetOpsRunDetailResponse {
  run: FleetOpsActionRun | null;
}

export interface AssignmentTraceResponse {
  /** The assignment ID being traced */
  assignmentId: string;
  /** Project / task identity */
  projectId: string | null;
  projectName: string | null;
  taskId: number | null;
  taskTitle: string | null;
  /** Agent identity associated with this assignment */
  agentIdentity: string | null;
  workerRunId: string | null;
  workerRole: string | null;

  /** Source availability signals */
  coreAvailability: TraceSourceAvailability;
  gatewayAvailability: TraceSourceAvailability;
  messagesAvailability: TraceSourceAvailability;
  activityAvailability: TraceSourceAvailability;

  /** Core state (from den-core worker-pool API) */
  coreState: AssignmentCoreState | null;

  /** Gateway delivery evidence */
  gatewayEvidence: AssignmentGatewayEvidence | null;

  /** Channel messages tagged with this deliveryRequestId */
  channelMessages: import('../channels/types').ChannelMessage[];

  /** Activity events (non-waking) tagged with this assignment */
  activityEvents: import('../channels/types').ChannelActivityEvent[];

  /** Summary of the trace for display */
  summary: string | null;
}

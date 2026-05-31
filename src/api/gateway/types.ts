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

export type WorkerPoolAvailabilityState =
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
// Gateway FleetOps API types.
// =============================================================================

export interface FleetOpsServiceUnit {
  /** Service unit name (e.g. "hermes-coder", "den-hermes-runner") */
  name: string;
  /** Current status reported by the service manager */
  status: string;
  /** Whether the unit is enabled */
  enabled: boolean;
  /** Profile name if this is a per-profile unit */
  profile?: string | null;
  /** Human-readable description */
  description?: string | null;
  /** Last known PID or instance marker */
  pid?: number | string | null;
  /** Uptime seconds */
  uptimeSeconds?: number | null;
}

export interface FleetOpsAction {
  /** Action identifier — e.g. "fleet-status", "fleet-smoke", "restart-all", "restart-failed", "restart-profile" */
  actionId: string;
  /** Human-readable label */
  label: string;
  /** Category for grouping (e.g. "diagnostic", "restart", "maintenance") */
  category: string;
  /** Whether the action is currently allowed */
  enabled: boolean;
  /** If false, the UI must show the button as disabled */
  highRisk?: boolean;
  /** Short description */
  description?: string | null;
  /** Whether this action requires confirmation */
  requiresConfirmation?: boolean;
  /** Whether this action supports dry-run */
  supportsDryRun?: boolean;
  /** Whether this action requires args (e.g. profile name for restart-profile) */
  requiresArgs?: boolean;
}

export interface FleetOpsDiagnosticEntry {
  /** Diagnostic check name */
  check: string;
  /** Status: "ok", "warn", "error", "unknown" */
  status: string;
  /** Human-readable detail */
  detail?: string | null;
}

export interface FleetOpsRunSummary {
  /** Unique run identifier */
  runId: string;
  /** Action that was triggered */
  actionId: string;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Run status: "pending", "running", "completed", "failed" */
  status: string;
  /** When the run was started */
  startedAt: string | null;
  /** When the run completed */
  completedAt: string | null;
  /** Summary of results */
  summary?: string | null;
  /** Error detail if failed */
  error?: string | null;
}

export interface FleetOpsResponse {
  /** Service name (e.g. "gateway-fleet-ops") */
  service: string;
  /** Timestamp of generation */
  generatedAt: string;
  /** Service unit statuses */
  serviceUnits: FleetOpsServiceUnit[];
  /** Available actions */
  actions: FleetOpsAction[];
  /** Discovery diagnostics */
  discoveryDiagnostics: FleetOpsDiagnosticEntry[];
  /** Recent action runs */
  recentRuns: FleetOpsRunSummary[];
}

export interface FleetOpsActionRunRequest {
  /** The action to execute */
  actionId: string;
  /** Whether to perform a dry run */
  dryRun?: boolean;
  /** Action arguments (e.g. { profile: "hermes-coder" } for restart-profile) */
  args?: Record<string, string> | null;
  /** Confirmation token/string for high-risk actions */
  confirmation?: string | null;
}

export interface FleetOpsActionRunResponse {
  /** The created run */
  run: FleetOpsRunSummary;
}

export interface FleetOpsRunDetailResponse {
  /** The run detail, or null if not found */
  run: FleetOpsRunSummary | null;
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

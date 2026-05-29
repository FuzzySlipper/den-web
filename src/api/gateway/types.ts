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

import type { Channel, ChannelMessage, DesktopSessionEvent, DesktopSessionSnapshot, GatewayMember } from '@den-web/api/types';
import { formatTimeAgo, truncate } from '@den-web/shared/format';
import { asRecord, firstString, parseJsonRecord } from '@den-web/shared/jsonRecord';
import { channelLabel } from '../channels/chatDisplay';

export type FocusedLaneKind = 'session' | 'channel';
export type FocusedLaneState = 'active' | 'working' | 'queued' | 'replied' | 'failed' | 'stale';

export interface FocusedSessionLane {
  key: string;
  kind: FocusedLaneKind;
  channel: Channel;
  snapshot: DesktopSessionSnapshot | null;
  label: string;
  state: FocusedLaneState;
  lastActivityAt: string;
  threadId: number | null;
}

const RECENT_STATUS_VALUES = new Set(['exited', 'exit', 'complete', 'completed', 'done', 'failed', 'crashed', 'terminated']);

export function displayTime(value: string | null | undefined): string {
  return value ? formatTimeAgo(value) : 'no activity';
}

export function sessionActivityAt(snapshot: DesktopSessionSnapshot): string {
  return snapshot.last_activity_at ?? snapshot.updated_at ?? snapshot.received_at ?? snapshot.observed_at ?? snapshot.started_at ?? '';
}

export function normalizedSessionStatus(snapshot: DesktopSessionSnapshot | null): string {
  return snapshot?.status?.trim().toLowerCase() ?? '';
}

export function isLiveSession(snapshot: DesktopSessionSnapshot): boolean {
  const status = normalizedSessionStatus(snapshot);
  return !snapshot.is_stale && !snapshot.exited_at && !RECENT_STATUS_VALUES.has(status);
}

export function deriveSessionState(snapshot: DesktopSessionSnapshot | null, members: GatewayMember[]): FocusedLaneState {
  if (!snapshot) {
    return members.some(member => member.memberType === 'agent' && member.membershipStatus === 'active') ? 'active' : 'queued';
  }

  const status = normalizedSessionStatus(snapshot);
  if (snapshot.is_stale) return 'stale';
  if (status.includes('fail') || status.includes('crash') || (snapshot.exit_code ?? 0) !== 0) return 'failed';
  if (status.includes('reply') || status.includes('complete') || status.includes('done')) return 'replied';
  if (snapshot.current_command || snapshot.current_phase || status.includes('run') || status.includes('work')) return 'working';
  if (status.includes('queue') || status.includes('pending') || status.includes('created')) return 'queued';
  return 'active';
}

export function sessionModelProfile(snapshot: DesktopSessionSnapshot | null): string | null {
  if (!snapshot) return null;
  const capability = asRecord(snapshot.capabilities);
  const recent = asRecord(snapshot.recent_activity);
  const control = asRecord(snapshot.control_capabilities);
  const model = firstString([recent, capability, control], ['model', 'modelName', 'requested_model']);
  const profile = firstString([recent, capability, control], ['profile', 'profileName', 'provider', 'backend']);
  return [model, profile].filter(Boolean).join(' / ') || snapshot.backend || null;
}

export function sessionDisplayName(snapshot: DesktopSessionSnapshot): string {
  return snapshot.display_name
    ?? snapshot.title
    ?? snapshot.agent_identity
    ?? snapshot.session_id;
}

export function laneKeyForSession(snapshot: DesktopSessionSnapshot): string {
  return `session:${snapshot.source_instance_id}:${snapshot.session_id}`;
}

export function laneKeyForChannel(channel: Channel): string {
  return `channel:${channel.id}`;
}

export function buildLaneLabel(
  channel: Channel,
  snapshot: DesktopSessionSnapshot | null,
  state: FocusedLaneState,
  threadId: number | null,
  projectId: string | null,
): string {
  const project = snapshot?.project_id ?? channel.projectId ?? projectId ?? 'project';
  const task = snapshot?.task_id != null ? `target task #${snapshot.task_id}` : 'no target task';
  const thread = threadId != null ? `thread #${threadId}` : 'no thread';
  const agent = snapshot?.agent_identity ?? 'source context only';
  const status = snapshot?.status ?? state;
  const lastActivity = displayTime(snapshot ? sessionActivityAt(snapshot) : channel.updatedAt);
  const modelProfile = sessionModelProfile(snapshot);
  const sessionName = snapshot ? sessionDisplayName(snapshot) : channel.displayName;
  return [
    `${state}: ${sessionName}`,
    `Project ${project}`,
    `Channel ${channelLabel(channel, projectId, '#select-project')}`,
    task,
    thread,
    agent,
    status,
    `last ${lastActivity}`,
    modelProfile ? `model/profile ${modelProfile}` : null,
  ].filter(Boolean).join(' · ');
}

export function isCommandOrResultMessage(message: ChannelMessage): boolean {
  const sourceKind = (message.sourceKind ?? '').toLowerCase();
  const messageKind = message.messageKind.toLowerCase();
  const body = message.body.trim();
  return body.startsWith('/')
    || sourceKind.includes('command')
    || sourceKind.includes('result')
    || sourceKind.includes('gateway')
    || sourceKind.includes('wake')
    || sourceKind.includes('external_adapter')
    || messageKind.includes('command')
    || messageKind.includes('result');
}

export function eventPayloadPreview(event: DesktopSessionEvent): string {
  const payload = event.payload?.trim();
  if (!payload) return event.reason ?? 'status update';
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (typeof parsed === 'string') return truncate(parsed, 180);
    const record = asRecord(parsed);
    if (!record) return truncate(JSON.stringify(parsed), 180);
    const concise: Record<string, unknown> = {};
    for (const key of ['status', 'phase', 'tool', 'tool_name', 'toolName', 'command', 'result', 'summary', 'message', 'error']) {
      if (record[key] != null) concise[key] = record[key];
    }
    return truncate(JSON.stringify(Object.keys(concise).length > 0 ? concise : parsed), 180);
  } catch {
    return truncate(payload, 180);
  }
}

export function currentToolLabel(snapshot: DesktopSessionSnapshot | null, events: DesktopSessionEvent[]): string {
  if (snapshot?.current_command) return snapshot.current_command;
  for (const event of events) {
    const record = parseJsonRecord(event.payload);
    const tool = firstString([record], ['tool', 'tool_name', 'toolName', 'current_tool']);
    if (tool) return tool;
  }
  return 'No current tool signal';
}

export function statusDetail(snapshot: DesktopSessionSnapshot | null): string {
  if (!snapshot) return 'Source channel context selected; no durable active-owner session snapshot is attached yet.';
  const parts = [
    snapshot.status ?? 'unknown status',
    snapshot.current_phase ? `phase ${snapshot.current_phase}` : null,
    snapshot.current_command ? `command ${snapshot.current_command}` : null,
    snapshot.is_stale ? 'stale binding warning' : null,
    snapshot.exit_code != null ? `exit ${snapshot.exit_code}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

export function safeEvidenceLink(link: string | null): string | null {
  const trimmed = link?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^(https?:|den:)/i.test(trimmed)) return trimmed;
  return null;
}

export function messageEvidenceLink(message: ChannelMessage): string {
  return safeEvidenceLink(message.deepLink) ?? `/api/gateway/messages/${message.id}`;
}

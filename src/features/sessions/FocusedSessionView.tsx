import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Channel, ChannelMessage, DesktopSessionEvent, DesktopSessionSnapshot, GatewayMember, GatewayMemberships, ActiveWorkRoutesResponse } from '../../api/types';
import {
  ensureProjectDefaultChannel,
  listChannelMessages,
  listDesktopSessionEvents,
  listDesktopSessionSnapshots,
  listGatewayMemberships,
  listProjectLinkedChannels,
  listActiveWorkRoutes,
  postChannelMessage,
} from '../../api/client';
import { preferredProjectChannel } from '../channels/channelRouting';
import {
  activeOwnerLabel,
  activeRouteKey,
  activeWorkTargetLabel,
  continuationPreview,
  groupRoutesByOwner,
  resetScopeForRoute,
  resetScopeLabel,
  routeAllows,
  sourceContextLabel,
} from './sessionPolicy';
import { NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS, isVisibleNormalParticipant } from '../channels/participantVisibility';
import { usePolling } from '../../hooks/usePolling';
import { formatTimeAgo, truncate } from '../../utils';

const SENDER_IDENTITY_STORAGE_KEY = 'den-channel-sender-identity';
const RECENT_STATUS_VALUES = new Set(['exited', 'exit', 'complete', 'completed', 'done', 'failed', 'crashed', 'terminated']);
const NOISY_EVENT_TYPES = new Set(['snapshot_published', 'snapshot_publish_failed', 'discovered']);

interface Props {
  projectId: string | null;
  spaceName?: string | null;
}

type FocusedLaneKind = 'session' | 'channel';
type FocusedLaneState = 'active' | 'working' | 'queued' | 'replied' | 'failed' | 'stale';

interface FocusedSessionLane {
  key: string;
  kind: FocusedLaneKind;
  channel: Channel;
  snapshot: DesktopSessionSnapshot | null;
  label: string;
  state: FocusedLaneState;
  lastActivityAt: string;
  threadId: number | null;
}

function readStoredSenderIdentity(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SENDER_IDENTITY_STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

function persistSenderIdentity(identity: string): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = identity.trim();
    if (normalized) {
      window.localStorage.setItem(SENDER_IDENTITY_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(SENDER_IDENTITY_STORAGE_KEY);
    }
  } catch {
    // Embedded/private windows can reject storage writes; keep the in-memory identity.
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function firstString(records: Array<Record<string, unknown> | null>, keys: string[]): string | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = stringFromUnknown(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function parseJsonRecord(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return asRecord(JSON.parse(json));
  } catch {
    return null;
  }
}

function channelLabel(channel: Channel | null, projectId: string | null): string {
  if (channel) return `#${channel.slug}`;
  return projectId ? `#project-${projectId}` : '#select-project';
}

function displayTime(value: string | null | undefined): string {
  return value ? formatTimeAgo(value) : 'no activity';
}

function messageSender(message: ChannelMessage): string {
  return message.senderIdentity || message.senderType;
}


function sessionActivityAt(snapshot: DesktopSessionSnapshot): string {
  return snapshot.last_activity_at ?? snapshot.updated_at ?? snapshot.received_at ?? snapshot.observed_at ?? snapshot.started_at ?? '';
}

function normalizedSessionStatus(snapshot: DesktopSessionSnapshot | null): string {
  return snapshot?.status?.trim().toLowerCase() ?? '';
}

function isLiveSession(snapshot: DesktopSessionSnapshot): boolean {
  const status = normalizedSessionStatus(snapshot);
  return !snapshot.is_stale && !snapshot.exited_at && !RECENT_STATUS_VALUES.has(status);
}

function deriveSessionState(snapshot: DesktopSessionSnapshot | null, members: GatewayMember[]): FocusedLaneState {
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

function sessionModelProfile(snapshot: DesktopSessionSnapshot | null): string | null {
  if (!snapshot) return null;
  const capability = asRecord(snapshot.capabilities);
  const recent = asRecord(snapshot.recent_activity);
  const control = asRecord(snapshot.control_capabilities);
  const model = firstString([recent, capability, control], ['model', 'modelName', 'requested_model']);
  const profile = firstString([recent, capability, control], ['profile', 'profileName', 'provider', 'backend']);
  return [model, profile].filter(Boolean).join(' / ') || snapshot.backend || null;
}

function sessionDisplayName(snapshot: DesktopSessionSnapshot): string {
  return snapshot.display_name
    ?? snapshot.title
    ?? snapshot.agent_identity
    ?? snapshot.session_id;
}

function laneKeyForSession(snapshot: DesktopSessionSnapshot): string {
  return `session:${snapshot.source_instance_id}:${snapshot.session_id}`;
}

function laneKeyForChannel(channel: Channel): string {
  return `channel:${channel.id}`;
}

function buildLaneLabel(
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
    `Channel ${channelLabel(channel, projectId)}`,
    task,
    thread,
    agent,
    status,
    `last ${lastActivity}`,
    modelProfile ? `model/profile ${modelProfile}` : null,
  ].filter(Boolean).join(' · ');
}

function directMessageEvidence(message: ChannelMessage): { target: string | null; status: string } | null {
  const metadata = parseJsonRecord(message.metadataJson);
  if (!metadata) return null;
  if (metadata.deliveryMode !== 'direct_agent_message') return null;
  const target = stringFromUnknown(metadata.targetMemberIdentity);
  const status = [
    stringFromUnknown(metadata.deliveryStatus),
    stringFromUnknown(metadata.claimStatus),
    stringFromUnknown(metadata.completionStatus),
    stringFromUnknown(metadata.suppressionStatus),
  ].filter(Boolean).join(' · ');
  return { target, status: status || 'claimed/delivered/reply-posted pending' };
}

function isCommandOrResultMessage(message: ChannelMessage): boolean {
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

function eventPayloadPreview(event: DesktopSessionEvent): string {
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

function currentToolLabel(snapshot: DesktopSessionSnapshot | null, events: DesktopSessionEvent[]): string {
  if (snapshot?.current_command) return snapshot.current_command;
  for (const event of events) {
    const record = parseJsonRecord(event.payload);
    const tool = firstString([record], ['tool', 'tool_name', 'toolName', 'current_tool']);
    if (tool) return tool;
  }
  return 'No current tool signal';
}

function statusDetail(snapshot: DesktopSessionSnapshot | null): string {
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

function safeEvidenceLink(link: string | null): string | null {
  const trimmed = link?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^(https?:|den:)/i.test(trimmed)) return trimmed;
  return null;
}

function messageEvidenceLink(message: ChannelMessage): string {
  return safeEvidenceLink(message.deepLink) ?? `/api/gateway/messages/${message.id}`;
}

export function FocusedSessionView({ projectId, spaceName }: Props) {
  const [selectedLaneKey, setSelectedLaneKey] = useState('');
  const [selectedRouteKey, setSelectedRouteKey] = useState('');
  const [senderIdentity, setSenderIdentity] = useState(readStoredSenderIdentity);
  const [targetMemberIdentity, setTargetMemberIdentity] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const transcriptRef = useRef<HTMLElement | null>(null);
  const normalizedSenderIdentity = senderIdentity.trim();

  const fetchChannels = useCallback(async () => {
    if (!projectId) return [];
    const channels = await listProjectLinkedChannels(projectId);
    if (channels.length > 0) return channels;
    const ensured = await ensureProjectDefaultChannel(projectId, {
      displayName: spaceName?.trim() || projectId,
      createdBy: normalizedSenderIdentity || 'den-web',
    });
    return [ensured];
  }, [normalizedSenderIdentity, projectId, spaceName]);
  const { data: channels, loading: channelsLoading, error: channelsError, refresh: refreshChannels } = usePolling<Channel[]>(fetchChannels, 15000);

  const availableChannels = useMemo(
    () => (channels ?? []).filter(channel => channel.visibility !== 'archived'),
    [channels],
  );

  const primaryChannel = useMemo(
    () => preferredProjectChannel(availableChannels, projectId) ?? null,
    [availableChannels, projectId],
  );

  const selectedChannelLane = useMemo(
    () => availableChannels.find(channel => laneKeyForChannel(channel) === selectedLaneKey) ?? null,
    [availableChannels, selectedLaneKey],
  );
  const activeChannel = selectedChannelLane ?? primaryChannel;

  const fetchSnapshots = useCallback(
    () => projectId ? listDesktopSessionSnapshots(projectId, { limit: 60 }) : Promise.resolve([]),
    [projectId],
  );
  const { data: snapshots, loading: snapshotsLoading, error: snapshotsError, refresh: refreshSnapshots } = usePolling<DesktopSessionSnapshot[]>(fetchSnapshots, 5000);

  const fetchActiveRoutes = useCallback(
    () => projectId ? listActiveWorkRoutes({ targetProjectId: projectId, includeStale: true, limit: 50 }) : Promise.resolve(null),
    [projectId],
  );
  const { data: activeRoutesResponse, loading: activeRoutesLoading, error: activeRoutesError, refresh: refreshActiveRoutes } = usePolling<ActiveWorkRoutesResponse | null>(fetchActiveRoutes, 5000);
  const activeRoutes = useMemo(() => activeRoutesResponse?.routes ?? [], [activeRoutesResponse]);

  const fetchMessages = useCallback(
    () => activeChannel ? listChannelMessages(activeChannel.id, { limit: 150 }) : Promise.resolve([]),
    [activeChannel],
  );
  const { data: messages, loading: messagesLoading, error: messagesError, refresh: refreshMessages } = usePolling<ChannelMessage[]>(fetchMessages, 3000);

  const sortedMessages = useMemo(() => {
    const visibleMessages = activeChannel
      ? (messages ?? []).filter(message => message.channelId === activeChannel.id)
      : [];
    return [...visibleMessages].sort((left, right) => left.id - right.id);
  }, [activeChannel, messages]);

  const selectedThreadId: number | null = null;

  const fetchMemberships = useCallback(
    () => activeChannel ? listGatewayMemberships({ channelId: activeChannel.id, ...NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS }) : Promise.resolve(null),
    [activeChannel],
  );
  const { data: memberships, loading: membershipsLoading, error: membershipsError, refresh: refreshMemberships } = usePolling<GatewayMemberships | null>(fetchMemberships, 5000);

  const members = useMemo(() => (memberships?.members ?? []).filter(member => isVisibleNormalParticipant(member)), [memberships]);
  const activeAgentMembers = useMemo(
    () => members.filter(member => member.memberType === 'agent' && member.membershipStatus === 'active'),
    [members],
  );

  const sortedSnapshots = useMemo(() => {
    return [...(snapshots ?? [])]
      .filter(snapshot => snapshot.project_id === projectId)
      .sort((left, right) => sessionActivityAt(right).localeCompare(sessionActivityAt(left)));
  }, [projectId, snapshots]);

  const liveSessionLanes = useMemo<FocusedSessionLane[]>(() => {
    if (!primaryChannel) return [];
    return sortedSnapshots.filter(isLiveSession).map(snapshot => {
      const state = deriveSessionState(snapshot, members);
      return {
        key: laneKeyForSession(snapshot),
        kind: 'session',
        channel: primaryChannel,
        snapshot,
        label: buildLaneLabel(primaryChannel, snapshot, state, selectedThreadId, projectId),
        state,
        lastActivityAt: sessionActivityAt(snapshot),
        threadId: selectedThreadId,
      };
    });
  }, [members, primaryChannel, projectId, selectedThreadId, sortedSnapshots]);

  const recentSessionLanes = useMemo<FocusedSessionLane[]>(() => {
    if (!primaryChannel) return [];
    const sessionLanes = sortedSnapshots.filter(snapshot => !isLiveSession(snapshot)).map(snapshot => {
      const state = deriveSessionState(snapshot, members);
      return {
        key: laneKeyForSession(snapshot),
        kind: 'session' as const,
        channel: primaryChannel,
        snapshot,
        label: buildLaneLabel(primaryChannel, snapshot, state, selectedThreadId, projectId),
        state,
        lastActivityAt: sessionActivityAt(snapshot),
        threadId: selectedThreadId,
      };
    });
    const channelLanes = availableChannels.map(channel => {
      const state = deriveSessionState(null, members);
      return {
        key: laneKeyForChannel(channel),
        kind: 'channel' as const,
        channel,
        snapshot: null,
        label: buildLaneLabel(channel, null, state, selectedThreadId, projectId),
        state,
        lastActivityAt: channel.updatedAt,
        threadId: selectedThreadId,
      };
    });
    return [...sessionLanes, ...channelLanes].sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
  }, [availableChannels, members, primaryChannel, projectId, selectedThreadId, sortedSnapshots]);

  const allLanes = useMemo(() => [...liveSessionLanes, ...recentSessionLanes], [liveSessionLanes, recentSessionLanes]);

  useEffect(() => {
    if (allLanes.length === 0) {
      setSelectedLaneKey('');
      return;
    }
    if (!selectedLaneKey || !allLanes.some(lane => lane.key === selectedLaneKey)) {
      setSelectedLaneKey(allLanes[0].key);
    }
  }, [allLanes, selectedLaneKey]);

  const selectedLane = useMemo(
    () => allLanes.find(lane => lane.key === selectedLaneKey) ?? allLanes[0] ?? null,
    [allLanes, selectedLaneKey],
  );
  const selectedSnapshot = selectedLane?.snapshot ?? null;

  const activeRouteGroups = useMemo(() => groupRoutesByOwner(activeRoutes), [activeRoutes]);
  const selectedActiveRoute = useMemo(
    () => activeRoutes.find(route => activeRouteKey(route) === selectedRouteKey) ?? activeRoutes[0] ?? null,
    [activeRoutes, selectedRouteKey],
  );
  const selectedSourceContext = useMemo(() => ({
    kind: selectedLane?.kind ?? 'channel' as const,
    channelSlug: selectedLane?.channel.slug ?? activeChannel?.slug ?? null,
    sessionId: selectedSnapshot?.session_id ?? null,
    sourceInstanceId: selectedSnapshot?.source_instance_id ?? null,
  }), [activeChannel?.slug, selectedLane, selectedSnapshot]);
  const selectedResetScope = resetScopeForRoute(selectedActiveRoute, selectedSnapshot, selectedSourceContext);
  const routePreview = continuationPreview(selectedActiveRoute, selectedSnapshot, selectedSourceContext);
  const selectedRouteAllowsReset = routeAllows(selectedActiveRoute, 'reset');

  useEffect(() => {
    if (activeRoutes.length === 0) {
      setSelectedRouteKey('');
      return;
    }
    if (!selectedRouteKey || !activeRoutes.some(route => activeRouteKey(route) === selectedRouteKey)) {
      setSelectedRouteKey(activeRouteKey(activeRoutes[0]));
    }
  }, [activeRoutes, selectedRouteKey]);

  const fetchEvents = useCallback(
    () => projectId && selectedSnapshot
      ? listDesktopSessionEvents(projectId, {
        sourceInstanceId: selectedSnapshot.source_instance_id,
        sessionId: selectedSnapshot.session_id,
        limit: 60,
      })
      : Promise.resolve([]),
    [projectId, selectedSnapshot],
  );
  const { data: sessionEvents, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = usePolling<DesktopSessionEvent[]>(fetchEvents, 4000);

  const orderedEvents = useMemo(
    () => [...(sessionEvents ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [sessionEvents],
  );
  const evidenceEvents = useMemo(
    () => orderedEvents.filter(event => !NOISY_EVENT_TYPES.has(event.event_type)).slice(0, 12),
    [orderedEvents],
  );

  useEffect(() => {
    if (activeAgentMembers.length === 0) {
      setTargetMemberIdentity('');
      return;
    }
    if (targetMemberIdentity && !activeAgentMembers.some(member => member.memberIdentity === targetMemberIdentity)) {
      setTargetMemberIdentity('');
    }
  }, [activeAgentMembers, targetMemberIdentity]);

  const conversationMessages = useMemo(
    () => sortedMessages.filter(message => !isCommandOrResultMessage(message)),
    [sortedMessages],
  );
  const workflowMessages = useMemo(
    () => sortedMessages.filter(isCommandOrResultMessage),
    [sortedMessages],
  );

  const selectedTarget = activeAgentMembers.find(member => member.memberIdentity === targetMemberIdentity) ?? null;
  const identityRequired = Boolean(projectId) && normalizedSenderIdentity.length === 0;
  const composerDisabled = !activeChannel || sending || identityRequired || Boolean(channelsError);
  const topError = sendError ?? channelsError ?? snapshotsError ?? activeRoutesError ?? messagesError ?? membershipsError ?? eventsError;
  const viewState = selectedLane?.state ?? 'queued';

  const handleSenderIdentityChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSenderIdentity(value);
    persistSenderIdentity(value);
  }, []);

  const refreshAll = useCallback(() => {
    refreshChannels();
    refreshSnapshots();
    refreshMessages();
    refreshMemberships();
    refreshActiveRoutes();
    refreshEvents();
  }, [refreshActiveRoutes, refreshChannels, refreshEvents, refreshMemberships, refreshMessages, refreshSnapshots]);

  const snapTranscriptToBottom = useCallback(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'auto' });
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!activeChannel || !body || !normalizedSenderIdentity || composerDisabled) return;

    setSending(true);
    setSendError(null);
    try {
      const metadata = {
        sourceContextKind: selectedLane?.kind ?? 'channel',
        sourceChannelId: activeChannel.id,
        sourceChannelSlug: activeChannel.slug,
        selectedContextKey: selectedLane?.key ?? null,
        targetProjectId: selectedActiveRoute?.targetProjectId ?? projectId ?? null,
        targetTaskId: selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id ?? null,
        assignmentId: selectedActiveRoute?.assignmentId ?? null,
        workerRunId: selectedActiveRoute?.workerRunId ?? null,
        workerRole: selectedActiveRoute?.workerRole ?? null,
        agentInstanceId: selectedActiveRoute?.agentInstanceId ?? null,
        poolMemberId: selectedActiveRoute?.poolMemberId ?? null,
        profileIdentity: selectedActiveRoute?.profileIdentity ?? selectedTarget?.memberIdentity ?? null,
        sessionOwnerId: selectedActiveRoute?.sessionOwnerId ?? null,
        sessionId: selectedActiveRoute?.sessionId ?? selectedSnapshot?.session_id ?? null,
        sourceInstanceId: selectedSnapshot?.source_instance_id ?? null,
        workspaceId: selectedSnapshot?.workspace_id ?? null,
        deliveryMode: selectedTarget || selectedActiveRoute ? 'direct_agent_message' : 'channel_message',
        targetMemberIdentity: selectedTarget?.memberIdentity ?? selectedActiveRoute?.profileIdentity ?? null,
        activeWorkRouteKey: selectedActiveRoute ? activeRouteKey(selectedActiveRoute) : null,
        activeWorkRouteStatus: selectedActiveRoute ? (selectedActiveRoute.isStale ? 'stale' : 'routed') : 'no_active_route',
        resetScope: selectedResetScope,
        slashCommand: body.startsWith('/') ? body.split(/\s+/, 1)[0] : null,
      };
      await postChannelMessage(activeChannel.id, {
        senderType: 'user',
        senderIdentity: normalizedSenderIdentity,
        messageKind: body.startsWith('/') ? 'command' : 'human_text',
        sourceKind: 'den_web_active_work',
        sourceId: selectedLane?.key ?? null,
        sourceProjectId: projectId ?? null,
        targetProjectId: selectedActiveRoute?.targetProjectId ?? projectId ?? null,
        targetTaskId: selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id ?? null,
        assignmentId: selectedActiveRoute?.assignmentId ?? null,
        workerRunId: selectedActiveRoute?.workerRunId ?? null,
        workerRole: selectedActiveRoute?.workerRole ?? null,
        profileIdentity: selectedActiveRoute?.profileIdentity ?? selectedTarget?.memberIdentity ?? null,
        agentInstanceId: selectedActiveRoute?.agentInstanceId ?? null,
        poolMemberId: selectedActiveRoute?.poolMemberId ?? null,
        sessionOwnerId: selectedActiveRoute?.sessionOwnerId ?? null,
        sessionId: selectedActiveRoute?.sessionId ?? selectedSnapshot?.session_id ?? null,
        body,
        threadRootMessageId: selectedLane?.threadId ?? null,
        metadataJson: JSON.stringify(metadata),
      });
      setDraft('');
      refreshMessages();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [activeChannel, composerDisabled, draft, normalizedSenderIdentity, projectId, refreshMessages, selectedActiveRoute, selectedLane, selectedResetScope, selectedSnapshot, selectedTarget]);

  return (
    <section className="focused-session-view" aria-label="Focused active-owner sessions">
      <div className="focused-session-toolbar">
        <div className="focused-session-title">
          <span>Active work</span>
          <strong>{selectedActiveRoute ? activeOwnerLabel(selectedActiveRoute) : selectedLane ? channelLabel(selectedLane.channel, projectId) : channelLabel(null, projectId)}</strong>
          <span className={`focused-session-state focused-session-state-${viewState}`}>{viewState}</span>
        </div>
        <label className="focused-session-selector-label" htmlFor="focused-session-selector">Active owner / source context</label>
        <select
          id="focused-session-selector"
          className="focused-session-selector"
          value={selectedLane?.key ?? ''}
          onChange={event => setSelectedLaneKey(event.target.value)}
          disabled={allLanes.length === 0}
        >
          {allLanes.length === 0 ? (
            <option value="">{channelsLoading || snapshotsLoading ? 'Loading sessions…' : 'No sessions or channels'}</option>
          ) : (
            <>
              <optgroup label="Live active-owner sessions">
                {liveSessionLanes.length === 0 ? (
                  <option value="" disabled>No live sessions</option>
                ) : liveSessionLanes.map(lane => (
                  <option key={lane.key} value={lane.key}>{lane.label}</option>
                ))}
              </optgroup>
              <optgroup label="Recent runtime/source contexts">
                {recentSessionLanes.map(lane => (
                  <option key={lane.key} value={lane.key}>{lane.label}</option>
                ))}
              </optgroup>
            </>
          )}
        </select>
        <label className="focused-session-selector-label" htmlFor="focused-active-route-selector">Continuation route</label>
        <select
          id="focused-active-route-selector"
          className="focused-session-selector"
          value={selectedActiveRoute ? activeRouteKey(selectedActiveRoute) : ''}
          onChange={event => setSelectedRouteKey(event.target.value)}
          disabled={activeRoutes.length === 0}
          title="Routes by target project/task/assignment/run; source channel is metadata only"
        >
          {activeRoutes.length === 0 ? (
            <option value="">{activeRoutesLoading ? 'Resolving active work…' : 'No active route for this project'}</option>
          ) : activeRoutes.map(route => (
            <option key={activeRouteKey(route)} value={activeRouteKey(route)}>
              {activeWorkTargetLabel(route)} → {activeOwnerLabel(route)}{route.isStale ? ' (stale)' : ''}
            </option>
          ))}
        </select>
        <button type="button" className="focused-session-refresh" onClick={refreshAll}>Refresh</button>
        <button
          type="button"
          className="focused-session-refresh focused-session-bottom"
          onClick={snapTranscriptToBottom}
          title="Snap the connected transcript to the newest messages"
        >
          Bottom
        </button>
      </div>

      {topError && <div className="focused-session-error">{topError.message}</div>}

      <div className="focused-session-grid">
        <main ref={transcriptRef} className="focused-session-transcript" aria-label="Connected transcript">
          <div className="focused-session-section-header">
            <h3>Connected transcript</h3>
            <span>{messagesLoading ? 'loading…' : `${sortedMessages.length} channel messages`}</span>
          </div>

          <section className="focused-session-conversation">
            <h4>Conversation</h4>
            {conversationMessages.length === 0 ? (
              <div className="focused-session-empty">No visible conversation messages yet.</div>
            ) : conversationMessages.map(message => {
              const evidence = directMessageEvidence(message);
              const link = messageEvidenceLink(message);
              return (
                <article key={message.id} className={`focused-session-message focused-session-message-${message.senderType}`}>
                  <div className="focused-session-message-meta">
                    <span>{displayTime(message.createdAt)}</span>
                    <strong>{messageSender(message)}</strong>
                    <span>{message.messageKind}</span>
                    {message.sourceKind && <span>{message.sourceKind}</span>}
                  </div>
                  <p>{message.body}</p>
                  {evidence && (
                    <div className="focused-session-evidence-inline">
                      <strong>{evidence.target ? `Direct agent target ${evidence.target}` : 'Direct agent target pending'}</strong>
                      <span>{evidence.status}</span>
                    </div>
                  )}
                  {link && <a href={link} target="_blank" rel="noreferrer">evidence</a>}
                </article>
              );
            })}
          </section>

          <section className="focused-session-workflow">
            <h4>Workflow evidence</h4>
            <div className="focused-session-subtitle">Command/result messages are separated from mirrored workflow events to suppress transcript noise.</div>
            {workflowMessages.length === 0 ? (
              <div className="focused-session-empty">No Command/result messages yet.</div>
            ) : workflowMessages.map(message => {
              const evidence = directMessageEvidence(message);
              return (
                <article key={message.id} className="focused-session-message focused-session-command-result">
                  <div className="focused-session-message-meta">
                    <span>{displayTime(message.createdAt)}</span>
                    <strong>Command/result</strong>
                    <span>{messageSender(message)}</span>
                    <span>{message.sourceKind ?? message.messageKind}</span>
                  </div>
                  <p>{message.body}</p>
                  {evidence && (
                    <div className="focused-session-evidence-inline">
                      <strong>{evidence.target ? `claimed/delivered/reply-posted for ${evidence.target}` : 'claimed/delivered/reply-posted evidence'}</strong>
                      <span>{evidence.status}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </main>

        <aside className="focused-session-sidebar" aria-label="Den context">
          <section className="focused-session-card">
            <h3>Den context</h3>
            <dl className="focused-session-context-list">
              <dt>Target work</dt><dd>{selectedActiveRoute ? activeWorkTargetLabel(selectedActiveRoute) : selectedSnapshot?.task_id != null ? `project ${projectId} · task #${selectedSnapshot.task_id}` : `project ${projectId ?? 'Select a project'}`}</dd>
              <dt>Active owner</dt><dd>{selectedActiveRoute ? activeOwnerLabel(selectedActiveRoute) : selectedSnapshot?.source_instance_id ?? 'No active owner route'}</dd>
              <dt>Source context</dt><dd>{sourceContextLabel(selectedActiveRoute, selectedSourceContext)}</dd>
              <dt>Runtime session</dt><dd>{selectedActiveRoute?.sessionId ?? selectedSnapshot?.session_id ?? 'No runtime session evidence'}</dd>
              <dt>Task</dt><dd>{selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id != null ? `#${selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id}` : 'No task metadata'}</dd>
              <dt>Assignment/run</dt><dd>{[selectedActiveRoute?.assignmentId, selectedActiveRoute?.workerRunId].filter(Boolean).join(' / ') || 'No assignment/run metadata'}</dd>
              <dt>Agent instance</dt><dd>{selectedActiveRoute?.agentInstanceId ?? selectedSnapshot?.source_instance_id ?? 'Not reported'}</dd>
              <dt>Pool/profile</dt><dd>{[selectedActiveRoute?.poolMemberId, selectedActiveRoute?.profileIdentity, selectedTarget?.memberIdentity].filter(Boolean).join(' / ') || 'Not reported'}</dd>
              <dt>Model/Profile</dt><dd>{sessionModelProfile(selectedSnapshot) ?? 'Not reported'}</dd>
            </dl>
          </section>

          <section className="focused-session-card focused-session-status-card">
            <h3>Status evidence</h3>
            <div className={`focused-session-status-pill focused-session-state-${viewState}`}>{viewState}</div>
            <p>{statusDetail(selectedSnapshot)}</p>
            <div className="focused-session-routing-preview">
              <strong>Route preview</strong>
              <span>{routePreview}</span>
              <span>Reset scope: {resetScopeLabel(selectedResetScope)}{selectedRouteAllowsReset ? '' : ' (route does not advertise reset action)'}</span>
            </div>
            {selectedSnapshot?.warnings?.length ? (
              <ul className="focused-session-warning-list">
                {selectedSnapshot.warnings.slice(0, 4).map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            ) : null}
            {selectedSnapshot?.is_stale && <div className="focused-session-warning">Stale binding warning: desktop snapshot is outside freshness bounds.</div>}
          </section>

          <section className="focused-session-card">
            <h3>Tool evidence</h3>
            <p>{currentToolLabel(selectedSnapshot, orderedEvents)}</p>
            <div className="focused-session-subtitle">{eventsLoading ? 'loading session events…' : `${evidenceEvents.length} bounded event previews`}</div>
            <div className="focused-session-event-list">
              {evidenceEvents.length === 0 ? (
                <div className="focused-session-empty">No status/tool events for this lane.</div>
              ) : evidenceEvents.map(event => (
                <div key={event.id} className="focused-session-event">
                  <span>{displayTime(event.created_at)}</span>
                  <strong>{event.event_type}</strong>
                  <p>{eventPayloadPreview(event)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="focused-session-card">
            <h3>Policy refs</h3>
            <p className="focused-session-subtitle">
              Copy follows the accepted session-owner policy; source channels are metadata, while concrete agent instances or assignment runs own active work.
            </p>
            <div className="focused-session-ref-list">
              <a href="/den-core-api/api/projects/_global/documents/agent-session-boundary-policy" target="_blank" rel="noreferrer">_global/agent-session-boundary-policy</a>
              <a href="/den-core-api/api/projects/den-channels/tasks/1873" target="_blank" rel="noreferrer">den-channels #1873 active-work routing</a>
              <a href="/den-core-api/api/projects/den-hermes-bridge/tasks/1890" target="_blank" rel="noreferrer">den-hermes-bridge #1890 Hermes session behavior</a>
            </div>
          </section>

          <section className="focused-session-card">
            <h3>Active-work routes</h3>
            <div className="focused-session-subtitle">
              {activeRoutesLoading ? 'resolving routes…' : `${activeRoutes.length} route(s), ${activeRouteGroups.size} concrete owner group(s)`}
            </div>
            <div className="focused-session-route-list">
              {activeRoutes.length === 0 ? (
                <div className="focused-session-empty">No active route for this target project. Source-channel messages will remain ordinary channel context.</div>
              ) : activeRoutes.map(route => {
                const key = activeRouteKey(route);
                const selected = selectedActiveRoute ? activeRouteKey(selectedActiveRoute) === key : false;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`focused-session-route ${selected ? 'selected' : ''}`}
                    onClick={() => setSelectedRouteKey(key)}
                    title={`${activeWorkTargetLabel(route)} · ${sourceContextLabel(route, selectedSourceContext)}`}
                  >
                    <strong>{activeWorkTargetLabel(route)}</strong>
                    <span>{activeOwnerLabel(route)}</span>
                    <span>{sourceContextLabel(route, selectedSourceContext)} · actions {route.allowedActions.join(', ') || 'none'}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="focused-session-card">
            <h3>Participants</h3>
            <div className="focused-session-subtitle">{membershipsLoading ? 'loading…' : `${activeAgentMembers.length} active agent(s)`}</div>
            <div className="focused-session-member-list">
              {members.length === 0 ? (
                <div className="focused-session-empty">No gateway membership metadata.</div>
              ) : members.map(member => (
                <button
                  key={member.id}
                  type="button"
                  className={`focused-session-member ${member.memberIdentity === targetMemberIdentity ? 'selected' : ''}`}
                  disabled={member.memberType !== 'agent' || member.membershipStatus !== 'active'}
                  onClick={() => setTargetMemberIdentity(member.memberIdentity)}
                >
                  <strong>{member.memberIdentity}</strong>
                  <span>{member.memberType} · {member.membershipStatus} · {member.wakePolicy}</span>
                  {member.settingsLabel && <span>{member.settingsLabel}</span>}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <form className="focused-session-composer" onSubmit={handleSubmit}>
        <label htmlFor="focused-session-sender">Posting as</label>
        <input
          id="focused-session-sender"
          value={senderIdentity}
          onChange={handleSenderIdentityChange}
          placeholder="your name"
          spellCheck={false}
          autoComplete="nickname"
        />
        <label htmlFor="focused-session-target">Direct agent / owner hint</label>
        <select
          id="focused-session-target"
          value={targetMemberIdentity}
          onChange={event => setTargetMemberIdentity(event.target.value)}
          disabled={activeAgentMembers.length === 0 || !activeChannel || sending}
        >
          <option value="">Use active-work route/source channel</option>
          {activeAgentMembers.map(member => (
            <option key={member.id} value={member.memberIdentity}>@{member.memberIdentity}</option>
          ))}
        </select>
        <input
          className="focused-session-draft"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          disabled={composerDisabled}
          placeholder={identityRequired ? 'Set Posting as before sending' : 'Ask/continue via active owner or type /new with scoped reset'}
          aria-label="Focused active-work message"
        />
        <button type="submit" disabled={composerDisabled || draft.trim().length === 0}>{sending ? 'Sending…' : 'Send'}</button>
        <div className="focused-session-composer-help">{routePreview}</div>
      </form>
    </section>
  );
}

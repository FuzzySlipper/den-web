import { useCallback, useMemo, useRef, useState } from 'react';
import type { Channel, ChannelMessage, DesktopSessionEvent, DesktopSessionSnapshot, GatewayMemberships, ActiveWorkRoutesResponse } from '@den-web/api/types';
import {
  ensureProjectDefaultChannel,
  listChannelMessages,
  listDesktopSessionEvents,
  listDesktopSessionSnapshots,
  listGatewayMemberships,
  listProjectLinkedChannels,
  listActiveWorkRoutes,
} from '@den-web/api/client';
import { preferredProjectChannel } from '@den-web/models/channels/channelRouting';
import {
  activeRouteKey,
  continuationPreview,
  groupRoutesByOwner,
  resetScopeForRoute,
  routeAllows,
} from './sessionPolicy';
import { NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS, isVisibleNormalParticipant } from '../channels/participantVisibility';
import { membershipLookupForChannel } from '../channels/channelMembershipLookup';
import { readStoredSenderIdentity } from '../channels/channelChatStorage';
import { useLiveData } from '@den-web/ui/hooks/useLiveData';
import {
  buildLaneLabel,
  deriveSessionState,
  isCommandOrResultMessage,
  isLiveSession,
  laneKeyForChannel,
  laneKeyForSession,
  sessionActivityAt,
  type FocusedSessionLane,
} from '@den-web/models/sessions/sessionDisplay';
import { SessionLaneToolbar } from './SessionLaneToolbar';
import { SessionTranscript } from './SessionTranscript';
import { SessionContextSidebar } from './SessionContextSidebar';
import { SessionComposer } from './SessionComposer';
import { useFocusedSessionComposerActions } from './useFocusedSessionComposerActions';

const NOISY_EVENT_TYPES = new Set(['snapshot_published', 'snapshot_publish_failed', 'discovered']);

interface Props {
  projectId: string | null;
  spaceName?: string | null;
}

export function FocusedSessionView({ projectId, spaceName }: Props) {
  const [selectedLaneKey, setSelectedLaneKey] = useState('');
  const [selectedRouteKey, setSelectedRouteKey] = useState('');
  const [senderIdentity, setSenderIdentity] = useState(readStoredSenderIdentity);
  const [targetMemberIdentity, setTargetMemberIdentity] = useState('');
  const [draft, setDraft] = useState('');
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
  const { data: channels, loading: channelsLoading, error: channelsError, refresh: refreshChannels } = useLiveData<Channel[]>(fetchChannels, { interval: 15000 });

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
  const { data: snapshots, loading: snapshotsLoading, error: snapshotsError, refresh: refreshSnapshots } = useLiveData<DesktopSessionSnapshot[]>(fetchSnapshots, { interval: 5000 });

  const fetchActiveRoutes = useCallback(
    () => projectId ? listActiveWorkRoutes({ targetProjectId: projectId, includeStale: true, limit: 50 }) : Promise.resolve(null),
    [projectId],
  );
  const { data: activeRoutesResponse, loading: activeRoutesLoading, error: activeRoutesError, refresh: refreshActiveRoutes } = useLiveData<ActiveWorkRoutesResponse | null>(fetchActiveRoutes, { interval: 5000 });
  const activeRoutes = useMemo(() => activeRoutesResponse?.routes ?? [], [activeRoutesResponse]);

  const fetchMessages = useCallback(
    () => activeChannel ? listChannelMessages(activeChannel.id, { limit: 150 }) : Promise.resolve([]),
    [activeChannel],
  );
  const { data: messages, loading: messagesLoading, error: messagesError, refresh: refreshMessages } = useLiveData<ChannelMessage[]>(fetchMessages, { interval: 3000 });

  const sortedMessages = useMemo(() => {
    const visibleMessages = activeChannel
      ? (messages ?? []).filter(message => message.channelId === activeChannel.id)
      : [];
    return [...visibleMessages].sort((left, right) => left.id - right.id);
  }, [activeChannel, messages]);

  const selectedThreadId: number | null = null;

  const fetchMemberships = useCallback(
    () => activeChannel ? listGatewayMemberships({ ...membershipLookupForChannel(activeChannel), ...NORMAL_PARTICIPANT_MEMBERSHIP_OPTIONS }) : Promise.resolve(null),
    [activeChannel],
  );
  const { data: memberships, loading: membershipsLoading, error: membershipsError, refresh: refreshMemberships } = useLiveData<GatewayMemberships | null>(fetchMemberships, { interval: 5000 });

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
  const { data: sessionEvents, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useLiveData<DesktopSessionEvent[]>(fetchEvents, { interval: 4000 });

  const orderedEvents = useMemo(
    () => [...(sessionEvents ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [sessionEvents],
  );
  const evidenceEvents = useMemo(
    () => orderedEvents.filter(event => !NOISY_EVENT_TYPES.has(event.event_type)).slice(0, 12),
    [orderedEvents],
  );

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
  const composerBlocked = !activeChannel || identityRequired || Boolean(channelsError);
  const {
    handleSenderIdentityChange,
    handleSubmit,
    sendError,
    sending,
  } = useFocusedSessionComposerActions({
    draft,
    onDraftChange: setDraft,
    activeChannel,
    normalizedSenderIdentity,
    selectedLane,
    selectedActiveRoute,
    selectedSnapshot,
    selectedTarget,
    activeAgentMembers,
    selectedResetScope,
    selectedSourceContext,
    composerBlocked,
    projectId,
    onSenderIdentityChange: setSenderIdentity,
    refreshMessages,
  });
  const composerDisabled = composerBlocked || sending;
  const topError = sendError ?? channelsError ?? snapshotsError ?? activeRoutesError ?? messagesError ?? membershipsError ?? eventsError;
  const viewState = selectedLane?.state ?? 'queued';

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

  return (
    <section className="focused-session-view" aria-label="Focused active-owner sessions">
      <SessionLaneToolbar
        projectId={projectId}
        viewState={viewState}
        selectedActiveRoute={selectedActiveRoute}
        selectedLane={selectedLane}
        allLanes={allLanes}
        liveSessionLanes={liveSessionLanes}
        recentSessionLanes={recentSessionLanes}
        channelsLoading={channelsLoading}
        snapshotsLoading={snapshotsLoading}
        activeRoutes={activeRoutes}
        activeRoutesLoading={activeRoutesLoading}
        onSelectLane={setSelectedLaneKey}
        onSelectRoute={setSelectedRouteKey}
        onRefresh={refreshAll}
        onSnapToBottom={snapTranscriptToBottom}
      />

      {topError && <div className="focused-session-error">{topError.message}</div>}

      <div className="focused-session-grid">
        <SessionTranscript
          transcriptRef={transcriptRef}
          messagesLoading={messagesLoading}
          totalMessageCount={sortedMessages.length}
          conversationMessages={conversationMessages}
          workflowMessages={workflowMessages}
        />

        <SessionContextSidebar
          projectId={projectId}
          viewState={viewState}
          selectedActiveRoute={selectedActiveRoute}
          selectedSnapshot={selectedSnapshot}
          selectedSourceContext={selectedSourceContext}
          selectedTarget={selectedTarget}
          selectedResetScope={selectedResetScope}
          routePreview={routePreview}
          selectedRouteAllowsReset={selectedRouteAllowsReset}
          orderedEvents={orderedEvents}
          evidenceEvents={evidenceEvents}
          eventsLoading={eventsLoading}
          activeRoutes={activeRoutes}
          activeRoutesLoading={activeRoutesLoading}
          activeRouteGroups={activeRouteGroups}
          members={members}
          activeAgentMembers={activeAgentMembers}
          membershipsLoading={membershipsLoading}
          targetMemberIdentity={targetMemberIdentity}
          onSelectRoute={setSelectedRouteKey}
          onSelectTarget={setTargetMemberIdentity}
        />
      </div>

      <SessionComposer
        onSubmit={handleSubmit}
        senderIdentity={senderIdentity}
        onSenderIdentityChange={handleSenderIdentityChange}
        targetMemberIdentity={targetMemberIdentity}
        onTargetMemberIdentityChange={setTargetMemberIdentity}
        activeAgentMembers={activeAgentMembers}
        activeChannel={activeChannel}
        sending={sending}
        draft={draft}
        onDraftChange={setDraft}
        composerDisabled={composerDisabled}
        identityRequired={identityRequired}
        routePreview={routePreview}
      />
    </section>
  );
}

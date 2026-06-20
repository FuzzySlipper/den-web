import { useCallback, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { ActiveWorkRoute, Channel, DesktopSessionSnapshot, GatewayMember } from '@den-web/api/types';
import { postChannelMessage, postGatewayDirectAgentMessage } from '@den-web/api/client';
import { persistSenderIdentity } from '../channels/channelChatStorage';
import { activeRouteKey, type ResetScope, type SourceContextSelection } from './sessionPolicy';
import type { FocusedSessionLane } from '@den-web/models/sessions/sessionDisplay';

interface UseFocusedSessionComposerActionsOptions {
  draft: string;
  onDraftChange: (draft: string) => void;
  activeChannel: Channel | null;
  normalizedSenderIdentity: string;
  selectedLane: FocusedSessionLane | null;
  selectedActiveRoute: ActiveWorkRoute | null;
  selectedSnapshot: DesktopSessionSnapshot | null;
  selectedTarget: GatewayMember | null;
  activeAgentMembers: GatewayMember[];
  selectedResetScope: ResetScope;
  selectedSourceContext: SourceContextSelection;
  composerBlocked: boolean;
  projectId: string | null;
  onSenderIdentityChange: (value: string) => void;
  refreshMessages: () => void;
}

function buildSessionMessageMetadata({
  activeChannel,
  body,
  projectId,
  selectedActiveRoute,
  selectedLane,
  selectedResetScope,
  selectedSnapshot,
  selectedSourceContext,
  selectedTarget,
}: {
  activeChannel: Channel;
  body: string;
  projectId: string | null;
  selectedActiveRoute: ActiveWorkRoute | null;
  selectedLane: FocusedSessionLane | null;
  selectedResetScope: ResetScope;
  selectedSnapshot: DesktopSessionSnapshot | null;
  selectedSourceContext: SourceContextSelection;
  selectedTarget: GatewayMember | null;
}) {
  return {
    sourceContextKind: selectedSourceContext.kind,
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
}

async function postSessionChannelMessage({
  activeChannel,
  body,
  metadata,
  normalizedSenderIdentity,
  projectId,
  selectedActiveRoute,
  selectedLane,
  selectedSnapshot,
  selectedTarget,
}: {
  activeChannel: Channel;
  body: string;
  metadata: ReturnType<typeof buildSessionMessageMetadata>;
  normalizedSenderIdentity: string;
  projectId: string | null;
  selectedActiveRoute: ActiveWorkRoute | null;
  selectedLane: FocusedSessionLane | null;
  selectedSnapshot: DesktopSessionSnapshot | null;
  selectedTarget: GatewayMember | null;
}) {
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
}

export function useFocusedSessionComposerActions({
  draft,
  onDraftChange,
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
  onSenderIdentityChange,
  refreshMessages,
}: UseFocusedSessionComposerActionsOptions) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);

  const handleSenderIdentityChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onSenderIdentityChange(value);
    persistSenderIdentity(value);
  }, [onSenderIdentityChange]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!activeChannel || !body || !normalizedSenderIdentity || composerBlocked || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const metadata = buildSessionMessageMetadata({
        activeChannel,
        body,
        projectId,
        selectedActiveRoute,
        selectedLane,
        selectedResetScope,
        selectedSnapshot,
        selectedSourceContext,
        selectedTarget,
      });
      const directTargetIdentity = selectedTarget?.memberIdentity ?? selectedActiveRoute?.profileIdentity ?? null;
      const directTarget = directTargetIdentity
        ? activeAgentMembers.find(member => member.memberIdentity === directTargetIdentity) ?? null
        : null;

      await postSessionChannelMessage({
        activeChannel,
        body,
        metadata,
        normalizedSenderIdentity,
        projectId,
        selectedActiveRoute,
        selectedLane,
        selectedSnapshot,
        selectedTarget,
      });

      if (directTarget) {
        await postGatewayDirectAgentMessage({
          channelId: activeChannel.id,
          projectId: projectId ?? undefined,
          memberIdentity: directTarget.memberIdentity,
          senderIdentity: normalizedSenderIdentity,
          body,
          sourceProjectId: projectId ?? null,
          targetProjectId: selectedActiveRoute?.targetProjectId ?? projectId ?? null,
          targetTaskId: selectedActiveRoute?.targetTaskId ?? selectedSnapshot?.task_id ?? null,
          assignmentId: selectedActiveRoute?.assignmentId ?? null,
          workerRunId: selectedActiveRoute?.workerRunId ?? null,
          workerRole: selectedActiveRoute?.workerRole ?? null,
          profileIdentity: selectedActiveRoute?.profileIdentity ?? selectedTarget?.memberIdentity ?? null,
          poolMemberId: selectedActiveRoute?.poolMemberId ?? null,
          agentInstanceId: selectedActiveRoute?.agentInstanceId ?? null,
          sessionOwnerId: selectedActiveRoute?.sessionOwnerId ?? null,
          sessionId: selectedActiveRoute?.sessionId ?? selectedSnapshot?.session_id ?? null,
        });
      }
      onDraftChange('');
      refreshMessages();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [
    activeAgentMembers,
    activeChannel,
    composerBlocked,
    draft,
    normalizedSenderIdentity,
    onDraftChange,
    projectId,
    refreshMessages,
    selectedActiveRoute,
    selectedLane,
    selectedResetScope,
    selectedSnapshot,
    selectedSourceContext,
    selectedTarget,
    sending,
  ]);

  return {
    handleSenderIdentityChange,
    handleSubmit,
    sendError,
    sending,
  };
}

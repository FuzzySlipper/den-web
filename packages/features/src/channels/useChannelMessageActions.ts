import { useCallback, useState, type FormEvent } from 'react';
import type { ChannelMessage } from '@den-web/api/types';
import {
  addChannelReaction,
  postChannelMessage,
  postGatewayDirectAgentMessage,
} from '@den-web/api/client';
import type { ChannelSendMode } from './useComposerHotkeys';
import { directTargetsForComposerBody } from './channelComposerDirectTargets';
import type { useChannelChatData } from './useChannelChatData';

type ChatData = ReturnType<typeof useChannelChatData>;

interface Options {
  activeAgentMembers: ChatData['activeAgentMembers'];
  activeChannel: ChatData['activeChannel'];
  composer: ChatData['composer'];
  normalizedSenderIdentity: string;
  projectId: string | null;
  refreshActivityEvents: () => void;
  refreshMessages: () => void;
  refreshReactions: () => void;
  selectedTarget: ChatData['selectedTarget'];
  sendMode: ChannelSendMode;
  targetMemberIdentity: string;
}

export function useChannelMessageActions({
  activeAgentMembers,
  activeChannel,
  composer,
  normalizedSenderIdentity,
  projectId,
  refreshActivityEvents,
  refreshMessages,
  refreshReactions,
  selectedTarget,
  sendMode,
  targetMemberIdentity,
}: Options) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = composer.draft.trim();
    if (!activeChannel || !body || !normalizedSenderIdentity) return;
    if (sendMode === 'direct' && !selectedTarget) return;

    setSending(true);
    setSendError(null);
    try {
      if (sendMode === 'direct' && selectedTarget) {
        await postGatewayDirectAgentMessage({
          channelId: activeChannel.id,
          projectId: projectId ?? undefined,
          memberIdentity: selectedTarget.memberIdentity,
          senderIdentity: normalizedSenderIdentity,
          body,
        });
      } else if (sendMode === 'channel') {
        await postChannelMessage(activeChannel.id, {
          senderType: 'user',
          senderIdentity: normalizedSenderIdentity,
          messageKind: 'human_text',
          body,
          sourceProjectId: projectId ?? activeChannel.projectId ?? null,
        });
        const mentionedDirectTargets = directTargetsForComposerBody(body, activeAgentMembers);
        await Promise.all(mentionedDirectTargets.map(target => postGatewayDirectAgentMessage({
          channelId: activeChannel.id,
          projectId: projectId ?? undefined,
          memberIdentity: target.memberIdentity,
          senderIdentity: normalizedSenderIdentity,
          body,
        })));
      }
      composer.recordSentMessage(body);
      refreshMessages();
      refreshActivityEvents();
      refreshReactions();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [activeAgentMembers, activeChannel, composer, normalizedSenderIdentity, projectId, refreshActivityEvents, refreshMessages, refreshReactions, selectedTarget, sendMode]);

  const handleReactToMessage = useCallback(async (message: ChannelMessage, reactionKey: string) => {
    const reactorIdentity = normalizedSenderIdentity || targetMemberIdentity;
    if (!reactorIdentity) return setSendError(new Error('Set Posting as before reacting.'));
    setSendError(null);
    try {
      await addChannelReaction(message.id, { reactorType: 'user', reactorIdentity, reactionKey });
      refreshReactions();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [normalizedSenderIdentity, refreshReactions, targetMemberIdentity]);

  const handleClarifyChoice = useCallback(async (channelId: number, messageId: number, replyBody: string) => {
    if (!normalizedSenderIdentity) return setSendError(new Error('Set Posting as before answering a clarify question.'));
    setSending(true);
    setSendError(null);
    try {
      await postChannelMessage(channelId, {
        senderType: 'user',
        senderIdentity: normalizedSenderIdentity,
        messageKind: 'human_text',
        body: replyBody,
        replyToMessageId: messageId,
        sourceProjectId: projectId,
      });
      refreshMessages();
      refreshActivityEvents();
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [normalizedSenderIdentity, projectId, refreshActivityEvents, refreshMessages]);

  return {
    handleClarifyChoice,
    handleReactToMessage,
    handleSubmit,
    sendError,
    sending,
    setSendError,
  };
}

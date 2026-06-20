import type { RefObject, UIEvent } from 'react';
import type { Channel, ChannelActivityEvent, ChannelMessage, ChannelReactionSummary } from '@den-web/api/types';
import { formatTimeAgo } from '@den-web/shared';
import { isSharedProjectChannel, messageProjectAttribution } from '@den-web/models/channels/channelRouting';
import { channelMessagePrimaryBody, directAgentMessageDisplay, deriveAssignmentBadge } from '@den-web/models/channels';
import { messageSender } from '@den-web/models/channels/chatDisplay';
import { deriveWakeProgress } from './channelDeliveryProgress';
import { MessageBody } from './MessageBody';
import { ActivityTimeline } from './ActivityTimeline';
import { DeliveryProgressCards } from './DeliveryProgressCards';
import { ChannelReactions } from './ChannelReactions';

interface Props {
  activeChannel: Channel | null;
  sortedMessages: ChannelMessage[];
  displayedMessages: ChannelMessage[];
  unanchoredActivityEvents: ChannelActivityEvent[];
  deliveryProgressBlocks: Array<{ displayBlockId: string; events: ChannelActivityEvent[] }>;
  reactionsByMessageId: Map<number, ChannelReactionSummary[]>;
  activityEventsByMessageId: Map<number, ChannelActivityEvent[]>;
  messagesLoading: boolean;
  activityLoading: boolean;
  messagesError: Error | null;
  activityError: Error | null;
  disabledReason: string | null;
  isMessageSearchActive: boolean;
  messageSearchQuery: string;
  identityRequired: boolean;
  quickReactions: string[];
  scrollbackRef: RefObject<HTMLDivElement | null>;
  scrollAnchorRef: RefObject<HTMLDivElement | null>;
  onScrollbackScroll: (event: UIEvent<HTMLDivElement>) => void;
  onReactToMessage: (message: ChannelMessage, reactionKey: string) => void;
  onOpenAssignmentTrace?: (assignmentId: string) => void;
  /** Clarify support: when the user picks a choice, send it as a reply. */
  onSendChoice?: (channelId: number, messageId: number, replyBody: string) => void;
}

/** Scrollback region: loading/error/empty states, activity timelines, and the message stream. */
export function ChannelMessageList({
  activeChannel,
  sortedMessages,
  displayedMessages,
  unanchoredActivityEvents,
  deliveryProgressBlocks,
  reactionsByMessageId,
  activityEventsByMessageId,
  messagesLoading,
  activityLoading,
  messagesError,
  activityError,
  disabledReason,
  isMessageSearchActive,
  messageSearchQuery,
  identityRequired,
  quickReactions,
  scrollbackRef,
  scrollAnchorRef,
  onScrollbackScroll,
  onReactToMessage,
  onOpenAssignmentTrace,
  onSendChoice,
}: Props) {
  const channelId = activeChannel?.id;

  return (
    <div className="channel-chat-scrollback" aria-live="polite" ref={scrollbackRef} onScroll={onScrollbackScroll}>
      {disabledReason ? (
        <div className="channel-chat-state channel-chat-state-muted">{disabledReason}</div>
      ) : (messagesLoading || activityLoading) && sortedMessages.length === 0 && unanchoredActivityEvents.length === 0 && deliveryProgressBlocks.length === 0 ? (
        <div className="channel-chat-state">Loading channel messages…</div>
      ) : messagesError || activityError ? (
        <div className="channel-chat-state channel-chat-state-error">{(messagesError ?? activityError)?.message}</div>
      ) : isMessageSearchActive && displayedMessages.length === 0 ? (
        <div className="channel-chat-state channel-chat-state-muted">
          No loaded messages match “{messageSearchQuery.trim()}”. This search filters the {sortedMessages.length} messages currently loaded in the browser, not full channel history.
        </div>
      ) : sortedMessages.length === 0 && unanchoredActivityEvents.length === 0 && deliveryProgressBlocks.length === 0 ? (
        <div className="channel-chat-state channel-chat-state-muted">No channel messages yet. Start the scrollback below.</div>
      ) : (
        <>
          {isMessageSearchActive && (
            <div className="channel-chat-search-status">
              Showing {displayedMessages.length} of {sortedMessages.length} loaded message{sortedMessages.length === 1 ? '' : 's'} for “{messageSearchQuery.trim()}”. Full channel-history search is not available yet.
            </div>
          )}
          {!isMessageSearchActive && <ActivityTimeline events={unanchoredActivityEvents} />}
          {(() => {
            const chronologicalBlocks = isMessageSearchActive ? [] : sortDeliveryBlocksChronologically(deliveryProgressBlocks);
            let nextBlockIndex = 0;
            const takeBlocksBeforeMessage = (message: ChannelMessage) => {
              const messageTime = Date.parse(message.createdAt);
              const blocks = [] as typeof chronologicalBlocks;
              while (nextBlockIndex < chronologicalBlocks.length && blockTimestamp(chronologicalBlocks[nextBlockIndex]) <= messageTime) {
                blocks.push(chronologicalBlocks[nextBlockIndex]);
                nextBlockIndex += 1;
              }
              return blocks;
            };
            const takeRemainingBlocks = () => {
              const blocks = chronologicalBlocks.slice(nextBlockIndex);
              nextBlockIndex = chronologicalBlocks.length;
              return blocks;
            };
            const renderRemainingBlocks = () => {
              const remainingBlocks = takeRemainingBlocks();
              return remainingBlocks.length > 0 ? <DeliveryProgressCards blocks={remainingBlocks} /> : null;
            };

            return (
              <>
          {displayedMessages.map(message => {
            const blocksBeforeMessage = takeBlocksBeforeMessage(message);
            const wakeProgress = deriveWakeProgress(message, sortedMessages);
            const messageReactions = reactionsByMessageId.get(message.id) ?? [];
            const anchoredActivityEvents = activityEventsByMessageId.get(message.id) ?? [];
            const attributedProjectId = messageProjectAttribution(message);
            const messageDisplay = directAgentMessageDisplay(message);
            const primaryBody = channelMessagePrimaryBody(message);
            return (
            <div key={`message-row-${message.id}`}>
            {blocksBeforeMessage.length > 0 && <DeliveryProgressCards blocks={blocksBeforeMessage} />}
            <div key={message.id} className={`channel-chat-message ${isSharedProjectChannel(activeChannel) ? 'channel-chat-message-shared' : ''}`}>
              <span className="message-time">{formatTimeAgo(message.createdAt)}</span>
              <span className={`channel-chat-sender channel-chat-sender-${message.senderType}`}>{messageSender(message)}</span>
              {isSharedProjectChannel(activeChannel) && (
                <span className="channel-chat-project-badge" title="Message project attribution">{attributedProjectId ?? 'unattributed'}</span>
              )}
              <span className="channel-chat-body">
                <MessageBody
                  body={primaryBody}
                  clarifyQuestion={message.senderType === 'agent' ? guessClarifyQuestion(primaryBody) : null}
                  clarifyChoices={message.senderType === 'agent' ? guessClarifyChoices(primaryBody) : null}
                  messageId={message.id}
                  channelId={channelId}
                  onSendChoice={onSendChoice}
                />
                {messageDisplay.deliverySummary && (
                  <span className="channel-chat-delivery-summary" title="Generated delivery summary">
                    {messageDisplay.deliverySummary}
                  </span>
                )}
                <ActivityTimeline events={anchoredActivityEvents} compact />
                {wakeProgress && (
                  <span className={`channel-chat-wake-progress channel-chat-wake-progress-${wakeProgress.state}`}>
                    <strong>{wakeProgress.label}</strong>
                    <span>{wakeProgress.detail}</span>
                  </span>
                )}
                {(() => {
                  const badge = deriveAssignmentBadge(message);
                  if (!badge) return null;
                  return (
                    <span className={`channel-chat-assignment-badge channel-chat-assignment-badge-${badge.label}`}>
                      <span className="trace-assignment-badge-label">{badge.label}</span>
                      <span className="trace-assignment-badge-id" title={badge.assignmentId}>{badge.assignmentId.slice(0, 12)}</span>
                      {onOpenAssignmentTrace && (
                        <button
                          type="button"
                          className="trace-open-transcript-button"
                          onClick={event => {
                            event.stopPropagation();
                            onOpenAssignmentTrace(badge.assignmentId);
                          }}
                          title={`Open assignment trace for ${badge.assignmentId}`}
                        >
                          Open transcript
                        </button>
                      )}
                    </span>
                  );
                })()}
                <ChannelReactions
                  messageId={message.id}
                  reactions={messageReactions}
                  quickReactions={quickReactions}
                  identityRequired={identityRequired}
                  onReact={reactionKey => onReactToMessage(message, reactionKey)}
                />
              </span>
            </div>
            </div>
          );
          })}
          {renderRemainingBlocks()}
              </>
            );
          })()}
        </>
      )}
      <div className="channel-chat-scroll-anchor" ref={scrollAnchorRef} aria-hidden="true" />
    </div>
  );
}

type DeliveryProgressBlock = { displayBlockId: string; events: ChannelActivityEvent[] };

function sortDeliveryBlocksChronologically(blocks: DeliveryProgressBlock[]): DeliveryProgressBlock[] {
  return [...blocks].sort((left, right) => blockTimestamp(left) - blockTimestamp(right) || left.displayBlockId.localeCompare(right.displayBlockId));
}

function blockTimestamp(block: DeliveryProgressBlock): number {
  const firstEvent = block.events[0];
  const timestamp = firstEvent ? Date.parse(firstEvent.createdAt) : Number.POSITIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

// ─── Clarify detection helpers ───────────────────────────────────────────────

function guessClarifyQuestion(body: string): string | null {
  // Only return a question if choices are also present (multi-choice).
  const choices = guessClarifyChoices(body);
  if (!choices || choices.length < 2) return null;
  // Question is the text before the first choice line
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const choicePattern = /^\d+\.\s+/;
  const firstChoiceIdx = lines.findIndex(l => choicePattern.test(l));
  if (firstChoiceIdx < 0) return null;
  return lines.slice(0, firstChoiceIdx).join('\n') || body;
}

function guessClarifyChoices(body: string): string[] | null {
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const choicePattern = /^(\d+)\.\s+(.+)/;
  const choiceIndices: number[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(choicePattern);
    if (match) {
      choiceIndices.unshift(i);
    } else {
      break;
    }
  }

  if (choiceIndices.length < 2) return null;
  return choiceIndices.map(i => {
    const match = lines[i].match(choicePattern);
    return match ? match[2].trim() : lines[i];
  });
}

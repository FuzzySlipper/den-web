import type { ChannelReactionSummary } from '@den-web/api/types';

interface Props {
  messageId: number;
  reactions: ChannelReactionSummary[];
  quickReactions: string[];
  identityRequired: boolean;
  onReact: (reactionKey: string) => void;
}

/** Reaction pills plus quick-react buttons shown under a channel message. */
export function ChannelReactions({ messageId, reactions, quickReactions, identityRequired, onReact }: Props) {
  return (
    <span className="channel-chat-reactions" aria-label={`Reactions for message ${messageId}`}>
      {reactions.map(reaction => (
        <span key={`${reaction.channelMessageId}:${reaction.reactionKey}`} className="channel-chat-reaction-pill" title={reaction.reactors.join(', ')}>
          <span>{reaction.reactionKey}</span>
          <span>{reaction.count}</span>
        </span>
      ))}
      <span className="channel-chat-reaction-actions" aria-label="Quick reactions">
        {quickReactions.map(reactionKey => (
          <button
            key={reactionKey}
            type="button"
            onClick={() => onReact(reactionKey)}
            disabled={identityRequired}
            title={`React ${reactionKey} without creating a wake pulse`}
          >
            {reactionKey}
          </button>
        ))}
      </span>
    </span>
  );
}

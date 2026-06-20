import { parseMessageBodySegments } from '@den-web/models/channels';
import { ClarifyCard, parseClarifyBody } from './ClarifyCard';

interface Props {
  body: string;
  /** When present, this message is an agent clarify prompt with choices. */
  clarifyQuestion?: string | null;
  clarifyChoices?: string[] | null;
  messageId?: number;
  channelId?: number;
  senderIdentity?: string;
  onSendChoice?: (channelId: number, messageId: number, replyBody: string) => void;
}

/** Renders a channel message body, expanding collapsible <details> segments
 *  and detecting clarify prompts for richer interactive rendering. */
export function MessageBody({
  body,
  clarifyQuestion,
  clarifyChoices,
  messageId,
  channelId,
  senderIdentity,
  onSendChoice,
}: Props) {
  // If this message has clarify metadata or detectably is a clarify prompt,
  // render the interactive card instead of plain markdown.
  const clarify = clarifyQuestion != null
    ? { question: clarifyQuestion, choices: clarifyChoices ?? null }
    : parseClarifyBody(body);

  if (clarify && messageId && channelId && onSendChoice) {
    return (
      <ClarifyCard
        question={clarify.question}
        choices={clarify.choices}
        messageId={messageId}
        channelId={channelId}
        senderIdentity={senderIdentity ?? ''}
        onSendChoice={onSendChoice}
      />
    );
  }

  return (
    <>
      {parseMessageBodySegments(body).map((segment, index) => segment.type === 'details' ? (
        <details key={`details-${index}`} className="channel-chat-details-block">
          <summary>{segment.summary}</summary>
          <div>{segment.body}</div>
        </details>
      ) : (
        <span key={`text-${index}`}>{segment.text}</span>
      ))}
    </>
  );
}

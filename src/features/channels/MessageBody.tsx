import { parseMessageBodySegments } from './channelChatRenderModel';

/** Renders a channel message body, expanding collapsible <details> segments. */
export function MessageBody({ body }: { body: string }) {
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

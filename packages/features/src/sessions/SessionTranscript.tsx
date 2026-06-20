import type { RefObject } from 'react';
import type { ChannelMessage } from '@den-web/api/types';
import { messageSender } from '@den-web/models/channels/chatDisplay';
import { directMessageEvidence } from '../channels/channelDirectMessages';
import { displayTime, messageEvidenceLink } from '@den-web/models/sessions/sessionDisplay';

interface Props {
  transcriptRef: RefObject<HTMLElement | null>;
  messagesLoading: boolean;
  totalMessageCount: number;
  conversationMessages: ChannelMessage[];
  workflowMessages: ChannelMessage[];
}

/** Connected transcript: human conversation and command/result workflow evidence. */
export function SessionTranscript({
  transcriptRef,
  messagesLoading,
  totalMessageCount,
  conversationMessages,
  workflowMessages,
}: Props) {
  return (
    <main ref={transcriptRef} className="focused-session-transcript" aria-label="Connected transcript">
      <div className="focused-session-section-header">
        <h3>Connected transcript</h3>
        <span>{messagesLoading ? 'loading…' : `${totalMessageCount} channel messages`}</span>
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
  );
}

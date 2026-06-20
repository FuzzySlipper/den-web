import { useState } from 'react';

interface Props {
  question: string;
  choices: string[] | null;
  messageId: number;
  channelId: number;
  senderIdentity: string;
  onSendChoice: (channelId: number, messageId: number, replyBody: string) => void;
}

export function ClarifyCard({ question, choices, messageId, channelId, onSendChoice }: Props) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleChoiceClick = async (choice: string) => {
    if (sending) return;
    setSending(true);
    setSelectedChoice(choice);
    try {
      onSendChoice(channelId, messageId, choice);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="channel-chat-clarify-card" role="group" aria-label="Clarify question">
      <div className="channel-chat-clarify-header">
        <span className="channel-chat-clarify-icon" aria-hidden="true">❓</span>
        <span className="channel-chat-clarify-label">Clarify</span>
      </div>
      <div className="channel-chat-clarify-question">{question}</div>
      {choices && choices.length > 0 && (
        <div className="channel-chat-clarify-choices" role="group" aria-label="Answer choices">
          {choices.map((choice, index) => (
            <button
              key={index}
              type="button"
              className={`channel-chat-clarify-choice ${selectedChoice === choice ? 'channel-chat-clarify-choice-selected' : ''}`}
              onClick={() => handleChoiceClick(choice)}
              disabled={selectedChoice !== null}
              aria-label={`Choose: ${choice}`}
            >
              <span className="channel-chat-clarify-choice-number">{index + 1}</span>
              <span className="channel-chat-clarify-choice-label">{choice}</span>
              {selectedChoice === choice && (
                <span className="channel-chat-clarify-choice-sent" aria-label="Sent">✓</span>
              )}
            </button>
          ))}
          <div className="channel-chat-clarify-hint">
            Or type your answer in the composer below
          </div>
        </div>
      )}
    </div>
  );
}

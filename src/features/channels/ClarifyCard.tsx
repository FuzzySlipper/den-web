import { useState } from 'react';

interface Props {
  question: string;
  choices: string[] | null;
  messageId: number;
  channelId: number;
  senderIdentity: string;
  onSendChoice: (channelId: number, messageId: number, replyBody: string) => void;
}

/** Extracts question + numbered choices from a clarify prompt message body. */
export function parseClarifyBody(body: string | null | undefined): { question: string; choices: string[] | null } | null {
  if (!body || !body.trim()) return null;

  const lines = body.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return null;

  // Scan from the end for numbered choice lines: `1. some text`
  const choicePattern = /^(\d+)\.\s+(.+)/;
  const choiceLines: number[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(choicePattern);
    if (match) {
      choiceLines.unshift(i);
    } else {
      break; // Stop at first non-choice line from the bottom
    }
  }

  // Require at least 2 choices to be confident it's a clarify prompt
  if (choiceLines.length >= 2) {
    const choices = choiceLines.map(i => {
      const match = lines[i].match(choicePattern);
      return match ? match[2].trim() : lines[i];
    });
    // Everything before the first choice line is the question
    const questionLines = lines.slice(0, choiceLines[0]).filter(line => line.length > 0);
    const question = questionLines.join('\n');
    return { question: question || body, choices };
  }

  // Single choice is ambiguous (could be a numbered step), only detect multi-choice
  return null;
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

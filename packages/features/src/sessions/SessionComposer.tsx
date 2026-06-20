import type { ChangeEvent, FormEvent } from 'react';
import type { Channel, GatewayMember } from '@den-web/api/types';

interface Props {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  senderIdentity: string;
  onSenderIdentityChange: (event: ChangeEvent<HTMLInputElement>) => void;
  targetMemberIdentity: string;
  onTargetMemberIdentityChange: (identity: string) => void;
  activeAgentMembers: GatewayMember[];
  activeChannel: Channel | null;
  sending: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  composerDisabled: boolean;
  identityRequired: boolean;
  routePreview: string;
}

/** Focused-session composer: posting identity, direct-agent/owner hint, draft, and route preview. */
export function SessionComposer({
  onSubmit,
  senderIdentity,
  onSenderIdentityChange,
  targetMemberIdentity,
  onTargetMemberIdentityChange,
  activeAgentMembers,
  activeChannel,
  sending,
  draft,
  onDraftChange,
  composerDisabled,
  identityRequired,
  routePreview,
}: Props) {
  return (
    <form className="focused-session-composer" onSubmit={onSubmit}>
      <label htmlFor="focused-session-sender">Posting as</label>
      <input
        id="focused-session-sender"
        value={senderIdentity}
        onChange={onSenderIdentityChange}
        placeholder="your name"
        spellCheck={false}
        autoComplete="nickname"
      />
      <label htmlFor="focused-session-target">Direct agent / owner hint</label>
      <select
        id="focused-session-target"
        value={targetMemberIdentity}
        onChange={event => onTargetMemberIdentityChange(event.target.value)}
        disabled={activeAgentMembers.length === 0 || !activeChannel || sending}
      >
        <option value="">Use active-work route/source channel</option>
        {activeAgentMembers.map(member => (
          <option key={member.id} value={member.memberIdentity}>@{member.memberIdentity}</option>
        ))}
      </select>
      <input
        className="focused-session-draft"
        value={draft}
        onChange={event => onDraftChange(event.target.value)}
        disabled={composerDisabled}
        placeholder={identityRequired ? 'Set Posting as before sending' : 'Ask/continue via active owner or type /new with scoped reset'}
        aria-label="Focused active-work message"
      />
      <button type="submit" disabled={composerDisabled || draft.trim().length === 0}>{sending ? 'Sending…' : 'Send'}</button>
      <div className="focused-session-composer-help">{routePreview}</div>
    </form>
  );
}

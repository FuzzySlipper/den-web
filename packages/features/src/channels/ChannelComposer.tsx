import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import type { Channel, GatewayMember } from '@den-web/api/types';
import type { ChannelSendMode, ComposerHotkeyBindings } from './useComposerHotkeys';
import type { SlashCommand } from './channelSlashCommands';
import type { MentionQuery, MentionSuggestion } from '@den-web/models/channels';

interface Props {
  sendMode: ChannelSendMode;
  onSendModeChange: (mode: ChannelSendMode) => void;
  bindings: ComposerHotkeyBindings;
  targetMemberIdentity: string;
  onTargetMemberIdentityChange: (identity: string) => void;
  activeAgentMembers: GatewayMember[];
  activeChannel: Channel | null;
  sending: boolean;
  disabledReason: string | null;
  identityRequired: boolean;
  isComposerDisabled: boolean;
  draft: string;
  composerPlaceholder: string;
  onDraftChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onComposerHotkey: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  slashCommandSuggestions: SlashCommand[];
  slashActiveIndex: number;
  onSelectSlashCommand: (command: string) => void;
  showSlashHelp: boolean;
  slashHelpLines: string[];
  mentionQuery: MentionQuery | null;
  mentionSuggestions: MentionSuggestion[];
  mentionActiveIndex: number;
  onInsertMention: (identity: string) => void;
}

/** Channel message composer: send-mode/target controls, textarea, slash/mention menus, send button. */
export function ChannelComposer({
  sendMode,
  onSendModeChange,
  bindings,
  targetMemberIdentity,
  onTargetMemberIdentityChange,
  activeAgentMembers,
  activeChannel,
  sending,
  disabledReason,
  identityRequired,
  isComposerDisabled,
  draft,
  composerPlaceholder,
  onDraftChange,
  onComposerHotkey,
  onComposerKeyDown,
  onSubmit,
  slashCommandSuggestions,
  slashActiveIndex,
  onSelectSlashCommand,
  showSlashHelp,
  slashHelpLines,
  mentionQuery,
  mentionSuggestions,
  mentionActiveIndex,
  onInsertMention,
}: Props) {
  return (
    <form className="channel-chat-composer" onSubmit={onSubmit}>
      <select
        className="channel-chat-send-mode"
        value={sendMode}
        onChange={event => onSendModeChange(event.target.value as ChannelSendMode)}
        disabled={!activeChannel || sending || Boolean(disabledReason) || identityRequired}
        aria-label="Send mode"
        title="Choose whether to post to the whole channel or directly wake one agent."
      >
        <option value="channel">Channel</option>
        <option value="direct">Direct agent</option>
      </select>
      <span className="channel-chat-hint">{bindings.cycleModeKey}</span>
      <select
        value={targetMemberIdentity}
        onChange={event => onTargetMemberIdentityChange(event.target.value)}
        disabled={sendMode === 'channel' || activeAgentMembers.length === 0 || !activeChannel || sending || Boolean(disabledReason) || identityRequired}
        aria-label="Direct agent target"
      >
        {activeAgentMembers.length === 0 ? (
          <option value="">No active agents</option>
        ) : activeAgentMembers.map(member => (
          <option key={member.id} value={member.memberIdentity}>@{member.memberIdentity}</option>
        ))}
      </select>
      {sendMode === 'direct' && activeAgentMembers.length > 1 && (
        <span className="channel-chat-hint">{bindings.cycleTargetKey}</span>
      )}
      <textarea
        value={draft}
        onChange={onDraftChange}
        onKeyDown={event => {
          onComposerHotkey(event);
          if (!event.defaultPrevented) {
            onComposerKeyDown(event);
          }
        }}
        placeholder={composerPlaceholder}
        disabled={isComposerDisabled}
        aria-label="Channel message"
        rows={2}
        className="channel-chat-composer-textarea"
      />
      {slashCommandSuggestions.length > 0 && (
        <div className="channel-chat-slash-menu" role="listbox" aria-label="Slash command suggestions">
          {slashCommandSuggestions.map((cmd, index) => (
            <button
              key={cmd.command}
              type="button"
              className={`channel-chat-slash-option ${index === slashActiveIndex ? 'active' : ''}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onSelectSlashCommand(cmd.command)}
              role="option"
              aria-selected={index === slashActiveIndex}
            >
              <span className="channel-chat-slash-command">{cmd.command}</span>
              <span className="channel-chat-slash-description">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}
      {showSlashHelp && (
        <div className="channel-chat-slash-help" aria-label="Slash command help">
          <strong>Slash command help</strong>
          <span>These are local composer shortcuts; they do not call a backend slash-command API.</span>
          <ul>
            {slashHelpLines.map(line => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}
      {mentionQuery && (
        <div className="channel-chat-mention-menu" role="listbox" aria-label="Mention suggestions">
          {mentionSuggestions.length === 0 ? (
            <div className="channel-chat-mention-empty">No active channel members match @{mentionQuery.query}</div>
          ) : mentionSuggestions.map((suggestion, index) => (
            <button
              key={suggestion.identity}
              type="button"
              className={`channel-chat-mention-option ${index === mentionActiveIndex ? 'active' : ''}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onInsertMention(suggestion.identity)}
              role="option"
              aria-selected={index === mentionActiveIndex}
            >
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
      <button type="submit" disabled={isComposerDisabled || draft.trim().length === 0}>
        {sending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

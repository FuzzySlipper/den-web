import type { ChangeEvent } from 'react';
import type { Channel } from '../../api/types';
import { channelLabel, channelOptionLabel } from './channelChatDisplay';
import type { ChannelStreamStatus } from './channelEventStream';
import type { ChannelChatPanelSize } from './ChannelChatPanel';

const PANEL_SIZE_OPTIONS: Array<{ value: ChannelChatPanelSize; label: string }> = [
  { value: 'small', label: '25%' },
  { value: 'medium', label: '50%' },
  { value: 'large', label: '80%' },
];

/** Operator-visible live-stream status pill (#2147). `idle` shows nothing. */
const STREAM_PILL: Record<ChannelStreamStatus, { label: string; title: string } | null> = {
  idle: null,
  connecting: { label: 'connecting…', title: 'Connecting to the live channel stream' },
  open: { label: 'live', title: 'Live updates via the channel event stream' },
  fallback: { label: 'polling', title: 'Live stream unavailable — falling back to polling' },
};

interface Props {
  activeChannel: Channel | null;
  projectId: string | null;
  channelStatus: string;
  streamStatus: ChannelStreamStatus;
  panelSize: ChannelChatPanelSize;
  onPanelSizeChange: (size: ChannelChatPanelSize) => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onOpenPreferences: () => void;
  senderIdentity: string;
  onSenderIdentityChange: (event: ChangeEvent<HTMLInputElement>) => void;
  availableChannels: Channel[];
  onSelectChannel: (channelId: number) => void;
  activeChannelLinkedProjectIds: string[];
  projectAttributionFilter: string;
  onProjectAttributionFilterChange: (value: string) => void;
  messageSearchQuery: string;
  onMessageSearchQueryChange: (value: string) => void;
  onRefresh: () => void;
}

/** Channel chat header: title, panel sizing, identity, channel/project selectors, search, refresh. */
export function ChannelChatHeader({
  activeChannel,
  projectId,
  channelStatus,
  streamStatus,
  panelSize,
  onPanelSizeChange,
  autoScroll,
  onAutoScrollChange,
  onOpenPreferences,
  senderIdentity,
  onSenderIdentityChange,
  availableChannels,
  onSelectChannel,
  activeChannelLinkedProjectIds,
  projectAttributionFilter,
  onProjectAttributionFilterChange,
  messageSearchQuery,
  onMessageSearchQueryChange,
  onRefresh,
}: Props) {
  return (
    <div className="channel-chat-header">
      <div className="channel-chat-title">
        <span className="channel-chat-kicker">Channel</span>
        <strong>{channelLabel(activeChannel, projectId)}</strong>
        {activeChannel?.id != null && (
          <span className="channel-chat-id" title="Channel ID">
            ID: <code>{activeChannel.id}</code>
          </span>
        )}
        {STREAM_PILL[streamStatus] && (
          <span
            className={`channel-chat-stream-pill channel-chat-stream-${streamStatus}`}
            title={STREAM_PILL[streamStatus]!.title}
          >
            {STREAM_PILL[streamStatus]!.label}
          </span>
        )}
        <span>{channelStatus}</span>
      </div>
      <div className="channel-chat-quick-controls" aria-label="Channel display controls">
        <div className="channel-chat-size-controls" role="group" aria-label="Channel panel size">
          {PANEL_SIZE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`channel-chat-size-button ${panelSize === option.value ? 'active' : ''}`}
              aria-pressed={panelSize === option.value}
              onClick={() => onPanelSizeChange(option.value)}
              title={`Set channel panel size to ${option.label.toLowerCase()}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="channel-chat-auto-scroll">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={event => onAutoScrollChange(event.target.checked)}
          />
          <span>Auto-scroll</span>
        </label>
        <button
          type="button"
          className="preferences-gear"
          onClick={onOpenPreferences}
          title="Open preferences"
          aria-label="Open preferences"
        >
          Options ⚙
        </button>
      </div>
      <label className="channel-chat-identity-label" htmlFor="channel-chat-sender-identity">Posting as</label>
      <input
        id="channel-chat-sender-identity"
        className="channel-chat-identity"
        value={senderIdentity}
        onChange={onSenderIdentityChange}
        placeholder="your name"
        spellCheck={false}
        autoComplete="nickname"
      />
      <label className="channel-chat-selector-label" htmlFor="channel-chat-selector">Channel</label>
      <select
        id="channel-chat-selector"
        className="channel-chat-selector"
        value={activeChannel?.id ?? ''}
        disabled={availableChannels.length === 0}
        onChange={event => onSelectChannel(Number(event.target.value))}
        title="Select a project/space channel."
      >
        {availableChannels.length === 0 ? (
          <option value="">{channelLabel(activeChannel, projectId)}</option>
        ) : availableChannels.map(candidate => (
          <option key={candidate.id} value={candidate.id}>{channelOptionLabel(candidate, projectId)}</option>
        ))}
      </select>
      {activeChannelLinkedProjectIds.length > 1 && (
        <>
          <label className="channel-chat-selector-label" htmlFor="channel-chat-project-filter">Project</label>
          <select
            id="channel-chat-project-filter"
            className="channel-chat-selector"
            value={projectAttributionFilter}
            onChange={event => onProjectAttributionFilterChange(event.target.value)}
            title="Filter the shared channel by project attribution."
          >
            <option value="">All linked projects</option>
            {activeChannelLinkedProjectIds.map(linkedProjectId => (
              <option key={linkedProjectId} value={linkedProjectId}>{linkedProjectId}</option>
            ))}
          </select>
        </>
      )}
      <label className="channel-chat-selector-label" htmlFor="channel-chat-message-search">Search</label>
      <input
        id="channel-chat-message-search"
        className="channel-chat-message-search"
        type="search"
        value={messageSearchQuery}
        onChange={event => onMessageSearchQueryChange(event.target.value)}
        placeholder="Filter loaded messages"
        title="Client-side filter over the currently loaded channel scrollback only."
        aria-label="Filter loaded channel messages"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="channel-chat-refresh"
        onClick={onRefresh}
      >
        Refresh
      </button>
    </div>
  );
}

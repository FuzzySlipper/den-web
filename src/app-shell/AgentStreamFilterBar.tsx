import type { StreamFilters } from './useStreamFilters';

interface Props {
  filters: StreamFilters;
  isAggregateSpace: boolean;
  streamEventOptions: string[];
}

/** Toolbar of filter controls shown above the agent-stream feed. */
export function AgentStreamFilterBar({ filters, isAggregateSpace, streamEventOptions }: Props) {
  return (
    <div className="feed-toolbar agent-stream-toolbar">
      <label className="panel-filter-label" htmlFor="stream-kind-filter">Kind</label>
      <select
        id="stream-kind-filter"
        className="panel-filter-select"
        value={filters.streamKindFilter}
        onChange={e => filters.setStreamKindFilter(e.target.value as 'ops' | 'message')}
      >
        <option value="ops">Ops</option>
        <option value="message">Messages</option>
      </select>

      <label className="panel-filter-label" htmlFor="stream-event-filter">Event</label>
      <select
        id="stream-event-filter"
        className="panel-filter-select"
        value={filters.streamEventFilter}
        onChange={e => filters.setStreamEventFilter(e.target.value)}
      >
        <option value="">All</option>
        {streamEventOptions.map(eventType => (
          <option key={eventType} value={eventType}>{eventType}</option>
        ))}
      </select>

      {isAggregateSpace && (
        <input
          className="feed-text-filter"
          value={filters.streamProjectFilter}
          onChange={e => filters.setStreamProjectFilter(e.target.value)}
          placeholder="Space"
        />
      )}

      <input
        className="feed-text-filter"
        value={filters.streamSenderFilter}
        onChange={e => filters.setStreamSenderFilter(e.target.value)}
        placeholder="Sender"
      />

      <input
        className="feed-text-filter"
        value={filters.streamRecipientFilter}
        onChange={e => filters.setStreamRecipientFilter(e.target.value)}
        placeholder="Recipient"
      />

      <input
        className="feed-text-filter feed-text-filter-short"
        value={filters.streamTaskFilter}
        onChange={e => filters.setStreamTaskFilter(e.target.value)}
        placeholder="Task #"
      />

      <label
        className="thought-raw-toggle"
        title="Show verbose subagent_work_* audit events in the normal stream feed"
      >
        <input
          type="checkbox"
          checked={filters.showRawSubagentWorkEvents}
          onChange={e => filters.setShowRawSubagentWorkEvents(e.target.checked)}
        />
        Raw sub-agent work
      </label>
    </div>
  );
}

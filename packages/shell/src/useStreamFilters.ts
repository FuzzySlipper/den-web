import { useMemo, useState } from 'react';

export type StreamKindFilter = 'ops' | 'message';

export interface StreamFilters {
  streamKindFilter: StreamKindFilter;
  setStreamKindFilter: (value: StreamKindFilter) => void;
  streamEventFilter: string;
  setStreamEventFilter: (value: string) => void;
  streamProjectFilter: string;
  setStreamProjectFilter: (value: string) => void;
  streamSenderFilter: string;
  setStreamSenderFilter: (value: string) => void;
  streamRecipientFilter: string;
  setStreamRecipientFilter: (value: string) => void;
  streamTaskFilter: string;
  setStreamTaskFilter: (value: string) => void;
  showRawSubagentWorkEvents: boolean;
  setShowRawSubagentWorkEvents: (value: boolean) => void;
  /** Numeric task id parsed from {@link streamTaskFilter}, or undefined when not a plain number. */
  parsedStreamTaskId: number | undefined;
}

/** State for the agent-stream feed toolbar filters. */
export function useStreamFilters(): StreamFilters {
  const [streamKindFilter, setStreamKindFilter] = useState<StreamKindFilter>('ops');
  const [streamEventFilter, setStreamEventFilter] = useState('');
  const [streamProjectFilter, setStreamProjectFilter] = useState('');
  const [streamSenderFilter, setStreamSenderFilter] = useState('');
  const [streamRecipientFilter, setStreamRecipientFilter] = useState('');
  const [streamTaskFilter, setStreamTaskFilter] = useState('');
  const [showRawSubagentWorkEvents, setShowRawSubagentWorkEvents] = useState(false);

  const parsedStreamTaskId = useMemo(() => {
    const trimmed = streamTaskFilter.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  }, [streamTaskFilter]);

  return {
    streamKindFilter,
    setStreamKindFilter,
    streamEventFilter,
    setStreamEventFilter,
    streamProjectFilter,
    setStreamProjectFilter,
    streamSenderFilter,
    setStreamSenderFilter,
    streamRecipientFilter,
    setStreamRecipientFilter,
    streamTaskFilter,
    setStreamTaskFilter,
    showRawSubagentWorkEvents,
    setShowRawSubagentWorkEvents,
    parsedStreamTaskId,
  };
}

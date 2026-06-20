
import type { SubagentRunWorkEvent } from '@den-web/api/types';
import { formatSubagentWorkEventType } from './subagentRunsDisplay';

export type SubagentWorkCardKind = 'assistant' | 'reasoning' | 'tool' | 'lifecycle';

export type SubagentWorkCardStatus = 'requested' | 'running' | 'complete' | 'error' | 'info';

export interface SubagentWorkCard {
  id: string;
  kind: SubagentWorkCardKind;
  status: SubagentWorkCardStatus;
  title: string;
  subtitle: string | null;
  timestamp: number | null;
  startedAt: number | null;
  endedAt: number | null;
  toolCallId: string | null;
  toolName: string | null;
  argsPreview: string | null;
  resultPreview: string | null;
  textPreview: string | null;
  warning: string | null;
  eventCount: number;
  events: SubagentRunWorkEvent[];
}

export interface SubagentWorkActivitySummary {
  cardCount: number;
  toolCallCount: number;
  errorCount: number;
  assistantMessageCount: number;
  reasoningCount: number;
  lifecycleCount: number;
  latestAt: number | null;
  currentToolName: string | null;
  lastToolName: string | null;
  lastAssistantPreview: string | null;
  statusText: string;
}

type WorkEventSummaryHandler = (event: SubagentRunWorkEvent) => string;

const summarizeReasoningEvent: WorkEventSummaryHandler = event => {
  if (event.reasoning_summary_preview) return `reasoning summary: ${event.reasoning_summary_preview}`;
  if (event.reasoning_redacted) {
    return `reasoning ${event.update_kind ?? event.reasoning_kind ?? 'activity'} (${event.reasoning_chars ?? 0} chars, redacted)`;
  }
  return event.text_preview ? `reasoning: ${event.text_preview}` : `reasoning ${event.update_kind ?? event.reasoning_kind ?? 'activity'}`;
};

const summarizeMessageEnd: WorkEventSummaryHandler = event => {
  if (!event.tool_calls?.length) {
    return event.text_preview ? `assistant message: ${event.text_preview}` : 'assistant message ended';
  }
  const names = event.tool_calls.map(tool => tool.name).filter(Boolean).join(', ');
  return `assistant requested tool${event.tool_calls.length > 1 ? 's' : ''}${names ? `: ${names}` : ''}`;
};

const workEventSummaryHandlers: Record<string, WorkEventSummaryHandler> = {
  'subagent.work_session': event => `session${event.cwd ? ` in ${event.cwd}` : ''}`,
  'subagent.work_agent_start': () => 'agent process initialized',
  'subagent.work_turn_start': () => 'turn started',
  'subagent.work_turn_end': event => event.text_preview ? `turn finished: ${event.text_preview}` : 'turn finished',
  'subagent.work_message_start': () => 'assistant message started',
  'subagent.work_message_update': event => event.text_preview
    ? `assistant update: ${event.text_preview}`
    : `assistant update${event.update_kind ? ` (${event.update_kind})` : ''}`,
  'subagent.work_message_end': summarizeMessageEnd,
  'subagent.work_reasoning_start': summarizeReasoningEvent,
  'subagent.work_reasoning_update': summarizeReasoningEvent,
  'subagent.work_reasoning_end': summarizeReasoningEvent,
  'subagent.work_tool_start': event => `tool started: ${event.tool_name ?? 'unknown'}${event.args_preview ? ` ${event.args_preview}` : ''}`,
  'subagent.work_tool_update': event => `tool update: ${event.tool_name ?? 'unknown'}${event.result_preview ? ` ${event.result_preview}` : ''}`,
  'subagent.work_tool_end': event => `tool ${event.is_error ? 'errored' : 'finished'}: ${event.tool_name ?? 'unknown'}${event.result_preview ? ` ${event.result_preview}` : ''}`,
  'subagent.work_bash_execution': event => `bash ${event.is_error ? 'failed' : 'finished'}${event.args_preview ? `: ${event.args_preview}` : ''}`,
  'subagent.work_compaction': event => event.text_preview ? `compaction: ${event.text_preview}` : 'session compacted',
  'subagent.work_branch_summary': event => event.text_preview ? `branch summary: ${event.text_preview}` : 'branch summary',
  'subagent.work_custom': event => `custom event${event.custom_type ? `: ${event.custom_type}` : ''}`,
  'subagent.work_custom_message': event => event.text_preview ? `custom message: ${event.text_preview}` : 'custom message',
};

export function summarizeSubagentWorkEvent(event: SubagentRunWorkEvent): string {
  return workEventSummaryHandlers[event.type]?.(event) ?? event.type.replace(/[_.]/g, ' ');
}

function asFiniteTimestamp(ts: number | null | undefined): number | null {
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : null;
}

function preview(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

function toolCardKey(event: SubagentRunWorkEvent, index: number): string {
  if (event.tool_call_id) return `tool:${event.tool_call_id}`;
  return `tool:${event.tool_name ?? 'unknown'}:${event.ts ?? 'no-ts'}:${index}`;
}

function detectToolWarning(toolName: string | null | undefined, argsPreview: string | null | undefined): string | null {
  const args = argsPreview?.toLowerCase() ?? '';
  if (!args) return null;
  const shellLike = !toolName || ['bash', 'shell', 'terminal'].includes(toolName.toLowerCase());
  if (shellLike && /find\s+\//.test(args)) return 'broad filesystem search';
  if (shellLike && /grep\s+(-[^\s]*r[^\s]*|--recursive)\s+\//.test(args)) return 'broad recursive search';
  if (shellLike && /rm\s+(-[^\s]*r[^\s]*f|-[^\s]*f[^\s]*r)\s+\//.test(args)) return 'dangerous root delete command';
  if (shellLike && /sudo\s+/.test(args)) return 'privileged shell command';
  return null;
}

function createToolCard(event: SubagentRunWorkEvent, index: number): SubagentWorkCard {
  const ts = asFiniteTimestamp(event.ts);
  const toolName = event.tool_name ?? null;
  const args = preview(event.args_preview);
  return {
    id: toolCardKey(event, index),
    kind: 'tool',
    status: 'requested',
    title: toolName ?? 'tool',
    subtitle: null,
    timestamp: ts,
    startedAt: null,
    endedAt: null,
    toolCallId: event.tool_call_id ?? null,
    toolName,
    argsPreview: args,
    resultPreview: preview(event.result_preview),
    textPreview: null,
    warning: detectToolWarning(toolName, args),
    eventCount: 0,
    events: [],
  };
}

function touchToolCard(card: SubagentWorkCard, event: SubagentRunWorkEvent): void {
  const ts = asFiniteTimestamp(event.ts);
  const args = preview(event.args_preview);
  const result = preview(event.result_preview);
  card.events.push(event);
  card.eventCount = card.events.length;
  card.timestamp = ts ?? card.timestamp;
  card.toolName = event.tool_name ?? card.toolName;
  card.toolCallId = event.tool_call_id ?? card.toolCallId;
  card.title = card.toolName ?? card.title;
  card.argsPreview = args ?? card.argsPreview;
  card.resultPreview = result ?? card.resultPreview;
  card.warning = card.warning ?? detectToolWarning(card.toolName, card.argsPreview);

  if (event.type === 'subagent.work_tool_start') {
    card.status = 'running';
    card.startedAt = ts ?? card.startedAt;
  } else if (event.type === 'subagent.work_tool_update') {
    if (card.status === 'requested') card.status = 'running';
  } else if (event.type === 'subagent.work_tool_end' || event.type === 'subagent.work_bash_execution') {
    card.status = event.is_error ? 'error' : 'complete';
    card.endedAt = ts ?? card.endedAt;
    if (card.startedAt == null) card.startedAt = card.timestamp;
  }
}

function createCardFromEvent(event: SubagentRunWorkEvent, index: number, kind: SubagentWorkCardKind, title: string): SubagentWorkCard {
  const ts = asFiniteTimestamp(event.ts);
  const text = preview(event.text_preview) ?? (kind === 'reasoning' ? summarizeSubagentWorkEvent(event) : null);
  return {
    id: `${kind}:${event.type}:${ts ?? 'no-ts'}:${index}`,
    kind,
    status: event.is_error ? 'error' : kind === 'assistant' ? 'complete' : 'info',
    title,
    subtitle: null,
    timestamp: ts,
    startedAt: ts,
    endedAt: ts,
    toolCallId: null,
    toolName: event.tool_name ?? null,
    argsPreview: preview(event.args_preview),
    resultPreview: preview(event.result_preview),
    textPreview: text,
    warning: null,
    eventCount: 1,
    events: [event],
  };
}

function isToolEvent(event: SubagentRunWorkEvent): boolean {
  return event.type === 'subagent.work_tool_start'
    || event.type === 'subagent.work_tool_update'
    || event.type === 'subagent.work_tool_end'
    || event.type === 'subagent.work_bash_execution';
}

function hasToolCalls(event: SubagentRunWorkEvent): boolean {
  return Array.isArray(event.tool_calls) && event.tool_calls.length > 0;
}

function isReasoningEvent(event: SubagentRunWorkEvent): boolean {
  return event.type === 'subagent.work_reasoning_start'
    || event.type === 'subagent.work_reasoning_update'
    || event.type === 'subagent.work_reasoning_end';
}

function isAssistantTextEvent(event: SubagentRunWorkEvent): boolean {
  if (event.role && event.role !== 'assistant') return false;
  if (!preview(event.text_preview)) return false;
  if (hasToolCalls(event)) return false;
  return event.type === 'subagent.work_message_update'
    || event.type === 'subagent.work_message_end'
    || event.type === 'subagent.work_turn_end';
}

function lifecycleTitle(type: string): string {
  switch (type) {
    case 'subagent.work_session':
      return 'Session created';
    case 'subagent.work_agent_start':
      return 'Agent initialized';
    case 'subagent.work_turn_start':
      return 'Turn started';
    case 'subagent.work_turn_end':
      return 'Turn finished';
    case 'subagent.work_message_start':
      return 'Assistant message started';
    case 'subagent.work_reasoning_start':
      return 'Reasoning started';
    case 'subagent.work_reasoning_update':
      return 'Reasoning update';
    case 'subagent.work_reasoning_end':
      return 'Reasoning ended';
    case 'subagent.work_compaction':
      return 'Session compacted';
    case 'subagent.work_branch_summary':
      return 'Branch summary';
    case 'subagent.work_custom':
      return 'Custom event';
    case 'subagent.work_custom_message':
      return 'Custom message';
    default:
      return formatSubagentWorkEventType(type);
  }
}

export function groupSubagentWorkEvents(events: SubagentRunWorkEvent[]): SubagentWorkCard[] {
  const cards: SubagentWorkCard[] = [];
  const toolCards = new Map<string, SubagentWorkCard>();

  events.forEach((event, index) => {
    if (event.type === 'subagent.work_message_end' && hasToolCalls(event)) {
      if (preview(event.text_preview)) {
        cards.push(createCardFromEvent(event, index, 'assistant', 'Assistant commentary'));
      }
      event.tool_calls?.forEach((toolCall, toolIndex) => {
        const synthetic: SubagentRunWorkEvent = {
          ...event,
          type: 'subagent.work_tool_start',
          tool_call_id: toolCall.id ?? null,
          tool_name: toolCall.name ?? null,
          args_preview: toolCall.args_preview ?? null,
          result_preview: null,
          is_error: false,
        };
        const key = toolCardKey(synthetic, index + toolIndex / 1000);
        let card = toolCards.get(key);
        if (!card) {
          card = createToolCard(synthetic, index);
          toolCards.set(key, card);
          cards.push(card);
        }
        card.events.push(event);
        card.eventCount = card.events.length;
        card.status = card.status === 'requested' ? 'requested' : card.status;
        card.argsPreview = preview(toolCall.args_preview) ?? card.argsPreview;
        card.warning = card.warning ?? detectToolWarning(card.toolName, card.argsPreview);
      });
      return;
    }

    if (isToolEvent(event)) {
      const key = toolCardKey(event, index);
      let card = toolCards.get(key);
      if (!card) {
        card = createToolCard(event, index);
        toolCards.set(key, card);
        cards.push(card);
      }
      touchToolCard(card, event);
      return;
    }

    if (isReasoningEvent(event)) {
      cards.push(createCardFromEvent(event, index, 'reasoning', lifecycleTitle(event.type)));
      return;
    }

    if (isAssistantTextEvent(event)) {
      cards.push(createCardFromEvent(event, index, 'assistant', event.type === 'subagent.work_message_update' ? 'Assistant update' : 'Assistant message'));
      return;
    }

    if (event.type.startsWith('subagent.work_')) {
      cards.push(createCardFromEvent(event, index, 'lifecycle', lifecycleTitle(event.type)));
    }
  });

  return cards;
}

export function summarizeSubagentWorkActivity(events: SubagentRunWorkEvent[]): SubagentWorkActivitySummary {
  const cards = groupSubagentWorkEvents(events);
  const toolCards = cards.filter(card => card.kind === 'tool');
  const assistantCards = cards.filter(card => card.kind === 'assistant');
  const reasoningCards = cards.filter(card => card.kind === 'reasoning');
  const lifecycleCards = cards.filter(card => card.kind === 'lifecycle');
  const currentTool = [...toolCards].reverse().find(card => card.status === 'running' || card.status === 'requested') ?? null;
  const lastTool = [...toolCards].reverse().find(card => card.status === 'complete' || card.status === 'error') ?? currentTool;
  const lastAssistant = [...assistantCards].reverse().find(card => card.textPreview) ?? null;
  const lastReasoning = [...reasoningCards].reverse().find(card => card.textPreview) ?? reasoningCards.at(-1) ?? null;
  const latestAt = cards.reduce<number | null>((latest, card) => {
    const ts = card.endedAt ?? card.timestamp ?? card.startedAt;
    return ts != null && (latest == null || ts > latest) ? ts : latest;
  }, null);
  const errorCount = cards.filter(card => card.status === 'error').length;
  let statusText = 'no structured work events';
  if (currentTool) statusText = `${currentTool.status === 'requested' ? 'requested' : 'running'} ${currentTool.toolName ?? 'tool'}`;
  else if (lastTool) statusText = `last tool: ${lastTool.toolName ?? 'tool'}`;
  else if (lastAssistant) statusText = 'last assistant message';
  else if (lastReasoning) statusText = 'reasoning activity';
  else if (cards.length > 0) statusText = `${cards.length} lifecycle events`;

  return {
    cardCount: cards.length,
    toolCallCount: toolCards.length,
    errorCount,
    assistantMessageCount: assistantCards.length,
    reasoningCount: reasoningCards.length,
    lifecycleCount: lifecycleCards.length,
    latestAt,
    currentToolName: currentTool?.toolName ?? null,
    lastToolName: lastTool?.toolName ?? null,
    lastAssistantPreview: lastAssistant?.textPreview ?? null,
    statusText,
  };
}

export function summarizeSubagentWorkCard(card: SubagentWorkCard): string {
  if (card.kind === 'tool') {
    const result = card.resultPreview ? ` → ${card.resultPreview}` : '';
    const args = card.argsPreview ? ` ${card.argsPreview}` : '';
    return `${card.toolName ?? 'tool'} ${card.status}${args}${result}`.trim();
  }
  if (card.textPreview) return card.textPreview;
  return card.title;
}

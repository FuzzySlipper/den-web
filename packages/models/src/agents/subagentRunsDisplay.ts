
import type { AgentStreamEntry, SubagentRunState, SubagentRunSummary } from '@den-web/api/types';
export {
  groupSubagentWorkEvents,
  summarizeSubagentWorkActivity,
  summarizeSubagentWorkCard,
  summarizeSubagentWorkEvent,
  type SubagentWorkActivitySummary,
  type SubagentWorkCard,
  type SubagentWorkCardKind,
  type SubagentWorkCardStatus,
} from './subagentWorkCards';

export type SubagentRunFilter = 'all' | 'active' | 'problem' | 'complete';

export function isRawSubagentWorkEventType(eventType: string): boolean {
  return eventType.startsWith('subagent_work_');
}

export function agentStreamEntryVisibility(entry: AgentStreamEntry): 'summary' | 'debug' {
  const visibility = typeof entry.metadata?.event_visibility === 'string' ? entry.metadata.event_visibility : null;
  if (visibility === 'debug' || visibility === 'summary') return visibility;
  return isRawSubagentWorkEventType(entry.event_type) ? 'debug' : 'summary';
}

export function formatSubagentOperatorEventName(eventName: string): string {
  return eventName.replace(/_/g, ' ');
}

export function formatSubagentUsageSummary(run: SubagentRunSummary): string | null {
  const usage = run.usage_summary;
  if (!usage) return null;
  const totalTokens = usage.total_tokens
    ?? [usage.input_tokens, usage.output_tokens, usage.cache_read_tokens, usage.cache_write_tokens]
      .reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
  const parts: string[] = [];
  if (totalTokens > 0) parts.push(`${formatTokenCount(totalTokens)} tokens`);
  if (typeof usage.total_cost === 'number') parts.push(`$${usage.total_cost.toFixed(4)}`);
  return parts.length ? parts.join(' · ') : null;
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function stateFromSubagentEvent(eventType: string): SubagentRunState {
  switch (eventType) {
    case 'subagent_started':
    case 'subagent_process_started':
    case 'subagent_heartbeat':
    case 'subagent_assistant_output':
    case 'subagent_prompt_echo_detected':
      return 'running';
    case 'subagent_fallback_started':
      return 'retrying';
    case 'subagent_abort_requested':
      return 'aborting';
    case 'subagent_rerun_requested':
      return 'rerun_requested';
    case 'subagent_rerun_accepted':
      return 'rerun_accepted';
    case 'subagent_rerun_unavailable':
      return 'failed';
    case 'subagent_completed':
      return 'complete';
    case 'subagent_timeout':
    case 'subagent_startup_timeout':
    case 'subagent_terminal_drain_timeout':
      return 'timeout';
    case 'subagent_aborted':
    case 'subagent_abort':
      return 'aborted';
    case 'subagent_failed':
    case 'subagent_spawn_error':
      return 'failed';
    default:
      return eventType.startsWith('subagent_work_') ? 'running' : 'unknown';
  }
}

export function formatSubagentDuration(ms: number | null): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

export function formatInfrastructureFailureReason(reason: string | null): string {
  switch (reason) {
    case 'extension_load':
      return 'extension load';
    case 'extension_runtime':
      return 'extension runtime';
    case 'child_error':
      return 'child process';
    case 'forced_kill':
      return 'forced kill';
    case null:
      return '';
    default:
      return reason.replace(/_/g, ' ');
  }
}

export function summarizeSubagentRunEntry(entry: AgentStreamEntry): string {
  const body = entry.body?.replace(/\s+/g, ' ').trim();
  return body || entry.event_type.replace(/_/g, ' ');
}

export function formatSubagentWorkEventType(type: string): string {
  return type.replace(/^subagent\.work_/, '').replace(/_/g, ' ');
}

export function formatSubagentWorkTimestamp(ts: number | null | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  return new Date(ts).toLocaleString();
}

export function subagentRunMatchesFilter(run: SubagentRunSummary, filter: SubagentRunFilter): boolean {
  switch (filter) {
    case 'active':
      return run.state === 'running' || run.state === 'retrying' || run.state === 'aborting' || run.state === 'rerun_requested';
    case 'problem':
      return run.state === 'failed' || run.state === 'timeout' || run.state === 'aborted' || run.state === 'unknown';
    case 'complete':
      return run.state === 'complete';
    case 'all':
    default:
      return true;
  }
}

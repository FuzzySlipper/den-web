
import type { ChannelActivityEvent } from '@den-web/api/types';
import { firstAnyNumber, firstNumber, firstPositiveInteger, firstString, humanizeEventType, parseJsonObject, parseJsonValue, summarizePreview } from './activityUtils';

export interface ActivityDisplayModel {
  id: number;
  agentIdentity: string;
  displayBlockId: string | null;
  workerRunId: string | null;
  workerRole: string | null;
  parentAgentIdentity: string | null;
  parentHermesSessionKey: string | null;
  status: string;
  deliveryStage: string;
  terminal: boolean;
  title: string;
  preview: string | null;
  count: number | null;
  taskId: number | null;
  anchorMessageId: number | null;
  finalChannelMessageId: number | null;
  childSessionId: string | null;
  parentSessionId: string | null;
  rootSessionId: string | null;
  profileId: string | null;
  toolName: string | null;
  toolCallId: string | null;
  durationMs: number | null;
  outcome: string | null;
  sourceMessageId: number | null;
  createdAt: string;
}

export function toActivityDisplayModel(event: ChannelActivityEvent): ActivityDisplayModel {
  const metadata = parseJsonObject(event.metadataJson);
  const preview = parseJsonValue(event.previewJson);
  const title = firstString(
    event.title,
    metadata.toolName,
    metadata.tool_name,
    metadata.name,
    humanizeEventType(event.eventType),
  ) ?? humanizeEventType(event.eventType);
  const count = firstNumber(metadata.count, metadata.coalescedCount, metadata.coalesced_count);
  const childSessionId = firstString(metadata.childSessionId, metadata.child_session_id);
  const parentSessionId = firstString(metadata.parentSessionId, metadata.parent_session_id);
  const rootSessionId = firstString(metadata.rootSessionId, metadata.root_session_id);
  const profileId = firstString(metadata.profileId, metadata.profile_id);
  const toolCallId = firstString(metadata.toolCallId, metadata.tool_call_id);
  const durationMs = firstAnyNumber(metadata.durationMs, metadata.duration_ms);
  return {
    id: event.id,
    agentIdentity: event.agentIdentity,
    displayBlockId: event.displayBlockId,
    workerRunId: event.workerRunId,
    workerRole: event.workerRole,
    parentAgentIdentity: event.parentAgentIdentity,
    parentHermesSessionKey: event.parentHermesSessionKey,
    status: event.status || event.eventType,
    deliveryStage: event.deliveryStage || 'progress',
    terminal: Boolean(event.terminal),
    title,
    preview: summarizePreview(preview, event.summary),
    count,
    taskId: event.taskId,
    anchorMessageId: event.anchorMessageId,
    finalChannelMessageId: event.finalChannelMessageId,
    childSessionId,
    parentSessionId,
    rootSessionId,
    profileId,
    toolName: firstString(metadata.toolName, metadata.tool_name),
    toolCallId,
    durationMs,
    outcome: firstString(metadata.outcome, metadata.result, metadata.status),
    sourceMessageId: firstPositiveInteger(metadata.sourceMessageId, metadata.source_message_id),
    createdAt: event.createdAt,
  };
}

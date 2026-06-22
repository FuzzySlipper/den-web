
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
  severity: string | null;
  visibility: string | null;
  displayOnly: boolean;
  refLinks: ActivityRefLink[];
  createdAt: string;
}

export interface ActivityRefLink {
  label: string;
  href: string | null;
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
    severity: firstString(metadata.severity, event.status),
    visibility: firstString(metadata.visibility, event.deliveryStage),
    displayOnly: metadata.displayOnly === true || metadata.display_only === true,
    refLinks: activityRefLinks(metadata, event),
    createdAt: event.createdAt,
  };
}

function activityRefLinks(metadata: Record<string, unknown>, event: ChannelActivityEvent): ActivityRefLink[] {
  const workRef = objectRecord(metadata.workRef);
  const resultRef = objectRecord(metadata.resultRef);
  return [
    taskRefLink(workRef, event),
    channelMessageRefLink(workRef, event),
    documentRefLink(workRef, resultRef, event),
    reviewRefLink(workRef),
    resultMessageRefLink(resultRef),
    commitRefLink(resultRef),
    artifactRefLink(resultRef),
  ].filter((link): link is ActivityRefLink => Boolean(link));
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function taskRefLink(workRef: Record<string, unknown>, event: ChannelActivityEvent): ActivityRefLink | null {
  const taskId = firstPositiveInteger(workRef.task_id, event.taskId);
  if (!taskId) return null;
  const projectId = firstString(workRef.project_id, event.projectId);
  return { label: `task #${taskId}`, href: projectId ? `/den-core-api/api/projects/${encodeURIComponent(projectId)}/tasks/${taskId}` : null };
}

function channelMessageRefLink(workRef: Record<string, unknown>, event: ChannelActivityEvent): ActivityRefLink | null {
  const channelMessageId = firstPositiveInteger(workRef.channel_message_id, event.anchorMessageId);
  if (!channelMessageId) return null;
  const channelId = firstPositiveInteger(workRef.channel_id, event.channelId);
  return { label: `channel message #${channelMessageId}`, href: channelId ? `/api/v1/timeline/channels/${channelId}/items?limit=80` : null };
}

function documentRefLink(workRef: Record<string, unknown>, resultRef: Record<string, unknown>, event: ChannelActivityEvent): ActivityRefLink | null {
  const documentSlug = firstString(resultRef.document_slug);
  if (!documentSlug) return null;
  const projectId = firstString(workRef.project_id, event.projectId);
  return { label: `doc ${documentSlug}`, href: projectId ? `/den-core-api/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentSlug)}` : null };
}

function reviewRefLink(workRef: Record<string, unknown>): ActivityRefLink | null {
  const reviewRoundId = firstString(workRef.review_round_id);
  return reviewRoundId ? { label: `review ${reviewRoundId}`, href: null } : null;
}

function resultMessageRefLink(resultRef: Record<string, unknown>): ActivityRefLink | null {
  return resultRef.message_id != null ? { label: `result message #${resultRef.message_id}`, href: null } : null;
}

function commitRefLink(resultRef: Record<string, unknown>): ActivityRefLink | null {
  const commit = firstString(resultRef.commit);
  return commit ? { label: `commit ${commit.slice(0, 12)}`, href: null } : null;
}

function artifactRefLink(resultRef: Record<string, unknown>): ActivityRefLink | null {
  const artifactPath = firstString(resultRef.artifact_path);
  if (!artifactPath) return null;
  const href = artifactPath.startsWith('/') || /^https?:\/\//i.test(artifactPath) ? artifactPath : null;
  return { label: `artifact ${artifactPath}`, href };
}

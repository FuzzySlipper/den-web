/**
 * Start Work — bounded workflow affordance for waking assigned agents via
 * Den Channels direct-agent delivery.
 *
 * This module does NOT set task status; it only sends a wake signal and
 * records delivery evidence. The operator monitors the chain: preflight
 * membership → send direct-agent message → display concrete evidence.
 *
 * The direct-delivery contract:
 *   - Use Den Channels direct-agent delivery.
 *   - Do NOT invent a parallel wake route or task-status ledger.
 */

import type { ProjectTask } from '@den-web/api/types';
import {
  listGatewayMemberships,
  postGatewayDirectAgentMessage,
} from '@den-web/api/client';

// ---------------------------------------------------------------------------
// State machine phases
// ---------------------------------------------------------------------------

export type StartWorkPhase =
  | 'idle'
  | 'preflighting'
  | 'sending'
  | 'sent'
  | 'failed';

// ---------------------------------------------------------------------------
// Evidence envelope returned to the UI
// ---------------------------------------------------------------------------

export interface StartWorkEvidence {
  phase: 'sent' | 'failed';
  /** Human-readable one-line status for inline display */
  summary: string;
  /** Structured fields returned by the direct-agent delivery API where available */
  messageId?: number;
  channelId?: number;
  channelSlug?: string;
  requestId?: string;
  deliveryStatus?: string;
  claimStatus?: string;
  completionStatus?: string;
  suppressionStatus?: string;
  gatewayMessageUrl?: string;
  gatewayEventsUrl?: string;
  evidenceSummary?: string;
  /** Error message when phase is 'failed' */
  error?: string;
  /** Non-blocking warning (e.g. non-active membership) */
  warning?: string;
  /** Suggested recovery hint when blocked */
  recoveryHint?: string;
}

// ---------------------------------------------------------------------------
// Core operation
// ---------------------------------------------------------------------------

/**
 * Attempt to wake the assigned agent for a task via Den Channels direct delivery.
 *
 * Step 1: Resolve project context from `task.project_id`.
 * Step 2: Preflight active channels membership for the assigned agent.
 * Step 3: Send one targeted direct-agent wake message with task context.
 * Step 4: Return recorded evidence from the direct-delivery response.
 *
 * Does NOT auto-set task status to in_progress — that is the operator's
 * explicit choice or a separate workflow contract.
 *
 * @param task        The task detail's `task` (ProjectTask) — source of truth
 *                    for `project_id` and `assigned_to`.
 * @param senderIdentity   The sender label (default: 'web-ui').
 * @returns           A `StartWorkEvidence` result envelope.
 */
export async function sendTaskStartWork(
  task: ProjectTask,
  senderIdentity: string = 'web-ui',
): Promise<StartWorkEvidence> {
  // --- Guard: unassigned ---------------------------------------------------
  const agentIdentity = task.assigned_to;
  if (!agentIdentity) {
    return {
      phase: 'failed',
      summary: 'Cannot start work: task is not assigned to any agent.',
      error: 'Task is not assigned to any agent.',
      recoveryHint: 'Assign this task to an agent first via the task editor or API.',
    };
  }

  // --- Resolve project/channel context from the task's project -------------
  const projectId = task.project_id;
  if (!projectId) {
    return {
      phase: 'failed',
      summary: 'Task has no project context for channel resolution.',
      error: 'Task has no project_id.',
      recoveryHint: 'Ensure the task belongs to a project with a configured Den Channels channel.',
    };
  }

  // --- Step 1: Preflight membership ----------------------------------------
  let memberships;
  try {
    memberships = await listGatewayMemberships({ projectId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      phase: 'failed',
      summary: `Could not check channel memberships: ${msg}`,
      error: `Failed to list channel memberships for project ${projectId}: ${msg}`,
      recoveryHint: 'Check that the Den Channels service is running and reachable.',
    };
  }

  // --- Step 2: Find assigned agent in memberships --------------------------
  const member = memberships.members.find(
    m => m.memberIdentity === agentIdentity,
  );

  if (!member) {
    return {
      phase: 'failed',
      summary: `Agent "${agentIdentity}" is not a member of #${memberships.channelSlug}. Wake cannot be delivered.`,
      error: `Agent "${agentIdentity}" not found in channel #${memberships.channelSlug} (channelId=${memberships.channelId}).`,
      channelId: memberships.channelId,
      channelSlug: memberships.channelSlug,
      recoveryHint: `Add ${agentIdentity} as a member of channel #${memberships.channelSlug} with active membership status.`,
    };
  }

  // --- Step 3: Check membership status -------------------------------------
  const statusNotes: string[] = [];
  if (member.membershipStatus !== 'active') {
    statusNotes.push(
      `Agent has membership status "${member.membershipStatus}" — wake delivery may not be accepted.`,
    );
  }
  if (!member.canSend) {
    statusNotes.push('Member does not have send permission.');
  }
  if (!member.canReact) {
    statusNotes.push('Member does not have react permission.');
  }

  // --- Step 4: Build the wake message body ---------------------------------
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const detailUrl = `${origin}/#/tasks?task=${task.id}`;

  const body = [
    `## Start Work: Task #${task.id}`,
    ``,
    `**Title**: ${task.title}`,
    `**Project**: ${projectId}`,
    `**Detail**: ${detailUrl}`,
    ``,
    `You have been assigned task #${task.id}. Please review the task description and begin implementation.`,
    ``,
    `_Sent from Den Web (Start Work button)._`,
  ].join('\n');

  // --- Step 5: Send the direct-agent message -------------------------------
  let result;
  try {
    result = await postGatewayDirectAgentMessage({
      channelId: memberships.channelId,
      projectId,
      memberIdentity: agentIdentity,
      senderIdentity,
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      phase: 'failed',
      summary: `Failed to send wake message: ${msg}`,
      error: `postGatewayDirectAgentMessage failed: ${msg}`,
      channelId: memberships.channelId,
      channelSlug: memberships.channelSlug,
      recoveryHint: 'Check the Den Channels API status and try again.',
    };
  }

  // --- Step 6: Return evidence ---------------------------------------------
  const warning = statusNotes.length > 0 ? statusNotes.join(' ') : undefined;

  return {
    phase: 'sent',
    summary: warning
      ? `Wake sent to ${agentIdentity} via #${memberships.channelSlug}. ${warning}`
      : `Wake sent to ${agentIdentity} via #${memberships.channelSlug}.`,
    messageId: result.messageId,
    channelId: result.channelId,
    channelSlug: memberships.channelSlug,
    requestId: result.requestId,
    deliveryStatus: result.deliveryStatus,
    claimStatus: result.claimStatus,
    completionStatus: result.completionStatus,
    suppressionStatus: result.suppressionStatus,
    gatewayMessageUrl: result.gatewayMessageUrl,
    gatewayEventsUrl: result.gatewayEventsUrl,
    evidenceSummary: result.evidenceSummary,
    warning,
  };
}

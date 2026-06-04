/**
 * Den Web API — Core API client (Den Core backend).
 *
 * Re-exports everything from the split API modules for backward compatibility.
 * New code should import directly from the specific API module:
 *   - `@api/core/client`   — Spaces, Projects, Tasks, Messages, Documents, Stream, Git, Desktop, Dispatch
 *   - `@api/channels/client` — Channels, Messages, Activity Events, Reactions
 *   - `@api/gateway/client` — Memberships, Test Wake, Direct Agent, Agents Overview
 */

import { getConfig } from './config';
import { initClient as initCoreClient, resetClient as resetCoreClient } from './core/client';
import { reinitChannelsBase } from './channels/client';
import { reinitGatewayBase } from './gateway/client';

// Core API
export { getApiBases } from './core/client';

export async function initClient(): Promise<void> {
  await initCoreClient();
  const config = await getConfig();
  reinitChannelsBase(config.denChannelsApiBase);
  reinitGatewayBase(config.denGatewayApiBase);
}

export function resetClient(): void {
  resetCoreClient();
  reinitChannelsBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE ?? '/api');
  reinitGatewayBase(import.meta.env.VITE_DEN_GATEWAY_API_BASE ?? '/den-gateway-api');
}
export type {
  ListSpacesOpts,
  ListTasksOpts,
  GetMessagesOpts,
  SaveDocumentRequest,
  QueryLibrarianRequest,
  ListAttentionOpts,
  ListAgentStreamOpts,
  ListSubagentRunsOpts,
  SubagentRunControlAction,
  ControlSubagentRunOpts,
  ListAgentWorkspacesOpts,
  GitFilesOpts,
  GitDiffOpts,
  ListDesktopSnapshotsOpts,
  DesktopDiffSnapshotOpts,
  ListDesktopSessionSnapshotsOpts,
  ListDispatchesOpts,
  PostDiscussionCommentRequest,
  GetUserNotificationsOpts,
  MarkNotificationsReadBody,
} from './core/client';
export {
  listSpaces,
  listProjects,
  getProject,
  listTasks,
  getTask,
  updateTask,
  requestReview,
  postReviewFindings,
  getNextTask,
  getMessage,
  getMessages,
  getThread,
  listDocuments,
  getDocument,
  saveDocument,
  searchDocuments,
  queryLibrarian,
  listAttention,
  listProjectAttention,
  listAgentStream,
  listSubagentRuns,
  getSubagentRun,
  controlSubagentRun,
  listProjectAgentWorkspaces,
  getProjectGitStatus,
  getProjectGitFiles,
  getProjectGitDiff,
  getWorkspaceGitStatus,
  getWorkspaceGitFiles,
  getWorkspaceGitDiff,
  listDesktopGitSnapshots,
  getLatestDesktopGitSnapshot,
  getLatestDesktopDiffSnapshot,
  listDesktopSessionSnapshots,
  listDesktopSessionEvents,
  appendDesktopSessionEvent,
  listDispatches,
  getDispatch,
  approveDispatch,
  rejectDispatch,
  getDocumentDiscussion,
  postDocumentDiscussionComment,
  getUserNotifications,
  getProjectUserNotifications,
  markNotificationsRead,
} from './core/client';

// Channels API
export type {
  ListChannelsOpts,
  ListChannelMessagesOpts,
  ListChannelActivityEventsOpts,
  PostChannelMessageRequest,
  EnsureProjectDefaultChannelRequest,
  AddChannelReactionRequest,
} from './channels/client';
export {
  listChannels,
  listProjectLinkedChannels,
  listChannelLinkedProjects,
  ensureProjectDefaultChannel,
  ensureAgentCommonsChannel,
  listChannelMessages,
  listChannelActivityEvents,
  postChannelMessage,
  listChannelReactions,
  addChannelReaction,
} from './channels/client';

// Gateway API
export type {
  ListAgentsOverviewOpts,
} from './gateway/client';
export {
  upsertChannelMembership,
  listGatewayMemberships,
  postGatewayTestWake,
  postGatewayDirectAgentMessage,
  listAgentsOverview,
  getAgentDetail,
  getAssignmentTrace,
  getWorkerPoolLobbyPresence,
  getFleetOps,
  postFleetOpsActionRun,
  getFleetOpsRun,
} from './gateway/client';

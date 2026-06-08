/**
 * Den Web API — Core API client (Den Core backend).
 *
 * Re-exports everything from the split API modules for backward compatibility.
 * New code should import directly from the specific API module:
 *   - `@api/core/client`   — Spaces, Projects, Tasks, Messages, Documents, Stream, Git, Desktop, Dispatch
 *   - `@api/channels/client` — Channels, Messages, Activity Events, Reactions
 *   - `@api/gateway/client` — Channels gateway helpers, Agents Overview, Den Host FleetOps
 */

import { getConfig } from './config';
import { initClient as initCoreClient, resetClient as resetCoreClient } from './core/client';
import { reinitChannelsBase } from './channels/client';
import { reinitHostBase } from './gateway/client';

// Core API
export { getApiBases } from './core/client';

export async function initClient(): Promise<void> {
  await initCoreClient();
  const config = await getConfig();
  reinitChannelsBase(config.denChannelsApiBase);
  reinitHostBase(config.denHostApiBase);
}

export function resetClient(): void {
  resetCoreClient();
  reinitChannelsBase(import.meta.env.VITE_DEN_CHANNELS_API_BASE ?? '/api');
  reinitHostBase(import.meta.env.VITE_DEN_HOST_API_BASE ?? '/den-host-api');
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
  ListStaleWorkerConditionsOpts,
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
  listStaleWorkerConditions,
} from './core/client';

// Channels API
export type {
  ListChannelsOpts,
  ListChannelMessagesOpts,
  ListChannelActivityEventsOpts,
  PostChannelMessageRequest,
  EnsureProjectDefaultChannelRequest,
  AddChannelReactionRequest,
  ResolveActiveWorkRouteRequest,
  ListActiveWorkRoutesOpts,
  ListAgentWorkOpts,
  ListDirectAgentEventsOpts,
} from './channels/client';
export {
  listChannels,
  listProjectLinkedChannels,
  listChannelLinkedProjects,
  ensureProjectDefaultChannel,
  ensureAgentCommonsChannel,
  listChannelMessages,
  listChannelActivityEvents,
  listAgentWorkCurrent,
  listAgentWorkEvents,
  listDirectAgentEvents,
  resolveActiveWorkRoute,
  listActiveWorkRoutes,
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
  postGatewayDirectAgentMessage,
  listAgentsOverview,
  getAgentDetail,
  getAssignmentTrace,
  getWorkerPoolLobbyPresence,
  getFleetOps,
  postFleetOpsActionRun,
  getFleetOpsRun,
} from './gateway/client';

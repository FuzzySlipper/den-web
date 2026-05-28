/**
 * Den Web API — Core API client (Den Core backend).
 *
 * Re-exports everything from the split API modules for backward compatibility.
 * New code should import directly from the specific API module:
 *   - `@api/core/client`   — Spaces, Projects, Tasks, Messages, Documents, Stream, Git, Desktop, Dispatch
 *   - `@api/channels/client` — Channels, Messages, Activity Events, Reactions
 *   - `@api/gateway/client` — Memberships, Test Wake, Direct Agent, Agents Overview
 */

// Core API
export { initClient, resetClient, getApiBases } from './core/client';
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
  UpsertChannelMembershipRequest,
  ListAgentsOverviewOpts,
} from './gateway/client';
export {
  upsertChannelMembership,
  listGatewayMemberships,
  postGatewayTestWake,
  postGatewayDirectAgentMessage,
  listAgentsOverview,
  getAgentDetail,
} from './gateway/client';

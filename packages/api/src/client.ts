/**
 * Den Web API — Core API client (Den Core backend).
 *
 * Re-exports everything from the split API modules for backward compatibility.
 * New code should import directly from the specific API module:
 *   - `@api/core/client`   — Spaces, Projects, Tasks, Messages, Documents, Stream, Git, Desktop, Dispatch
 *   - `@api/channels/client` — Channels, Messages, Activity Events, Reactions
 *   - `@api/gateway/client` — Channels gateway helpers, Agents Overview
 */

import { getConfig } from './config';
import { initClient as initCoreClient, resetClient as resetCoreClient } from './core/client';
import { reinitChannelsRuntime } from './channels/client';
import { reinitTimelineSuccessor } from './timeline/client';
import { reinitDocPublishClient } from './docPublish/client';

// Core API
export { getApiBases } from './core/client';

export async function initClient(): Promise<void> {
  await initCoreClient();
  const config = await getConfig();
  reinitChannelsRuntime({
    denChannelsApiBase: config.denChannelsApiBase,
    conversationSuccessorReads: {
      enabled: config.conversationSuccessorReadsEnabled,
      writeEnabled: config.conversationSuccessorWritesEnabled,
      apiBase: config.conversationSuccessorApiBase,
      projectIds: config.conversationSuccessorReadProjectIds,
      writeProjectIds: config.conversationSuccessorWriteProjectIds,
    },
  });
  reinitTimelineSuccessor({
    enabled: config.timelineSuccessorEnabled,
    apiBase: config.timelineSuccessorApiBase,
    projectIds: config.timelineSuccessorProjectIds,
  });
  reinitDocPublishClient({
    apiBase: config.docPublishApiBase,
  });
}

export function resetClient(): void {
  resetCoreClient();
  reinitChannelsRuntime({
    denChannelsApiBase: import.meta.env.VITE_DEN_CHANNELS_API_BASE ?? '/api',
    conversationSuccessorReads: {
      enabled: false,
      writeEnabled: false,
      apiBase: '/api/v1/conversation',
      projectIds: [],
      writeProjectIds: [],
    },
  });
  reinitTimelineSuccessor({
    enabled: false,
    apiBase: '/api/v1/timeline',
    projectIds: [],
  });
  reinitDocPublishClient({ apiBase: '/api/v1/blog/publications' });
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
  channelUsesConversationSuccessor,
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
  listObservationLane,
  getObservationAgentOverview,
  listObservationActiveWork,
  getAssignmentTrace,
  getWorkerPoolLobbyPresence,
} from './gateway/client';

// Timeline API
export type {
  TimelineSuccessorConfig,
  TimelineChannelProjection,
  ListTimelineItemsOpts,
} from './timeline/client';
export {
  listChannelTimelineItems,
  timelineSuccessorEnabledForChannel,
  timelineSuccessorEnabledForChannelId,
  timelineChannelStreamUrl,
} from './timeline/client';

// Doc Publish API
export type {
  DocumentPublicationDraft,
  DocumentPublicationOptions,
  DocumentPublicationRecord,
  DocumentPublicationRequest,
  DocumentPublicationResponse,
  DocumentPublicationSource,
  DocumentPublicationStatus,
} from './docPublish/types';
export {
  getDocumentPublication,
  previewDocumentPublication,
  publishDocument,
  reinitDocPublishClient,
} from './docPublish/client';

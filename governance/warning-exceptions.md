# Warning Exceptions

This file is the ledger for intentional warning exceptions. A check may print
INFO for an entry listed here, but anonymous WARN output is not acceptable:
either fix the warning or record why the exception exists and when to revisit it.

## Complexity Baseline Exceptions

Owner: den-web governance.

Rationale: these are remaining composition-shell functions whose extraction
would require broader UI state ownership decisions. They are allowed as
documented exceptions so routine CI output stays meaningful while future work can
retire them incrementally.

Revisit trigger: when a file is touched for feature work, extract pure helpers,
subcomponents, or hook state first; remove the matching baseline entry in the
same change. The complexity check fails if an entry clears but remains listed.

| File | Rule | Current evidence | Rationale |
| --- | --- | --- | --- |
| `packages/features/src/agents/AgentsOverviewView.tsx` | `max-lines-per-function` | `AgentsOverviewView`, 188 lines | Agent overview coordinates several panels and live data sources; extract more panels when this surface changes. |
| `packages/features/src/agents/AssignmentTraceView.tsx` | `max-lines-per-function` | `AssignmentTraceView`, 248 lines | Trace rendering still owns fetch, empty, error, and timeline states in one view. |
| `packages/features/src/agents/SubagentRunDetail.tsx` | `max-lines-per-function` | `SubagentRunDetail`, 255 lines | Detail view composes run metadata, work cards, and event evidence; split by section on next edit. |
| `packages/features/src/agents/WorkerPoolLobbyView.tsx` | `max-lines-per-function` | `WorkerPoolLobbyView`, 130 lines | Slightly over threshold; defer until worker lobby UX gets touched. |
| `packages/features/src/channels/ChannelChatHeader.tsx` | `max-lines-per-function` | `ChannelChatHeader`, 134 lines | Header still groups channel metadata, participants, and actions; split action controls on next channel-header edit. |
| `packages/features/src/channels/ChannelChatPanel.tsx` | `max-lines-per-function` | `ChannelChatPanel`, 306 lines | Main channel coordinator owns several hooks and panel branches; further split requires care around loading/error state. |
| `packages/features/src/channels/ChannelComposer.tsx` | `max-lines-per-function` | `ChannelComposer`, 124 lines | Barely above threshold; extract toolbar/help subview when composer changes next. |
| `packages/features/src/channels/ChannelMessageList.tsx` | `max-lines-per-function`, `sonarjs/cognitive-complexity` | `ChannelMessageList`, 153 lines, complexity 24 | Message list branches by delivery, activity, clarify, and debug states; split render branches before adding more message kinds. |
| `packages/features/src/channels/ChannelParticipants.tsx` | `max-lines-per-function` | `ChannelParticipants`, 149 lines | Participant grouping/action UI remains local to the channel feature. |
| `packages/features/src/channels/useChannelComposer.ts` | `max-lines-per-function`, `sonarjs/cognitive-complexity` | `useChannelComposer`, 159 lines, nested handler complexity 40 | Composer state machine is concentrated in one hook; extract command/history/send reducers before adding behavior. |
| `packages/features/src/documents/DocumentDetail.tsx` | `max-lines-per-function` | `DocumentDetail`, 237 lines | Document body, metadata, and discussion entry points share selection state. |
| `packages/features/src/documents/DocumentDiscussion.tsx` | `max-lines-per-function` | `DocumentDiscussion`, 181 lines | Discussion threading state is still local; split comment form/list when discussion work resumes. |
| `packages/features/src/git/GitView.tsx` | `max-lines-per-function`, `sonarjs/cognitive-complexity` | `GitView`, 205 lines, complexity 18 | Git summary/action branching remains in one view; split status/action sections before adding commands. |
| `packages/features/src/notifications/NotificationHistoryPanel.tsx` | `max-lines-per-function` | `NotificationHistoryPanel`, 225 lines | Notification filtering, grouping, and detail actions share local state. |
| `packages/features/src/piCrewDiagnostics/PiCrewDiagnosticsPanel.tsx` | `max-lines-per-function` | `PiCrewDiagnosticsPanel`, 130 lines | Slightly above threshold after config extraction; split controls if Pi Crew diagnostics remains active. |
| `packages/features/src/preferences/hotkeyParse.ts` | `sonarjs/cognitive-complexity` | parser function complexity 16 | Parser is just over threshold; refactor only with focused parser tests. |
| `packages/features/src/sessions/FocusedSessionView.tsx` | `max-lines-per-function` | `FocusedSessionView`, 274 lines | Focused session transcript and context panels still coordinate in one feature view. |
| `packages/features/src/sessions/SessionContextSidebar.tsx` | `max-lines-per-function` | `SessionContextSidebar`, 133 lines | Slightly above threshold; split sidebar sections on next session-context edit. |
| `packages/features/src/tasks/TaskDetail.tsx` | `max-lines-per-function` | `TaskDetail`, 138 lines | Task detail still groups status, messages, and related panels. |
| `packages/shell/src/App.tsx` | `max-lines-per-function` | `App`, 274 lines | Shell bootstrap owns top-level data loading, workspace state, and layout composition. |
| `packages/shell/src/MainPanel.tsx` | `max-lines-per-function`, `sonarjs/cognitive-complexity` | `MainPanel`, 176 lines, complexity 108 | Central route switch remains intentionally explicit; replace with route table before adding views. |
| `packages/shell/src/keyboardShortcuts.ts` | `sonarjs/cognitive-complexity` | shortcut handler complexity 17 | Shortcut dispatch is just above threshold; convert to command table when adding shortcuts. |
| `packages/shell/src/useWorkspaceNavigation.ts` | `max-lines-per-function` | `useWorkspaceNavigation`, 177 lines | Navigation hook owns URL/detail sync; split detail parsing helpers before adding routes. |

## File-Size Exceptions

| File | Rule | Rationale | Revisit trigger |
| --- | --- | --- | --- |
| `packages/api/src/gateway/types.ts` | 650-line exception ceiling | Gateway DTO contract mirrors external Channels/Gateway payloads. | Split by upstream contract or generated source when that boundary exists. |

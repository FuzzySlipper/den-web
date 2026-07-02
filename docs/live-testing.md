# Den Web Successor Live Testing

Date: 2026-07-02.

This document defines the live verification catalog for the Angular/Nx Den Web
successor. It applies the rendered-evidence rule from
`den:patch/rusty-view-ui-architecture-pattern`: user-deliverable UI claims close
only after the working agent runs the relevant live scenario, inspects rendered
artifacts, and reports what the UI did.

Deterministic tests, store snapshots, raw events, logs, and CSS classes are
diagnostic evidence. They help localize failures, but they do not prove rendered
behavior by themselves.

## Harness Contract

Use the bootstrap template live harness:

- live scenarios are opt-in and gated by `LIVE_RUN=1`;
- the harness consumes `BASE_URL`;
- it does not manage ports, kill processes, or guess server identity;
- the Playwright run broker may provide `BASE_URL` later;
- until then, use the template local serve fallback and rerun with `BASE_URL`
  set;
- artifacts live under the e2e app's live artifact directory.

Standard artifact bundle:

- milestone screenshots;
- before/after visual-impact screenshots for interactive controls;
- Playwright trace when available;
- `console.json`;
- `page-errors.json`;
- extracted visible text;
- transport excerpt;
- store/debug snapshot;
- `evidence-packet.json`;
- `scenario-summary.md`.

Every live scenario must name what it does not prove. A headless browser run is
not performance evidence, a local backend run is not deploy evidence, and a
single successful route is not full feature parity.

## Completion Report Template

Use this shape when closing a user-deliverable UI claim:

```text
Live scenario:
Command:
Backend/profile:
Artifacts:
Screenshots inspected:
Rendered behavior observed:
Evidence packet:
Timeline notes:
Supporting checks:
Non-claims / residual risk:
```

## Scenario Catalog

These stubs exist before implementation so each feature has a selection target.
The concrete Playwright specs should be generated under the e2e app as feature
libraries are created.

### 1. Boot And Workspace Selection

Purpose: prove the successor app boots, loads runtime config, reads projects and
spaces from `/api/v1`, and lets the operator select a workspace.

Milestones:

- app shell rendered with build/environment marker;
- runtime config loaded or visible config error rendered;
- projects/spaces loaded from successor route;
- `den-web` workspace selected;
- no legacy `/api/*` den-channels request observed.

Non-claims:

- does not prove every feature route works;
- does not prove live deployment smoke.

### 2. Project Tasks List And Detail

Purpose: prove tasks render from den-services successor routes with list, filter,
tree/detail, dependency-waiting, and review/start-work affordances that are in
scope.

Milestones:

- selected project task list rendered;
- status filter changes visible rows;
- task detail opens;
- dependency/review sections render when data exists;
- failed task read renders classified error state.

Non-claims:

- does not prove dropped Git/session/worker workflows;
- start-work behavior is limited to successor-supported request paths.

### 3. Conversation Timeline And Composer

Purpose: prove the cockpit conversation view uses Conversation/Timeline/Delivery
successor routes only.

Milestones:

- project channel list loads from `/api/v1/conversation`;
- timeline items load or stream from `/api/v1/timeline`;
- composer posts through Conversation or Delivery successor route as appropriate;
- newly posted message is visible by readback;
- stream fallback state is visible when streaming is unavailable.

Non-claims:

- does not prove direct-message behavior;
- does not prove legacy den-channels compatibility.

### 4. Documents List, Detail, And Discussion

Purpose: prove documents use successor routes and preserve the predecessor's
important editor/discussion behavior.

Milestones:

- document list loads for selected project;
- document detail renders body separately from discussion;
- dirty edit blocks document switching until confirmed or cancelled;
- discussion comments load and post through successor route;
- publish panel renders when document data supports it.

Non-claims:

- does not prove external blog rendering;
- does not prove concurrent editing.

### 5. Notifications Feed And Read Behavior

Purpose: prove notification feed, unread cues, and read-state persistence render
correctly.

Milestones:

- user notification feed loads from `/api/v1/user-notifications`;
- unread cue appears when unread items exist;
- read action changes visible state;
- local read cache survives reload through platform storage port;
- failed feed read renders classified error state.

Non-claims:

- does not prove push notification delivery;
- does not prove browser popup behavior unless that control is included in the
  scenario variant.

### 6. Messages Inbox And Thread

Purpose: prove project messages and thread detail render through messages
successor routes.

Milestones:

- project message inbox loads;
- intent/filter display is correct for known fixtures;
- thread/detail opens;
- missing or malformed message renders classified error state.

Non-claims:

- does not prove direct-message conversations;
- does not prove channel timeline rendering.

### 7. Librarian Query

Purpose: prove the librarian query surface calls the den-services librarian
successor route and renders answer/source states.

Milestones:

- query form renders;
- submitted query produces loading state;
- answer and source cards render;
- empty/no-result and error states render.

Non-claims:

- does not prove ranking quality;
- does not prove knowledge curation correctness.

### 8. Agents Overview Degraded State

Purpose: prove the successor agents overview is Observation-backed and honest
about missing successor parity.

Milestones:

- overview reads `/api/v1/observation/lane` and active-work successor routes;
- agent/activity summaries render when available;
- missing membership/binding/assignment-trace parity renders visible degraded
  source-health states;
- no worker pool/lobby or pi-crew route is called.

Non-claims:

- does not prove worker management;
- does not prove assignment trace parity until den-services exposes that
  successor contract.

### 9. Preferences Persistence And Visual Application

Purpose: prove preferences use platform ports and apply visible UI changes.

Milestones:

- preferences view opens;
- a layout/theme/keyboard setting changes state;
- visual-impact artifact shows the setting taking effect when applicable;
- setting persists across reload via platform storage;
- storage failure renders or degrades predictably.

Non-claims:

- does not prove every keyboard shortcut;
- does not prove cross-browser storage behavior.

### 10. Static Service Smoke And Legacy Route Retirement

Purpose: prove the deployed/static-service shape matches the Den Web contract.

Milestones:

- public root returns the successor app HTML;
- build marker or sentinel identifies the fresh successor build;
- `/den-web-config.json` is valid or intentionally absent;
- `/api/v1/projects` succeeds through the same-origin proxy;
- `/api/v1/projects/den-web/tasks?limit=1` succeeds;
- `/api/v1/user-notifications?read_for_agent=web-ui&limit=5` succeeds;
- `/api/v1/conversation/channels?project_id=den-web&limit=1` succeeds;
- `/api/v1/observation/lane?limit=1` succeeds;
- `/api/v1/timeline/channels/1/items?limit=1` succeeds;
- retired `/api/channels?limit=1` and `/api/gateway/memberships?projectId=den-web`
  return `410`.

Non-claims:

- does not prove feature-level rendered parity;
- does not prove rollback unless rollback is explicitly exercised.

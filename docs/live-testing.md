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
- remote deployment evidence records the target hostname, machine ID, and
  access route; a private LAN IP is not unique across sites;
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

### 3. Documents List, Detail, And Discussion

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

### 4. Notifications (retired)

The Notifications page was removed from Den Web in October 2026 because
nothing used it. This number is kept so later scenario numbers stay stable.

### 5. Messages Inbox And Thread

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

### 6. Librarian Query

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

### 7. Agents Overview Degraded State

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

### 8. Preferences Persistence And Visual Application

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

### 9. Static Service Smoke And Legacy Route Retirement

Purpose: prove the deployed/static-service shape matches the Den Web contract.

Milestones:

- public root returns the successor app HTML;
- build marker or sentinel identifies the fresh successor build;
- `/den-web-config.json` is valid or intentionally absent;
- `/api/v1/projects` succeeds through the same-origin proxy;
- `/api/v1/projects/den-web/tasks?limit=1` succeeds;
- `/api/v1/observation/lane?limit=1` succeeds;
- `/api/v1/timeline/channels/1/items?limit=1` succeeds;
- retired `/api/channels?limit=1` and `/api/gateway/memberships?projectId=den-web`
  return `410`.

Non-claims:

- does not prove feature-level rendered parity;
- does not prove rollback unless rollback is explicitly exercised.

### 10. Artifact Evidence Preview

Purpose: prove a durable `den-artifact://` reference in Den message metadata
resolves through the same-origin artifacts route without putting image bytes in
task or message state.

Milestones:

- a task containing ref-only artifact metadata loads;
- artifact metadata renders with MIME, byte count, dimensions, SHA-256,
  sensitivity, and retention state;
- image content loads from `/api/v1/artifacts/{artifact_id}/content`;
- the thumbnail opens the full-size viewer;
- the evidence packet records the rendered state and explicit non-claims.

Run the focused live scenario with:

```bash
LIVE_RUN=1 \
BASE_URL=http://192.168.1.5:18080 \
ARTIFACT_EVIDENCE_TASK_ID=3480 \
npx playwright test --config=apps/den-web-e2e/playwright.config.mts \
  src/live/artifact-evidence.live.spec.ts
```

Non-claims:

- does not prove sensitive-artifact authorization policy;
- does not prove deleted-artifact rendering.

### 11. Operations Backup Status

Purpose: prove the Operations page reads real backup status from Ops through
same-origin `/api/v1/ops` (web-edge → Gateway → Ops on CT106) and renders it
without ever showing unverified protection as green.

Milestones:

- the Admin → Operations route renders;
- `/api/v1/ops/summary` responds and the overall status or an error alert is
  visible;
- each registered job shows its status, last attempt, last successful backup,
  schedule, verification and restore-test lines;
- the first job's history table loads from `/api/v1/ops/jobs/{job_id}`;
- the evidence packet records the Ops responses and job statuses seen.

Run the focused live scenario with:

```bash
LIVE_RUN=1 \
BASE_URL=http://192.168.1.5:18080 \
npx playwright test --config=apps/den-web-e2e/playwright.config.mts \
  src/live/ops.live.spec.ts
```

The mocked smoke spec `src/smoke/ops.spec.ts` covers the failure, overdue,
uncovered-machine, Ops-unreachable and failed-refresh renderings.

Non-claims:

- does not prove that any backup ran, only what Ops has recorded;
- does not exercise failure or overdue states against the live backend.

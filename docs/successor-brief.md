# Den Web Successor Brief

Date: 2026-07-02.

This is the Phase 0 build brief for the Angular/Nx successor to Den Web. The
predecessor lives under `local/` and is evidence only: read it for product
shape, contracts, behavior, test cases, and operational lessons, but do not
port React/Vite implementation code.

Primary references:

- `den:patch/successor-pattern`
- `den:patch/rusty-view-ui-architecture-pattern`
- `den:patch/ui-pattern-bootstrap-template`
- `docs/successor-assessment.md`
- `docs/den-web-static-service-contract.md`

## Objective

Build a clean Angular/Nx Den Web successor using the rusty-view UI architecture
pattern v2. The successor should reach the useful product shape of the old app
while inheriting only selected behavior, contracts, tests, and operational
constraints.

The successor is a static browser service. It does not own backend state. All
normal Den connectivity must flow through den-services successor surfaces behind
the same-origin Den Web proxy, primarily `/api/v1/*`.

## Architecture Contract

Use the bootstrap template layout and keep the dependency direction mechanical:

```text
protocol -> transport -> domain -> store -> renderer/components -> feature-* -> shell
             platform ----^
```

Required Angular/Nx posture:

- standalone Angular components;
- signals-based stores with private writable state and public readonly signals;
- `AsyncState<T>` for every async store value;
- classified error taxonomy for transport/store failures;
- Nx tags for both `type:` and `scope:`;
- no deep imports across libraries;
- public barrels only;
- route-level feature providers;
- shell composes features and root providers only.

Feature libraries may not import sibling feature libraries. Shared behavior must
move down into domain/store/components/renderer/platform as appropriate.

## Successor Connectivity

Allowed normal browser route families:

| Domain | Browser base |
| --- | --- |
| Projects, spaces, tasks, messages, notifications, documents, review, librarian | `/api/v1` |
| Conversation | `/api/v1/conversation` |
| Timeline | `/api/v1/timeline` |
| Observation | `/api/v1/observation` |
| Delivery/wake intents | `/api/v1/delivery` |
| Document publish | `/api/v1/blog/publications` |

Browser code must not call backend loopback targets directly. Static server
token injection and routing remain server-side concerns.

Forbidden normal product dependencies:

- legacy `den-channels` `/api/*` routes outside `/api/v1/*`;
- direct `den-core` fallback paths;
- direct Gateway loopback URLs;
- worker pool/lobby routes;
- Hermes-specific routes or identifiers;
- pi-crew-specific routes, models, labels, or UI affordances;
- compatibility shims that silently fall back to legacy backends.

If a backend contract gap blocks an inherited feature, create or link a task in
the owning backend project. Do not implement an ad hoc backend in Den Web.

## Feature Triage

### Inherit

These product areas are in successor scope:

| Feature | Successor shape | Primary sources in `local/` |
| --- | --- | --- |
| Projects/spaces | project/space list, visibility filters, selected workspace | `packages/shell/src/spaces.ts`, `packages/features/src/projects/` |
| Tasks | list/tree/detail, status filters, dependency-waiting display, review actions, start-work affordances where successor services support them | `packages/features/src/tasks/`, `packages/api/src/core/tasks*.ts` |
| Conversation cockpit | project channel selection, timeline/message display, composer, reactions/memberships only through Conversation/Timeline/Delivery | `packages/features/src/channels/`, `packages/api/src/channels/`, `packages/api/src/timeline/` |
| Messages | inbox/detail/thread views backed by messages successor APIs | `packages/features/src/messages/`, `packages/api/src/core/messages*.ts` |
| Notifications | user notification feed, read cache, bell cues, side panel or route-level view | `packages/features/src/notifications/` |
| Documents | list/detail/edit guard, discussions, publish panel | `packages/features/src/documents/`, `packages/api/src/core/documents.ts`, `packages/api/src/docPublish/` |
| Librarian | query/search surface backed by den-services librarian route | `packages/features/src/librarian/` |
| Agents overview | Observation-backed operator overview with explicit degraded states where successor parity is missing | `packages/features/src/agents/AgentsOverviewView.tsx`, `packages/api/src/gateway/observation*` |
| Preferences | client-local preferences, keyboard/layout/theme settings through platform storage and document ports | `packages/features/src/preferences/` |

### Defer Or Drop

These are not part of the initial inherited parity target unless a later task
explicitly re-adds them with successor contracts:

| Area | Decision | Reason |
| --- | --- | --- |
| Fleetops | Drop | Outside the scoped Den Web cockpit successor. |
| Git | Drop initially | Not a required v2 cockpit workflow; avoid legacy coupling. |
| piCrewDiagnostics | Drop | Direct pi-crew references are explicitly out of scope. |
| DM | Drop initially | User requested no DM; avoid direct-message legacy surface inheritance. |
| Sessions | Drop initially | User requested no sessions; current implementation mixes desktop/session/gateway assumptions. |
| Worker pool/lobby | Drop | Worker references are explicitly out of scope. |
| Hermes-specific behavior | Drop | Hermes direct references are explicitly out of scope. |
| Direct den-channels compatibility | Drop | Normal product path is successor `/api/v1/*` only. |

## Behavioral Fixtures To Carry Forward

Carry forward tests and cases, not implementation code. Good first candidates:

- task status and dependency-waiting cases;
- task start-work request shape after verifying successor ownership;
- document discussion separation;
- dirty document switch guard;
- notification panel/read-cache behavior;
- channel render model cases that do not mention pi-crew or legacy sources;
- conversation route and idempotent write behavior through successor routes;
- runtime config precedence and malformed config handling;
- static service smoke behavior from `docs/den-web-static-service-contract.md`.

Remove or rewrite any fixture whose premise depends on dropped features or
legacy connectivity.

## Live-Update Semantics Inventory

The predecessor scatters live-update behavior through hooks and API helpers. The
successor must make these semantics explicit in stores and transport:

| Surface | Current behavior to inspect | Successor target |
| --- | --- | --- |
| Projects/spaces | shell polls every 5s | workspace/session store command with configured polling |
| Tasks | shell polls every 5s, all-spaces aggregates multiple project reads | task store, no component-owned aggregation |
| Documents | shell polls every 5s, detail reads on selection | document store with explicit dirty-edit guard |
| Notifications | feed polls every 10s, panel polls faster, local read cache | notification store plus platform storage port |
| Conversation | timeline stream when enabled, polling fallback, local stream opt-out | transport owns EventSource/reconnect, store owns fallback state |
| Agent overview | observation reads poll every 10s | agents store renders source-health/degraded states |
| Preferences | localStorage plus direct document CSS mutation | platform storage/document ports |

No feature is complete until its store owns refresh cadence, error state,
empty/loading rendering, and any optimistic/readback behavior.

## Acceptance Scenario Catalog

Each inherited feature needs a live scenario stub before implementation. The
initial catalog is maintained in `docs/live-testing.md`.

Minimum scenario set:

1. boot and workspace selection;
2. project tasks list/detail;
3. conversation timeline and composer;
4. documents list/detail/discussion;
5. notifications feed and read behavior;
6. messages inbox/thread;
7. librarian query;
8. agents overview degraded-state display;
9. preferences persistence and visual application;
10. static service smoke and retired legacy route checks.

## Definition Of Ported

A feature is ported only when:

- it lives in the correct Angular/Nx libraries with passing boundary checks;
- protocol imports come from generated/stable protocol barrels;
- transport calls use the allowed `/api/v1/*` successor route families;
- async data is exposed as `AsyncState<T>`;
- domain behavior has unit tests or carried-forward fixture tests;
- stores expose readonly state and named commands;
- all loading/error/empty/data branches render;
- deterministic tests pass;
- the live scenario ran against a real app URL;
- the working agent inspected rendered artifacts and recorded what the UI did;
- non-claims and residual risk are stated.

Passing unit tests or store snapshots are not enough to close a
user-deliverable UI claim.

## Cutover Contract

Keep the public static-service shape from
`docs/den-web-static-service-contract.md`:

- canonical URL: `http://192.168.1.10:18080/`;
- runtime config: `/den-web-config.json`;
- static asset service only;
- same-origin `/api/v1/*` browser bases;
- legacy `/api/*` den-channels paths retired or explicitly diagnostic.

Cutover is allowed only after all inherited feature scenarios pass and artifacts
have been inspected. Rollback restores the previous static asset root only; it
does not roll back backend service ownership.

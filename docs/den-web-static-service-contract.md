# Den Web static service contract

Den task: #1705. Umbrella: #1704. ADR: `den-web/den-web-standalone-static-site-service`.

## Status

Accepted target contract for extracting Den Web from the embedded `den-channels` ClientApp into the standalone `/home/dev/den-web` repository and static service.

## Ownership boundary

`den-web` is a static frontend service only. It owns the React/Vite app, frontend routing, API client adapters, browser-facing static assets, CSS/design system, frontend tests, static deploy scripts, and live UI smoke checks.

It does **not** own backend state:

- Den Core owns spaces/projects/tasks/documents/task messages/review/worker state.
- den-services Conversation/Timeline/Observation owns channel state, message display, memberships, reactions, and activity breadcrumbs for the Den Web client.
- Den Gateway owns delivery/wake/binding/claim/session routing authority.
- Den Host/FleetOps was retired from Den Web in task #3085; `/den-host-api/*` is not a live backend dependency for this service.

Any backend contract gap discovered during extraction should become a task in the owning backend project, not an ad hoc backend in `den-web`.

## Public route and service shape

### Canonical operator URL

The intended primary Den Web cockpit URL after cutover is:

- `http://192.168.1.10:18080/`

This preserves the currently useful operator entry point while changing the serving owner from `den-channels` static files to the `den-web` static service.

### Internal deployment target

Initial deployment should be a simple static asset service on `den-srv`:

- repo/source path: `/home/dev/den-web` on development machines;
- deploy root candidate: `/data/services/den-web`;
- built asset directory: `/data/services/den-web/wwwroot`;
- service name candidate: `den-web.service`;
- reverse-proxy/public route: `http://192.168.1.10:18080/`.

A later deployment task may adjust the concrete service manager or asset directory if existing infrastructure requires it, but the public route and API paths below are the compatibility contract for the extracted app.

## API base URL contract

The browser app must use explicit configured API bases and must not infer backend ownership from its static host.

| Backend | Owner | Browser base path | Health/smoke endpoint | Notes |
| --- | --- | --- | --- | --- |
| Den Core | `den-core` | `/den-core-api` | `/den-core-api/health`, `/den-core-api/api/projects` | Canonical tasks/docs/messages/workflow REST facade. Current live health returns commit/version metadata. |
| Conversation | `den-services` Gateway route | `/api/v1/conversation` | `/api/v1/conversation/channels?project_id=den-web&limit=1` | Canonical channel/message/membership/write API. The static server injects conversation caller tokens; browser code must not call Conversation loopback directly. |
| Observation | `den-services` Gateway route | `/api/v1/observation` | `/api/v1/observation/lane?limit=1` | Canonical display-only agent activity breadcrumbs. The static server injects `DEN_GATEWAY_OBSERVATION_READ_TOKEN` for read routes; browser code must not call Observation loopback directly. |
| Delivery | `den-services` Gateway route | `/api/v1/delivery` | `/api/v1/delivery/intents` | Canonical executable direct-agent wake intent surface. The static server injects `DEN_GATEWAY_DELIVERY_WRITE_TOKEN` and the migrated route header; browser code must not create wakes through legacy den-channels routes. |
| Timeline | `den-services` Gateway route | `/api/v1/timeline` | `/api/v1/timeline/channels/1/items?limit=1` | Composed human-facing conversation + observation timeline. The static server injects `DEN_GATEWAY_TIMELINE_READ_TOKEN`; browser code must not call Timeline loopback directly. |
| Retired den-channels compatibility API | none | `/api/*` except `/api/v1/*` successor paths | `/api/channels?limit=1` returns `410` | Legacy `den-channels` proxy is intentionally not a normal Den Web dependency. History/evidence links should use successor, Core, or explicit archive tooling. |
| Retired Den Host FleetOps APIs | none | `/den-host-api` | `/den-host-api/fleet-ops` | Returns `410 den_host_api_retired`. Den Web no longer consumes Den Host/FleetOps. |
| Agents overview | `den-services` Gateway route | `/api/v1/observation` | `/api/v1/observation/lane?limit=1` | Operator overview is derived from Observation successor reads. Membership/binding aggregates are visibly degraded until den-services exposes successor parity. |

Current app code uses explicit Vite build-time variables for backend bases:

- `VITE_DEN_CORE_API_BASE`, fallback `/den-core-api`;
- `VITE_DEN_CHANNELS_API_BASE`, fallback `/api` for compatibility with older config records only; normal Den Web code uses successor bases.

FleetOps and `/den-host-api/*` were retired from Den Web in task #3085. Legacy den-channels `/api/*` routes were retired from the normal product path in task #3161.

## Runtime config strategy

The standalone static site should support deploy-time runtime configuration instead of requiring a rebuild for every environment move.

Required precedence for the extracted app:

1. Runtime config loaded from `/den-web-config.json` when present.
2. Vite build-time env values (`VITE_DEN_CORE_API_BASE`, `VITE_DEN_CHANNELS_API_BASE`, and disabled conversation successor pilot flags) as fallback.
3. Safe local defaults: `/den-core-api`, `/api`, and conversation successor reads disabled.

Recommended runtime config keys:

| Key | Recommended den-srv value | Meaning |
| --- | --- | --- |
| `denCoreApiBase` | `/den-core-api` | Core REST facade base path. |
| `denChannelsApiBase` | `/api` | Compatibility key retained for older config consumers; `/api/*` legacy den-channels routes are not a live browser dependency. |
| `docPublishApiBase` | `/api/v1/blog/publications` | Same-origin Den Web proxy base for the den-services document blog publisher. |
| `conversationSuccessorReadsEnabled` | `true` on den-srv | Feature flag for Conversation successor channel/message reads. Keep aligned with write allowlists so posted messages are visible in the same UI. |
| `conversationSuccessorWritesEnabled` | `true` on den-srv | Feature flag for conversation successor message/reaction writes. |
| `conversationSuccessorApiBase` | `/api/v1/conversation` | Same-origin Den Web proxy base for Gateway conversation canary reads. |
| `conversationSuccessorReadProjectIds` | same as write allowlist on den-srv | Project allowlist for successor channel/message reads. Empty means no channel/message reads use successor. |
| `conversationSuccessorWriteProjectIds` | conversation read allowlist on den-srv | Project allowlist for successor conversation writes. Empty means channel-message writes are disabled rather than routed to den-channels. |
| `timelineSuccessorEnabled` | `true` on den-srv | Feature flag for the den-services composed timeline read/SSE surface. Set false to roll back to legacy message/activity reads. |
| `timelineSuccessorApiBase` | `/api/v1/timeline` | Same-origin Den Web proxy base for Gateway timeline reads/streams. |
| `timelineSuccessorProjectIds` | conversation read allowlist on den-srv | Project allowlist for timeline display composition. Empty disables timeline display rather than routing normal reads to den-channels. |
| `appBasePath` | `/` | Static app base path. |
| `environmentName` | `den-srv` | Human-readable deployment/environment label. |

The deploy artifact may encode these keys as JSON in `/den-web-config.json`, but the contract is the key/value table above. The config loader must be deterministic and testable: missing config should not block local development; malformed config should show a visible operator-facing error and leave a console diagnostic, not silently point at wrong APIs.

## Cutover behavior for the old `den-channels` path

`den-channels` currently serves the embedded ClientApp from its service root when `wwwroot/index.html` exists. After `den-web` is deployed and smoked:

1. `http://192.168.1.10:18080/` should serve the `den-web` asset build.
2. `den-channels` backend `/api/...` routes are no longer part of Den Web normal operation.
3. Any old static asset path owned by `den-channels` should be removed, redirected, or replaced by an explicit moved-page that points to the canonical Den Web route.
4. Do not leave two indistinguishable primary UIs live; if a temporary fallback remains, label it and create a cleanup/removal task.

Rollback is straightforward: restore the reverse proxy/static route to the previous `den-channels` static root and redeploy the last known good `den-channels` ClientApp assets. Rollback must not change Core/Channels/Gateway API ownership.

## Build/test contract for the scaffold task

Task #1706 should preserve the current ClientApp behavior while moving it:

- `npm install` / lockfile strategy documented in the new repo;
- `npm test` runs all Vitest files;
- `npm run build` passes;
- `npm run lint` passes;
- regression tests from #1702 remain included, especially document discussion separation, dirty document switch guard, channel default/Agent Commons fallback, chat panel size presets, and activity/final-message correlation;
- API base URL config tests cover runtime config precedence and fallbacks.

## Live smoke checklist

After standalone deployment (#1707), smoke the public URL and API-backed UI paths against live services:

1. Static asset health:
   - `curl -fsS -I http://192.168.1.10:18080/` returns `200` and `text/html` for the Den Web app.
   - The HTML references the freshly built asset hash/sentinel from the `den-web` build.
   - `/den-web-config.json` returns valid config or intentionally returns 404 only if build-time env is the documented active mode.
2. Core API reachability through the browser base:
   - `curl -fsS http://192.168.1.10:18080/den-core-api/health`.
   - `curl -fsS http://192.168.1.10:18080/den-core-api/api/projects`.
3. Conversation, Observation, and Timeline reachability:
   - `curl -fsS 'http://192.168.1.10:18080/api/v1/conversation/channels?project_id=den-web&limit=1'`.
   - `curl -fsS 'http://192.168.1.10:18080/api/v1/conversation/memberships?project_id=den-web&limit=20'`.
   - `curl -fsS 'http://192.168.1.10:18080/api/v1/observation/lane?limit=1'` should return an Observation lane JSON object through Gateway.
   - `curl -fsS 'http://192.168.1.10:18080/api/v1/timeline/channels/1/items?limit=1'` should return a Timeline JSON object through Gateway.
   - `curl -fsS -o /dev/null -w '%{http_code}' 'http://192.168.1.10:18080/api/channels?limit=1'` should return `410`.
   - `curl -fsS -o /dev/null -w '%{http_code}' 'http://192.168.1.10:18080/api/gateway/memberships?projectId=den-web'` should return `410`.
4. Agents overview and retired API reachability:
   - Operator overview renders from `/api/v1/observation/lane?limit=1` plus `/api/v1/observation/active-work`; `/api/agents/overview` is no longer a smoke requirement.
   - `curl -fsS -o /dev/null -w '%{http_code}' http://192.168.1.10:18080/den-host-api/fleet-ops` returns `410` or `404`, not a proxied Den Host response.
   - `curl -fsS -o /dev/null -w '%{http_code}' http://192.168.1.10:18080/den-gateway-api/fleet-ops` returns `410` or `404`, not a misleading Gateway `502`.
5. Browser behavior smoke:
   - project/space list loads from Core;
   - document list/detail and discussion panel load without mixing comments into document body;
   - project default channel and Agent Commons selection load from Conversation;
   - agent overview renders with source-health warnings when Gateway data is degraded;
   - a visible asset/version marker confirms the standalone `den-web` build is being served, not stale `den-channels` assets.

## Observation Successor Gaps

Den Web no longer calls the retired den-channels operator observation aggregates:

- `GET /api/agents/overview`
- `GET /api/agents/{id}/overview`
- `GET /api/assignments/{assignmentId}/trace`

The current successor-backed operator overview uses Observation lane and active-work reads. It intentionally marks channel membership, gateway binding, and assignment trace data as degraded where den-services does not yet provide parity.

Needed den-services successor contracts:

- All-agents operator overview: grouped agent/runtime summaries with current binding/residency, active delivery counts, recent activity, source health, and project/channel filters.
- Assignment trace: assignment id to Core lifecycle state, Delivery intent evidence, Timeline/Conversation messages, Observation activity, source availability states, and a human summary.

## Rollback notes

- Keep the previous live `den-channels` static asset bundle or service deployment identifiable until the first `den-web` live smoke passes.
- If static asset serving fails but APIs are healthy, revert only the reverse-proxy/static root. Do not roll back Core/Channels/Host services.
- If API base config is wrong, prefer fixing `/den-web-config.json` and refreshing the static service over rebuilding assets unless the code lacks runtime config support.
- Post rollback evidence to the relevant Den task thread: failing URL, restored asset root, restored asset hash/sentinel, and API health checks.

## Next task recommendation

Proceed to #1706: create/populate `/home/dev/den-web` from the current `den-channels` ClientApp, preserving all tests and build behavior, adding the runtime config loader described above, and keeping API ownership boundaries explicit.

# Den Web — Successor-Pattern Suitability Assessment

Date: 2026-07-01. Read-only assessment of this repo as a **predecessor** under
`den:patch/successor-pattern`: build a new repo on the Angular/Nx UI pattern
(`den:patch/rusty-view-ui-architecture-pattern` v2, bootstrapped from
`den:patch/ui-pattern-bootstrap-template`), porting no code, using this repo
as the living PRD.

## Verdict

**Well suited — better than a typical rewrite candidate.** The properties
that usually make frontend successors expensive are already handled: the API
contracts are owned externally (den-services `/api/v1` successor surfaces),
the feature inventory is legible (15 named verticals), no other code depends
on this repo's packages, and cutover is a static-site swap with documented
deploy/rollback. The mess is *inside* the features, which is exactly the part
a successor discards. The one real gap is the selection environment: there is
no e2e layer, so "similar functionality" has no mechanical definition until
the brief adds acceptance scenarios.

This repo also has successor lineage already — it was itself scaffolded from
the `den-channels` ClientApp (task #1706), and recent commits ("Fail task
cutover reads closed", "Route den-web task reads to successor tasks") show
cutover discipline is normal in this ecosystem.

## What the current shape is

React 19 + Vite, npm workspaces, ~35k LOC. Packages: `api` (8k — hand-written
clients/types per den-services surface), `models` (5.4k — pure projection
logic, the best-tested part), `features` (18.3k / 130 files — the god
package), `shell` (2.7k incl. a 388-line `App.tsx`), `ui` and `shared`
(nearly empty — component gravity pulled everything into features). No store
layer: state lives in per-component hooks (`useLiveData`, `useState`),
polling/caching semantics live in `api/requestCache.ts` and feature hooks.
Governance attempts exist (`governance/ownership.toml` + `check:deps`/
`check:size`/`check:complexity`) but the rules codify the mess rather than
prevent it: features may import features laterally, deep subpath imports are
the norm (no barrels), and the size guard carries per-file exceptions.

## Why it suits the successor pattern

1. **Protocol truth is external.** The hardest lesson-packet work — contract
   extraction — is already done and owned by den-services. The predecessor's
   hand-written `api/*/types.ts` files are *evidence to verify against the
   services*, not truth to port. The successor's protocol layer can be
   generated/aliased from the den-services contracts directly.
2. **The feature inventory is the PRD table of contents.** `features/src/`
   enumerates: agents, channels, dm, documents, fleetops, git, librarian,
   messages, notifications, piCrewDiagnostics, preferences, projects,
   sessions, tasks. Each maps 1:1 to a v2 `feature-*` lib. Behavior discovery
   is per-directory, bounded reading.
3. **No code consumers.** Nothing imports den-web packages; the only consumer
   is the browser. No compatibility shims can become permanent because there
   is no package surface to shim.
4. **Cutover/rollback is already documented and cheap.** Static-service
   contract + standalone deploy guide exist in `docs/`; cutover is pointing
   the static server at a new `dist`, rollback is pointing it back.
5. **The distillation targets self-identify.** `ownership.toml`'s
   `expected_violations` and file-size `contract_exceptions` are a confessed
   list of where the current shape lost. The three homegrown check scripts
   are replaced wholesale by Nx boundary tags + lint in the successor.
6. **A port-as-spec kernel exists.** `models/` is pure, framework-free
   projection logic with 10 test files (e.g. `channelChatRenderModel`).
   Rewrite the code, but carry the *test cases* forward as behavioral
   fixtures — they are the strongest inherited selection pressure available.

## What the successor brief must add (the weak points)

1. **Selection environment.** 58 unit tests, zero Playwright/e2e;
   `smoke:live` is a node script. Without added acceptance criteria, "similar
   functionality" gets judged by eyeball — the proxy-confidence trap, and
   mid-tier implementation models are the most prone to it. The successor
   should stand up the bootstrap template's live harness in phase 0 and
   define **"ported" = the feature's live scenario runs and its artifacts
   were inspected**, one scenario per feature, written *before* the feature
   is built (from observing the predecessor run).
2. **Implicit live-update semantics.** With no store layer, the real
   behavioral contract — what polls vs streams, refresh cadence, cache
   invalidation, notification badge rules, optimistic vs read-back updates —
   lives scattered in hooks. The lesson packet needs an explicit inventory of
   these (start from `useLiveData` and `requestCache.ts`); this is where
   "works like the old one" quietly fails.
3. **Forbidden inheritance list.** At minimum: lateral feature→feature
   imports (legal here, banned in v2), deep subpath imports, per-file guard
   exceptions as a growth mechanism, fetching/caching inside components, and
   the legacy den-core/den-channels fallback paths (the README already says
   normal workflows use `/api/v1`; the successor should inherit only the
   successor routes and name the legacy paths as explicitly not inherited).
4. **Per-feature triage, not blanket parity.** 15 features is too big a
   first bite for a single "reach parity then cut over" run. The brief should
   force an inherit / defer / drop decision per feature (candidates to
   defer or drop: fleetops, piCrewDiagnostics, git — verify against actual
   usage), and sequence the build core-first: tasks, channels/messages,
   documents, notifications, projects/sessions. Since cutover is per-deploy
   rather than per-route, parity scope = the inherit list only.

## Fit with the mid-tier-model build approach

Good. The properties that make successor builds work with weaker
implementation models are all present or providable: external contracts
(no invention required), enumerated features (bounded task cells), the
bootstrap template's rails (generators make the correct path the lazy path),
and no do-no-harm refactor gravity. The two areas to reserve for a stronger
model or human-adjacent review: the live-update semantics inventory (item 2
above — extraction, judgment-heavy) and shell/router/provider wiring (done
once, everything hangs off it). Feature-by-feature implementation after that
is well inside mid-tier capability.

## Suggested phase 0 (before any feature work)

1. Copy the bootstrap template; wire protocol to den-services contracts.
2. Port `models/` test cases as domain fixtures (code rewritten, cases kept).
3. Write the live-update semantics inventory from the predecessor.
4. Write the per-feature triage table + one live scenario stub per inherited
   feature.
5. Define cutover: static-service contract unchanged, deploy guide reused,
   predecessor kept deployable until the inherit list's scenarios all pass
   inspection.

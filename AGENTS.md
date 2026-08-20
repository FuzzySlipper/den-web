# Den Web Agent Guide

This frontend is built as layered Angular/Nx infrastructure. Architecture is
fixed unless the task explicitly says otherwise.

## Current Shape

The root workspace is the successor implementation. The old React/Vite app lives
under `local/` as predecessor evidence only. Do not import or port code from it.
Carry forward selected behavior, tests, and operational lessons.

## Layer Rules

```text
protocol -> transport -> domain -> store -> renderer/components -> feature-* -> shell
             platform ----^
```

- `libs/protocol`: generated or aliased wire contracts and classified errors.
- `libs/platform`: browser/host ports and test fakes.
- `libs/transport`: HTTP/SSE/WebSocket communication and error normalization.
- `libs/domain`: pure projections, reducers, validation, navigation semantics.
- `libs/store`: Angular signals stores with `AsyncState<T>`.
- `libs/renderer`: high-scale rendering surfaces.
- `libs/components`: domain-blind presentational primitives.
- `libs/feature-*`: one user-facing workflow per library.
- `libs/shell`: root routes, providers, and feature composition only.

## Shell & Routing

`libs/shell` owns the real shell: `shell.routes.ts` lazy-routes each feature
component at its own path (`/tasks`, `/messages`, ...; unknown paths redirect to
`/tasks`), and `ShellComponent` (selector `den-root`, bootstrapped from
`apps/den-web/src/main.ts`) renders the grouped nav rail, the collapsible
workspace panel, and the `router-outlet`. There is no tab bar or app-level
`@switch`; cross-feature navigation goes through `NAVIGATION_STORE`
(`openTab`/`openMessageThread`), which the shell turns into router navigation.

## Hard Rules

- Use workspace generators or existing layer templates for new libs, features,
  stores, and live scenarios.
- Do not duplicate backend protocol types; use protocol exports only.
- Do not import another library's internals; public entrypoints only.
- Do not bypass transport for backend communication.
- Do not bypass platform ports for browser APIs.
- Do not bypass stores for application state mutation.
- Do not put domain logic in components.
- Do not put feature logic in shell.
- Expose async state as `AsyncState<T>`.
- Map all transport failures to classified errors.
- Do not add global CSS except through approved theme files or app reset.
- Do not use `any`, non-null assertions, unsafe casts, or lint disables.
- Do not add direct `den-channels`, worker, Hermes, or pi-crew product paths.

## Evidence

Do not close a user-deliverable UI task on deterministic evidence alone. Run the
live scenario, inspect the rendered artifacts, and report what the UI did,
including non-claims. See `docs/live-testing.md`.

When a task seems to require breaking a boundary, stop and request planner
review.

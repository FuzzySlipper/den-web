# Den Web Agent Guide

## Layer Quick Reference

| Layer | Current Phase 1 Path | Target Package | May Import | May Not Import | React |
| --- | --- | --- | --- | --- | --- |
| Foundation | `src/shared/`, generic parts of `src/utils.ts` | `packages/shared/` | external utilities only | internal packages | No |
| Browser foundation | `src/hooks/` | shell hooks or future browser foundation | shared | api/models/features/shell unless deliberately promoted | Yes |
| Data | `src/api/` | `packages/api/` | shared | models, ui, features, shell | No |
| Transform | current `*Model.ts` / `*Display.ts` files, target `src/models/` | `packages/models/` | api, shared | ui, features, shell | No |
| Presentation | target only in Phase 1 | `packages/ui/` | shared | api, models, features, shell | Yes |
| Composition | `src/features/` | `packages/features/` | api, models, shared, ui, sibling features if acyclic | shell | Yes |
| Bootstrap | `src/app-shell/`, app wiring | `packages/shell/` | everything | - | Yes |

## Where Things Go

- Backend types and HTTP clients -> `api`.
- Transforming backend data into display shapes -> `models`.
- Generic utilities such as JSON record parsing and formatters -> `shared`.
- Domain-blind reusable UI components -> `ui`.
- Feature views that compose models and UI into product surfaces -> `features`.
- App routing, layout, global state coordination, and app wiring -> `shell`.

## Feature Dependencies

Features may import sibling features when that reflects real composition. For example, tasks can compose agent, git, and message views; sessions can compose channel chat. The rule is no cycles. If feature A imports feature B, feature B must not import feature A.

## File Discipline

- Phase 1 file-size checks are baseline-aware: existing large files warn, new growth fails.
- Target steady state: warn at 400 lines, fail at 600 lines.
- Functions fail at 120 lines and warn conceptually at 80 lines.
- Cognitive complexity limit is 15.
- If a change pushes a file past the warning threshold, split into a sibling file in the same layer.

## Training-Bias Correction

These patterns are forbidden in this codebase:

1. God-components that combine fetching, state management, event handling, model construction, and rendering.
2. Putting backend-to-display transforms in feature view files because they are convenient today.
3. Parallel constructors that hand-copy the same target shape in multiple functions.
4. Moving all feature composition into `App.tsx` or one shell file to avoid sibling feature imports.
5. Deep cross-layer relative imports when a package/workspace import exists.
6. Domain-specific components in `ui`; keep them in features unless they are genuinely domain-blind.
7. Treating Phase 1 warnings as permanent. The baseline must be cleared by the model extraction and large-file decomposition phases.

Reviewer prompt checklists live under `governance/reviewer-prompts/` for patterns that CI cannot fully mechanize:

- `governance/reviewer-prompts/models-boundary-reviewer.md` for changes under `packages/models/src/**`.
- `governance/reviewer-prompts/api-boundary-reviewer.md` for changes under `packages/api/src/**`.
- `governance/reviewer-prompts/channel-render-reviewer.md` for channel render and activity model changes.

When in doubt, write the boring version: one responsibility, in the right layer, with the dependency direction obvious.

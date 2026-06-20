# Channel Render Reviewer Prompt

Use this checklist when reviewing any change that touches `packages/models/src/channels/**`, or any channels-domain file matching `*Render*.ts` or `*Activity*.ts`.

## Scope

This prompt is living review documentation, not an automated gate. CI can flag size, complexity, lint, and import direction, but it cannot reliably detect duplicated render constructors or quiet field-copy drift.

## Checklist

- [ ] No new function takes an `*Event` and returns a `*Display` by hand-copying fields when an existing builder can be extended.
- [ ] Use one builder function plus small override-returning functions for variants.
- [ ] No new parallel constructor builds the same target display type as an existing constructor.
- [ ] Constructor input and output types are declared in the model module or its domain types, not locally in consuming feature files.
- [ ] If the change touches the `piCrew*` family, extend the existing override functions instead of duplicating them.
- [ ] Event-to-display mapping preserves source identifiers needed for traceability: message IDs, task IDs, run IDs, assignment IDs, project IDs, and channel IDs where available.
- [ ] Search/filter behavior is applied after canonical display construction unless there is a documented reason to filter earlier.
- [ ] No file exceeds 600 lines. If the change pushes a file past 400 lines, split into a sibling model file.
- [ ] `npm run check:all` passes.

## Review Notes

Channel render code is where small duplication turns into subtle UI drift. Favor a single canonical construction path, then make each variant obvious through typed overrides.

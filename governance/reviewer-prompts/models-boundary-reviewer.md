# Models Boundary Reviewer Prompt

Use this checklist when reviewing any change that touches `packages/models/src/**`.

## Scope

This prompt is living review documentation, not an automated gate. CI covers the package layout, dependency direction, file-size guardrails, function-size guardrails, complexity guardrails, and lint baselines. This checklist catches model-boundary patterns that are hard to mechanize.

## Checklist

- [ ] No new function imports React, `react-dom`, or any UI library.
- [ ] New transforms take API-layer types as input and return display-shaped types as output.
- [ ] Display-shaped types are deterministic and serializable; no hidden browser or component state leaks into model output.
- [ ] If constructing a type with many fields, use one builder plus small override-returning helpers instead of parallel constructors.
- [ ] Types are declared in the domain's types file or in the model module itself, not locally inside consuming features.
- [ ] Domain-specific parsing, grouping, labeling, sorting, and attribution live in models when reused across feature views.
- [ ] No feature, shell, or UI imports were introduced.
- [ ] No file exceeds 600 lines; warn and request a split when a changed file exceeds 400 lines.
- [ ] `npm run check:all` passes.

## Review Notes

Prefer boring model APIs: typed input, typed output, no React assumptions, no feature-view knowledge. When a model helper starts accepting JSX, component callbacks, browser refs, or feature-local state, it belongs somewhere else.

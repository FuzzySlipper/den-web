# API Boundary Reviewer Prompt

Use this checklist when reviewing any change that touches `packages/api/src/**`.

## Scope

This prompt is living review documentation, not an automated gate. CI checks import direction and broad guardrails, but reviewers still need to catch accidental display logic, side effects, and backend-contract drift.

## Checklist

- [ ] No imports of React, `react-dom`, feature code, shell code, model code, or any UI library.
- [ ] No display logic, formatting, labeling, grouping, or domain-to-display transforms were added. Those belong in `packages/models/src/**`.
- [ ] HTTP clients are pure request wrappers: they take config or typed request objects, return typed promises, and perform no side effects beyond the network call.
- [ ] Types match the backend contract. Any deliberate deviation is documented next to the type or in the relevant contract note.
- [ ] Gateway/core/channel DTOs remain named after backend concepts, not UI presentation concepts.
- [ ] Shared helpers imported by API code are domain-neutral and do not pull in browser, model, feature, or shell dependencies.
- [ ] Large contract files are split when there is a real backend-contract boundary. If not split, any exception is documented in governance with a ceiling.
- [ ] No file exceeds 600 lines unless covered by a documented contract exception; warn and request a split when a changed file exceeds 400 lines.
- [ ] `npm run check:all` passes.

## Review Notes

The API layer should feel like a typed transport adapter. If a change answers "how should this look in Den Web?" it is probably not API-layer work.

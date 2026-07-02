# Domain And Store Fixture Notes

Date: 2026-07-02.

Phase 3 carries forward predecessor behavior as fixture expectations, not as
ported implementation code. The successor domain layer keeps only inherited
Den Web cockpit behavior that has a den-services `/api/v1/*` path.

Carried-forward fixture coverage:

- task active/status filtering, dependency-waiting detection, nested search
  visibility, and flat-list parent context;
- document dirty-switch decisions, canonical Markdown selection, and discussion
  thread separation;
- notification read-cache mapping as optimistic UI state, with service read
  state remaining authoritative;
- message intent labels and fallback body projection;
- conversation body segmentation for `<details>` blocks and timeline item
  projection;
- Observation-backed agents overview with explicit degraded source state;
- signal stores with private writable state, public readonly signals, named
  commands, and `AsyncState<T>` for every async value.

Dropped predecessor assumptions:

- feature components should not own polling, local readback, backend calls, or
  browser effects;
- local notification storage is not authoritative state;
- document discussion is not part of the canonical document Markdown body;
- old direct-connectivity and deferred feature premises are not represented in
  successor domain models.

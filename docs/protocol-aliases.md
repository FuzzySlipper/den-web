# Den Web Protocol Aliases

Date: 2026-07-02.

Phase 2 uses hand-written stable protocol aliases in `libs/protocol/src/lib/den-services.ts`.
They are intentionally thin frontend-facing aliases for den-services successor
routes while generated OpenAPI/schema output is not yet wired into this repo.

Rules for these aliases:

- they are evidence-backed by `docs/den-web-static-service-contract.md`;
- transport clients import through `@den-web/protocol` only;
- they do not replace backend ownership or schema truth;
- Phase 2 tests assert canonical route construction and error taxonomy;
- a later protocol-generation task should replace the alias internals without
  changing feature/store imports.

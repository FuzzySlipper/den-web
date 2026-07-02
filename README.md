# Den Web

Den Web is the static browser cockpit for the Den system. This root workspace is
now the Angular/Nx successor scaffold. The predecessor React/Vite implementation
is preserved under `local/` as product evidence only.

## References

- [Successor brief](docs/successor-brief.md)
- [Live testing catalog](docs/live-testing.md)
- [Successor assessment](docs/successor-assessment.md)
- [Static service contract](docs/den-web-static-service-contract.md)
- [Standalone deploy guide](docs/den-web-standalone-deploy.md)

## Local Development

```bash
npm install
npm run dev
npm run verify
npm run e2e
```

Useful focused commands:

```bash
npm run check:pattern
npm run check:docs
npm run lint
npm run typecheck
npm test
npm run build
```

## Architecture

The successor follows `den:patch/rusty-view-ui-architecture-pattern`:

```text
protocol -> transport -> domain -> store -> renderer/components -> feature-* -> shell
             platform ----^
```

Normal browser connectivity must use den-services successor surfaces through the
same-origin `/api/v1/*` Den Web proxy. The root app must not reintroduce legacy
`den-channels` product dependencies.

## Live Verification

Live scenarios are opt-in:

```bash
npm run serve:local
LIVE_RUN=1 BASE_URL=http://127.0.0.1:4200 npm run e2e
```

The live harness consumes `BASE_URL`; it does not manage ports or processes.
Rendered artifacts, not store snapshots alone, close user-deliverable UI claims.

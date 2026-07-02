# Den Web

Den Web is the standalone static-site browser cockpit for the Den system. It owns the React/Vite frontend, static assets, frontend tests, and UI smoke checks while consuming API contracts owned by den-services successor surfaces.

This repository was scaffolded from the `den-channels` ClientApp (source commit `cd7bb549ea6dcbc1ce912aea87fd81cec346451c`) as part of Den task #1706.

## Contract and migration docs

- [Static service contract](docs/den-web-static-service-contract.md)
- [Standalone deploy guide](docs/den-web-standalone-deploy.md) — deployment, smoke, rollback instructions

## Ownership boundaries

- `den-web`: frontend app, static deploy/smoke, browser UX modules, UI tests.
- den-services projects/tasks/messages/documents/review/librarian: project scope, task workflow, notifications, documents, review operations, and retrieval.
- den-services Gateway: Observation, Delivery, Conversation, Timeline, and Doc Publish successor surfaces.
- Legacy `den-core` and `den-channels` paths may remain as rollback/debug affordances, but normal Den Web workflows should use `/api/v1` successor routes.

Do not add backend state authority to `den-web`; add API/client adapters here and backend behavior in the owning service.

## Local development

```bash
# Install dependencies
npm install

# Start dev server with Hot Module Replacement
npm run dev

# Run all tests
npm test

# Run a specific test file
npx vitest run src/api/config.test.ts

# Lint
npm run lint

# Production build
npm run build
```

### Vite dev server proxy

The production static server proxies `/api/v1` successor requests to den-services owners. The Vite dev server still supports the legacy `/den-core-api` proxy for diagnosis and rollback testing.
Configure the legacy Core target with `VITE_DEV_DEN_CORE_TARGET` (default: `http://localhost:5299`):

```bash
VITE_DEV_DEN_CORE_TARGET=http://192.168.1.10:5299 \
  npm run dev
```

### Runtime configuration

The app loads API base URLs from `/den-web-config.json` at runtime when present.
Fallback order:

1. `/den-web-config.json` (deploy-time JSON override)
2. Vite build-time env vars (`VITE_TASKS_SUCCESSOR_API_BASE`, `VITE_MESSAGES_SUCCESSOR_API_BASE`, `VITE_DOC_PUBLISH_API_BASE`)
3. Hardcoded defaults (`/api/v1`, `/api/v1`, `/api/v1/blog/publications`)

For local development without a runtime config file, copy `.env.example` to `.env` and adjust values if needed:

```
VITE_TASKS_SUCCESSOR_API_BASE=/api/v1
VITE_MESSAGES_SUCCESSOR_API_BASE=/api/v1
VITE_DOC_PUBLISH_API_BASE=/api/v1/blog/publications
```

### Lockfile strategy

The `package-lock.json` is committed. Always use `npm ci` in CI/CD for reproducible installs.
In local development, use `npm install` (updates lockfile) or `npm ci` (strict lockfile install).

## Build output

Production build writes to `dist/`. The output is a fully static site that can be served
by any HTTP server (nginx, caddy, deno serve, etc.) at any path with proper URL rewriting
for SPA client-side routing.

## Deployment

The durable `den-srv` path is:

```bash
npm run deploy:den-srv
```

The deploy script stages timestamped releases under `/data/services/den-web/releases`,
flips stable symlinks, restarts `den-web.service`, runs the live smoke check, and
rolls back to the previous release if smoke fails. See
[Standalone deploy guide](docs/den-web-standalone-deploy.md) for the required
`den-srv` ownership, sudoers, and systemd settings.

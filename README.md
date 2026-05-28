# Den Web

Den Web is the standalone static-site browser cockpit for the Den system. It owns the React/Vite frontend, static assets, frontend tests, and UI smoke checks while consuming API contracts owned by `den-core`, `den-channels`, and `den-gateway`.

Current migration status: this repository starts with service-contract documentation. The app source is expected to be scaffolded from the current `den-channels` ClientApp in Den task #1706 after the static service contract in task #1705 is accepted.

## Contract and migration docs

- [Static service contract](docs/den-web-static-service-contract.md)

## Ownership boundaries

- `den-web`: frontend app, static deploy/smoke, browser UX modules, UI tests.
- `den-core`: canonical tasks, documents, messages, workflow/review state, and Core REST APIs.
- `den-channels`: channels, channel messages, memberships, reactions, activity events, and channel/Gateway-facing HTTP APIs.
- `den-gateway`: delivery, wake, binding, claim, and Hermes session routing authority.

Do not add backend state authority to `den-web`; add API/client adapters here and backend behavior in the owning service.

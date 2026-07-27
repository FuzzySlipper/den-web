# Den Web serving contract

Architecture decision: `den-services/den-web-go-edge-boundary-2026-07-26`.

## Ownership

`den-web` owns:

- the Angular/Nx browser application;
- browser routing, presentation, and transport adapters;
- compiled static assets;
- `den-web-config.json` and `den-web-build.json`;
- frontend tests, live UI smoke, and asset release automation.

`den-web` owns no backend state, service credentials, public listener, or API
reverse-proxy implementation.

The `web-edge` module in `den-services` owns static serving and the public
listener. Gateway owns browser route-to-service selection and credential
replacement. Projects, Tasks, Messages, Documents, Guidance, Review, Artifacts,
Librarian, Conversation, Timeline, Observation, Delivery, and Doc Publish
remain the authorities for their own domains.

## Public contract

The canonical operator URL is:

```text
http://192.168.1.10:18080/
```

| Path | Owner | Contract |
| --- | --- | --- |
| `/` and browser routes | `web-edge` | Serve the active SPA release with index fallback. |
| `/den-web-config.json` | `den-web` release, served by `web-edge` | Public same-origin API bases and environment label; never secrets. |
| `/den-web-build.json` | `den-web` release, served by `web-edge` | Frontend commit and release identity. |
| `/health` | `web-edge` | Real Go service health JSON, never SPA HTML. |
| `/version` | `web-edge` | Go edge build/version JSON. |
| `/api/v1/*` | `web-edge` -> Gateway | Strip `/api`, replace browser auth with the edge caller token, and route through Gateway. |
| `/api/*` outside `/api/v1` | `web-edge` | `410 Gone`; no den-channels fallback. |
| `/den-core-api/*`, `/den-host-api/*`, `/den-gateway-api/*` | `web-edge` | `404 Not Found`; compatibility proxies are retired. |

The browser never receives a service token and never targets service loopback
ports directly.

## Runtime config

The browser loads `/den-web-config.json` before creating transport clients.
Supported API bases are:

| Key | Normal value |
| --- | --- |
| `tasksSuccessorApiBase` | `/api/v1` |
| `messagesSuccessorApiBase` | `/api/v1` |
| `conversationSuccessorApiBase` | `/api/v1/conversation` |
| `timelineSuccessorApiBase` | `/api/v1/timeline` |
| `observationSuccessorApiBase` | `/api/v1/observation` |
| `deliverySuccessorApiBase` | `/api/v1/delivery` |
| `docPublishApiBase` | `/api/v1/blog/publications` |
| `artifactsApiBase` | `/api/v1/artifacts` |

Feature flags and project allowlists may also be present. Missing config may
fall back to local development defaults. Malformed config must produce a visible
diagnostic and must not silently redirect requests to another authority.

## Caching

- `index.html`, runtime config, and build sentinel: no-cache/no-store;
- content-hashed assets: one-year immutable cache;
- other static files: revalidate.

An asset release is activated by an atomic symlink flip. The Go edge follows the
stable symlink and normally does not restart.

## Acceptance

A production release is healthy when:

1. `/health` and `/version` return edge JSON with the deployed edge commit.
2. `/den-web-build.json` returns the expected frontend commit.
3. deep browser routes return the SPA shell.
4. `/api/v1/projects` and a project task read succeed through Gateway.
5. Conversation, Observation, and Timeline reads succeed through Gateway.
6. a retired `/api/*` path returns `410`.
7. browser tests show no backend token or loopback target in public config,
   HTML, or JavaScript.

Backend contract gaps belong in the owning `den-services` project, not in a new
frontend proxy or state store.

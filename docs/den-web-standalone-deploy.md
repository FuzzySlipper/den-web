# Den Web asset deployment

Architecture decision: `den-services/den-web-go-edge-boundary-2026-07-26`.

## Operating model

`den-web` owns the Angular/Nx application and publishes immutable frontend
releases. It does not run a production Node server.

The `web-edge` service in `den-services` owns the public listener on port 18080:

```text
browser :18080
  -> web-edge (static files, SPA fallback, health/version)
  -> /api/v1/* -> Gateway :8079 -> owning den-services service
```

The edge has one Gateway caller token. Backend targets and service tokens belong
to Gateway, not this repository or its release directories.

## Release layout

```text
/data/services/den-web/
├── current -> releases/<release-id>
├── previous -> releases/<previous-release-id>
├── wwwroot -> current/wwwroot
└── releases/
    └── <release-id>/
        └── wwwroot/
            ├── index.html
            ├── assets/
            ├── den-web-config.json
            └── den-web-build.json
```

`web-edge` follows the stable `wwwroot` symlink on each request. A frontend
release therefore does not require a service restart.

## New-server prerequisite

Deploy `gateway` and `web-edge` from `den-services` before publishing the first
frontend release. The registered service contract installs:

- `/etc/den-services/web-edge.yaml`;
- `/etc/den-services/web-edge.env`;
- `/data/services/web-edge/web-edge`;
- `den-go@web-edge.service`.

The edge config expects `/data/services/den-web/wwwroot` to contain
`index.html`, `den-web-config.json`, and `den-web-build.json`. Stage the first
frontend release before starting the edge, or create the release during the
same cutover.

## Deploy

From a workstation with access to the target host:

```bash
npm run deploy:den-srv:remote
```

From a checkout already on the service host:

```bash
cd /data/dev/den-web
git pull --ff-only origin main
npm run deploy:den-srv
```

The deploy script:

1. rejects a dirty tree unless `ALLOW_DIRTY=1`;
2. runs install, checks, tests, and the production build;
3. stages assets plus runtime/build JSON into a new release;
4. atomically flips `current`, `previous`, and `wwwroot`;
5. waits for the edge to expose the new build sentinel;
6. runs the live Den Web smoke;
7. restores the previous symlink target if verification fails.

The regression harness exercises both non-mutating dry-run behavior and a
forced smoke failure that restores `current`, `wwwroot`, and `previous` while
the independently managed edge remains running:

```bash
npm run test:asset-release
```

Useful overrides:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DEPLOY_ROOT` | `/data/services/den-web` | Asset release root. |
| `DEN_WEB_URL` | `http://192.168.1.10:18080` | Public smoke target. |
| `KEEP_RELEASES` | `5` | Number of releases retained. |
| `ALLOW_DIRTY` | unset | Permit deploying committed HEAD from a dirty checkout. |
| `SKIP_INSTALL` | unset | Skip `npm ci`. |
| `SKIP_CHECKS` | unset | Skip pre-build checks and tests. |
| `DEPLOY_SMOKE` | `1` | Set to `0` only for deliberate staged work. |
| `DRY_RUN` | unset | Validate and print without activating a release. |

The remote wrapper additionally supports `DEN_WEB_DEPLOY_TARGET`,
`DEN_WEB_REMOTE_REPO`, `DEN_WEB_DEPLOY_BRANCH`, `SKIP_PUSH`, and
`SKIP_SENTINEL`.

## Runtime config

Each release contains same-origin browser bases:

```json
{
  "tasksSuccessorApiBase": "/api/v1",
  "messagesSuccessorApiBase": "/api/v1",
  "conversationSuccessorApiBase": "/api/v1/conversation",
  "observationSuccessorApiBase": "/api/v1/observation",
  "deliverySuccessorApiBase": "/api/v1/delivery",
  "timelineSuccessorApiBase": "/api/v1/timeline",
  "docPublishApiBase": "/api/v1/blog/publications",
  "artifactsApiBase": "/api/v1/artifacts",
  "visualContractApiBase": "/api/v1/visual-contracts",
  "environmentName": "den-srv"
}
```

Deploy-time environment variables may change these public paths and feature
allowlists. They must never contain a backend target URL or credential.

## Verification

```bash
curl -fsS http://127.0.0.1:18080/health
curl -fsS http://127.0.0.1:18080/version
curl -fsS http://127.0.0.1:18080/den-web-build.json
curl -fsS http://127.0.0.1:18080/den-web-config.json
curl -fsS http://127.0.0.1:18080/api/v1/projects
curl -fsS 'http://127.0.0.1:18080/api/v1/projects/den-web/tasks?limit=1'
curl -fsS 'http://127.0.0.1:18080/api/v1/observation/lane?limit=1'
```

`/health` and `/version` describe the Go edge build. The frontend commit is
reported separately by `/den-web-build.json`.

## Rollback

Frontend rollback is an asset-only symlink operation:

```bash
cd /data/services/den-web
ln -sfn "$(readlink previous)" current
ln -sfn current/wwwroot wwwroot
```

Verify the restored sentinel and representative API reads. Do not restart or
roll back Gateway/backend services for an asset-only problem.

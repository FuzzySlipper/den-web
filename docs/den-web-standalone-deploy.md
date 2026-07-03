# Den Web standalone deploy guide

Den task: #1707. Umbrella: #1704. ADR: `den-web/den-web-standalone-static-site-service`.

## Service overview

Den Web runs as a standalone Node.js static/reverse-proxy service on `den-srv`.
It serves the built React/Vite frontend assets and proxies API requests to backend
services.

| Component | Host | Route | Description |
|-----------|------|-------|-------------|
| Den Web static service | `den-srv:18080` | `/` | SPA frontend, static assets, runtime config |
| den-services owners | `den-srv:8091-8098` | `/api/v1/*` -> `/v1/*` | Projects, Tasks, Messages, Documents, Review, and Librarian successor APIs |
| Den Gateway (backend) | `den-srv:8079` | `/api/v1/*` → `/v1/*` | Gateway-owned Conversation, Timeline, Observation, Delivery, and Doc Publish routes |
| Public operator URL | `http://192.168.1.10:18080/` | — | Entry point for browser users |

## Deploy root

```
/data/services/den-web/
├── current -> releases/<release-id>        # Active release
├── previous -> releases/<previous-id>      # Previous release, for rollback
├── wwwroot -> current/wwwroot              # Stable STATIC_ROOT for systemd
├── den-web-static-server.mjs -> current/den-web-static-server.mjs
├── releases/
│   └── <release-id>/
│       ├── wwwroot/
│       │   ├── index.html
│       │   ├── assets/
│       │   ├── den-web-config.json
│       │   └── den-web-build.json
│       ├── den-web-static-server.mjs
│       └── gateway.env -> ../../shared/gateway.env  # if present
└── shared/
    └── gateway.env       # Optional token/target overrides, not release-owned
```

Older manual deployments used a real `/data/services/den-web/wwwroot`
directory. The deploy script preserves that directory by moving it aside to
`wwwroot.pre-symlink-<timestamp>` the first time it takes over symlink
management.

## Recommended deploy path

On first deploy, clone the repo under the deploy user:

```bash
sudo install -d -o agent -g agents -m 0755 /data/dev
sudo -u agent git clone git@github.com:FuzzySlipper/den-web.git /data/dev/den-web
```

Then run the durable deploy script from the repo root on `den-srv`:

```bash
cd /data/dev/den-web
git pull --ff-only origin main
SYSTEMCTL="sudo -n /usr/bin/systemctl" npm run deploy:den-srv
```

If invoking the deploy from a root shell rather than an `agent` shell, pass the
environment through `sudo` explicitly:

```bash
cd /data/dev/den-web
sudo -H -u agent env SYSTEMCTL="sudo -n /usr/bin/systemctl" npm run deploy:den-srv
```

What the script does:

1. Refuses a dirty git tree unless `ALLOW_DIRTY=1` is set.
2. Runs `npm ci`, `npm run check:all`, `npm test`, `npm run test:static-server`, and `npm run build`.
3. Stages `dist/`, runtime config, build sentinel, and the static server into `releases/<timestamp>-<commit>`.
4. Flips `current`, `previous`, `wwwroot`, and `den-web-static-server.mjs` symlinks.
5. Restarts `den-web.service`.
6. Runs `tools/scripts/smoke-den-web.mjs` against `DEN_WEB_URL` and the expected commit.
7. If restart or smoke fails, rolls `current` back to the previous release and restarts the service again.

Useful deploy overrides:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DEPLOY_ROOT` | `/data/services/den-web` | Deployment root. |
| `DEN_WEB_URL` | `http://192.168.1.10:18080` | Public URL used by smoke. |
| `SERVICE_NAME` | `den-web.service` | systemd service to restart. |
| `SYSTEMCTL` | `systemctl` | Command used for service restart, e.g. `sudo -n /usr/bin/systemctl`. |
| `KEEP_RELEASES` | `5` | Number of release directories to keep. |
| `ALLOW_DIRTY` | unset | Set to `1` to allow deploying uncommitted source. |
| `SKIP_INSTALL` | unset | Set to `1` to skip `npm ci`. |
| `SKIP_CHECKS` | unset | Set to `1` to skip check/test gates before build. |
| `DEPLOY_RESTART` | `1` | Set to `0` to stage and flip symlinks without restarting. |
| `DEPLOY_SMOKE` | `1` | Set to `0` to skip live smoke. |
| `DRY_RUN` | unset | Set to `1` to print commands without writing releases. |

Runtime config values are generated from:

```bash
TASKS_SUCCESSOR_API_BASE=/api/v1
MESSAGES_SUCCESSOR_API_BASE=/api/v1
CONVERSATION_SUCCESSOR_READS_ENABLED=true
CONVERSATION_SUCCESSOR_WRITES_ENABLED=true
CONVERSATION_SUCCESSOR_API_BASE=/api/v1/conversation
CONVERSATION_SUCCESSOR_READ_PROJECT_IDS=den-web
CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS=den-web
TIMELINE_SUCCESSOR_ENABLED=true
TIMELINE_SUCCESSOR_API_BASE=/api/v1/timeline
TIMELINE_SUCCESSOR_PROJECT_IDS=den-web
DOC_PUBLISH_API_BASE=/api/v1/blog/publications
APP_BASE_PATH=/
ENVIRONMENT_NAME=den-srv
```

The deployed service target URLs are systemd/static-server settings, not browser
runtime config. Keep service tokens in `/data/services/den-web/shared/gateway.env`
with mode `0640`, not in release directories or git.

## Required den-srv service setup

One-time deploy-root ownership:

```bash
sudo install -d -o agent -g agents -m 0755 /data/services/den-web
sudo install -d -o agent -g agents -m 0755 /data/services/den-web/releases
sudo install -d -o agent -g agents -m 0750 /data/services/den-web/shared
```

If gateway proxy credentials are needed:

```bash
sudo install -o agent -g agents -m 0640 /dev/null /data/services/den-web/shared/gateway.env
sudoedit /data/services/den-web/shared/gateway.env
```

Example `gateway.env`:

```bash
DEN_GATEWAY_TARGET=http://127.0.0.1:8079
DEN_GATEWAY_SERVICE_TOKEN=<service-token>
DEN_PROJECTS_TARGET=http://127.0.0.1:8091
DEN_TASKS_TARGET=http://127.0.0.1:8092
DEN_MESSAGES_TARGET=http://127.0.0.1:8093
DEN_DOCUMENTS_TARGET=http://127.0.0.1:8094
DEN_REVIEW_TARGET=http://127.0.0.1:8096
DEN_LIBRARIAN_TARGET=http://127.0.0.1:8098
DEN_GATEWAY_DELIVERY_WRITE_TOKEN=<delivery-write-token-or-service-token>
DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN=<doc-publish-caller-token>
DEN_GATEWAY_OBSERVATION_READ_TOKEN=<observation-read-token>
DEN_GATEWAY_CONVERSATION_READ_TOKEN=<conversation-read-token>
DEN_GATEWAY_CONVERSATION_WRITE_TOKEN=<conversation-write-token>
DEN_GATEWAY_TIMELINE_READ_TOKEN=<timeline-read-token>
```

To let the `agent` user deploy without full root, add a narrow sudoers drop-in:

```sudoers
agent ALL=(root) NOPASSWD: /usr/bin/systemctl restart den-web.service, /usr/bin/systemctl status den-web.service
```

Then run deploys with:

```bash
SYSTEMCTL="sudo -n /usr/bin/systemctl" npm run deploy:den-srv
```

The service itself should run as `agent` and read only the stable symlinks under
`/data/services/den-web`.

### systemd service unit

Create `/etc/systemd/system/den-web.service`:

```ini
[Unit]
Description=Den Web static site service
After=network.target
Wants=den-gateway.service den-projects.service den-tasks.service den-messages.service den-documents.service den-review.service den-librarian.service

[Service]
Type=simple
User=agent
Group=agents
WorkingDirectory=/data/services/den-web
ExecStart=/usr/bin/node /data/services/den-web/den-web-static-server.mjs
Restart=always
RestartSec=5
Environment=PORT=18080
Environment=HOST=0.0.0.0
Environment=STATIC_ROOT=/data/services/den-web/wwwroot
Environment=DEN_GATEWAY_TARGET=http://127.0.0.1:8079
Environment=GATEWAY_ENV_PATH=/data/services/den-web/shared/gateway.env

# Hardening
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
```

Start and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable den-web.service
sudo systemctl start den-web.service
sudo systemctl status den-web.service
```

## Manual fallback

The old manual path is still useful for diagnosis, but should not be the normal
deployment process because it lacks atomic release switching and automatic
rollback.

```bash
cd /data/dev/den-web
npm ci
npm run check:all
npm test
npm run test:static-server
npm run build
mkdir -p /data/services/den-web/wwwroot
cp -r dist/* /data/services/den-web/wwwroot/
cp tools/scripts/den-web-static-server.mjs /data/services/den-web/den-web-static-server.mjs
sudo systemctl restart den-web.service
```

After any manual copy, run `node /data/dev/den-web/tools/scripts/smoke-den-web.mjs`
with `DEN_WEB_URL` and `EXPECTED_BUILD_COMMIT` set as appropriate.

## Environment reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `18080` | Listen port |
| `HOST` | `0.0.0.0` | Listen host |
| `STATIC_ROOT` | `/data/services/den-web/wwwroot` | Static asset directory |
| `DEN_PROJECTS_TARGET` | `http://127.0.0.1:8091` | Projects successor backend URL |
| `DEN_TASKS_TARGET` | `http://127.0.0.1:8092` | Tasks successor backend URL |
| `DEN_MESSAGES_TARGET` | `http://127.0.0.1:8093` | Messages/notifications successor backend URL |
| `DEN_DOCUMENTS_TARGET` | `http://127.0.0.1:8094` | Documents/discussions successor backend URL |
| `DEN_REVIEW_TARGET` | `http://127.0.0.1:8096` | Review successor backend URL |
| `DEN_LIBRARIAN_TARGET` | `http://127.0.0.1:8098` | Librarian successor backend URL |
| `DEN_GATEWAY_TARGET` | `http://127.0.0.1:8079` | Den Gateway backend URL for Gateway-owned successor APIs such as Conversation, Timeline, Observation, Delivery, and Doc Publish |
| `GATEWAY_ENV_PATH` | sibling `gateway.env` next to the server script | Optional service-token/target override file |
| `DEN_GATEWAY_DELIVERY_WRITE_TOKEN` | `DEN_GATEWAY_SERVICE_TOKEN` | Gateway caller token for `/v1/delivery/*`; injected server-side for `/api/v1/delivery/*` wake intent writes/reads. |
| `DEN_GATEWAY_OBSERVATION_READ_TOKEN` | empty | Gateway caller token for `GET /v1/observation/*`; injected server-side for `/api/v1/observation/*` reads. |
| `DEN_GATEWAY_CONVERSATION_READ_TOKEN` | empty | Gateway caller token for the feature-flagged conversation successor read pilot; injected server-side for `/api/v1/conversation/*` reads. |
| `DEN_GATEWAY_CONVERSATION_WRITE_TOKEN` | empty | Gateway caller token for feature-flagged conversation successor writes; injected server-side for non-GET `/api/v1/conversation/*` calls. |
| `DEN_GATEWAY_TIMELINE_READ_TOKEN` | empty | Gateway caller token for `GET /v1/timeline/*`; injected server-side for `/api/v1/timeline/*` reads and streams. |
| `DEN_WEB_CONFIG_PATH` | `${STATIC_ROOT}/den-web-config.json` | Path to runtime config |
| `DEN_WEB_BUILD_SENTINEL` | `${STATIC_ROOT}/den-web-build.json` | Path to build sentinel |
| `CACHE_MAX_AGE_SECONDS` | `31536000` | max-age for hashed assets |
| `CACHE_HTML_SECONDS` | `0` | max-age for HTML and un-hashed files |
| `APP_BASE_PATH` | `/` | App base path for config defaults |
| `ENVIRONMENT_NAME` | `den-srv` | Environment name for config defaults |
| `TASKS_SUCCESSOR_API_BASE` | `/api/v1` | Browser proxy base for tasks and other successor owner APIs |
| `MESSAGES_SUCCESSOR_API_BASE` | `/api/v1` | Browser proxy base for messages and notifications successor APIs |
| `CONVERSATION_SUCCESSOR_READS_ENABLED` | `true` | Enables Conversation successor channel/message reads in browser config. On den-srv this should stay aligned with write allowlists so posted messages are visible in the same UI. |
| `CONVERSATION_SUCCESSOR_WRITES_ENABLED` | `true` | Enables conversation successor message/reaction writes in browser config. |
| `CONVERSATION_SUCCESSOR_API_BASE` | `/api/v1/conversation` | Same-origin Den Web proxy base for Gateway conversation canary reads. |
| `CONVERSATION_SUCCESSOR_READ_PROJECT_IDS` | empty | Comma-separated project IDs allowed to use successor channel/message reads. Empty means route no projects. On den-srv, mirror the write allowlist during migration. |
| `CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS` | mirrors `CONVERSATION_SUCCESSOR_READ_PROJECT_IDS` | Comma-separated project IDs allowed to use successor message/reaction writes. Empty disables writes rather than falling back to den-channels. |
| `TIMELINE_SUCCESSOR_ENABLED` | `true` | Enables den-services Timeline read/SSE display composition in browser config. Set to `false` only for explicit successor incident response. |
| `TIMELINE_SUCCESSOR_API_BASE` | `/api/v1/timeline` | Same-origin Den Web proxy base for Gateway Timeline reads/streams. |
| `TIMELINE_SUCCESSOR_PROJECT_IDS` | `den-web` | Comma-separated project IDs allowed to use Timeline display composition. Empty means route no projects. |

## Cutover from den-channels

After `den-web` is deployed and smoked:

1. `http://192.168.1.10:18080/` should serve the `den-web` asset build.
2. Den Channels must continue serving backend `/api/...` routes on its own port
   (e.g., `http://127.0.0.1:18081`).
3. Any old static asset path owned by `den-channels` serving on port 18080 should
   be removed or redirected.

The Runner will handle the live service changes (port reassignments, den-channels
static removal, nginx/config adjustments) as a separate step. This repository only
provides the artifacts needed for that deployment.

## Rollback notes

- Keep the previous live `den-channels` static asset bundle identifiable until the
  first `den-web` live smoke passes.
- `npm run deploy:den-srv` automatically restores `current` to `previous` if
  restart or live smoke fails.
- If static asset serving fails but APIs are healthy, revert only the reverse proxy/
  static root to the previous `den-channels` path. Do not roll back Core/Channels/
  Gateway services.
- If API base config is wrong, fix `/den-web-config.json` and restart the service
  instead of rebuilding assets.
- Rollback command:
  ```bash
  sudo systemctl stop den-web.service
  sudo systemctl disable den-web.service
  # Restore previous static server / reverse proxy configuration
  # (e.g., point port 18080 back to den-channels wwwroot)
  ```
- With release symlinks, manual rollback is:
  ```bash
  cd /data/services/den-web
  ln -sfn "$(readlink previous)" current
  ln -sfn current/wwwroot wwwroot
  ln -sfn current/den-web-static-server.mjs den-web-static-server.mjs
  sudo systemctl restart den-web.service
  ```
- Post rollback evidence to the relevant Den task thread: failing URL, restored
  asset root, restored build sentinel hash, and API health checks.

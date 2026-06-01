# Den Web standalone deploy guide

Den task: #1707. Umbrella: #1704. ADR: `den-web/den-web-standalone-static-site-service`.

## Service overview

Den Web runs as a standalone Node.js static/reverse-proxy service on `den-srv`.
It serves the built React/Vite frontend assets and proxies API requests to backend
services.

| Component | Host | Route | Description |
|-----------|------|-------|-------------|
| Den Web static service | `den-srv:18080` | `/` | SPA frontend, static assets, runtime config |
| Den Core (backend) | `den-srv:5299` (127.0.0.1) | `/den-core-api/*` | Core REST facade (tasks, docs, messages) |
| Den Channels (backend) | `den-srv:18081` | `/api/*` | Channels/Gateway/Agents API |
| Den Gateway (backend) | `den-srv:5300` (127.0.0.1) | `/den-gateway-api/*` → `/api/gateway/*` | FleetOps and Den Gateway-owned APIs |
| Public operator URL | `http://192.168.1.10:18080/` | — | Entry point for browser users |

## Deploy root

```
/data/services/den-web/
├── wwwroot/              # Built static assets (dist/ contents)
│   ├── index.html
│   ├── assets/
│   │   ├── index-<hash>.js
│   │   └── index-<hash>.css
│   ├── den-web-config.json   # Runtime configuration (create on deploy)
│   └── den-web-build.json    # Build sentinel (create on deploy)
├── den-web-static-server.mjs # Copied from ops/den-web-static-server.mjs
└── .env                     # (optional) Service environment overrides
```

## Build and deploy steps

### 1. Build the frontend

```bash
# From the repository root on a development machine
cd /home/dev/den-web
npm ci
npm run build
```

The build output lands in `dist/`.

### 2. Create runtime config

Create `den-web-config.json` at the deploy root. This file is served at
`/den-web-config.json` and configures API base URLs without a rebuild.

Expected contents for `den-srv`:

```json
{
  "denCoreApiBase": "/den-core-api",
  "denChannelsApiBase": "/api",
  "denGatewayApiBase": "/den-gateway-api",
  "appBasePath": "/",
  "environmentName": "den-srv"
}
```

### 3. Create build sentinel

Create `den-web-build.json` at the deploy root. This file is served at
`/den-web-build.json` and provides deploy provenance for smoke tests.

```json
{
  "commit": "<full git commit SHA>",
  "builtAt": "2026-05-28T09:00:00Z",
  "builtBy": "deploy-runner",
  "sourceRepo": "/home/dev/den-web"
}
```

You can generate this automatically during a CI/CD pipeline:

```bash
cat > /data/services/den-web/wwwroot/den-web-build.json <<EOF
{
  "commit": "$(git rev-parse HEAD)",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "builtBy": "deploy",
  "sourceRepo": "/home/dev/den-web"
}
EOF
```

### 4. Copy artifacts

```bash
# Create deploy root
mkdir -p /data/services/den-web/wwwroot

# Copy built assets
cp -r dist/* /data/services/den-web/wwwroot/

# Copy runtime config
cp den-web-config.json /data/services/den-web/wwwroot/den-web-config.json

# Copy build sentinel
cp den-web-build.json /data/services/den-web/wwwroot/den-web-build.json

# Copy static server script
cp ops/den-web-static-server.mjs /data/services/den-web/den-web-static-server.mjs
```

### 5. systemd service unit

Create `/etc/systemd/system/den-web.service`:

```ini
[Unit]
Description=Den Web static site service
After=network.target
Wants=den-core.service den-channels.service

[Service]
Type=simple
User=agent
Group=agent
WorkingDirectory=/data/services/den-web
ExecStart=/usr/bin/node /data/services/den-web/den-web-static-server.mjs
Restart=always
RestartSec=5
Environment=PORT=18080
Environment=HOST=0.0.0.0
Environment=STATIC_ROOT=/data/services/den-web/wwwroot
Environment=DEN_CORE_TARGET=http://127.0.0.1:5299
Environment=DEN_CHANNELS_TARGET=http://127.0.0.1:18081
Environment=DEN_GATEWAY_TARGET=http://127.0.0.1:5300

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

### 6. Start and enable

```bash
sudo systemctl daemon-reload
sudo systemctl enable den-web.service
sudo systemctl start den-web.service
sudo systemctl status den-web.service
```

### 7. Smoke

Run the smoke script against the deployment:

```bash
# Get the deployed commit
DEPLOYED_COMMIT=$(cat /data/services/den-web/wwwroot/den-web-build.json | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).commit))")

# Run smoke tests
DEN_WEB_URL=http://192.168.1.10:18080 \
  EXPECTED_BUILD_COMMIT="$DEPLOYED_COMMIT" \
  node /home/dev/den-web/ops/smoke-den-web.mjs
```

Expected output: all PASS lines, exit code 0.

## Environment reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `18080` | Listen port |
| `HOST` | `0.0.0.0` | Listen host |
| `STATIC_ROOT` | `/data/services/den-web/wwwroot` | Static asset directory |
| `DEN_CORE_TARGET` | `http://127.0.0.1:5299` | Den Core backend URL |
| `DEN_CHANNELS_TARGET` | `http://127.0.0.1:18081` | Den Channels backend URL |
| `DEN_GATEWAY_TARGET` | `http://127.0.0.1:5300` | Den Gateway backend URL |
| `DEN_WEB_CONFIG_PATH` | `${STATIC_ROOT}/den-web-config.json` | Path to runtime config |
| `DEN_WEB_BUILD_SENTINEL` | `${STATIC_ROOT}/den-web-build.json` | Path to build sentinel |
| `CACHE_MAX_AGE_SECONDS` | `31536000` | max-age for hashed assets |
| `CACHE_HTML_SECONDS` | `0` | max-age for HTML and un-hashed files |
| `APP_BASE_PATH` | `/` | App base path for config defaults |
| `ENVIRONMENT_NAME` | `den-srv` | Environment name for config defaults |
| `DEN_CORE_API_BASE` | `/den-core-api` | Core API base for config defaults |
| `DEN_CHANNELS_API_BASE` | `/api` | Channels API base for config defaults |
| `DEN_GATEWAY_API_BASE` | `/den-gateway-api` | Gateway API base for config defaults |

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
- Post rollback evidence to the relevant Den task thread: failing URL, restored
  asset root, restored build sentinel hash, and API health checks.

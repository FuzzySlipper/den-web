#!/usr/bin/env node

/**
 * den-web-static-server.mjs
 *
 * Zero-dependency Node.js static file server + reverse proxy for Den Web.
 *
 * Serves the production build of Den Web (React/Vite SPA) from STATIC_ROOT,
 * proxies /den-core-api/* to Den Core (stripping the prefix), proxies
 * Gateway-owned /api/v1/* successor APIs. Falls back to
 * index.html for unknown paths (SPA routing). Serves /den-web-config.json
 * from a configurable path or from sensible defaults.
 *
 * Environment variables:
 *   PORT                  - listen port (default: 18080)
 *   HOST                  - listen host (default: 0.0.0.0)
 *   STATIC_ROOT           - directory with built static assets (default: /data/services/den-web/wwwroot)
 *   DEN_CORE_TARGET       - Den Core backend URL (default: http://127.0.0.1:5299)
 *   DEN_TASKS_TARGET      - Tasks successor backend URL (default: http://127.0.0.1:8092)
 *   DEN_MESSAGES_TARGET   - Messages successor backend URL (default: http://127.0.0.1:8093)
 *   DEN_GATEWAY_TARGET    - Den Gateway backend URL for Gateway-owned read APIs (default: http://127.0.0.1:8079)
 *   DEN_GATEWAY_SERVICE_TOKEN - fallback Gateway token used as successor token default (default: empty, no auth)
 *   DEN_TASKS_SERVICE_TOKEN - Tasks successor caller token for project task paths and /api/v1/tasks (default: DEN_GATEWAY_SERVICE_TOKEN)
 *   DEN_MESSAGES_SERVICE_TOKEN - Messages successor caller token for project message paths (default: DEN_GATEWAY_SERVICE_TOKEN)
 *   DEN_GATEWAY_DELIVERY_WRITE_TOKEN - Gateway caller token for /api/v1/delivery/* writes/reads (default: DEN_GATEWAY_SERVICE_TOKEN)
 *   DEN_GATEWAY_OBSERVATION_READ_TOKEN - Gateway caller token for /api/v1/observation/* reads (default: empty, no auth)
 *   DEN_GATEWAY_CONVERSATION_READ_TOKEN - Gateway caller token for /api/v1/conversation/* read pilot (default: empty, no auth)
 *   DEN_GATEWAY_CONVERSATION_WRITE_TOKEN - Gateway caller token for /api/v1/conversation/* write pilot (default: empty, no auth)
 *   DEN_GATEWAY_TIMELINE_READ_TOKEN - Gateway caller token for /api/v1/timeline/* reads/streams (default: empty, no auth)
 *   DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN - Gateway caller token for /api/v1/blog/publications/* writes/reads (default: empty, no auth)
 *   DEN_WEB_CONFIG_PATH   - path to den-web-config.json (default: ${STATIC_ROOT}/den-web-config.json)
 *   DEN_WEB_BUILD_SENTINEL - path to den-web-build.json (default: ${STATIC_ROOT}/den-web-build.json)
 *   CACHE_MAX_AGE_SECONDS - max-age for immutable assets (default: 31536000)
 *   CACHE_HTML_SECONDS    - max-age for HTML and un-hashed files (default: 0)
 *   DEN_CORE_API_BASE     - runtime config Core API base (default: /den-core-api)
 *   DEN_CHANNELS_API_BASE - runtime config Channels API base (default: /api)
 *   TASKS_SUCCESSOR_API_BASE - runtime config tasks successor browser proxy base (default: /api/v1)
 *   MESSAGES_SUCCESSOR_API_BASE - runtime config messages successor browser proxy base (default: /api/v1)
 *   DOC_PUBLISH_API_BASE - runtime config document publishing API base (default: /api/v1/blog/publications)
 *   CONVERSATION_SUCCESSOR_READS_ENABLED - runtime config conversation successor read pilot flag (default: false)
 *   CONVERSATION_SUCCESSOR_API_BASE - runtime config conversation successor browser proxy base (default: /api/v1/conversation)
 *   TIMELINE_SUCCESSOR_API_BASE - runtime config timeline browser proxy base (default: /api/v1/timeline)
 *   CONVERSATION_SUCCESSOR_READ_PROJECT_IDS - comma-separated pilot project IDs for successor reads (default: empty)
 *   APP_BASE_PATH         - runtime config app base path (default: /)
 *   ENVIRONMENT_NAME      - runtime config environment label (default: den-srv)
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

// ── Load gateway env from local file (agent-writable, no systemd edit needed) ──
const GATEWAY_ENV_PATH = process.env.GATEWAY_ENV_PATH ?? path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'gateway.env');
function loadGatewayEnv() {
  const env = {};
  try {
    if (fs.existsSync(GATEWAY_ENV_PATH)) {
      const raw = fs.readFileSync(GATEWAY_ENV_PATH, 'utf-8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[den-web-static-server] failed to read ${GATEWAY_ENV_PATH}: ${e.message}`);
  }
  return env;
}
const GATEWAY_ENV = loadGatewayEnv();

// ── Configuration ──────────────────────────────────────────────────────────────

const PORT             = parseInt(process.env.PORT ?? '18080', 10);
const HOST             = process.env.HOST ?? '0.0.0.0';
const STATIC_ROOT      = process.env.STATIC_ROOT ?? '/data/services/den-web/wwwroot';
const DEN_CORE_TARGET  = process.env.DEN_CORE_TARGET ?? 'http://127.0.0.1:5299';
const DEN_TASKS_TARGET = GATEWAY_ENV.DEN_TASKS_TARGET ?? process.env.DEN_TASKS_TARGET ?? 'http://127.0.0.1:8092';
const DEN_MESSAGES_TARGET = GATEWAY_ENV.DEN_MESSAGES_TARGET ?? process.env.DEN_MESSAGES_TARGET ?? 'http://127.0.0.1:8093';
const DEN_GATEWAY_TARGET = GATEWAY_ENV.DEN_GATEWAY_TARGET ?? process.env.DEN_GATEWAY_TARGET ?? 'http://127.0.0.1:8079';
const DEN_GATEWAY_SERVICE_TOKEN = GATEWAY_ENV.DEN_GATEWAY_SERVICE_TOKEN ?? process.env.DEN_GATEWAY_SERVICE_TOKEN ?? '';
const DEN_TASKS_SERVICE_TOKEN = GATEWAY_ENV.DEN_TASKS_SERVICE_TOKEN ?? process.env.DEN_TASKS_SERVICE_TOKEN ?? DEN_GATEWAY_SERVICE_TOKEN;
const DEN_MESSAGES_SERVICE_TOKEN = GATEWAY_ENV.DEN_MESSAGES_SERVICE_TOKEN ?? process.env.DEN_MESSAGES_SERVICE_TOKEN ?? DEN_GATEWAY_SERVICE_TOKEN;
const DEN_GATEWAY_DELIVERY_WRITE_TOKEN = GATEWAY_ENV.DEN_GATEWAY_DELIVERY_WRITE_TOKEN ?? process.env.DEN_GATEWAY_DELIVERY_WRITE_TOKEN ?? DEN_GATEWAY_SERVICE_TOKEN;
const DEN_GATEWAY_OBSERVATION_READ_TOKEN = GATEWAY_ENV.DEN_GATEWAY_OBSERVATION_READ_TOKEN ?? process.env.DEN_GATEWAY_OBSERVATION_READ_TOKEN ?? '';
const DEN_GATEWAY_CONVERSATION_READ_TOKEN = GATEWAY_ENV.DEN_GATEWAY_CONVERSATION_READ_TOKEN ?? process.env.DEN_GATEWAY_CONVERSATION_READ_TOKEN ?? '';
const DEN_GATEWAY_CONVERSATION_WRITE_TOKEN = GATEWAY_ENV.DEN_GATEWAY_CONVERSATION_WRITE_TOKEN ?? process.env.DEN_GATEWAY_CONVERSATION_WRITE_TOKEN ?? '';
const DEN_GATEWAY_TIMELINE_READ_TOKEN = GATEWAY_ENV.DEN_GATEWAY_TIMELINE_READ_TOKEN ?? process.env.DEN_GATEWAY_TIMELINE_READ_TOKEN ?? '';
const DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN = GATEWAY_ENV.DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN ?? process.env.DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN ?? '';
const CONFIG_PATH      = process.env.DEN_WEB_CONFIG_PATH ?? path.join(STATIC_ROOT, 'den-web-config.json');
const BUILD_SENTINEL_PATH = process.env.DEN_WEB_BUILD_SENTINEL ?? path.join(STATIC_ROOT, 'den-web-build.json');
const CACHE_MAX_AGE    = parseInt(process.env.CACHE_MAX_AGE_SECONDS ?? '31536000', 10);
const CACHE_HTML_AGE   = parseInt(process.env.CACHE_HTML_SECONDS ?? '0', 10);

// ── MIME types ─────────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json',
};

function mimeType(ext) {
  return MIME_TYPES[ext.toLowerCase()] ?? 'application/octet-stream';
}

// ── Path traversal guard ───────────────────────────────────────────────────────

function safePath(root, requestPath) {
  const rootPath = path.resolve(root);
  // Decode URL-encoded characters
  const decoded = decodeURIComponent(requestPath).replace(/[?#].*$/, '');
  // Resolve and normalize
  const resolved = path.resolve(rootPath, '.' + decoded);
  // Must stay inside root
  if (resolved !== rootPath && !resolved.startsWith(rootPath + path.sep)) {
    return null;
  }
  return resolved;
}

// ── Serve static file ──────────────────────────────────────────────────────────

function serveStatic(res, filePath, maxAge) {
  const ext = path.extname(filePath);
  const contentType = mimeType(ext);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': `public, max-age=${maxAge}`,
    };
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

// ── SPA fallback ───────────────────────────────────────────────────────────────

function serveIndex(res) {
  const indexPath = path.join(STATIC_ROOT, 'index.html');
  fs.stat(indexPath, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('index.html not found');
      return;
    }
    serveStatic(res, indexPath, CACHE_HTML_AGE);
  });
}

// ── Read config and build sentinel at startup ──────────────────────────────────

let configData = null;
let configError = null;
let buildSentinelData = null;
let buildSentinelError = null;

function loadConfig() {
  const defaults = {
    denCoreApiBase: process.env.DEN_CORE_API_BASE ?? '/den-core-api',
    denChannelsApiBase: process.env.DEN_CHANNELS_API_BASE ?? '/api',
    tasksSuccessorApiBase: process.env.TASKS_SUCCESSOR_API_BASE ?? '/api/v1',
    messagesSuccessorApiBase: process.env.MESSAGES_SUCCESSOR_API_BASE ?? '/api/v1',
    docPublishApiBase: process.env.DOC_PUBLISH_API_BASE ?? '/api/v1/blog/publications',
    conversationSuccessorReadsEnabled: process.env.CONVERSATION_SUCCESSOR_READS_ENABLED === '1' || process.env.CONVERSATION_SUCCESSOR_READS_ENABLED === 'true',
    conversationSuccessorWritesEnabled: process.env.CONVERSATION_SUCCESSOR_WRITES_ENABLED === '1' || process.env.CONVERSATION_SUCCESSOR_WRITES_ENABLED === 'true',
    conversationSuccessorApiBase: process.env.CONVERSATION_SUCCESSOR_API_BASE ?? '/api/v1/conversation',
    conversationSuccessorReadProjectIds: (process.env.CONVERSATION_SUCCESSOR_READ_PROJECT_IDS ?? '').split(',').map(item => item.trim()).filter(Boolean),
    conversationSuccessorWriteProjectIds: (process.env.CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS ?? '').split(',').map(item => item.trim()).filter(Boolean),
    timelineSuccessorEnabled: process.env.TIMELINE_SUCCESSOR_ENABLED === '1' || process.env.TIMELINE_SUCCESSOR_ENABLED === 'true',
    timelineSuccessorApiBase: process.env.TIMELINE_SUCCESSOR_API_BASE ?? '/api/v1/timeline',
    timelineSuccessorProjectIds: (process.env.TIMELINE_SUCCESSOR_PROJECT_IDS ?? '').split(',').map(item => item.trim()).filter(Boolean),
    appBasePath: process.env.APP_BASE_PATH ?? '/',
    environmentName: process.env.ENVIRONMENT_NAME ?? 'den-srv',
  };

  try {
    let fileConfig = {};
    if (fs.existsSync(CONFIG_PATH)) {
      const rawConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(rawConfig);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        fileConfig = parsed;
      } else {
        throw new Error('configuration root must be a JSON object');
      }
    }

    // Serve a canonical runtime config shape. This intentionally drops retired
    // Retired gateway values from older deploy-time
    // config files so the app no longer advertises retired routes.
    configData = JSON.stringify({
      denCoreApiBase: typeof fileConfig.denCoreApiBase === 'string' ? fileConfig.denCoreApiBase : defaults.denCoreApiBase,
      denChannelsApiBase: typeof fileConfig.denChannelsApiBase === 'string' ? fileConfig.denChannelsApiBase : defaults.denChannelsApiBase,
      tasksSuccessorApiBase: typeof fileConfig.tasksSuccessorApiBase === 'string' ? fileConfig.tasksSuccessorApiBase : defaults.tasksSuccessorApiBase,
      messagesSuccessorApiBase: typeof fileConfig.messagesSuccessorApiBase === 'string' ? fileConfig.messagesSuccessorApiBase : defaults.messagesSuccessorApiBase,
      docPublishApiBase: typeof fileConfig.docPublishApiBase === 'string' ? fileConfig.docPublishApiBase : defaults.docPublishApiBase,
      conversationSuccessorReadsEnabled: typeof fileConfig.conversationSuccessorReadsEnabled === 'boolean' ? fileConfig.conversationSuccessorReadsEnabled : defaults.conversationSuccessorReadsEnabled,
      conversationSuccessorWritesEnabled: typeof fileConfig.conversationSuccessorWritesEnabled === 'boolean' ? fileConfig.conversationSuccessorWritesEnabled : defaults.conversationSuccessorWritesEnabled,
      conversationSuccessorApiBase: typeof fileConfig.conversationSuccessorApiBase === 'string' ? fileConfig.conversationSuccessorApiBase : defaults.conversationSuccessorApiBase,
      conversationSuccessorReadProjectIds: Array.isArray(fileConfig.conversationSuccessorReadProjectIds) ? fileConfig.conversationSuccessorReadProjectIds.filter(item => typeof item === 'string') : defaults.conversationSuccessorReadProjectIds,
      conversationSuccessorWriteProjectIds: Array.isArray(fileConfig.conversationSuccessorWriteProjectIds) ? fileConfig.conversationSuccessorWriteProjectIds.filter(item => typeof item === 'string') : defaults.conversationSuccessorWriteProjectIds,
      timelineSuccessorEnabled: typeof fileConfig.timelineSuccessorEnabled === 'boolean' ? fileConfig.timelineSuccessorEnabled : defaults.timelineSuccessorEnabled,
      timelineSuccessorApiBase: typeof fileConfig.timelineSuccessorApiBase === 'string' ? fileConfig.timelineSuccessorApiBase : defaults.timelineSuccessorApiBase,
      timelineSuccessorProjectIds: Array.isArray(fileConfig.timelineSuccessorProjectIds) ? fileConfig.timelineSuccessorProjectIds.filter(item => typeof item === 'string') : defaults.timelineSuccessorProjectIds,
      appBasePath: typeof fileConfig.appBasePath === 'string' ? fileConfig.appBasePath : defaults.appBasePath,
      environmentName: typeof fileConfig.environmentName === 'string' ? fileConfig.environmentName : defaults.environmentName,
    });
  } catch (e) {
    configError = `Failed to read ${CONFIG_PATH}: ${e.message}`;
    console.error(`[den-web-static-server] ${configError}`);
    configData = JSON.stringify(defaults);
  }
}

function loadBuildSentinel() {
  try {
    if (fs.existsSync(BUILD_SENTINEL_PATH)) {
      buildSentinelData = fs.readFileSync(BUILD_SENTINEL_PATH, 'utf-8');
    }
  } catch (e) {
    buildSentinelError = `Failed to read ${BUILD_SENTINEL_PATH}: ${e.message}`;
    console.warn(`[den-web-static-server] ${buildSentinelError}`);
  }
}

loadConfig();
loadBuildSentinel();

// ── Proxy helper ───────────────────────────────────────────────────────────────

function proxyRequest(targetBase, req, res, pathRewrite) {
  const targetUrl = new URL(pathRewrite(req.url), targetBase);
  const proxyHeaders = {};

  // Forward relevant headers
  if (req.headers['content-type']) {
    proxyHeaders['Content-Type'] = req.headers['content-type'];
  }
  if (req.headers['accept']) {
    proxyHeaders['Accept'] = req.headers['accept'];
  }
  if (req.headers['authorization']) {
    proxyHeaders['Authorization'] = req.headers['authorization'];
  }
  if (req.headers['cookie']) {
    proxyHeaders['Cookie'] = req.headers['cookie'];
  }
  if (req.headers['user-agent']) {
    proxyHeaders['User-Agent'] = req.headers['user-agent'];
  }
  if (req.headers['x-den-migrated-functions']) {
    proxyHeaders['X-Den-Migrated-Functions'] = req.headers['x-den-migrated-functions'];
  }
  if (req.headers['idempotency-key']) {
    proxyHeaders['Idempotency-Key'] = req.headers['idempotency-key'];
  }
  if (req.headers['x-forwarded-for']) {
    proxyHeaders['X-Forwarded-For'] = req.headers['x-forwarded-for'];
  }

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: proxyHeaders,
  };

  const failProxyResponse = (err) => {
    console.error(`[den-web-static-server] proxy error for ${req.url}: ${err.message}`);

    if (res.destroyed || res.writableEnded) {
      return;
    }

    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Bad Gateway: ${err.message}`);
      return;
    }

    // Headers/body are already in flight, so writing a synthetic 502 would
    // throw ERR_HTTP_HEADERS_SENT and can crash Node. Abort the downstream
    // response instead; clients see the truncated/reset response and the
    // server stays alive for subsequent requests.
    res.destroy(err);
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward response headers
    const responseHeaders = { ...proxyRes.headers };
    delete responseHeaders['transfer-encoding']; // let Node handle chunking
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.on('error', failProxyResponse);
    proxyRes.on('aborted', () => failProxyResponse(new Error('upstream response aborted')));
    proxyRes.pipe(res);
  });

  proxyReq.on('error', failProxyResponse);

  res.on('close', () => {
    if (!proxyReq.destroyed) {
      proxyReq.destroy();
    }
  });

  req.pipe(proxyReq);
}

// ── Request handler ────────────────────────────────────────────────────────────

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url);
  const requestPath = parsedUrl.pathname;
  const requestSearch = parsedUrl.search ?? '';

  // ── Config endpoint ──
  if (requestPath === '/den-web-config.json') {
    if (configData) {
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      };
      res.writeHead(200, headers);
      res.end(configData);
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(configData ?? '{}');
    }
    return;
  }

  // ── Build sentinel endpoint ──
  if (requestPath === '/den-web-build.json') {
    if (buildSentinelData) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buildSentinelData);
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end('{}');
    }
    return;
  }

  // ── Core API proxy ──
  if (requestPath.startsWith('/den-core-api/') || requestPath === '/den-core-api') {
    // Strip /den-core-api prefix before forwarding
    const stripped = requestPath.replace(/^\/den-core-api/, '') || '/';
    return proxyRequest(DEN_CORE_TARGET, req, res, () => stripped + requestSearch);
  }

  // ── Retired legacy API proxies ──
  if (requestPath.startsWith('/den-host-api/') || requestPath === '/den-host-api') {
    res.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(JSON.stringify({
      error: 'legacy_api_not_found',
      message: 'This Den Web API path is not served.',
    }));
    return;
  }

  if (requestPath.startsWith('/den-gateway-api/') || requestPath === '/den-gateway-api') {
    res.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(JSON.stringify({
      error: 'legacy_api_not_found',
      message: 'This Den Web API path is not served.',
    }));
    return;
  }

  // ── Gateway-owned successor API proxy ──
  if (requestPath.startsWith('/api/')) {
    if (requestPath === '/api/v1/tasks' ||
        requestPath.startsWith('/api/v1/tasks/') ||
        /^\/api\/v1\/projects\/[^/]+\/tasks(?:\/|$)/.test(requestPath)) {
      if (DEN_TASKS_SERVICE_TOKEN) {
        req.headers['authorization'] = `Bearer ${DEN_TASKS_SERVICE_TOKEN}`;
      }
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_TASKS_TARGET, req, res, () => stripped + requestSearch);
    }

    if (/^\/api\/v1\/projects\/[^/]+\/messages(?:\/|$)/.test(requestPath)) {
      if (DEN_MESSAGES_SERVICE_TOKEN) {
        req.headers['authorization'] = `Bearer ${DEN_MESSAGES_SERVICE_TOKEN}`;
      }
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_MESSAGES_TARGET, req, res, () => stripped + requestSearch);
    }

    // Observation reads are owned by den-services Gateway. Keep the browser base
    // under /api for compatibility, but forward Gateway's internal /v1 path.
    if (requestPath === '/api/v1/observation' || requestPath.startsWith('/api/v1/observation/')) {
      if (DEN_GATEWAY_OBSERVATION_READ_TOKEN) {
        req.headers['authorization'] = `Bearer ${DEN_GATEWAY_OBSERVATION_READ_TOKEN}`;
      }
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_GATEWAY_TARGET, req, res, () => stripped + requestSearch);
    }

    // Delivery successor owns executable wake intent creation. Keep Gateway
    // caller auth server-side and force the migrated route selector header.
    if (requestPath === '/api/v1/delivery' || requestPath.startsWith('/api/v1/delivery/')) {
      if (DEN_GATEWAY_DELIVERY_WRITE_TOKEN) {
        req.headers['authorization'] = `Bearer ${DEN_GATEWAY_DELIVERY_WRITE_TOKEN}`;
      }
      req.headers['x-den-migrated-functions'] = 'true';
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_GATEWAY_TARGET, req, res, () => stripped + requestSearch);
    }

    // Conversation successor read pilot. The browser adapter supplies the
    // X-Den-Migrated-Functions canary header only when its feature flag is on;
    // the read caller token stays server-side here.
    if (requestPath === '/api/v1/conversation' || requestPath.startsWith('/api/v1/conversation/')) {
      const token = req.method === 'GET' ? DEN_GATEWAY_CONVERSATION_READ_TOKEN : DEN_GATEWAY_CONVERSATION_WRITE_TOKEN;
      if (token) {
        req.headers['authorization'] = `Bearer ${token}`;
      }
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_GATEWAY_TARGET, req, res, () => stripped + requestSearch);
    }

    // Timeline read/SSE compositor. Gateway owns caller/upstream auth; the
    // browser sees only same-origin /api/v1/timeline/* paths.
    if (requestPath === '/api/v1/timeline' || requestPath.startsWith('/api/v1/timeline/')) {
      if (DEN_GATEWAY_TIMELINE_READ_TOKEN) {
        req.headers['authorization'] = `Bearer ${DEN_GATEWAY_TIMELINE_READ_TOKEN}`;
      }
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_GATEWAY_TARGET, req, res, () => stripped + requestSearch);
    }

    // Doc Publish writes configured blog repo commits through Gateway. The
    // browser sees only same-origin paths; caller auth stays server-side.
    if (requestPath === '/api/v1/blog/publications' || requestPath.startsWith('/api/v1/blog/publications/')) {
      if (DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN) {
        req.headers['authorization'] = `Bearer ${DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN}`;
      }
      const stripped = requestPath.replace(/^\/api/, '') || '/';
      return proxyRequest(DEN_GATEWAY_TARGET, req, res, () => stripped + requestSearch);
    }

    res.writeHead(410, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(JSON.stringify({
      error: 'legacy_den_channels_api_retired',
      message: 'Legacy den-channels /api/* proxy is retired. Use /api/v1/conversation, /api/v1/timeline, /api/v1/observation, or /api/v1/delivery.',
      path: requestPath,
    }));
    return;
  }

  // ── Static files ──
  const safe = safePath(STATIC_ROOT, requestPath);
  if (safe) {
    fs.stat(safe, (err, stats) => {
      if (!err && stats.isFile()) {
        // Determine cache max-age: immutable assets (hashed) get long cache
        let maxAge = CACHE_HTML_AGE;
        if (/[.-][a-zA-Z0-9_-]{8,}\./.test(path.basename(safe))) {
          maxAge = CACHE_MAX_AGE;
        }
        serveStatic(res, safe, maxAge);
      } else {
        // SPA fallback – serve index.html for any non-file path
        serveIndex(res);
      }
    });
  } else {
    // Path traversal detected
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
  }
}

// ── Server start ───────────────────────────────────────────────────────────────

function createStaticServer() {
  return http.createServer(handleRequest);
}

function startServer() {
  const server = createStaticServer();

  server.listen(PORT, HOST, () => {
    console.log(`[den-web-static-server] listening on ${HOST}:${PORT}`);
    console.log(`[den-web-static-server] static root: ${STATIC_ROOT}`);
    console.log(`[den-web-static-server] Den Core target: ${DEN_CORE_TARGET}`);
    console.log(`[den-web-static-server] Den Tasks target: ${DEN_TASKS_TARGET}`);
    console.log(`[den-web-static-server] Den Messages target: ${DEN_MESSAGES_TARGET}`);
    console.log(`[den-web-static-server] Den Gateway target: ${DEN_GATEWAY_TARGET}`);
    if (configData) {
      console.log(`[den-web-static-server] config: ${CONFIG_PATH}`);
    } else {
      console.log(`[den-web-static-server] config: defaults (no file at ${CONFIG_PATH})`);
    }
  });

  return server;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url);
  }
}

if (isMainModule()) {
  startServer();
}

export { createStaticServer, handleRequest, proxyRequest, startServer };

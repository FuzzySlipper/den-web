#!/usr/bin/env node

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import * as url from 'node:url';

const envFile = readEnvFile(process.env.GATEWAY_ENV_PATH ?? path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'gateway.env'));
const setting = (key, fallback = '') => envFile[key] ?? process.env[key] ?? fallback;
const publicSetting = (key, fallback = '') => process.env[key] ?? fallback;

const port = Number.parseInt(process.env.PORT ?? '18080', 10);
const host = process.env.HOST ?? '0.0.0.0';
const staticRoot = process.env.STATIC_ROOT ?? '/data/services/den-web/wwwroot';
const configPath = process.env.DEN_WEB_CONFIG_PATH ?? path.join(staticRoot, 'den-web-config.json');
const buildPath = process.env.DEN_WEB_BUILD_SENTINEL ?? path.join(staticRoot, 'den-web-build.json');
const cacheAssets = Number.parseInt(process.env.CACHE_MAX_AGE_SECONDS ?? '31536000', 10);
const cacheHtml = Number.parseInt(process.env.CACHE_HTML_SECONDS ?? '0', 10);

const targets = {
  core: setting('DEN_CORE_TARGET', 'http://127.0.0.1:5299'),
  projects: setting('DEN_PROJECTS_TARGET', 'http://127.0.0.1:8091'),
  tasks: setting('DEN_TASKS_TARGET', 'http://127.0.0.1:8092'),
  messages: setting('DEN_MESSAGES_TARGET', 'http://127.0.0.1:8093'),
  documents: setting('DEN_DOCUMENTS_TARGET', 'http://127.0.0.1:8094'),
  review: setting('DEN_REVIEW_TARGET', 'http://127.0.0.1:8096'),
  librarian: setting('DEN_LIBRARIAN_TARGET', 'http://127.0.0.1:8098'),
  gateway: setting('DEN_GATEWAY_TARGET', 'http://127.0.0.1:8079'),
};

const serviceToken = setting('DEN_GATEWAY_SERVICE_TOKEN');
const tokens = {
  projects: setting('DEN_PROJECTS_SERVICE_TOKEN', serviceToken),
  tasks: setting('DEN_TASKS_SERVICE_TOKEN', serviceToken),
  messages: setting('DEN_MESSAGES_SERVICE_TOKEN', serviceToken),
  documents: setting('DEN_DOCUMENTS_SERVICE_TOKEN', serviceToken),
  review: setting('DEN_REVIEW_SERVICE_TOKEN', serviceToken),
  librarian: setting('DEN_LIBRARIAN_SERVICE_TOKEN', serviceToken),
  delivery: setting('DEN_GATEWAY_DELIVERY_WRITE_TOKEN', serviceToken),
  observation: setting('DEN_GATEWAY_OBSERVATION_READ_TOKEN'),
  conversationRead: setting('DEN_GATEWAY_CONVERSATION_READ_TOKEN'),
  conversationWrite: setting('DEN_GATEWAY_CONVERSATION_WRITE_TOKEN'),
  timeline: setting('DEN_GATEWAY_TIMELINE_READ_TOKEN'),
  docPublish: setting('DEN_GATEWAY_DOC_PUBLISH_CALLER_TOKEN'),
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return values;
}

function boolEnv(name, fallback) {
  const raw = publicSetting(name, fallback);
  return raw === '1' || raw.toLowerCase() === 'true';
}

function listEnv(name, fallback = '') {
  return publicSetting(name, fallback).split(',').map(item => item.trim()).filter(Boolean);
}

function runtimeConfigDefaults() {
  const timelineProjects = publicSetting('TIMELINE_SUCCESSOR_PROJECT_IDS', 'den-web');
  const conversationProjects = publicSetting('CONVERSATION_SUCCESSOR_READ_PROJECT_IDS', timelineProjects);
  return {
    denCoreApiBase: publicSetting('DEN_CORE_API_BASE', '/den-core-api'),
    denChannelsApiBase: publicSetting('DEN_CHANNELS_API_BASE', '/api'),
    tasksSuccessorApiBase: publicSetting('TASKS_SUCCESSOR_API_BASE', '/api/v1'),
    messagesSuccessorApiBase: publicSetting('MESSAGES_SUCCESSOR_API_BASE', '/api/v1'),
    conversationSuccessorApiBase: publicSetting('CONVERSATION_SUCCESSOR_API_BASE', '/api/v1/conversation'),
    observationSuccessorApiBase: publicSetting('OBSERVATION_SUCCESSOR_API_BASE', '/api/v1/observation'),
    deliverySuccessorApiBase: publicSetting('DELIVERY_SUCCESSOR_API_BASE', '/api/v1/delivery'),
    timelineSuccessorApiBase: publicSetting('TIMELINE_SUCCESSOR_API_BASE', '/api/v1/timeline'),
    docPublishApiBase: publicSetting('DOC_PUBLISH_API_BASE', '/api/v1/blog/publications'),
    conversationSuccessorReadsEnabled: boolEnv('CONVERSATION_SUCCESSOR_READS_ENABLED', 'true'),
    conversationSuccessorWritesEnabled: boolEnv('CONVERSATION_SUCCESSOR_WRITES_ENABLED', 'true'),
    conversationSuccessorReadProjectIds: listEnv('CONVERSATION_SUCCESSOR_READ_PROJECT_IDS', conversationProjects),
    conversationSuccessorWriteProjectIds: listEnv('CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS', conversationProjects),
    timelineSuccessorEnabled: boolEnv('TIMELINE_SUCCESSOR_ENABLED', 'true'),
    timelineSuccessorProjectIds: listEnv('TIMELINE_SUCCESSOR_PROJECT_IDS', timelineProjects),
    appBasePath: publicSetting('APP_BASE_PATH', '/'),
    environmentName: publicSetting('ENVIRONMENT_NAME', 'den-srv'),
  };
}

function runtimeConfig() {
  const defaults = runtimeConfigDefaults();
  if (!fs.existsSync(configPath)) return defaults;
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('den-web-config.json must be an object');
  return { ...defaults, ...parsed };
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end(JSON.stringify(body));
}

function safeFile(requestPath) {
  const root = path.resolve(staticRoot);
  const decoded = decodeURIComponent(requestPath);
  const resolved = path.resolve(root, `.${decoded}`);
  return resolved === root || resolved.startsWith(root + path.sep) ? resolved : null;
}

function serveFile(res, filePath) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return serveIndex(res);
    const maxAge = /[.-][a-zA-Z0-9_-]{8,}\./.test(path.basename(filePath)) ? cacheAssets : cacheHtml;
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': `public, max-age=${maxAge}`,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function serveIndex(res) {
  const indexPath = path.join(staticRoot, 'index.html');
  fs.stat(indexPath, error => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('index.html not found');
      return;
    }
    serveFile(res, indexPath);
  });
}

function proxy(target, req, res, rewritePath, token, extraHeaders = {}) {
  if (token) req.headers.authorization = `Bearer ${token}`;
  Object.assign(req.headers, extraHeaders);
  const targetUrl = new URL(rewritePath, target);
  const headers = {};
  for (const key of ['accept', 'authorization', 'content-type', 'cookie', 'idempotency-key', 'user-agent', 'x-den-migrated-functions']) {
    if (req.headers[key]) headers[key] = req.headers[key];
  }
  const proxyReq = http.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port || 80,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers,
  }, proxyRes => {
    const responseHeaders = { ...proxyRes.headers };
    delete responseHeaders['transfer-encoding'];
    res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', error => {
    if (res.headersSent) res.destroy(error);
    else {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Bad Gateway: ${error.message}`);
    }
  });
  res.on('close', () => {
    if (!proxyReq.destroyed) proxyReq.destroy();
  });
  req.pipe(proxyReq);
}

function proxyApi(req, res, pathname, search) {
  const rewrite = pathname.replace(/^\/api/, '') + search;
  if (pathname === '/api/v1/projects' || pathname === '/api/v1/spaces' || pathname.startsWith('/api/v1/spaces/') || /^\/api\/v1\/projects\/[^/]+$/.test(pathname)) {
    return proxy(targets.projects, req, res, rewrite, tokens.projects);
  }
  if (pathname === '/api/v1/tasks' || pathname.startsWith('/api/v1/tasks/') || /^\/api\/v1\/projects\/[^/]+\/tasks(?:\/|$)/.test(pathname)) {
    return proxy(targets.tasks, req, res, rewrite, tokens.tasks);
  }
  if (pathname === '/api/v1/user-notifications' || pathname === '/api/v1/user-notifications/read' || pathname.startsWith('/api/v1/messages/') || pathname.startsWith('/api/v1/threads/') || /^\/api\/v1\/projects\/[^/]+\/messages(?:\/|$)/.test(pathname)) {
    return proxy(targets.messages, req, res, rewrite, tokens.messages);
  }
  if (pathname === '/api/v1/documents' || pathname.startsWith('/api/v1/documents/') || pathname.startsWith('/api/v1/discussion-threads') || /^\/api\/v1\/projects\/[^/]+\/documents(?:\/|$)/.test(pathname)) {
    return proxy(targets.documents, req, res, rewrite, tokens.documents);
  }
  if (pathname.startsWith('/api/v1/review/') || /^\/api\/v1\/projects\/[^/]+\/tasks\/[0-9]+\/review(?:\/|$)/.test(pathname) || /^\/api\/v1\/tasks\/[0-9]+\/review(?:\/|$)/.test(pathname)) {
    return proxy(targets.review, req, res, rewrite, tokens.review);
  }
  if (pathname === '/api/v1/librarian/query' || /^\/api\/v1\/projects\/[^/]+\/librarian\/query$/.test(pathname)) {
    return proxy(targets.librarian, req, res, rewrite, tokens.librarian);
  }
  if (pathname === '/api/v1/observation' || pathname.startsWith('/api/v1/observation/')) return proxy(targets.gateway, req, res, rewrite, tokens.observation);
  if (pathname === '/api/v1/delivery' || pathname.startsWith('/api/v1/delivery/')) return proxy(targets.gateway, req, res, rewrite, tokens.delivery, { 'x-den-migrated-functions': 'true' });
  if (pathname === '/api/v1/conversation' || pathname.startsWith('/api/v1/conversation/')) {
    return proxy(targets.gateway, req, res, rewrite, req.method === 'GET' ? tokens.conversationRead : tokens.conversationWrite);
  }
  if (pathname === '/api/v1/timeline' || pathname.startsWith('/api/v1/timeline/')) return proxy(targets.gateway, req, res, rewrite, tokens.timeline);
  if (pathname === '/api/v1/blog/publications' || pathname.startsWith('/api/v1/blog/publications/')) return proxy(targets.gateway, req, res, rewrite, tokens.docPublish);
  return json(res, 410, { error: 'legacy_den_channels_api_retired', path: pathname });
}

function handleRequest(req, res) {
  const parsed = url.parse(req.url ?? '/');
  const pathname = parsed.pathname ?? '/';
  const search = parsed.search ?? '';
  try {
    if (pathname === '/den-web-config.json') return json(res, 200, runtimeConfig());
    if (pathname === '/den-web-build.json') {
      return json(res, 200, fs.existsSync(buildPath) ? JSON.parse(fs.readFileSync(buildPath, 'utf8')) : {});
    }
    if (pathname === '/den-core-api' || pathname.startsWith('/den-core-api/')) {
      return proxy(targets.core, req, res, pathname.replace(/^\/den-core-api/, '') + search);
    }
    if (pathname === '/den-host-api' || pathname.startsWith('/den-host-api/') || pathname === '/den-gateway-api' || pathname.startsWith('/den-gateway-api/')) {
      return json(res, 404, { error: 'legacy_api_not_found', path: pathname });
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res, pathname, search);
    const filePath = safeFile(pathname);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    serveFile(res, filePath);
  } catch (error) {
    json(res, 500, { error: 'den_web_static_server_error', message: error instanceof Error ? error.message : String(error) });
  }
}

export function createStaticServer() {
  return http.createServer(handleRequest);
}

export function startServer() {
  const server = createStaticServer();
  server.listen(port, host, () => {
    console.log(`[den-web-static-server] listening on ${host}:${port}`);
    console.log(`[den-web-static-server] static root: ${staticRoot}`);
  });
  return server;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url))) {
  startServer();
}

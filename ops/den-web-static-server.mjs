#!/usr/bin/env node

/**
 * den-web-static-server.mjs
 *
 * Zero-dependency Node.js static file server + reverse proxy for Den Web.
 *
 * Serves the production build of Den Web (React/Vite SPA) from STATIC_ROOT,
 * proxies /den-core-api/* to Den Core (stripping the prefix), and
 * proxies /api/* to Den Channels (preserving the prefix). Falls back to
 * index.html for unknown paths (SPA routing). Serves /den-web-config.json
 * from a configurable path or from sensible defaults.
 *
 * Environment variables:
 *   PORT                  - listen port (default: 18080)
 *   HOST                  - listen host (default: 0.0.0.0)
 *   STATIC_ROOT           - directory with built static assets (default: /data/services/den-web/wwwroot)
 *   DEN_CORE_TARGET       - Den Core backend URL (default: http://127.0.0.1:5299)
 *   DEN_CHANNELS_TARGET   - Den Channels backend URL (default: http://127.0.0.1:18081)
 *   DEN_WEB_CONFIG_PATH   - path to den-web-config.json (default: ${STATIC_ROOT}/den-web-config.json)
 *   DEN_WEB_BUILD_SENTINEL - path to den-web-build.json (default: ${STATIC_ROOT}/den-web-build.json)
 *   CACHE_MAX_AGE_SECONDS - max-age for immutable assets (default: 31536000)
 *   CACHE_HTML_SECONDS    - max-age for HTML and un-hashed files (default: 0)
 *   DEN_CORE_API_BASE     - runtime config Core API base (default: /den-core-api)
 *   DEN_CHANNELS_API_BASE - runtime config Channels API base (default: /api)
 *   DEN_GATEWAY_API_BASE  - runtime config Gateway API base (default: /api/gateway)
 *   APP_BASE_PATH         - runtime config app base path (default: /)
 *   ENVIRONMENT_NAME      - runtime config environment label (default: den-srv)
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

// ── Configuration ──────────────────────────────────────────────────────────────

const PORT             = parseInt(process.env.PORT ?? '18080', 10);
const HOST             = process.env.HOST ?? '0.0.0.0';
const STATIC_ROOT      = process.env.STATIC_ROOT ?? '/data/services/den-web/wwwroot';
const DEN_CORE_TARGET  = process.env.DEN_CORE_TARGET ?? 'http://127.0.0.1:5299';
const DEN_CHANNELS_TARGET = process.env.DEN_CHANNELS_TARGET ?? 'http://127.0.0.1:18081';
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
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
      // Validate JSON
      JSON.parse(configData);
    }
  } catch (e) {
    configError = `Failed to read ${CONFIG_PATH}: ${e.message}`;
    console.error(`[den-web-static-server] ${configError}`);
  }

  // If no config file, generate from defaults
  if (!configData) {
    const defaults = {
      denCoreApiBase: process.env.DEN_CORE_API_BASE ?? '/den-core-api',
      denChannelsApiBase: process.env.DEN_CHANNELS_API_BASE ?? '/api',
      denGatewayApiBase: process.env.DEN_GATEWAY_API_BASE ?? '/api/gateway',
      appBasePath: process.env.APP_BASE_PATH ?? '/',
      environmentName: process.env.ENVIRONMENT_NAME ?? 'den-srv',
    };
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

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward response headers
    const responseHeaders = { ...proxyRes.headers };
    delete responseHeaders['transfer-encoding']; // let Node handle chunking
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[den-web-static-server] proxy error for ${req.url}: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Bad Gateway: ${err.message}`);
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

  // ── Channels/Gateway/Agents API proxy ──
  if (requestPath.startsWith('/api/')) {
    return proxyRequest(DEN_CHANNELS_TARGET, req, res, () => requestPath + requestSearch);
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

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`[den-web-static-server] listening on ${HOST}:${PORT}`);
  console.log(`[den-web-static-server] static root: ${STATIC_ROOT}`);
  console.log(`[den-web-static-server] Den Core target: ${DEN_CORE_TARGET}`);
  console.log(`[den-web-static-server] Den Channels target: ${DEN_CHANNELS_TARGET}`);
  if (configData) {
    console.log(`[den-web-static-server] config: ${CONFIG_PATH}`);
  } else {
    console.log(`[den-web-static-server] config: defaults (no file at ${CONFIG_PATH})`);
  }
});

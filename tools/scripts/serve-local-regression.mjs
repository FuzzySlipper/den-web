import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import * as path from 'node:path';
import test from 'node:test';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');

test('the Angular development server proxies API and runtime config to web-edge', async t => {
  const edge = http.createServer((req, res) => {
    if (req.url === '/api/v1/projects') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"source":"web-edge"}');
      return;
    }
    if (req.url === '/den-web-config.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"tasksSuccessorApiBase":"/api/v1"}');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await listen(edge);
  t.after(() => edge.close());

  const devPort = await availablePort();
  const child = spawn(process.execPath, ['tools/scripts/serve-local.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DEN_WEB_DEV_EDGE_URL: address(edge),
      NX_DAEMON: 'false',
      NX_TUI: 'false',
      PORT: String(devPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk;
  });
  child.stderr.on('data', chunk => {
    output += chunk;
  });
  t.after(() => child.kill('SIGTERM'));

  const baseURL = `http://127.0.0.1:${devPort}`;
  await waitForHTTP(`${baseURL}/`);

  const apiResponse = await fetch(`${baseURL}/api/v1/projects`);
  assert.equal(apiResponse.status, 200);
  assert.match(apiResponse.headers.get('content-type') ?? '', /^application\/json/);
  assert.deepEqual(await apiResponse.json(), { source: 'web-edge' });

  const configResponse = await fetch(`${baseURL}/den-web-config.json`);
  assert.equal(configResponse.status, 200);
  assert.deepEqual(await configResponse.json(), { tasksSuccessorApiBase: '/api/v1' });
  assert.match(output, new RegExp(`BASE_URL=http://127\\.0\\.0\\.1:${devPort}`));
});

async function availablePort() {
  const server = http.createServer();
  await listen(server);
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  return port;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function address(server) {
  const value = server.address();
  return `http://127.0.0.1:${value.port}`;
}

async function waitForHTTP(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The Angular server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`development server did not become ready: ${url}`);
}

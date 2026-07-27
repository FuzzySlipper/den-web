import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import * as os from 'node:os';
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

test(
  'shutdown escalates when the Nx leader exits but a descendant survives SIGTERM',
  { skip: process.platform === 'win32' },
  async t => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'den-web-serve-local-'));
    const descendantPIDPath = path.join(fixtureRoot, 'descendant.pid');
    const fakeNpxPath = path.join(fixtureRoot, 'npx');
    await writeFile(
      fakeNpxPath,
      `#!/usr/bin/env node
import { spawn } from 'node:child_process';

const descendant = spawn(process.execPath, [
  '-e',
  "const { writeFileSync } = require('node:fs'); process.on('SIGTERM', () => {}); writeFileSync(process.env.DESCENDANT_PID_PATH, String(process.pid)); setInterval(() => {}, 1000)",
], { env: process.env, stdio: 'ignore' });
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);
`,
    );
    await chmod(fakeNpxPath, 0o755);
    t.after(() => rm(fixtureRoot, { force: true, recursive: true }));

    const child = spawn(process.execPath, ['tools/scripts/serve-local.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DESCENDANT_PID_PATH: descendantPIDPath,
        PATH: `${fixtureRoot}${path.delimiter}${process.env.PATH}`,
      },
      stdio: 'ignore',
    });
    t.after(() => child.kill('SIGKILL'));

    const descendantPID = Number(await waitForFile(descendantPIDPath));
    t.after(() => killIfRunning(descendantPID));

    const shutdownStarted = Date.now();
    child.kill('SIGTERM');
    const result = await waitForExit(child, 8_000);
    assert.equal(result.code, 0);
    assert.equal(result.signal, null);
    assert.ok(Date.now() - shutdownStarted >= 4_500, 'wrapper exited before bounded escalation');
    await waitForProcessExit(descendantPID, 2_000);
  },
);

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

async function waitForFile(filePath) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`fixture did not write ${filePath}`);
}

function waitForExit(child, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`child ${child.pid} did not exit`)), timeout);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function waitForProcessExit(pid, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!processIsRunning(pid)) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(`descendant ${pid} survived bounded SIGKILL`);
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

function killIfRunning(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

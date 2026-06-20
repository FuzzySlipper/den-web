import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(2_000, () => req.destroy(new Error(`timeout fetching ${url}`)));
  });
}

async function waitForReady(baseUrl, child) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`static server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await request(`${baseUrl}/den-web-config.json`);
      if (response.statusCode === 200) {
        return;
      }
      lastError = new Error(`unexpected ready status ${response.statusCode}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw lastError ?? new Error('static server did not become ready');
}

async function startStaticServer(targetUrl, t, envOverrides = {}) {
  const staticRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-static-root-'));
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>den-web-test</title>');
  await fs.writeFile(path.join(staticRoot, 'den-web-config.json'), JSON.stringify({ denCoreApiBase: '/den-core-api', denChannelsApiBase: '/api', denHostApiBase: '/den-host-api' }));

  const portProbe = http.createServer();
  const port = await listen(portProbe);
  await new Promise(resolve => portProbe.close(resolve));

  const child = spawn(process.execPath, ['ops/den-web-static-server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      STATIC_ROOT: staticRoot,
      DEN_WEB_CONFIG_PATH: path.join(staticRoot, 'den-web-config.json'),
      DEN_CORE_TARGET: targetUrl,
      DEN_CHANNELS_TARGET: targetUrl,
      DEN_HOST_TARGET: targetUrl,
      ...envOverrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        once(child, 'exit'),
        new Promise(resolve => setTimeout(resolve, 1_000)),
      ]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }
    await fs.rm(staticRoot, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForReady(baseUrl, child);
  return { baseUrl, child, getLogs: () => ({ stdout, stderr }) };
}

test('static server starts when launched through a deploy symlink', async (t) => {
  const staticRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-static-root-'));
  const binRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-static-bin-'));
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>den-web-test</title>');
  await fs.writeFile(path.join(staticRoot, 'den-web-config.json'), JSON.stringify({ denCoreApiBase: '/den-core-api', denChannelsApiBase: '/api', denHostApiBase: '/den-host-api' }));
  const symlinkPath = path.join(binRoot, 'den-web-static-server.mjs');
  await fs.symlink(path.resolve('ops/den-web-static-server.mjs'), symlinkPath);

  const portProbe = http.createServer();
  const port = await listen(portProbe);
  await new Promise(resolve => portProbe.close(resolve));

  const child = spawn(process.execPath, [symlinkPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      STATIC_ROOT: staticRoot,
      DEN_WEB_CONFIG_PATH: path.join(staticRoot, 'den-web-config.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        once(child, 'exit'),
        new Promise(resolve => setTimeout(resolve, 1_000)),
      ]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }
    await fs.rm(staticRoot, { recursive: true, force: true });
    await fs.rm(binRoot, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForReady(baseUrl, child);
  const response = await request(`${baseUrl}/den-web-config.json`);
  assert.equal(response.statusCode, 200);
  assert.equal(child.exitCode, null);
});

test('static proxy returns bounded 502 before response headers are sent', async (t) => {
  const targetPort = 9; // Discard service is almost always closed in CI/dev; connection should fail before headers.
  const { baseUrl, child } = await startStaticServer(`http://127.0.0.1:${targetPort}`, t);

  const response = await request(`${baseUrl}/den-core-api/api/projects`);

  assert.equal(response.statusCode, 502);
  assert.match(response.body, /Bad Gateway:/);
  assert.equal(child.exitCode, null, 'static server should remain alive after early proxy failure');
});

test('Den Host FleetOps proxy rewrites /den-host-api and retires stale Gateway route', async (t) => {
  let observedPath = null;
  const upstream = http.createServer((req, res) => {
    observedPath = req.url;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'den-host', actions: [] }));
  });
  const upstreamPort = await listen(upstream);
  t.after(() => new Promise(resolve => upstream.close(resolve)));

  const { baseUrl } = await startStaticServer(`http://127.0.0.1:${upstreamPort}`, t);

  const hostResponse = await request(`${baseUrl}/den-host-api/fleet-ops?dryRun=true`);
  assert.equal(hostResponse.statusCode, 200);
  assert.equal(observedPath, '/api/host/fleet-ops?dryRun=true');
  assert.match(hostResponse.body, /"service":"den-host"/);

  const retiredResponse = await request(`${baseUrl}/den-gateway-api/fleet-ops`);
  assert.equal(retiredResponse.statusCode, 410);
  assert.match(retiredResponse.body, /den_gateway_api_retired/);
});

test('Observation reads use the Gateway observation read token, not the default service token', async (t) => {
  const gatewayObserved = [];
  const gateway = http.createServer((req, res) => {
    gatewayObserved.push({ url: req.url, authorization: req.headers.authorization ?? null });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: [] }));
  });
  const gatewayPort = await listen(gateway);
  t.after(() => new Promise(resolve => gateway.close(resolve)));

  const channelsObserved = [];
  const channels = http.createServer((req, res) => {
    channelsObserved.push({ url: req.url, authorization: req.headers.authorization ?? null });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  });
  const channelsPort = await listen(channels);
  t.after(() => new Promise(resolve => channels.close(resolve)));

  const { baseUrl } = await startStaticServer(`http://127.0.0.1:${channelsPort}`, t, {
    DEN_GATEWAY_TARGET: `http://127.0.0.1:${gatewayPort}`,
    DEN_GATEWAY_SERVICE_TOKEN: 'default-service-token',
    DEN_GATEWAY_OBSERVATION_READ_TOKEN: 'observation-read-token',
  });

  const observationResponse = await request(`${baseUrl}/api/v1/observation/lane?limit=1`);
  assert.equal(observationResponse.statusCode, 200);
  const channelsResponse = await request(`${baseUrl}/api/channels?limit=1`);
  assert.equal(channelsResponse.statusCode, 200);

  assert.deepEqual(gatewayObserved, [
    { url: '/v1/observation/lane?limit=1', authorization: 'Bearer observation-read-token' },
  ]);
  assert.deepEqual(channelsObserved, [
    { url: '/api/channels?limit=1', authorization: 'Bearer default-service-token' },
  ]);
});

test('Conversation successor reads use the Gateway conversation read token and canary header', async (t) => {
  const gatewayObserved = [];
  const gateway = http.createServer((req, res) => {
    gatewayObserved.push({
      url: req.url,
      authorization: req.headers.authorization ?? null,
      migrated: req.headers['x-den-migrated-functions'] ?? null,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ channels: [] }));
  });
  const gatewayPort = await listen(gateway);
  t.after(() => new Promise(resolve => gateway.close(resolve)));

  const channelsObserved = [];
  const channels = http.createServer((req, res) => {
    channelsObserved.push({ url: req.url, authorization: req.headers.authorization ?? null });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  });
  const channelsPort = await listen(channels);
  t.after(() => new Promise(resolve => channels.close(resolve)));

  const { baseUrl } = await startStaticServer(`http://127.0.0.1:${channelsPort}`, t, {
    DEN_GATEWAY_TARGET: `http://127.0.0.1:${gatewayPort}`,
    DEN_GATEWAY_SERVICE_TOKEN: 'default-service-token',
    DEN_GATEWAY_CONVERSATION_READ_TOKEN: 'conversation-read-token',
  });

  const conversationResponse = await request(`${baseUrl}/api/v1/conversation/channels?project_id=den-web&limit=1`, {
    headers: { 'X-Den-Migrated-Functions': 'true' },
  });
  assert.equal(conversationResponse.statusCode, 200);
  const channelsResponse = await request(`${baseUrl}/api/channels?limit=1`);
  assert.equal(channelsResponse.statusCode, 200);

  assert.deepEqual(gatewayObserved, [
    {
      url: '/v1/conversation/channels?project_id=den-web&limit=1',
      authorization: 'Bearer conversation-read-token',
      migrated: 'true',
    },
  ]);
  assert.deepEqual(channelsObserved, [
    { url: '/api/channels?limit=1', authorization: 'Bearer default-service-token' },
  ]);
});

test('static proxy survives upstream reset after response headers have been sent', async (t) => {
  const upstream = http.createServer((req, res) => {
    if (req.url === '/api/late-reset') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"partial":');
      setImmediate(() => {
        res.socket?.destroy(new Error('simulated upstream ECONNRESET'));
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  const upstreamPort = await listen(upstream);
  t.after(() => new Promise(resolve => upstream.close(resolve)));

  const { baseUrl, child, getLogs } = await startStaticServer(`http://127.0.0.1:${upstreamPort}`, t);

  await assert.rejects(
    request(`${baseUrl}/den-core-api/api/late-reset`),
    /aborted|socket hang up|Parse Error|ECONNRESET|terminated|aborted/i,
  );

  assert.equal(child.exitCode, null, 'static server should remain alive after late upstream reset');
  const configResponse = await request(`${baseUrl}/den-web-config.json`);
  assert.equal(configResponse.statusCode, 200, 'static server should serve later requests after the reset');
  assert.doesNotMatch(getLogs().stderr, /ERR_HTTP_HEADERS_SENT/);
});

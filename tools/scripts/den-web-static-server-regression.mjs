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

function request(target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(target), {
      method: options.method ?? 'GET',
      headers: options.headers,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error(`timeout fetching ${target}`)));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function startServer(t, env = {}) {
  const staticRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-static-root-'));
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>Den Web Successor</title><den-root></den-root>');
  await fs.writeFile(path.join(staticRoot, 'den-web-config.json'), JSON.stringify({ environmentName: 'test' }));
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['tools/scripts/den-web-static-server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      STATIC_ROOT: staticRoot,
      DEN_WEB_CONFIG_PATH: path.join(staticRoot, 'den-web-config.json'),
      GATEWAY_ENV_PATH: path.join(staticRoot, 'missing.env'),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 1000))]);
    }
    await fs.rm(staticRoot, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`static server exited with code ${child.exitCode}`);
    try {
      if ((await request(`${baseUrl}/den-web-config.json`)).status === 200) return baseUrl;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw new Error('static server did not become ready');
}

function service(responseBody = []) {
  const observed = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      observed.push({
        url: req.url,
        method: req.method,
        authorization: req.headers.authorization ?? null,
        migrated: req.headers['x-den-migrated-functions'] ?? null,
        body,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
    });
  });
  return { server, observed };
}

test('serves runtime config, SPA fallback, and build sentinel', async t => {
  const baseUrl = await startServer(t);
  const config = await request(`${baseUrl}/den-web-config.json`);
  const fallback = await request(`${baseUrl}/projects/den-web`);
  const build = await request(`${baseUrl}/den-web-build.json`);
  assert.equal(config.status, 200);
  assert.equal(JSON.parse(config.body).environmentName, 'test');
  assert.equal(fallback.status, 200);
  assert.match(fallback.body, /Den Web Successor/);
  assert.equal(build.status, 200);
  assert.deepEqual(JSON.parse(build.body), {});
});

test('retires legacy API routes without proxying them upstream', async t => {
  const upstream = service({ unexpected: true });
  const port = await listen(upstream.server);
  t.after(() => new Promise(resolve => upstream.server.close(resolve)));
  const baseUrl = await startServer(t, {
    DEN_CORE_TARGET: `http://127.0.0.1:${port}`,
    DEN_GATEWAY_TARGET: `http://127.0.0.1:${port}`,
  });
  assert.equal((await request(`${baseUrl}/api/channels?limit=1`)).status, 410);
  assert.equal((await request(`${baseUrl}/api/gateway/memberships?projectId=den-web`)).status, 410);
  assert.equal((await request(`${baseUrl}/den-gateway-api/anything`)).status, 404);
  assert.deepEqual(upstream.observed, []);
});

test('routes den-services owner APIs to their service targets with service tokens', async t => {
  const projects = service([{ id: 'den-web' }]);
  const tasks = service([]);
  const messages = service([]);
  const [projectsPort, tasksPort, messagesPort] = await Promise.all([listen(projects.server), listen(tasks.server), listen(messages.server)]);
  t.after(() => Promise.all([projects.server, tasks.server, messages.server].map(server => new Promise(resolve => server.close(resolve)))));
  const baseUrl = await startServer(t, {
    DEN_PROJECTS_TARGET: `http://127.0.0.1:${projectsPort}`,
    DEN_TASKS_TARGET: `http://127.0.0.1:${tasksPort}`,
    DEN_MESSAGES_TARGET: `http://127.0.0.1:${messagesPort}`,
    DEN_PROJECTS_SERVICE_TOKEN: 'projects-token',
    DEN_TASKS_SERVICE_TOKEN: 'tasks-token',
    DEN_MESSAGES_SERVICE_TOKEN: 'messages-token',
  });
  assert.equal((await request(`${baseUrl}/api/v1/projects`)).status, 200);
  assert.equal((await request(`${baseUrl}/api/v1/projects/den-web/tasks?limit=1`)).status, 200);
  assert.equal((await request(`${baseUrl}/api/v1/user-notifications?limit=1`)).status, 200);
  assert.equal(projects.observed[0].url, '/v1/projects');
  assert.equal(tasks.observed[0].authorization, 'Bearer tasks-token');
  assert.equal(messages.observed[0].authorization, 'Bearer messages-token');
});

test('routes Gateway successor APIs with route-specific tokens and headers', async t => {
  const gateway = service({ ok: true });
  const port = await listen(gateway.server);
  t.after(() => new Promise(resolve => gateway.server.close(resolve)));
  const baseUrl = await startServer(t, {
    DEN_GATEWAY_TARGET: `http://127.0.0.1:${port}`,
    DEN_GATEWAY_OBSERVATION_READ_TOKEN: 'observation-token',
    DEN_GATEWAY_CONVERSATION_READ_TOKEN: 'conversation-read-token',
    DEN_GATEWAY_CONVERSATION_WRITE_TOKEN: 'conversation-write-token',
    DEN_GATEWAY_DELIVERY_WRITE_TOKEN: 'delivery-token',
    DEN_GATEWAY_TIMELINE_READ_TOKEN: 'timeline-token',
  });
  await request(`${baseUrl}/api/v1/observation/lane?limit=1`);
  await request(`${baseUrl}/api/v1/conversation/channels?project_id=den-web&limit=1`);
  await request(`${baseUrl}/api/v1/conversation/channels/7/messages`, { method: 'POST', body: '{}' });
  await request(`${baseUrl}/api/v1/delivery/intents`, { method: 'POST', body: '{}' });
  await request(`${baseUrl}/api/v1/timeline/channels/7/items?limit=1`);
  assert.deepEqual(gateway.observed.map(item => [item.url, item.authorization, item.migrated]), [
    ['/v1/observation/lane?limit=1', 'Bearer observation-token', null],
    ['/v1/conversation/channels?project_id=den-web&limit=1', 'Bearer conversation-read-token', null],
    ['/v1/conversation/channels/7/messages', 'Bearer conversation-write-token', null],
    ['/v1/delivery/intents', 'Bearer delivery-token', 'true'],
    ['/v1/timeline/channels/7/items?limit=1', 'Bearer timeline-token', null],
  ]);
});

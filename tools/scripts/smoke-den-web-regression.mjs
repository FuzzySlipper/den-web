import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import * as path from 'node:path';
import test from 'node:test';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');

test('deployment smoke accepts a typed missing-project response on an empty instance', async t => {
  const edge = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>Den Web</title><den-root></den-root><script src="main.js"></script>');
      return;
    }
    if (req.url === '/den-web-config.json') {
      json(res, 200, {
        conversationSuccessorApiBase: '/api/v1/conversation',
        environmentName: 'empty-instance',
        observationSuccessorApiBase: '/api/v1/observation',
        tasksSuccessorApiBase: '/api/v1',
        visualContractApiBase: '/api/v1/visual-contracts',
      });
      return;
    }
    if (req.url === '/den-web-build.json') {
      json(res, 200, { commit: 'empty-instance-commit' });
      return;
    }
    if (req.url === '/api/v1/projects/den-web/librarian/query' && req.method === 'POST') {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        assert.equal(JSON.parse(body).query, 'Den Web edge live request-body probe');
        json(res, 404, {
          error: { code: 'not_found', message: 'project scope not found: den-web' },
        });
      });
      return;
    }
    if (req.url === '/api/v1/timeline/projects/den-web/stream?limit=1') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('event: stream_open\ndata: {}\n\n');
      return;
    }
    if (req.url?.startsWith('/api/channels') || req.url?.startsWith('/api/gateway/memberships')) {
      json(res, 410, { error: { code: 'gone' } });
      return;
    }
    json(res, 200, {});
  });
  await listen(edge);
  t.after(() => edge.close());

  const result = await runSmoke(address(edge));
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /POST librarian query body reached Librarian on empty instance/);
  assert.match(result.output, /-- Results: 35 passed, 0 failed --/);
});

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
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

function runSmoke(baseURL) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/scripts/smoke-den-web.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DEN_WEB_URL: baseURL,
        EXPECTED_BUILD_COMMIT: 'empty-instance-commit',
        EXPECTED_ENV_NAME: 'empty-instance',
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
    child.once('error', reject);
    child.once('close', code => resolve({ code, output }));
  });
}

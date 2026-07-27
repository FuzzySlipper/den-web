import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');

test('asset deploy dry-run does not create or activate a release', async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-dry-run-'));
  const deployRoot = path.join(scratch, 'deploy-root');

  const result = await runDeploy({
    ALLOW_DIRTY: '1',
    DEPLOY_ROOT: deployRoot,
    DRY_RUN: '1',
    RELEASE_ID: 'dry-run-release',
    SKIP_CHECKS: '1',
    SKIP_INSTALL: '1',
  });

  assert.equal(result.code, 0, result.output);
  await assert.rejects(fs.lstat(deployRoot), error => error?.code === 'ENOENT');
  assert.match(result.output, /dry run complete; would stage and activate dry-run-release/);
});

test('failed live smoke atomically restores every release link without stopping the edge', async t => {
  const deployRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-rollback-'));
  const releases = path.join(deployRoot, 'releases');
  const oldRelease = path.join(releases, 'old');
  const olderRelease = path.join(releases, 'older');
  await writeRelease(oldRelease, 'old-commit');
  await writeRelease(olderRelease, 'older-commit');
  await fs.symlink(oldRelease, path.join(deployRoot, 'current'));
  await fs.symlink(path.join(deployRoot, 'current', 'wwwroot'), path.join(deployRoot, 'wwwroot'));
  await fs.symlink(olderRelease, path.join(deployRoot, 'previous'));

  const edge = http.createServer(async (req, res) => {
    if (req.url === '/den-web-build.json') {
      try {
        const body = await fs.readFile(path.join(deployRoot, 'wwwroot', 'den-web-build.json'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
      } catch {
        res.writeHead(503);
        res.end();
      }
      return;
    }
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('forced smoke failure');
  });
  await listen(edge);
  t.after(() => edge.close());

  const result = await runDeploy({
    ALLOW_DIRTY: '1',
    DEPLOY_SMOKE: '1',
    DEN_WEB_URL: address(edge),
    DEPLOY_ROOT: deployRoot,
    NX_DAEMON: 'false',
    NX_SKIP_NX_CACHE: 'true',
    NX_TUI: 'false',
    RELEASE_ID: 'failing-release',
    SERVICE_READY_TIMEOUT_MS: '3000',
    SKIP_CHECKS: '1',
    SKIP_INSTALL: '1',
  });

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /rolling back to/);
  assert.equal(await fs.readlink(path.join(deployRoot, 'current')), oldRelease);
  assert.equal(
    await fs.readlink(path.join(deployRoot, 'wwwroot')),
    path.join(deployRoot, 'current', 'wwwroot'),
  );
  assert.equal(await fs.readlink(path.join(deployRoot, 'previous')), olderRelease);

  const stillRunning = await fetch(`${address(edge)}/health`);
  assert.equal(stillRunning.status, 503);
  const sentinel = JSON.parse(
    await fs.readFile(path.join(deployRoot, 'wwwroot', 'den-web-build.json'), 'utf8'),
  );
  assert.equal(sentinel.commit, 'old-commit');
});

async function writeRelease(releaseDir, commit) {
  const root = path.join(releaseDir, 'wwwroot');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>old</title>');
  await fs.writeFile(
    path.join(root, 'den-web-build.json'),
    `${JSON.stringify({ commit })}\n`,
  );
  await fs.writeFile(
    path.join(root, 'den-web-config.json'),
    '{"tasksSuccessorApiBase":"/api/v1"}\n',
  );
}

function runDeploy(extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/scripts/deploy-den-srv.mjs'], {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
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

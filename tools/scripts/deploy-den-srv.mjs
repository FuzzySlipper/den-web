#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import * as url from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const env = process.env;
const deployRoot = env.DEPLOY_ROOT ?? '/data/services/den-web';
const releasesDir = path.join(deployRoot, 'releases');
const sharedDir = path.join(deployRoot, 'shared');
const currentLink = path.join(deployRoot, 'current');
const previousLink = path.join(deployRoot, 'previous');
const wwwrootLink = path.join(deployRoot, 'wwwroot');
const serverLink = path.join(deployRoot, 'den-web-static-server.mjs');
const publicUrl = env.DEN_WEB_URL ?? 'http://192.168.1.10:18080';
const serviceName = env.SERVICE_NAME ?? 'den-web.service';
const systemctl = (env.SYSTEMCTL ?? 'systemctl').split(/\s+/).filter(Boolean);
const keepReleases = Number.parseInt(env.KEEP_RELEASES ?? '5', 10);
const dryRun = env.DRY_RUN === '1';
const shouldRestart = env.DEPLOY_RESTART !== '0';
const shouldSmoke = env.DEPLOY_SMOKE !== '0';
const skipInstall = env.SKIP_INSTALL === '1';
const skipChecks = env.SKIP_CHECKS === '1';
const allowDirty = env.ALLOW_DIRTY === '1';
const readyTimeoutMs = Number.parseInt(env.SERVICE_READY_TIMEOUT_MS ?? '15000', 10);
const runtimeEnv = { ...readEnvFile(path.join(sharedDir, 'gateway.env')), ...env };

function log(message) {
  console.log(`[deploy-den-srv] ${message}`);
}

function readEnvFile(filePath) {
  if (!fssync.existsSync(filePath)) return {};
  const values = {};
  for (const line of fssync.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return values;
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(' ')}`);
  if (dryRun) return;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
}

function read(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

async function readLinkIfExists(linkPath) {
  try {
    return await fs.readlink(linkPath);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EINVAL') return null;
    throw error;
  }
}

async function exists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function symlinkAtomic(target, linkPath) {
  const tmp = `${linkPath}.tmp-${process.pid}`;
  await fs.rm(tmp, { force: true, recursive: true });
  await fs.symlink(target, tmp);
  await fs.rename(tmp, linkPath);
}

async function prepareLinkPath(linkPath) {
  try {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      const backup = `${linkPath}.pre-symlink-${new Date().toISOString().replace(/[-:.]/g, '')}`;
      log(`${linkPath} is a directory; moving it aside to ${backup}`);
      await fs.rename(linkPath, backup);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function ensureCleanGit() {
  const status = read('git', ['status', '--porcelain']);
  if (status && !allowDirty) throw new Error('working tree is dirty; commit/stash changes or rerun with ALLOW_DIRTY=1');
  return Boolean(status);
}

function releaseId(commit) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${commit.slice(0, 12)}`;
}

function boolValue(name, fallback) {
  const value = runtimeEnv[name] ?? fallback;
  return value === '1' || value === 'true';
}

function listValue(name, fallback = '') {
  return (runtimeEnv[name] ?? fallback).split(',').map(item => item.trim()).filter(Boolean);
}

function runtimeConfig() {
  const timelineProjects = runtimeEnv.TIMELINE_SUCCESSOR_PROJECT_IDS ?? 'den-web';
  const conversationProjects = runtimeEnv.CONVERSATION_SUCCESSOR_READ_PROJECT_IDS ?? timelineProjects;
  return {
    denCoreApiBase: runtimeEnv.DEN_CORE_API_BASE ?? '/den-core-api',
    denChannelsApiBase: runtimeEnv.DEN_CHANNELS_API_BASE ?? '/api',
    tasksSuccessorApiBase: runtimeEnv.TASKS_SUCCESSOR_API_BASE ?? '/api/v1',
    messagesSuccessorApiBase: runtimeEnv.MESSAGES_SUCCESSOR_API_BASE ?? '/api/v1',
    conversationSuccessorApiBase: runtimeEnv.CONVERSATION_SUCCESSOR_API_BASE ?? '/api/v1/conversation',
    observationSuccessorApiBase: runtimeEnv.OBSERVATION_SUCCESSOR_API_BASE ?? '/api/v1/observation',
    deliverySuccessorApiBase: runtimeEnv.DELIVERY_SUCCESSOR_API_BASE ?? '/api/v1/delivery',
    timelineSuccessorApiBase: runtimeEnv.TIMELINE_SUCCESSOR_API_BASE ?? '/api/v1/timeline',
    docPublishApiBase: runtimeEnv.DOC_PUBLISH_API_BASE ?? '/api/v1/blog/publications',
    conversationSuccessorReadsEnabled: boolValue('CONVERSATION_SUCCESSOR_READS_ENABLED', 'true'),
    conversationSuccessorWritesEnabled: boolValue('CONVERSATION_SUCCESSOR_WRITES_ENABLED', 'true'),
    conversationSuccessorReadProjectIds: listValue('CONVERSATION_SUCCESSOR_READ_PROJECT_IDS', conversationProjects),
    conversationSuccessorWriteProjectIds: listValue('CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS', conversationProjects),
    timelineSuccessorEnabled: boolValue('TIMELINE_SUCCESSOR_ENABLED', 'true'),
    timelineSuccessorProjectIds: listValue('TIMELINE_SUCCESSOR_PROJECT_IDS', timelineProjects),
    appBasePath: runtimeEnv.APP_BASE_PATH ?? '/',
    environmentName: runtimeEnv.ENVIRONMENT_NAME ?? 'den-srv',
  };
}

function buildOutputPath() {
  const browserPath = path.join(repoRoot, 'dist/apps/den-web/browser');
  if (fssync.existsSync(path.join(browserPath, 'index.html'))) return browserPath;
  return path.join(repoRoot, 'dist/apps/den-web');
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function stageRelease(commit, dirty, id) {
  const releaseDir = path.join(releasesDir, id);
  const releaseWwwroot = path.join(releaseDir, 'wwwroot');
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(releaseDir, { recursive: true });
  await fs.cp(buildOutputPath(), releaseWwwroot, { recursive: true, dereference: true });
  await fs.copyFile(path.join(repoRoot, 'tools/scripts/den-web-static-server.mjs'), path.join(releaseDir, 'den-web-static-server.mjs'));
  await fs.chmod(path.join(releaseDir, 'den-web-static-server.mjs'), 0o755);
  await writeJson(path.join(releaseWwwroot, 'den-web-config.json'), runtimeConfig());
  await writeJson(path.join(releaseWwwroot, 'den-web-build.json'), {
    commit,
    dirty,
    releaseId: id,
    builtAt: new Date().toISOString(),
    builtBy: env.BUILT_BY ?? os.userInfo().username,
    sourceRepo: repoRoot,
  });
  const gatewayEnv = path.join(sharedDir, 'gateway.env');
  if (await exists(gatewayEnv)) await symlinkAtomic(gatewayEnv, path.join(releaseDir, 'gateway.env'));
  return releaseDir;
}

async function activate(releaseDir, previousTarget) {
  await prepareLinkPath(currentLink);
  await prepareLinkPath(wwwrootLink);
  await prepareLinkPath(serverLink);
  await symlinkAtomic(releaseDir, currentLink);
  await symlinkAtomic(path.join(currentLink, 'wwwroot'), wwwrootLink);
  await symlinkAtomic(path.join(currentLink, 'den-web-static-server.mjs'), serverLink);
  if (previousTarget) await symlinkAtomic(previousTarget, previousLink);
}

function restartService() {
  if (!shouldRestart) {
    log('skipping service restart because DEPLOY_RESTART=0');
    return;
  }
  run(systemctl[0], [...systemctl.slice(1), 'restart', serviceName], { cwd: '/' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function probeBuildSentinel() {
  const target = new URL('den-web-build.json', publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`);
  return new Promise(resolve => {
    const req = http.request(target, { method: 'GET', timeout: 1000 }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

async function waitForServiceReady() {
  if (!shouldRestart) return;
  const deadline = Date.now() + readyTimeoutMs;
  log(`waiting for ${serviceName} to serve /den-web-build.json`);
  while (Date.now() < deadline) {
    if (await probeBuildSentinel() === 200) return;
    await sleep(250);
  }
  throw new Error(`${serviceName} did not become ready within ${readyTimeoutMs}ms`);
}

async function rollback(previousTarget) {
  if (!previousTarget) {
    log('no previous release recorded; rollback cannot switch current');
    return;
  }
  log(`rolling back to ${previousTarget}`);
  await activate(previousTarget, null);
  restartService();
}

function smoke(commit) {
  if (!shouldSmoke) {
    log('skipping smoke because DEPLOY_SMOKE=0');
    return;
  }
  run('node', ['tools/scripts/smoke-den-web.mjs'], {
    env: {
      DEN_WEB_URL: publicUrl,
      EXPECTED_BUILD_COMMIT: commit,
      EXPECTED_ENV_NAME: runtimeEnv.ENVIRONMENT_NAME ?? 'den-srv',
    },
  });
}

async function prune() {
  if (!Number.isFinite(keepReleases) || keepReleases <= 0) return;
  const keep = new Set();
  for (const link of [currentLink, previousLink]) {
    const target = await readLinkIfExists(link);
    if (target) keep.add(path.resolve(path.dirname(link), target));
  }
  const releases = (await fs.readdir(releasesDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(releasesDir, entry.name))
    .sort()
    .reverse();
  for (const release of releases.slice(keepReleases)) {
    if (!keep.has(path.resolve(release))) {
      log(`pruning old release ${release}`);
      await fs.rm(release, { recursive: true, force: true });
    }
  }
}

async function main() {
  process.chdir(repoRoot);
  const dirty = ensureCleanGit();
  const commit = read('git', ['rev-parse', 'HEAD']);
  const id = env.RELEASE_ID ?? releaseId(commit);
  const previousTarget = await readLinkIfExists(currentLink);
  log(`repo: ${repoRoot}`);
  log(`deploy root: ${deployRoot}`);
  log(`release: ${id}`);
  log(`public URL: ${publicUrl}`);
  if (!skipInstall) run('npm', ['ci']);
  if (!skipChecks) {
    run('npm', ['run', 'check:all']);
    run('npm', ['test']);
    run('npm', ['run', 'test:static-server']);
  }
  run('npm', ['run', 'build']);
  if (dryRun) {
    log(`dry run complete; would stage and activate ${id}`);
    return;
  }
  await fs.mkdir(releasesDir, { recursive: true });
  await fs.mkdir(sharedDir, { recursive: true, mode: 0o750 });
  const releaseDir = await stageRelease(commit, dirty, id);
  await activate(releaseDir, previousTarget);
  try {
    restartService();
    await waitForServiceReady();
    smoke(commit);
  } catch (error) {
    await rollback(previousTarget);
    throw error;
  }
  await prune();
  log(`deployed ${id}`);
}

main().catch(error => {
  console.error(`[deploy-den-srv] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Durable deploy script for the den-web static service.
 *
 * Intended to run on den-srv from the repository root. It builds the app,
 * stages a timestamped release, atomically flips stable symlinks, restarts the
 * systemd service, smokes the public URL, and rolls back the symlink on smoke
 * failure.
 */

import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = process.env;

const DEPLOY_ROOT = env.DEPLOY_ROOT ?? '/data/services/den-web';
const RELEASES_DIR = path.join(DEPLOY_ROOT, 'releases');
const SHARED_DIR = path.join(DEPLOY_ROOT, 'shared');
const CURRENT_LINK = path.join(DEPLOY_ROOT, 'current');
const PREVIOUS_LINK = path.join(DEPLOY_ROOT, 'previous');
const WWWROOT_LINK = path.join(DEPLOY_ROOT, 'wwwroot');
const SERVER_LINK = path.join(DEPLOY_ROOT, 'den-web-static-server.mjs');
const SERVICE_NAME = env.SERVICE_NAME ?? 'den-web.service';
const PUBLIC_URL = env.DEN_WEB_URL ?? 'http://192.168.1.10:18080';
const KEEP_RELEASES = Number.parseInt(env.KEEP_RELEASES ?? '5', 10);
const SHOULD_RESTART = env.DEPLOY_RESTART !== '0';
const SHOULD_SMOKE = env.DEPLOY_SMOKE !== '0';
const SHOULD_PRUNE = env.DEPLOY_PRUNE !== '0';
const SKIP_INSTALL = env.SKIP_INSTALL === '1';
const SKIP_CHECKS = env.SKIP_CHECKS === '1';
const ALLOW_DIRTY = env.ALLOW_DIRTY === '1';
const DRY_RUN = env.DRY_RUN === '1';
const SYSTEMCTL = (env.SYSTEMCTL ?? 'systemctl').split(/\s+/).filter(Boolean);
const SERVICE_READY_TIMEOUT_MS = Number.parseInt(env.SERVICE_READY_TIMEOUT_MS ?? '15000', 10);
const DEFAULT_TIMELINE_SUCCESSOR_ENABLED = 'true';
const DEFAULT_TIMELINE_SUCCESSOR_PROJECT_IDS = 'den-web';
const runtimeEnv = { ...readEnvFile(path.join(SHARED_DIR, 'gateway.env')), ...env };
const timelineSuccessorProjectIds = runtimeEnv.TIMELINE_SUCCESSOR_PROJECT_IDS
  ?? runtimeEnv.CONVERSATION_SUCCESSOR_READ_PROJECT_IDS
  ?? DEFAULT_TIMELINE_SUCCESSOR_PROJECT_IDS;

function log(message) {
  console.log(`[deploy-den-web] ${message}`);
}

function readEnvFile(filePath) {
  if (!fssync.existsSync(filePath)) return {};
  const values = {};
  for (const line of fssync.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    values[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return values;
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(' ')}`);
  if (DRY_RUN) return;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}

function runStatus(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? 'inherit',
  });
  return result.status ?? 1;
}

function read(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
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

async function readLinkIfExists(target) {
  try {
    return await fs.readlink(target);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EINVAL') return null;
    throw error;
  }
}

async function symlinkAtomic(target, linkPath) {
  const tmp = `${linkPath}.tmp-${process.pid}`;
  await fs.rm(tmp, { force: true, recursive: true });
  await fs.symlink(target, tmp);
  await fs.rename(tmp, linkPath);
}

async function prepareSymlinkPath(linkPath) {
  try {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      const backup = `${linkPath}.pre-symlink-${new Date().toISOString().replace(/[-:.]/g, '')}`;
      log(`${linkPath} is a directory; moving it aside to ${backup}`);
      await fs.rename(linkPath, backup);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

async function copyDir(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });
  await fs.cp(src, dest, { recursive: true, dereference: true });
}

function buildRuntimeConfig() {
  return {
    denCoreApiBase: runtimeEnv.DEN_CORE_API_BASE ?? '/den-core-api',
    denChannelsApiBase: runtimeEnv.DEN_CHANNELS_API_BASE ?? '/api',
    docPublishApiBase: runtimeEnv.DOC_PUBLISH_API_BASE ?? '/api/v1/blog/publications',
    piCrewAdminApiBase: runtimeEnv.PI_CREW_ADMIN_API_BASE ?? '/pi-crew-admin-api',
    conversationSuccessorReadsEnabled: runtimeEnv.CONVERSATION_SUCCESSOR_READS_ENABLED === '1' || runtimeEnv.CONVERSATION_SUCCESSOR_READS_ENABLED === 'true',
    conversationSuccessorWritesEnabled: runtimeEnv.CONVERSATION_SUCCESSOR_WRITES_ENABLED === '1' || runtimeEnv.CONVERSATION_SUCCESSOR_WRITES_ENABLED === 'true',
    conversationSuccessorApiBase: runtimeEnv.CONVERSATION_SUCCESSOR_API_BASE ?? '/api/v1/conversation',
    conversationSuccessorReadProjectIds: (runtimeEnv.CONVERSATION_SUCCESSOR_READ_PROJECT_IDS ?? '').split(',').map(item => item.trim()).filter(Boolean),
    conversationSuccessorWriteProjectIds: (runtimeEnv.CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS ?? '').split(',').map(item => item.trim()).filter(Boolean),
    timelineSuccessorEnabled: (runtimeEnv.TIMELINE_SUCCESSOR_ENABLED ?? DEFAULT_TIMELINE_SUCCESSOR_ENABLED) === '1' || (runtimeEnv.TIMELINE_SUCCESSOR_ENABLED ?? DEFAULT_TIMELINE_SUCCESSOR_ENABLED) === 'true',
    timelineSuccessorApiBase: runtimeEnv.TIMELINE_SUCCESSOR_API_BASE ?? '/api/v1/timeline',
    timelineSuccessorProjectIds: timelineSuccessorProjectIds.split(',').map(item => item.trim()).filter(Boolean),
    appBasePath: runtimeEnv.APP_BASE_PATH ?? '/',
    environmentName: runtimeEnv.ENVIRONMENT_NAME ?? 'den-srv',
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureCleanGit() {
  const status = read('git', ['status', '--porcelain']);
  if (status && !ALLOW_DIRTY) {
    throw new Error('working tree is dirty; commit/stash changes or rerun with ALLOW_DIRTY=1');
  }
  return status;
}

function releaseIdFor(commit) {
  const stamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${commit.slice(0, 12)}`;
}

async function ensureDeployRoot() {
  await fs.mkdir(RELEASES_DIR, { recursive: true });
  await fs.mkdir(SHARED_DIR, { recursive: true, mode: 0o750 });
}

async function stageRelease({ commit, dirty, releaseId }) {
  const releaseDir = path.join(RELEASES_DIR, releaseId);
  const releaseWwwroot = path.join(releaseDir, 'wwwroot');
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(releaseDir, { recursive: true });
  await copyDir(path.join(REPO_ROOT, 'dist'), releaseWwwroot);
  await fs.copyFile(
    path.join(REPO_ROOT, 'ops', 'den-web-static-server.mjs'),
    path.join(releaseDir, 'den-web-static-server.mjs'),
  );
  await fs.chmod(path.join(releaseDir, 'den-web-static-server.mjs'), 0o755);
  await writeJson(path.join(releaseWwwroot, 'den-web-config.json'), buildRuntimeConfig());
  await writeJson(path.join(releaseWwwroot, 'den-web-build.json'), {
    commit,
    dirty,
    releaseId,
    builtAt: new Date().toISOString(),
    builtBy: env.BUILT_BY ?? os.userInfo().username,
    sourceRepo: REPO_ROOT,
  });

  const sharedGatewayEnv = path.join(SHARED_DIR, 'gateway.env');
  if (await exists(sharedGatewayEnv)) {
    await symlinkAtomic(sharedGatewayEnv, path.join(releaseDir, 'gateway.env'));
  }

  return releaseDir;
}

async function activateRelease(releaseDir, previousTarget) {
  await prepareSymlinkPath(CURRENT_LINK);
  await prepareSymlinkPath(WWWROOT_LINK);
  await prepareSymlinkPath(SERVER_LINK);
  await symlinkAtomic(releaseDir, CURRENT_LINK);
  await symlinkAtomic(path.join(CURRENT_LINK, 'wwwroot'), WWWROOT_LINK);
  await symlinkAtomic(path.join(CURRENT_LINK, 'den-web-static-server.mjs'), SERVER_LINK);
  if (previousTarget) {
    await symlinkAtomic(previousTarget, PREVIOUS_LINK);
  }
}

function systemctl(...args) {
  if (!SHOULD_RESTART) {
    log(`skipping systemctl ${args.join(' ')} because DEPLOY_RESTART=0`);
    return;
  }
  run(SYSTEMCTL[0], [...SYSTEMCTL.slice(1), ...args], { cwd: '/' });
}

function systemctlReadOnly(...args) {
  const systemctlBin = SYSTEMCTL.at(-1) ?? 'systemctl';
  return runStatus(systemctlBin, args, { cwd: '/' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readinessUrl() {
  const base = PUBLIC_URL.endsWith('/') ? PUBLIC_URL : `${PUBLIC_URL}/`;
  return new URL('den-web-build.json', base);
}

function probeHttp(urlToProbe) {
  return new Promise((resolve) => {
    const req = http.request(urlToProbe, { method: 'GET', timeout: 1_000 }, (res) => {
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
  if (!SHOULD_RESTART) return;
  const deadline = Date.now() + SERVICE_READY_TIMEOUT_MS;
  const target = readinessUrl();
  log(`waiting for ${SERVICE_NAME} to serve ${target.href}`);

  while (Date.now() < deadline) {
    const status = await probeHttp(target);
    if (status === 200) {
      log(`${SERVICE_NAME} is serving build sentinel`);
      return;
    }
    await sleep(250);
  }

  log(`${SERVICE_NAME} did not become ready within ${SERVICE_READY_TIMEOUT_MS}ms`);
  systemctlReadOnly('status', SERVICE_NAME, '--no-pager', '-l');
  throw new Error(`${SERVICE_NAME} did not become ready at ${target.href}`);
}

function smoke(commit) {
  if (!SHOULD_SMOKE) {
    log('skipping smoke because DEPLOY_SMOKE=0');
    return;
  }
  run('node', ['ops/smoke-den-web.mjs'], {
    env: {
      DEN_WEB_URL: PUBLIC_URL,
      EXPECTED_BUILD_COMMIT: commit,
      EXPECTED_ENV_NAME: runtimeEnv.ENVIRONMENT_NAME ?? 'den-srv',
      EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED: runtimeEnv.CONVERSATION_SUCCESSOR_READS_ENABLED ?? 'false',
      EXPECTED_CONVERSATION_SUCCESSOR_API_BASE: runtimeEnv.CONVERSATION_SUCCESSOR_API_BASE ?? '/api/v1/conversation',
      EXPECTED_TIMELINE_SUCCESSOR_ENABLED: runtimeEnv.TIMELINE_SUCCESSOR_ENABLED ?? DEFAULT_TIMELINE_SUCCESSOR_ENABLED,
      EXPECTED_TIMELINE_SUCCESSOR_API_BASE: runtimeEnv.TIMELINE_SUCCESSOR_API_BASE ?? '/api/v1/timeline',
    },
  });
}

async function rollback(previousTarget) {
  if (!previousTarget) {
    log('no previous release target recorded; cannot roll back automatically');
    return;
  }
  log(`rolling back current symlink to ${previousTarget}`);
  await prepareSymlinkPath(CURRENT_LINK);
  await prepareSymlinkPath(WWWROOT_LINK);
  await prepareSymlinkPath(SERVER_LINK);
  await symlinkAtomic(previousTarget, CURRENT_LINK);
  await symlinkAtomic(path.join(CURRENT_LINK, 'wwwroot'), WWWROOT_LINK);
  await symlinkAtomic(path.join(CURRENT_LINK, 'den-web-static-server.mjs'), SERVER_LINK);
  systemctl('restart', SERVICE_NAME);
}

async function pruneOldReleases() {
  if (!SHOULD_PRUNE || !Number.isFinite(KEEP_RELEASES) || KEEP_RELEASES <= 0) return;
  const keep = new Set();
  for (const link of [CURRENT_LINK, PREVIOUS_LINK]) {
    const target = await readLinkIfExists(link);
    if (target) keep.add(path.resolve(path.dirname(link), target));
  }
  const entries = await fs.readdir(RELEASES_DIR, { withFileTypes: true });
  const releases = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(RELEASES_DIR, entry.name))
    .sort()
    .reverse();

  for (const release of releases.slice(KEEP_RELEASES)) {
    if (keep.has(path.resolve(release))) continue;
    log(`pruning old release ${release}`);
    if (!DRY_RUN) await fs.rm(release, { recursive: true, force: true });
  }
}

async function main() {
  process.chdir(REPO_ROOT);
  const dirtyStatus = ensureCleanGit();
  const commit = read('git', ['rev-parse', 'HEAD']);
  const releaseId = env.RELEASE_ID ?? releaseIdFor(commit);
  const previousTarget = await readLinkIfExists(CURRENT_LINK);

  log(`repo: ${REPO_ROOT}`);
  log(`deploy root: ${DEPLOY_ROOT}`);
  log(`release: ${releaseId}`);
  log(`public URL: ${PUBLIC_URL}`);

  if (!SKIP_INSTALL) run('npm', ['ci']);
  if (!SKIP_CHECKS) {
    run('npm', ['run', 'check:all']);
    run('npm', ['test']);
    run('npm', ['run', 'test:static-server']);
  }
  run('npm', ['run', 'build']);

  if (DRY_RUN) {
    log(`dry run complete; would stage and activate ${releaseId}`);
    return;
  }

  await ensureDeployRoot();
  const releaseDir = await stageRelease({
    commit,
    dirty: Boolean(dirtyStatus),
    releaseId,
  });

  await activateRelease(releaseDir, previousTarget);
  try {
    systemctl('restart', SERVICE_NAME);
    await waitForServiceReady();
    smoke(commit);
  } catch (error) {
    await rollback(previousTarget);
    throw error;
  }

  await pruneOldReleases();
  log(`deployed ${releaseId}`);
}

main().catch(error => {
  console.error(`[deploy-den-web] ERROR: ${error.message}`);
  process.exit(1);
});

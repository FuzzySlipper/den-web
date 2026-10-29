#!/usr/bin/env node

// Build and stage a Den Web release on this machine, ship it to the service
// host over SSH, and activate it there. The host needs no checkout or Node
// toolchain: it only receives the staged release directory.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as url from 'node:url';
import http from 'node:http';
import https from 'node:https';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const env = process.env;

const branch = env.DEN_WEB_DEPLOY_BRANCH ?? 'main';
const remoteName = env.DEN_WEB_DEPLOY_REMOTE ?? 'origin';
const sshCommand = (env.DEN_WEB_DEPLOY_SSH ?? `ssh -F ${os.homedir()}/server-access/den-services/config target`)
  .split(/\s+/)
  .filter(Boolean);
const deployRoot = env.DEPLOY_ROOT ?? '/data/services/den-web';
const deployOwner = env.DEN_WEB_DEPLOY_OWNER ?? 'agent:agents';
const publicUrl = env.DEN_WEB_URL ?? 'http://192.168.1.5:18080';
const keepReleases = Number.parseInt(env.KEEP_RELEASES ?? '5', 10);
const skipPush = env.SKIP_PUSH === '1' || env.DEPLOY_SKIP_PUSH === '1';
const allowDirty = env.ALLOW_DIRTY === '1';
const allowBranchMismatch = env.ALLOW_BRANCH_MISMATCH === '1';
const shouldSmoke = env.DEPLOY_SMOKE !== '0';
const dryRun = env.DRY_RUN === '1';
const readyTimeoutMs = Number.parseInt(env.SERVICE_READY_TIMEOUT_MS ?? '15000', 10);

function log(message) {
  console.log(`[deploy-den-srv-remote] ${message}`);
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    input: options.input,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  return result;
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

function remote(script, options = {}) {
  const [command, ...args] = sshCommand;
  return run(command, [...args, 'bash', '-s'], {
    input: `set -euo pipefail\n${script}`,
    stdio: ['pipe', options.capture ? 'pipe' : 'inherit', 'inherit'],
  });
}

function sh(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function ensureLocalState() {
  const status = read('git', ['status', '--porcelain']);
  if (status && !allowDirty) {
    throw new Error('local working tree is dirty; commit/stash changes or rerun with ALLOW_DIRTY=1 to deploy committed HEAD anyway');
  }
  const currentBranch = read('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (currentBranch !== branch && !allowBranchMismatch) {
    throw new Error(`current branch is ${currentBranch}, but DEN_WEB_DEPLOY_BRANCH is ${branch}; rerun on ${branch} or set ALLOW_BRANCH_MISMATCH=1`);
  }
}

function readJson(targetUrl) {
  const transport = targetUrl.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(targetUrl, { method: 'GET', timeout: 5000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
          reject(new Error(`GET ${targetUrl.href}: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`GET ${targetUrl.href}: timeout`));
    });
    req.end();
  });
}

async function waitForSentinel(expectedCommit) {
  const target = new URL('den-web-build.json', publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`);
  const deadline = Date.now() + readyTimeoutMs;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const sentinel = await readJson(target);
      if (sentinel.commit === expectedCommit) {
        log(`verified deployed build ${sentinel.releaseId ?? expectedCommit}`);
        return;
      }
      last = `commit ${sentinel.commit ?? 'unknown'}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`web-edge did not serve ${expectedCommit} within ${readyTimeoutMs}ms (last: ${last})`);
}

// Point current at a release and previous at the release it replaced, with
// atomic renames; wwwroot already follows current.
function activateScript(releaseDir, previousDir) {
  const lines = [
    `cd ${sh(deployRoot)}`,
    `ln -sfn ${sh(releaseDir)} current.tmp && mv -T current.tmp current`,
    `[ -L wwwroot ] || ln -sfn ${sh(`${deployRoot}/current/wwwroot`)} wwwroot`,
  ];
  if (previousDir) lines.push(`ln -sfn ${sh(previousDir)} previous.tmp && mv -T previous.tmp previous`);
  return lines.join('\n');
}

function pruneScript() {
  return `cd ${sh(`${deployRoot}/releases`)}
keep=" $(readlink -f ../current) $(readlink -f ../previous 2>/dev/null || true) "
ls -1d */ | sed 's#/$##' | sort -r | tail -n +${keepReleases + 1} | while read -r release; do
  case "$keep" in *" $PWD/$release "*) continue ;; esac
  echo "[deploy-den-srv-remote] pruning $release"
  rm -rf -- "$release"
done`;
}

async function main() {
  process.chdir(repoRoot);
  ensureLocalState();
  const commit = read('git', ['rev-parse', branch]);
  log(`commit: ${commit}`);
  log(`target: ${sshCommand.join(' ')}:${deployRoot}`);

  if (!skipPush && !dryRun) run('git', ['push', remoteName, branch]);

  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'den-web-release-'));
  try {
    run('node', ['tools/scripts/deploy-den-srv.mjs'], {
      env: { DEPLOY_ROOT: stagingRoot, STAGE_ONLY: '1', DEPLOY_SMOKE: '0' },
    });
    if (dryRun) {
      log('dry run complete; nothing shipped');
      return;
    }
    const [releaseId] = await fs.readdir(path.join(stagingRoot, 'releases'));
    if (!releaseId) throw new Error('staging produced no release');
    const releaseDir = `${deployRoot}/releases/${releaseId}`;

    const previous = remote(`readlink ${sh(`${deployRoot}/current`)} || true`, { capture: true }).stdout.trim();
    const previousPrevious = remote(`readlink ${sh(`${deployRoot}/previous`)} || true`, { capture: true }).stdout.trim();

    const archive = spawnSync('tar', ['-C', path.join(stagingRoot, 'releases'), '-czf', '-', releaseId], {
      maxBuffer: 1024 * 1024 * 1024,
    });
    if (archive.status !== 0) throw new Error(`tar failed: ${archive.stderr}`);
    log(`shipping ${releaseId} (${archive.stdout.length} bytes)`);
    const [command, ...args] = sshCommand;
    const upload = spawnSync(command, [
      ...args,
      `mkdir -p ${sh(`${deployRoot}/releases`)} && tar -C ${sh(`${deployRoot}/releases`)} -xzf - && chown -R ${sh(deployOwner)} ${sh(releaseDir)}`,
    ], { input: archive.stdout, stdio: ['pipe', 'inherit', 'inherit'] });
    if (upload.status !== 0) throw new Error(`upload failed with exit ${upload.status}`);

    remote(activateScript(releaseDir, previous));
    try {
      await waitForSentinel(commit);
      if (shouldSmoke) {
        run('node', ['tools/scripts/smoke-den-web.mjs'], {
          env: { DEN_WEB_URL: publicUrl, EXPECTED_BUILD_COMMIT: commit },
        });
      }
    } catch (error) {
      if (previous) {
        log(`rolling back to ${previous}`);
        remote(activateScript(previous, previousPrevious));
      }
      throw error;
    }

    if (Number.isFinite(keepReleases) && keepReleases > 0) remote(pruneScript());
    log(`deployed ${releaseId}`);
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[deploy-den-srv-remote] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';
import http from 'node:http';
import https from 'node:https';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const env = process.env;

const branch = env.DEN_WEB_DEPLOY_BRANCH ?? 'main';
const remoteName = env.DEN_WEB_DEPLOY_REMOTE ?? 'origin';
const remoteHost = env.DEN_WEB_DEPLOY_HOST ?? '192.168.1.10';
const remoteUser = env.DEN_WEB_DEPLOY_USER ?? 'agent';
const remoteTarget = env.DEN_WEB_DEPLOY_TARGET ?? `${remoteUser}@${remoteHost}`;
const remoteRepo = env.DEN_WEB_REMOTE_REPO ?? '/data/dev/den-web';
const systemctl = env.SYSTEMCTL ?? 'sudo -n /usr/bin/systemctl';
const publicUrl = env.DEN_WEB_URL ?? 'http://192.168.1.10:18080';
const skipPush = env.SKIP_PUSH === '1' || env.DEPLOY_SKIP_PUSH === '1';
const allowDirty = env.ALLOW_DIRTY === '1';
const allowBranchMismatch = env.ALLOW_BRANCH_MISMATCH === '1';
const skipSentinel = env.SKIP_SENTINEL === '1';

const passThroughEnv = [
  'ALLOW_DIRTY',
  'APP_BASE_PATH',
  'ARTIFACTS_API_BASE',
  'CACHE_HTML_SECONDS',
  'CACHE_MAX_AGE_SECONDS',
  'CONVERSATION_SUCCESSOR_API_BASE',
  'CONVERSATION_SUCCESSOR_READS_ENABLED',
  'CONVERSATION_SUCCESSOR_READ_PROJECT_IDS',
  'CONVERSATION_SUCCESSOR_WRITES_ENABLED',
  'CONVERSATION_SUCCESSOR_WRITE_PROJECT_IDS',
  'DELIVERY_SUCCESSOR_API_BASE',
  'DEN_WEB_URL',
  'DEPLOY_RESTART',
  'DEPLOY_ROOT',
  'DEPLOY_SMOKE',
  'DOC_PUBLISH_API_BASE',
  'DRY_RUN',
  'ENVIRONMENT_NAME',
  'KEEP_RELEASES',
  'LIBRARIAN_SUCCESSOR_API_BASE',
  'MESSAGES_SUCCESSOR_API_BASE',
  'OBSERVATION_SUCCESSOR_API_BASE',
  'RELEASE_ID',
  'SERVICE_NAME',
  'SERVICE_READY_TIMEOUT_MS',
  'SKIP_CHECKS',
  'SKIP_INSTALL',
  'TASKS_SUCCESSOR_API_BASE',
  'TIMELINE_SUCCESSOR_API_BASE',
  'TIMELINE_SUCCESSOR_ENABLED',
  'TIMELINE_SUCCESSOR_PROJECT_IDS',
];

function log(message) {
  console.log(`[deploy-den-srv-remote] ${message}`);
}

function run(command, args, options = {}) {
  log(`$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: options.encoding ?? 'utf8',
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

function remoteScript(expectedCommit) {
  const exports = [
    `export SYSTEMCTL=${sh(systemctl)}`,
    `export EXPECTED_COMMIT=${sh(expectedCommit)}`,
  ];
  for (const name of passThroughEnv) {
    if (env[name] !== undefined) exports.push(`export ${name}=${sh(env[name])}`);
  }

  return `set -euo pipefail
${exports.join('\n')}
echo "[deploy-den-srv-remote] remote host: $(hostname)"
echo "[deploy-den-srv-remote] repo: ${sh(remoteRepo)}"
cd ${sh(remoteRepo)}
if [ -n "$(git status --porcelain)" ] && [ "\${ALLOW_DIRTY:-0}" != "1" ]; then
  echo "[deploy-den-srv-remote] ERROR: remote working tree is dirty; commit/stash changes or rerun with ALLOW_DIRTY=1" >&2
  git status --short >&2
  exit 1
fi
git fetch ${sh(remoteName)} ${sh(branch)}
git checkout ${sh(branch)}
git pull --ff-only ${sh(remoteName)} ${sh(branch)}
actual="$(git rev-parse HEAD)"
if [ "$actual" != "$EXPECTED_COMMIT" ]; then
  echo "[deploy-den-srv-remote] ERROR: remote HEAD $actual does not match expected $EXPECTED_COMMIT" >&2
  exit 1
fi
echo "[deploy-den-srv-remote] deploying $actual"
npm run deploy:den-srv
`;
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

async function verifySentinel(expectedCommit) {
  if (skipSentinel || env.DRY_RUN === '1') return;
  const target = new URL('den-web-build.json', publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`);
  const sentinel = await readJson(target);
  if (sentinel.commit !== expectedCommit) {
    throw new Error(`deployed build commit is ${sentinel.commit ?? 'unknown'}, expected ${expectedCommit}`);
  }
  log(`verified deployed build ${sentinel.releaseId ?? expectedCommit}`);
}

async function main() {
  process.chdir(repoRoot);
  ensureLocalState();
  const expectedCommit = read('git', ['rev-parse', branch]);

  log(`local branch: ${branch}`);
  log(`target: ${remoteTarget}:${remoteRepo}`);
  log(`commit: ${expectedCommit}`);

  if (!skipPush) run('git', ['push', remoteName, branch]);
  else log('skipping git push because SKIP_PUSH=1 or DEPLOY_SKIP_PUSH=1');

  run('ssh', ['-o', 'BatchMode=yes', remoteTarget, 'bash', '-s'], {
    input: remoteScript(expectedCommit),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  await verifySentinel(expectedCommit);
}

main().catch((error) => {
  console.error(`[deploy-den-srv-remote] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

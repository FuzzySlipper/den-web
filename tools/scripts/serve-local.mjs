import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const port = process.env.PORT ?? '4200';
const detached = process.platform !== 'win32';
const child = spawn('npx', ['nx', 'run', 'den-web:serve', '--host', '127.0.0.1', '--port', port], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: false,
  detached,
});
let stopping = false;
let forceKillTimer;

console.log(`BASE_URL=http://127.0.0.1:${port}`);

function killChildTree(signal) {
  try {
    if (detached && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  killChildTree(signal);
  forceKillTimer = setTimeout(() => killChildTree('SIGKILL'), 5000);
  forceKillTimer.unref();
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

child.once('exit', (code, signal) => {
  clearTimeout(forceKillTimer);
  if (!stopping) {
    process.exitCode = code ?? (signal ? 1 : 0);
  }
});

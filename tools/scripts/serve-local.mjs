import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const port = process.env.PORT ?? '4200';
const child = spawn('npx', ['nx', 'run', 'den-web:serve', '--host', '127.0.0.1', '--port', port], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: false,
});

console.log(`BASE_URL=http://127.0.0.1:${port}`);

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

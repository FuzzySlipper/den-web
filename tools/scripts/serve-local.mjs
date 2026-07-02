import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '4200';
const child = spawn('npx', ['nx', 'run', 'den-web:serve', '--port', port], {
  stdio: 'inherit',
  shell: false,
});

console.log(`BASE_URL=http://127.0.0.1:${port}`);

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));


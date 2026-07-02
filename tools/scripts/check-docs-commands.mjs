import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const scripts = new Set(Object.keys(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {}));
const checkedFiles = ['README.md', 'AGENTS.md', 'docs/successor-brief.md', 'docs/live-testing.md'];
const failures = [];

for (const entry of readdirSync(join(root, 'docs'))) {
  const path = join(root, 'docs', entry);
  if (statSync(path).isFile() && entry.endsWith('.md') && !checkedFiles.includes(`docs/${entry}`)) {
    checkedFiles.push(`docs/${entry}`);
  }
}

for (const file of checkedFiles) {
  const body = readFileSync(join(root, file), 'utf8');
  const matches = body.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g);
  for (const match of matches) {
    const scriptName = match[1];
    if (!scripts.has(scriptName)) {
      failures.push(`${file} references missing npm script: ${scriptName}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('check:docs ok');


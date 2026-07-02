import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const knownScopes = new Set(JSON.parse(readFileSync(join(root, 'boundaries.json'), 'utf8')).scopes);
const requiredFiles = [
  'template-manifest.json',
  'boundaries.json',
  '.playwright-service.json',
  'apps/den-web-e2e/src/live/support/artifact-collector.ts',
  'apps/den-web-e2e/src/live/boot.live.spec.ts',
];

const failures = [];

for (const file of requiredFiles) {
  try {
    statSync(join(root, file));
  } catch {
    failures.push(`Missing required pattern file: ${file}`);
  }
}

const libs = readdirSync(join(root, 'libs')).filter((entry) => statSync(join(root, 'libs', entry)).isDirectory());

for (const lib of libs) {
  const projectPath = join(root, 'libs', lib, 'project.json');
  let project;
  try {
    project = JSON.parse(readFileSync(projectPath, 'utf8'));
  } catch {
    failures.push(`Missing or invalid project.json for libs/${lib}`);
    continue;
  }

  const tags = new Set(project.tags ?? []);
  const typeTags = [...tags].filter((tag) => tag.startsWith('type:'));
  const scopeTags = [...tags].filter((tag) => tag.startsWith('scope:'));

  if (typeTags.length !== 1) failures.push(`libs/${lib} must have exactly one type: tag`);
  if (scopeTags.length !== 1) failures.push(`libs/${lib} must have exactly one scope: tag`);

  const scope = scopeTags[0]?.slice('scope:'.length);
  if (scope && !knownScopes.has(scope)) failures.push(`libs/${lib} has unknown scope: ${scope}`);

  try {
    statSync(join(root, 'libs', lib, 'src', 'index.ts'));
  } catch {
    failures.push(`libs/${lib} must expose libs/${lib}/src/index.ts`);
  }
}

const manifest = JSON.parse(readFileSync(join(root, 'template-manifest.json'), 'utf8'));
for (const deviation of manifest.localDeviations ?? []) {
  if (typeof deviation.adr !== 'string') {
    failures.push('template-manifest localDeviations entries must include adr');
    continue;
  }
  try {
    statSync(join(root, deviation.adr));
  } catch {
    failures.push(`template-manifest deviation ADR does not exist: ${deviation.adr}`);
  }
}

const bootLive = readFileSync(join(root, 'apps/den-web-e2e/src/live/boot.live.spec.ts'), 'utf8');
if (!bootLive.includes('LIVE_RUN') && !bootLive.includes('requireLiveRun') && !bootLive.includes('liveScenario')) {
  failures.push('boot live scenario must be LIVE_RUN gated');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`check:pattern ok (${libs.length} libs)`);

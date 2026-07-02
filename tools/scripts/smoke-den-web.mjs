#!/usr/bin/env node

import * as http from 'node:http';

const baseUrl = process.env.DEN_WEB_URL ?? 'http://192.168.1.10:18080';
const expectedCommit = process.env.EXPECTED_BUILD_COMMIT ?? '';
const expectedEnvironment = process.env.EXPECTED_ENV_NAME ?? 'den-srv';
const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

let passes = 0;
let failures = 0;

function fullUrl(pathname) {
  return new URL(pathname, base);
}

function request(pathname, method = 'GET') {
  const target = fullUrl(pathname);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method,
      timeout: 15000,
      headers: { 'User-Agent': 'den-web-smoke/1.0' },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`timeout fetching ${target.href}`)));
    req.end();
  });
}

function pass(label) {
  passes += 1;
  console.log(`  PASS  ${label}`);
}

function fail(label, detail) {
  failures += 1;
  console.log(`  FAIL  ${label}: ${detail}`);
}

function assertStatus(label, response, expected = 200) {
  if (response.status === expected) pass(label);
  else fail(label, `expected HTTP ${expected}, got ${response.status}`);
}

function parseJson(label, response) {
  try {
    const parsed = JSON.parse(response.body);
    pass(`${label} is valid JSON`);
    return parsed;
  } catch (error) {
    fail(`${label} JSON`, error.message);
    return null;
  }
}

async function checkStaticRoot() {
  console.log('\n-- Static root --');
  const root = await request('/');
  assertStatus('GET /', root);
  const contentType = root.headers['content-type'] ?? '';
  if (contentType.includes('text/html')) pass('GET / returns HTML');
  else fail('GET / content-type', String(contentType));
  if (/Den Web/.test(root.body) && /<den-root/.test(root.body)) pass('HTML is the Den Web Angular shell');
  else fail('HTML shell', 'missing Den Web title or den-root element');
  if (/src="[^"]+\.js"/.test(root.body)) pass('HTML references a JavaScript asset');
  else fail('HTML asset reference', 'missing script src');
}

async function checkConfigAndBuild() {
  console.log('\n-- Runtime config and build sentinel --');
  const configResponse = await request('/den-web-config.json');
  assertStatus('GET /den-web-config.json', configResponse);
  const config = parseJson('/den-web-config.json', configResponse);
  if (config?.tasksSuccessorApiBase === '/api/v1') pass('tasksSuccessorApiBase is /api/v1');
  else fail('tasksSuccessorApiBase', JSON.stringify(config?.tasksSuccessorApiBase));
  if (config?.conversationSuccessorApiBase === '/api/v1/conversation') pass('conversation base is /api/v1/conversation');
  else fail('conversationSuccessorApiBase', JSON.stringify(config?.conversationSuccessorApiBase));
  if (config?.observationSuccessorApiBase === '/api/v1/observation') pass('observation base is /api/v1/observation');
  else fail('observationSuccessorApiBase', JSON.stringify(config?.observationSuccessorApiBase));
  if (config?.environmentName === expectedEnvironment) pass(`environmentName is ${expectedEnvironment}`);
  else fail('environmentName', JSON.stringify(config?.environmentName));

  const buildResponse = await request('/den-web-build.json');
  assertStatus('GET /den-web-build.json', buildResponse);
  const build = parseJson('/den-web-build.json', buildResponse);
  if (!expectedCommit) pass('build commit check skipped');
  else if (build?.commit === expectedCommit) pass(`build commit is ${expectedCommit}`);
  else fail('build commit', JSON.stringify(build?.commit));
}

async function checkApis() {
  console.log('\n-- Same-origin successor APIs --');
  for (const [label, pathname] of [
    ['projects', '/api/v1/projects'],
    ['tasks', '/api/v1/projects/den-web/tasks?limit=1'],
    ['notifications', '/api/v1/user-notifications?read_for_agent=web-ui&limit=5'],
    ['conversation', '/api/v1/conversation/channels?project_id=den-web&limit=1'],
    ['conversation memberships', '/api/v1/conversation/memberships?project_id=den-web&limit=20'],
    ['observation', '/api/v1/observation/lane?limit=1'],
    ['timeline', '/api/v1/timeline/channels/1/items?limit=1'],
  ]) {
    const response = await request(pathname);
    assertStatus(`GET ${label}`, response);
    parseJson(label, response);
  }

  for (const pathname of ['/api/channels?limit=1', '/api/gateway/memberships?projectId=den-web']) {
    const response = await request(pathname);
    assertStatus(`legacy ${pathname} returns 410`, response, 410);
  }
}

async function main() {
  console.log('Den Web smoke test');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Expected build commit: ${expectedCommit || '(not set)'}`);
  try {
    await checkStaticRoot();
    await checkConfigAndBuild();
    await checkApis();
  } catch (error) {
    fail('Unhandled smoke error', error instanceof Error ? error.message : String(error));
  }
  console.log(`\n-- Results: ${passes} passed, ${failures} failed --`);
  process.exit(failures > 0 ? 1 : 0);
}

main();

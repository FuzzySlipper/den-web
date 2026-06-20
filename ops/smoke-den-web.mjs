#!/usr/bin/env node

/**
 * smoke-den-web.mjs
 *
 * Deterministic smoke-test script for a deployed Den Web static service.
 * Verifies the static root, runtime config, build sentinel, and all
 * required API endpoints. Prints concise PASS/FAIL lines and exits
 * nonzero on any failure.
 *
 * Usage:
 *   node ops/smoke-den-web.mjs
 *   DEN_WEB_URL=http://192.168.1.10:18080 EXPECTED_BUILD_COMMIT=abc123 node ops/smoke-den-web.mjs
 *
 * Environment variables:
 *   DEN_WEB_URL           - Base URL of the deployed Den Web (default: http://192.168.1.10:18080)
 *   EXPECTED_BUILD_COMMIT - If set, verify den-web-build.json contains this commit hash
 *   EXPECTED_ENV_NAME     - Expected environmentName value (default: den-srv)
 *   EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED - Expected read pilot flag (default: false)
 *   EXPECTED_CONVERSATION_SUCCESSOR_API_BASE - Expected read pilot API base (default: /api/v1/conversation)
 *   REQUIRE_AGENT_WORK_COMPLETE_NOTIFICATION - If set to 1, require at least one
 *                         agent_work_complete row in the Core notification feed
 */

import * as http from 'node:http';
import * as url from 'node:url';

// ── Configuration ──────────────────────────────────────────────────────────────

const DEN_WEB_URL       = process.env.DEN_WEB_URL ?? 'http://192.168.1.10:18080';
const EXPECTED_BUILD_COMMIT = process.env.EXPECTED_BUILD_COMMIT ?? '';
const EXPECTED_ENV_NAME = process.env.EXPECTED_ENV_NAME ?? 'den-srv';
const EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED = (process.env.EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED ?? 'false').toLowerCase() === 'true';
const EXPECTED_CONVERSATION_SUCCESSOR_API_BASE = process.env.EXPECTED_CONVERSATION_SUCCESSOR_API_BASE ?? '/api/v1/conversation';
const REQUIRE_AGENT_WORK_COMPLETE_NOTIFICATION = process.env.REQUIRE_AGENT_WORK_COMPLETE_NOTIFICATION === '1';

// Parse base URL
const BASE = new URL(DEN_WEB_URL.endsWith('/') ? DEN_WEB_URL : DEN_WEB_URL + '/');
const BASE_PATH = BASE.pathname.replace(/\/+$/, '');

let failures = 0;
let passes = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fullUrl(pathname) {
  const u = new URL(pathname, BASE);
  return u.href;
}

function fetchUrl(requestUrl, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(requestUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      timeout: 15000,
      headers: {
        'User-Agent': 'smoke-den-web/1.0',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${requestUrl}`));
    });

    req.end();
  });
}

function pass(label) {
  passes++;
  console.log(`  PASS  ${label}`);
}

function fail(label, detail) {
  failures++;
  console.log(`  FAIL  ${label}: ${detail}`);
}

function assertStatus(label, result, expected = 200) {
  if (result.status === expected) {
    pass(label);
  } else {
    fail(label, `expected HTTP ${expected}, got ${result.status}`);
  }
}

function assertJson(label, result) {
  try {
    JSON.parse(result.body);
    pass(label);
  } catch (e) {
    fail(label, `invalid JSON: ${e.message}`);
  }
}

function assertBodyContains(label, result, needle) {
  if (result.body.includes(needle)) {
    pass(label);
  } else {
    fail(label, `body does not contain "${needle}"`);
  }
}

function parseJsonBody(label, result) {
  try {
    return JSON.parse(result.body);
  } catch (e) {
    fail(label, `invalid JSON: ${e.message}`);
    return null;
  }
}

// ── Checks ─────────────────────────────────────────────────────────────────────

async function checkRoot() {
  console.log('\n── Static root ──');
  const result = await fetchUrl(fullUrl('/'));
  assertStatus('GET / returns 200', result);

  const ct = result.headers['content-type'] || '';
  if (ct.includes('text/html')) {
    pass('Content-Type is text/html');
  } else {
    fail('Content-Type', `expected text/html, got ${ct}`);
  }

  if (result.body.includes('<title>Den Web</title>')) {
    pass('HTML contains <title>Den Web</title>');
  } else {
    fail('HTML title', 'missing <title>Den Web</title>');
  }

  // Check for asset references
  const jsMatch = result.body.match(/src="([^"]+\.js)"/);
  if (jsMatch) {
    pass(`HTML references JS asset: ${jsMatch[1]}`);
  } else {
    fail('JS asset reference', 'no JS asset <script src="..."> found');
  }

  const cssMatch = result.body.match(/href="([^"]+\.css)"/);
  if (cssMatch) {
    pass(`HTML references CSS asset: ${cssMatch[1]}`);
  } else {
    fail('CSS asset reference', 'no CSS <link href="..."> found');
  }
}

async function checkConfig() {
  console.log('\n── Runtime config ──');
  const result = await fetchUrl(fullUrl('/den-web-config.json'));
  assertStatus('GET /den-web-config.json returns 200', result);
  assertJson('den-web-config.json is valid JSON', result);

  const config = JSON.parse(result.body);
  if (config.denCoreApiBase === '/den-core-api') {
    pass('config.denCoreApiBase == "/den-core-api"');
  } else {
    fail('config.denCoreApiBase', `expected "/den-core-api", got "${config.denCoreApiBase}"`);
  }

  if (config.denChannelsApiBase === '/api') {
    pass('config.denChannelsApiBase == "/api"');
  } else {
    fail('config.denChannelsApiBase', `expected "/api", got "${config.denChannelsApiBase}"`);
  }

  if (config.denHostApiBase === '/den-host-api') {
    pass('config.denHostApiBase == "/den-host-api"');
  } else {
    fail('config.denHostApiBase', `expected "/den-host-api", got "${config.denHostApiBase}"`);
  }

  if (config.conversationSuccessorReadsEnabled === EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED) {
    pass(`config.conversationSuccessorReadsEnabled == ${EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED}`);
  } else {
    fail('config.conversationSuccessorReadsEnabled', `expected ${EXPECTED_CONVERSATION_SUCCESSOR_READS_ENABLED}, got ${JSON.stringify(config.conversationSuccessorReadsEnabled)}`);
  }

  if (config.conversationSuccessorApiBase === EXPECTED_CONVERSATION_SUCCESSOR_API_BASE) {
    pass(`config.conversationSuccessorApiBase == "${EXPECTED_CONVERSATION_SUCCESSOR_API_BASE}"`);
  } else {
    fail('config.conversationSuccessorApiBase', `expected "${EXPECTED_CONVERSATION_SUCCESSOR_API_BASE}", got "${config.conversationSuccessorApiBase}"`);
  }

  if (config.environmentName === EXPECTED_ENV_NAME) {
    pass(`config.environmentName == "${EXPECTED_ENV_NAME}"`);
  } else {
    fail('config.environmentName', `expected "${EXPECTED_ENV_NAME}", got "${config.environmentName}"`);
  }
}

async function checkBuildSentinel() {
  console.log('\n── Build sentinel ──');
  const result = await fetchUrl(fullUrl('/den-web-build.json'));

  if (EXPECTED_BUILD_COMMIT) {
    assertStatus('GET /den-web-build.json returns 200', result);
    assertJson('den-web-build.json is valid JSON', result);

    const sentinel = JSON.parse(result.body);
    const commit = sentinel.commit || sentinel.buildCommit || '';
    if (commit === EXPECTED_BUILD_COMMIT) {
      pass(`build commit matches "${EXPECTED_BUILD_COMMIT}"`);
    } else if (commit) {
      fail('build commit', `expected "${EXPECTED_BUILD_COMMIT}", got "${commit}"`);
    } else {
      // Might have the hash elsewhere; check body contains it
      if (result.body.includes(EXPECTED_BUILD_COMMIT)) {
        pass(`build sentinel body contains "${EXPECTED_BUILD_COMMIT}"`);
      } else {
        fail('build commit', `expected "${EXPECTED_BUILD_COMMIT}" in body, not found`);
      }
    }
  } else {
    // Just check it returns valid JSON or empty object
    if (result.status === 200) {
      assertJson('den-web-build.json is valid JSON', result);
    } else if (result.status === 404) {
      pass('den-web-build.json not present (EXPECTED_BUILD_COMMIT not set, 404 is acceptable)');
    } else {
      fail('den-web-build.json', `unexpected status ${result.status}`);
    }
  }
}

async function checkCoreApi() {
  console.log('\n── Den Core API (via /den-core-api/) ──');

  // Health endpoint
  const health = await fetchUrl(fullUrl('/den-core-api/health'));
  assertStatus('GET /den-core-api/health', health);
  assertJson('/den-core-api/health returns JSON', health);

  // Projects list
  const projects = await fetchUrl(fullUrl('/den-core-api/api/projects'));
  assertStatus('GET /den-core-api/api/projects', projects);
  assertJson('/den-core-api/api/projects returns JSON', projects);
}

async function checkNotificationFeed() {
  console.log('\n── Operator notification feed (via /den-core-api/) ──');

  const feed = await fetchUrl(fullUrl('/den-core-api/api/user-notifications?readFor=web-ui&limit=5'));
  assertStatus('GET /den-core-api/api/user-notifications', feed);
  assertJson('/den-core-api/api/user-notifications returns JSON', feed);

  const feedItems = parseJsonBody('/den-core-api/api/user-notifications shape', feed);
  if (Array.isArray(feedItems)) {
    pass('notification feed returns an array of Core notification rows');
    if (feedItems.length > 0 && Object.prototype.hasOwnProperty.call(feedItems[0], 'is_read')) {
      pass('notification feed includes server-backed read state');
    } else if (feedItems.length === 0) {
      pass('notification feed is empty (acceptable without a seeded operator event)');
    } else {
      fail('notification feed read state', 'expected rows to include is_read');
    }
  } else if (feedItems !== null) {
    fail('notification feed shape', 'expected JSON array');
  }

  const agentDone = await fetchUrl(fullUrl('/den-core-api/api/user-notifications?readFor=web-ui&limit=5&metadataType=agent_work_complete'));
  assertStatus('GET /den-core-api/api/user-notifications?metadataType=agent_work_complete', agentDone);
  const agentDoneItems = parseJsonBody('agent_work_complete notification feed shape', agentDone);
  if (Array.isArray(agentDoneItems) && agentDoneItems.length > 0) {
    pass('agent_work_complete notification sample is available for rendering');
  } else if (REQUIRE_AGENT_WORK_COMPLETE_NOTIFICATION) {
    fail('agent_work_complete notification sample', 'required by env but none were returned');
  } else {
    pass('agent_work_complete notification sample not required (set REQUIRE_AGENT_WORK_COMPLETE_NOTIFICATION=1 to enforce)');
  }
}

async function checkChannelsApi() {
  console.log('\n── Den Channels API (via /api/) ──');

  const channels = await fetchUrl(fullUrl('/api/channels?limit=1'));
  assertStatus('GET /api/channels?limit=1', channels);
  assertJson('/api/channels?limit=1 returns JSON', channels);

  const memberships = await fetchUrl(fullUrl('/api/gateway/memberships?projectId=den-web'));
  assertStatus('GET /api/gateway/memberships?projectId=den-web', memberships);
  assertJson('/api/gateway/memberships returns JSON', memberships);

  const overview = await fetchUrl(fullUrl('/api/agents/overview'));
  assertStatus('GET /api/agents/overview', overview);
  assertJson('/api/agents/overview returns JSON', overview);
}

async function checkObservationApi() {
  console.log('\n── Observation API (via Gateway /api/v1/observation/) ──');

  const lane = await fetchUrl(fullUrl('/api/v1/observation/lane?limit=1'));
  assertStatus('GET /api/v1/observation/lane?limit=1', lane);
  assertJson('/api/v1/observation/lane returns JSON', lane);

  const body = parseJsonBody('/api/v1/observation/lane shape', lane);
  if (body && Array.isArray(body.events)) {
    pass('/api/v1/observation/lane returns an events array');
  } else if (body !== null) {
    fail('/api/v1/observation/lane shape', 'expected an object with events array');
  }
}

async function checkDenHostApi() {
  console.log('\n── Den Host API (via /den-host-api/) ──');

  const fleetOps = await fetchUrl(fullUrl('/den-host-api/fleet-ops'));
  assertStatus('GET /den-host-api/fleet-ops', fleetOps);
  assertJson('/den-host-api/fleet-ops returns JSON', fleetOps);

  try {
    const body = JSON.parse(fleetOps.body);
    if (body.service === 'den-host' && Array.isArray(body.actions)) {
      pass('/den-host-api/fleet-ops returns FleetOps overview shape');
    } else {
      fail('/den-host-api/fleet-ops shape', 'expected service="den-host" and actions array');
    }
  } catch (e) {
    fail('/den-host-api/fleet-ops shape', `invalid JSON: ${e.message}`);
  }

  const retiredGateway = await fetchUrl(fullUrl('/den-gateway-api/fleet-ops'));
  if (retiredGateway.status === 410 || retiredGateway.status === 404) {
    pass('retired /den-gateway-api/fleet-ops no longer returns misleading 502');
  } else {
    fail('/den-gateway-api/fleet-ops retired route', `expected 410/404, got ${retiredGateway.status}`);
  }
}

async function checkDocumentDiscussion() {
  console.log('\n── Document discussion API ──');

  const result = await fetchUrl(fullUrl(
    '/den-core-api/api/projects/den-web/documents/den-web-static-service-contract/discussion'
  ));

  // Accept 200 with JSON, or 404/null-style response (returns JSON null or body that parses)
  if (result.status === 200) {
    assertJson('discussion endpoint returns JSON', result);
    pass('discussion endpoint returns 200');
  } else if (result.status === 404) {
    // 404 is acceptable — document may not have a discussion yet
    pass('discussion endpoint returns 404 (acceptable — no discussion exists)');
  } else {
    // Other non-200: fail if it's really broken
    fail('discussion endpoint', `unexpected status ${result.status}, expected 200 or 404`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Den Web smoke test`);
  console.log(`Base URL: ${DEN_WEB_URL}`);
  console.log(`Expected build commit: ${EXPECTED_BUILD_COMMIT || '(not set)'}`);
  console.log(`Expected env name: ${EXPECTED_ENV_NAME}`);

  try {
    await checkRoot();
    await checkConfig();
    await checkBuildSentinel();
    await checkCoreApi();
    await checkNotificationFeed();
    await checkChannelsApi();
    await checkObservationApi();
    await checkDenHostApi();
    await checkDocumentDiscussion();
  } catch (err) {
    console.error(`\n  ERROR  Unhandled exception: ${err.message}`);
    failures++;
  }

  const total = passes + failures;
  console.log(`\n── Results: ${passes} passed, ${failures} failed (${total} total) ──`);

  process.exit(failures > 0 ? 1 : 0);
}

main();

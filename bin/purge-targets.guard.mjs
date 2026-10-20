// ★★★ POS-DEMO-PURGE (2026-10-20) — THE KERNEL PURGES EVERY FRONT OF THIS BOX THAT KEEPS A DATA CACHE.
//
//   node --test bin/purge-targets.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// Measured in the v0.3.3 blind rehearsal (phase 7/7b, 2026-10-19/20): the kernel's FORGE_STOREFRONT_URL named
// ONE target (`compose.yml`, `http://storefront:3000`; boot line `storefront cache invalidation ON — 1
// target(s)`), while VC-1 (#45) had put the café's and the totem's data caches on VOLUMES that survive a deploy.
// A price changed in the admin then reached those two fronts only when the read's TTL ran out — up to an hour —
// and nothing anywhere said so: every page answered 200 with the old price. The kernel takes a comma-separated
// LIST (published at v0.3.3 in the product's `docs/guides/demo-local.md`), so the cure is one line; this guard
// is what keeps the line true the day a fourth front is added.
//
// ── THE RULES, all DERIVED from the compose files, none a list typed here ───────────────────────────────
//
//   1. EVERY SERVICE THAT MOUNTS A NAMED VOLUME AT ITS FORGE_DATA_CACHE_DIR is a target of the kernel's
//      effective FORGE_STOREFRONT_URL (the last layer of the merge that declares it wins, as in compose), at
//      `http://<service>:<its PORT>` — its process on the compose network, never its edge.
//   2. EVERY TARGET NAMES A SERVICE THAT EXISTS. A target with no service is an unresolvable host the kernel
//      posts every event to, and fails on, forever.
//   3. EVERY TARGET CARRIES THE PURGE SECRET (`FORGE_REVALIDATE_SECRET: ${FORGE_REVALIDATE_SECRET:-}`) — a
//      front without it refuses every purge with a 401 and the cache lives out its TTL again.
//   4. EVERY TARGET THAT IS A FORK OF THIS REPOSITORY SHIPS `src/app/api/revalidate/route.ts` WITH A `POST` —
//      read as CODE, comments out. (The reference `storefront` is the product's image and carries its own.)
//   5. NO ENV FILE OF THIS REPO SHADOWS THE LIST with a shorter one: compose prefers `.env` and the shell over
//      the `${…:-default}`, so a declaration in `.env.example` or `deploy/*.env` is graded like the default.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { serviceBlock, volumeAt } from './edge-text.mjs';
import { forks } from './forks.mjs';
import { ROOT } from './release-tree.mjs';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const VAR = 'FORGE_STOREFRONT_URL';

/** The service names of one compose file, in order. */
export function servicesOf(text) {
  const out = [];
  let inServices = false;
  for (const l of text.split('\n')) {
    if (/^\S/.test(l)) inServices = /^services:\s*$/.test(l);
    else if (inServices) {
      const m = /^ {2}([a-z0-9_-]+):\s*$/.exec(l);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

/** One env value of a service block (six-space key), or undefined. */
const envOf = (block, key) => {
  for (const l of block ?? []) {
    const m = new RegExp(`^ {6}${key}:\\s*(.+?)\\s*$`).exec(l);
    if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
};

/** `${VAR:-default}` → default; a bare value → itself. */
const defaultOf = (value) => /^\$\{[A-Z_]+:-(.*)\}$/.exec(value)?.[1] ?? value;

/** The comma-separated list the kernel splits, blanks out. */
export const targetsOf = (list) => list.split(',').map((t) => t.trim()).filter(Boolean);

/** The merged view of `layers`: every service, a service's last value of a key, and the fronts that cache —
 *  the services that mount a named volume at the FORGE_DATA_CACHE_DIR they declare. */
export function stack(layers) {
  const services = [...new Set(layers.flatMap((l) => servicesOf(l.text)))];
  const blocks = (svc) => layers.map((l) => serviceBlock(l.text, svc)).filter(Boolean);
  const last = (svc, key) => blocks(svc).reduce((v, b) => envOf(b, key) ?? v, undefined);
  const fronts = services.filter((svc) => {
    const dir = last(svc, 'FORGE_DATA_CACHE_DIR');
    return dir && blocks(svc).some((b) => volumeAt(b, dir));
  });
  return { services, last, fronts };
}

/**
 * What is wrong with the purge targets of a merged stack. `layers` are `{ name, text }` in merge order.
 * Returns human sentences; empty means right.
 */
export function purgeGaps(layers, { declared = [], forkDirs = [], hasRoute = () => true } = {}) {
  const gaps = [];
  const { services, last, fronts } = stack(layers);

  const kernelValue = last('kernel', VAR);
  if (kernelValue === undefined) return [`the kernel declares no ${VAR} in any layer — no front is purged at all`];
  const lists = [{ from: 'the compose default', value: defaultOf(kernelValue) }, ...declared];

  if (fronts.length === 0) gaps.push('no service mounts a data-cache volume — this guard is reading the wrong files');

  for (const { from, value } of lists) {
    const targets = targetsOf(value);
    for (const svc of fronts) {
      const want = `http://${svc}:${last(svc, 'PORT') ?? 3000}`;
      if (!targets.includes(want))
        gaps.push(`${from}: ${VAR}=${value} misses ${want} — \`${svc}\` caches on a volume and is never purged`);
    }
    for (const t of targets) {
      const host = /^https?:\/\/([a-z0-9_-]+)(?::\d+)?\/?$/.exec(t)?.[1];
      if (!host || !services.includes(host))
        gaps.push(`${from}: target ${t} names no service of this stack — the kernel would post every event to nowhere`);
    }
  }

  for (const host of targetsOf(defaultOf(kernelValue)).map((t) => /^https?:\/\/([a-z0-9_-]+)/.exec(t)?.[1])) {
    if (!host || !services.includes(host)) continue;
    if (last(host, 'FORGE_REVALIDATE_SECRET') !== '${FORGE_REVALIDATE_SECRET:-}')
      gaps.push(`\`${host}\` is a purge target without FORGE_REVALIDATE_SECRET — it answers every purge 401`);
    if (forkDirs.includes(host) && !hasRoute(host))
      gaps.push(`\`${host}\` is a purge target and ships no POST in src/app/api/revalidate/route.ts — every purge 404s`);
  }
  return gaps;
}

// ── THIS TREE ───────────────────────────────────────────────────────────────────────────────────────────

/** The merge order a box and a bench use: compose.yml, compose.override.yml, then the bench's own files. */
const benchFiles = (/^FORGE_BENCH_COMPOSE_FILES=(.*)$/m.exec(read('bench/bench.env'))?.[1] ?? '').split(/\s+/).filter(Boolean);
const LAYERS = ['compose.yml', 'compose.override.yml', ...benchFiles].map((name) => ({ name, text: read(name) }));

const ENV_FILES = ['.env.example', 'bench/bench.env', ...readdirSync(join(ROOT, 'deploy')).filter((f) => f.endsWith('.env')).map((f) => `deploy/${f}`)];
const DECLARED = ENV_FILES.flatMap((f) => {
  const m = new RegExp(`^${VAR}=(.*)$`, 'm').exec(read(f));
  return m ? [{ from: f, value: m[1].replace(/^(['"])(.*)\1$/, '$2') }] : [];
});

const FORK_DIRS = forks('build').map((f) => f.dir);
const ROUTE = 'src/app/api/revalidate/route.ts';
/** The route's CODE exports a POST — a comment that mentions one does not count. */
export const exportsPost = (source) =>
  /export\s+(async\s+)?function\s+POST\b|export\s+const\s+POST\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
const hasRoute = (dir) => existsSync(join(ROOT, dir, ROUTE)) && exportsPost(read(join(dir, ROUTE)));

test('the fronts are derived and there are three today — the derivation sees what the tree has', () => {
  // ⚠️ ANTI-VACUUM: a derivation that found no front would make every rule below pass by grading nothing.
  assert.deepEqual(stack(LAYERS).fronts, ['storefront', 'storefront-coffee', 'totem']);
  assert.deepEqual(FORK_DIRS, ['storefront-coffee', 'totem'], 'bin/forks.mjs found a different set of forks');
});

test('★★★ the kernel purges every front that keeps a data cache, and only services that exist', () => {
  const gaps = purgeGaps(LAYERS, { declared: DECLARED, forkDirs: FORK_DIRS, hasRoute });
  assert.deepEqual(gaps, [], `\n  ${gaps.join('\n  ')}\n`);
});

// ── NEGATIVE CONTROLS — each forbidden state, fabricated, is seen ───────────────────────────────────────

const kernel = (list) => ['services:', '  kernel:', '    environment:', `      ${VAR}: \${${VAR}:-${list}}`].join('\n');
const front = (name, { cache = true, secret = true } = {}) =>
  [
    'services:',
    `  ${name}:`,
    '    environment:',
    '      PORT: 3000',
    ...(secret ? ['      FORGE_REVALIDATE_SECRET: ${FORGE_REVALIDATE_SECRET:-}'] : []),
    '      FORGE_DATA_CACHE_DIR: /var/cache/forge-storefront',
    '    volumes:',
    ...(cache ? [`      - ${name.replace(/-/g, '_')}_cache:/var/cache/forge-storefront`] : ['      - ./themes:/t:ro']),
  ].join('\n');
const L = (...texts) => texts.map((text, i) => ({ name: `layer${i}`, text }));

test('control: the right stack is green', () => {
  assert.deepEqual(purgeGaps(L(kernel('http://a:3000,http://b:3000'), front('a'), front('b'))), []);
});

test('control: ★ a NEW front with a cache volume left out of the list is red, naming it', () => {
  const gaps = purgeGaps(L(kernel('http://a:3000'), front('a'), front('b')));
  assert.equal(gaps.length, 1);
  assert.match(gaps[0], /misses http:\/\/b:3000/);
});

test('control: a front WITHOUT a cache volume is not required (it has nothing to purge)', () => {
  assert.deepEqual(purgeGaps(L(kernel('http://a:3000'), front('a'), front('b', { cache: false }))), []);
});

test('control: a later layer wins, as in compose — an override that drops a front is red', () => {
  const gaps = purgeGaps(L(kernel('http://a:3000,http://b:3000'), front('a'), front('b'), kernel('http://a:3000')));
  assert.match(gaps.join('\n'), /misses http:\/\/b:3000/);
});

test('control: a target naming no service, a target without the secret, a fork without the route', () => {
  assert.match(purgeGaps(L(kernel('http://a:3000,http://gone:3000'), front('a'))).join('\n'), /gone:3000 names no service/);
  assert.match(purgeGaps(L(kernel('http://a:3000'), front('a', { secret: false }))).join('\n'), /without FORGE_REVALIDATE_SECRET/);
  assert.match(purgeGaps(L(kernel('http://a:3000'), front('a')), { forkDirs: ['a'], hasRoute: () => false }).join('\n'), /ships no POST/);
});

test('control: an env file that shadows the default with a shorter list is red', () => {
  const gaps = purgeGaps(L(kernel('http://a:3000,http://b:3000'), front('a'), front('b')), {
    declared: [{ from: '.env.example', value: 'http://a:3000' }],
  });
  assert.match(gaps.join('\n'), /^\.env\.example: .* misses http:\/\/b:3000/);
});

test('control: a commented-out route export is no route', () => {
  assert.equal(exportsPost('// export async function POST() {}\n'), false);
  assert.equal(exportsPost('/* export async function POST() {} */'), false);
  assert.equal(exportsPost('export async function POST(req) {}'), true);
});

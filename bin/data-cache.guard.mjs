// ★★★ v0.3.3 (VC-1) — EVERY NEXT FRONT OF THIS BOX KEEPS ITS DATA CACHE UNDER A CEILING, ON A VOLUME OF ITS OWN.
//
//   node --test bin/data-cache.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// Measured 2026-10-19 on this demo's production box: a 96 GB disk at 100 %, 86 GB of it the reference vitrine's
// cached port reads (`.next/cache/fetch-cache`, ~200 000 filtered listings) in the container's writable layer,
// and Postgres dead of `disk_full`. Forge v0.3.3 answered with `@forgeco/storefront-kit/data-cache-handler`: a
// `cacheHandler` with a byte ceiling (LRU) and a free-disk floor, in FORGE_DATA_CACHE_DIR — a volume. The
// release is explicit that a front of one's OWN gets none of it until it wires the handler in its `next.config`.
// This box runs three such fronts: the reference `storefront` (the product's image, which carries the handler)
// and two of its own, `storefront-coffee` and `totem` (both read through the kit's `createReadClient`, which
// asks for `next: { revalidate, tags }` on every read — the totem's `force-dynamic` page does NOT stop that:
// measured on its standalone build, 4 entries written by one render).
//
// ── WHAT WAS MEASURED, on the standalone builds copied to another directory (as the image does) ────────
//
//     storefront-coffee, with the line: `[forge-data-cache] writing to <FORGE_DATA_CACHE_DIR>`, 7 entries
//                                        there, no `.next/cache` at all
//     the same build WITHOUT the line:  7 entries in `.next/cache/fetch-cache` (the container layer), none in
//                                        the directory, no handler log
//
// ── THE RULES ───────────────────────────────────────────────────────────────────────────────────────────
//
//   1. EVERY FRONT SERVICE declares the template's three variables and mounts a NAMED volume at the directory
//      it declares. A directory with no volume is the container layer again, with a ceiling — better, not it.
//   2. NO TWO FRONTS SHARE A VOLUME. The handler's index and byte count are per process: two fronts on one
//      directory each count only their own writes against the ceiling.
//   3. EVERY FORK'S `next.config.mjs` NAMES A `cacheHandler` that exists and is the kit's handler (via
//      `withPagesCache`, the template's door). Read by IMPORTING the config, the way Next reads it.
//   4. The fronts are DERIVED: the reference `storefront` plus every fork `bin/forks.mjs` finds. A third fork
//      tomorrow is graded without anybody remembering this file.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { serviceBlock, topVolumes } from './edge-text.mjs';
import { forks } from './forks.mjs';
import { ROOT } from './release-tree.mjs';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const COMPOSE_FILES = ['compose.yml', 'compose.override.yml'];

export const CACHE_DIR = '/var/cache/forge-storefront';
export const CACHE_ENV = {
  FORGE_DATA_CACHE_DIR: CACHE_DIR,
  FORGE_DATA_CACHE_MAX_MB: '${FORGE_DATA_CACHE_MAX_MB:-}',
  FORGE_DATA_CACHE_MIN_FREE_PERCENT: '${FORGE_DATA_CACHE_MIN_FREE_PERCENT:-}',
};
export const HANDLER_KIT = '@forgeco/storefront-kit/data-cache-handler';

/** What a service says about its data cache: its env values and the named volume at the declared dir. */
export function cacheWiring(block) {
  const env = {};
  for (const l of block) {
    const m = /^ {6}(FORGE_DATA_CACHE_[A-Z_]+):\s*(.+?)\s*$/.exec(l);
    if (m) env[m[1]] = m[2];
  }
  const dir = env.FORGE_DATA_CACHE_DIR;
  const mount = dir ? block.map((l) => /^ {6}- ([a-z0-9_]+):(\S+?)\s*$/.exec(l)).find((m) => m && m[2] === dir) : null;
  return { env, volume: mount ? mount[1] : null };
}

const FORKS = forks('build');
const FRONTS = ['storefront', ...FORKS.map((f) => f.dir)];

function wiringOf(service) {
  for (const f of COMPOSE_FILES) {
    const b = serviceBlock(read(f), service);
    if (b && b.some((l) => /FORGE_READ_BASE_URL/.test(l))) return { file: f, ...cacheWiring(b) };
  }
  return null;
}

test('the fronts are derived, and there are three of them today', () => {
  assert.ok(FORKS.length >= 2, `bin/forks.mjs found ${FORKS.length} fork(s) — the derivation is broken, not the tree`);
  assert.deepEqual(FRONTS, ['storefront', 'storefront-coffee', 'totem']);
});

for (const front of FRONTS) {
  test(`★★★ ${front}: the template's three variables, and a named volume at the directory it declares`, () => {
    const w = wiringOf(front);
    assert.ok(w, `no compose service \`${front}\` that reads the port — this guard is reading the wrong files`);
    assert.deepEqual(w.env, CACHE_ENV, `${w.file} › ${front}: the data-cache variables are not the template's`);
    assert.ok(w.volume, `${w.file} › ${front}: nothing is mounted at ${CACHE_DIR} — the cache is in the container layer`);
    const declared = COMPOSE_FILES.flatMap((f) => topVolumes(read(f)));
    assert.ok(declared.includes(w.volume), `${front} mounts \`${w.volume}\`, which no compose file declares`);
  });
}

test('★★ no two fronts share a data-cache volume — the ceiling is per process', () => {
  const vols = FRONTS.map((f) => wiringOf(f)?.volume);
  assert.equal(new Set(vols).size, vols.length, `shared: ${vols.join(', ')}`);
});

for (const fork of FORKS) {
  test(`★★★ ${fork.dir}: next.config names a cacheHandler that exists, and it is the kit's`, async () => {
    const cfg = (await import(pathToFileURL(join(fork.path, 'next.config.mjs')).href)).default;
    assert.equal(typeof cfg.cacheHandler, 'string', `${fork.dir}/next.config.mjs: no cacheHandler — Next's store has no ceiling`);
    assert.ok(existsSync(cfg.cacheHandler), `${fork.dir}: cacheHandler points at ${cfg.cacheHandler}, which does not exist`);
    const handler = readFileSync(cfg.cacheHandler, 'utf8');
    assert.match(handler, new RegExp(`import \\{ withPagesCache \\} from '${HANDLER_KIT}'`), `${cfg.cacheHandler} is not the kit's handler`);
    assert.match(handler, /export default withPagesCache\(/, `${cfg.cacheHandler} does not export the kit's handler`);
    const manifest = JSON.parse(read(join(fork.dir, 'package.json')));
    assert.ok(manifest.dependencies?.['@forgeco/storefront-kit'], `${fork.dir} does not install the kit it imports the handler from`);
  });
}

// ── NEGATIVE CONTROLS — the rules see the forbidden states, on fabricated files ─────────────────────────
const svc = (env, mounts) =>
  ['services:', '  front:', '    environment:', ...env.map((e) => `      ${e}`), '    volumes:', ...mounts.map((m) => `      - ${m}`), '  next:', '    image: x'].join('\n');
const ENV = Object.entries(CACHE_ENV).map(([k, v]) => `${k}: ${v}`);

test('control: no volume, a volume elsewhere, a missing variable — each is seen', () => {
  assert.deepEqual(cacheWiring(serviceBlock(svc(ENV, [`c:${CACHE_DIR}`]), 'front')), { env: CACHE_ENV, volume: 'c' });
  assert.equal(cacheWiring(serviceBlock(svc(ENV, ['./themes:/t:ro']), 'front')).volume, null);
  assert.equal(cacheWiring(serviceBlock(svc(ENV, ['c:/var/cache/other']), 'front')).volume, null);
  assert.notDeepEqual(cacheWiring(serviceBlock(svc(ENV.slice(0, 2), [`c:${CACHE_DIR}`]), 'front')).env, CACHE_ENV);
  // a mount commented out is no mount
  assert.equal(cacheWiring(serviceBlock(svc(ENV, [`./t:/t:ro`]).replace('      - ./t:/t:ro', `      # - c:${CACHE_DIR}`), 'front')).volume, null);
  // the block stops at the next service
  assert.equal(serviceBlock(svc(ENV, []), 'front').some((l) => /image: x/.test(l)), false);
});

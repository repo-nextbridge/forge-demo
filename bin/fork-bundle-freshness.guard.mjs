// ★★ THE BUNDLE A FORK SHIPS IS COMPILED FROM THE KIT ON DISK — the loop that was missing between `tsc` and
// the oven, and the one the bench paid for on 2026-09-09.
//
// ── WHAT WAS MEASURED, BEFORE ANY OF THIS EXISTED ───────────────────────────────────────────────────────
//
// `forge-preseed-storefront-coffee-1` was born `(unhealthy)` and threw on every request it answered:
//
//     TypeError: (0 , i.isServerActionSubmission) is not a function
//         at tx (.next/server/src/middleware.js)
//
// Everything that could have caught it was green. The kit installed in that fork DID export the function
// (`node_modules/@forgecommerce/storefront-kit/src/edge-cache.ts`). `tsc --noEmit` was green —
// `bin/fork-typecheck.guard.mjs` compiles the fork against exactly that file. `next build` exited 0. And the
// middleware it emitted carried `function te(e,t,r)`: the THREE-parameter `isCacheableRequest` of a kit six
// days older, next to an unmangled `(0 , i.isServerActionSubmission)` — webpack's fallback for an import it
// could not resolve to an export.
//
// The bundle had been compiled from a copy webpack never re-read. `snapshot.managedPaths` covers ALL of
// `node_modules` in a Next build, and a managed path is validated by the package's VERSION, never by its
// bytes; the Forge packages are vendored here as local tarballs frozen at one version forever
// (`bin/vendor-packages.sh`), so `.next/cache/webpack` served a September-3 compilation to a September-9
// build. Re-baking the image did not move it, because the cache lives in the fork's directory, not in the
// image.
//
// ⚠️ THE TWO THINGS THIS IS NOT. It is not `transpilePackages` failing to cover the kit — it covered it, and
// nothing of the kit is in the image's node_modules at all; the whole thing is bundled, and what was bundled
// was stale. And it is not an npm problem — `bin/install-storefront.sh` closed the npm-shaped half of the
// same lesson in pk24/D2 (a re-vendored tarball at an unchanged path is served from npm's cache unless the
// lock entry is evicted first). This is the webpack-shaped half.
//
// ── WHAT THE FORKS NOW CARRY, AND WHAT THIS FILE GRADES ─────────────────────────────────────────────────
//
// Each fork's `next.config.mjs` carries one shared block (`forkWebpack`) with two facts in it:
//
//   1. the scopes named in that fork's own `transpilePackages` are taken OUT of `snapshot.managedPaths`, so
//      webpack validates them by content like first-party source. Measured on this tree: with the kit's
//      `SERVER_ACTION_HEADER` rewritten on disk, a warm rebuild emitted the OLD literal; with the narrowing,
//      the same warm rebuild emitted the new one.
//   2. `module.parser.javascript.exportsPresence: 'error'`, so an import of a name the target module does
//      not export is a RED BUILD naming the symbol and the module, instead of webpack's default warning
//      followed by exit 0 and a production TypeError. Measured, reproducing the bench shape from zero
//      (kit on disk correct, `tsc` green, stale module in the cache):
//
//        exportsPresence 'auto'  →  ⚠ Compiled with warnings … exit 0, and the broken bundle ships
//        exportsPresence 'error' →  Failed to compile. Attempted import error:
//                                   'isServerActionSubmission' is not exported from
//                                   '@forgecommerce/storefront-kit/edge-cache'      exit 1
//
// ⚠️ ONE IS THE CURE AND THE OTHER IS THE ALARM, and the alarm is worth more: rule 1 keeps this box's own
// builds honest, rule 2 makes ANY disagreement between a fork and its kit — stale cache, half-vendored tree,
// a signature that moved upstream — fail where somebody is looking.
//
//   node --test bin/fork-bundle-freshness.guard.mjs        (or: bash bin/test.sh)
//
// This guard needs no `node_modules` and no Forge checkout: it loads each fork's config and exercises the
// hook. There is nothing here that can answer NOT CHECKED, which is deliberate — the defect it grades is
// invisible everywhere else.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { forks } from './forks.mjs';

const say = (line) => console.error(`[fork-bundle-freshness] ${line}`);

const BLOCK_START = '// ── ★★ pk29/D2 · THE BLOCK EVERY FORK OF THIS REPOSITORY CARRIES, WORD FOR WORD';
const BLOCK_END = '// ── end of the shared block';

/** The forks that produce a bundle. `build` and not `typecheck`: a directory with no build script emits
 *  nothing, so it has no bundle to be stale. */
const FORKS = forks('build');

/** The shared block as it stands in one fork's config, or null when the fork does not carry it. */
function sharedBlock(fork) {
  const text = readFileSync(join(fork.path, 'next.config.mjs'), 'utf8');
  const from = text.indexOf(BLOCK_START);
  const to = text.indexOf(BLOCK_END);
  if (from < 0 || to < 0 || to < from) return null;
  return text.slice(from, to);
}

/** What that fork's config asks webpack for, measured by calling the hook it exports rather than by reading
 *  the source: a block that is present but wired to nothing would pass a grep and fail here. */
async function webpackFacts(fork) {
  const config = (await import(pathToFileURL(join(fork.path, 'next.config.mjs')).href)).default;
  assert.equal(
    typeof config.webpack,
    'function',
    `${fork.dir}/next.config.mjs carries the shared block but never hands \`forkWebpack\` to Next — nothing ` +
      `it says is in effect`,
  );
  const out = config.webpack({ snapshot: {}, module: { parser: {} } });
  return { config, managed: out.snapshot?.managedPaths ?? [], parser: out.module?.parser?.javascript ?? {} };
}

const isManaged = (managed, path) => managed.some((rule) => rule.test(path));

say(`forks that build: ${FORKS.map((f) => f.dir).join(', ') || 'none'}`);

test('this repository owns at least one fork that produces a bundle', () => {
  // The premise. Every rule below iterates the list, so a list that lost its subject would make this file
  // green by having nothing to say — the exact silence these guards exist to end.
  assert.ok(FORKS.length > 0, 'no directory of this repo installs the kit and declares a `build` script');
});

test('★ every fork carries the SAME block — a copy that drifts is a fork that goes stale alone', () => {
  const blocks = FORKS.map((fork) => [fork.dir, sharedBlock(fork)]);
  const missing = blocks.filter(([, block]) => block === null).map(([dir]) => dir);
  assert.deepEqual(
    missing,
    [],
    `${missing.join(', ')} has no shared bundle-freshness block in next.config.mjs. Copy it, verbatim, from ` +
      `a fork that has one — it is the only thing standing between a stale cached kit and a production ` +
      `TypeError.`,
  );
  const [reference, ...rest] = blocks;
  for (const [dir, block] of rest) {
    assert.equal(
      block,
      reference[1],
      `${dir}/next.config.mjs and ${reference[0]}/next.config.mjs carry DIFFERENT copies of the block. One of ` +
        `them learned something the other did not.`,
    );
  }
  say(`${blocks.length} fork(s) carry an identical ${reference[1].split('\n').length}-line block`);
});

for (const fork of FORKS) {
  test(`★★ ${fork.dir} — what it compiles like source, it invalidates like source`, async () => {
    const { config, managed } = await webpackFacts(fork);
    const transpiled = config.transpilePackages ?? [];
    assert.ok(
      transpiled.length > 0,
      `${fork.dir} transpiles nothing, so this rule has no subject — did \`transpilePackages\` move?`,
    );
    // DERIVED, never a typed list: every scope the fork compiles like its own code must be content-checked.
    // A package added to `transpilePackages` tomorrow is covered by nobody remembering this file exists.
    const stale = transpiled.filter((name) => isManaged(managed, `/x/node_modules/${name}/src/anything.ts`));
    assert.deepEqual(
      stale,
      [],
      `${fork.dir} compiles ${stale.join(', ')} like its own source but lets webpack validate it by VERSION. ` +
        `Those packages are vendored at a version that never moves, so a rebuild serves last week's copy out ` +
        `of .next/cache/webpack and says nothing.`,
    );
    // ⚠️ ANTI-VACUUM, and it is not decoration: `managedPaths: []` would make every assertion above pass by
    // making NOTHING managed — and would also make every rebuild re-stat the whole of node_modules. The
    // narrowing has to be narrow.
    assert.ok(
      isManaged(managed, '/x/node_modules/next/dist/server/next.js'),
      `${fork.dir} took the whole of node_modules out of managedPaths, not just what it transpiles — this ` +
        `rule can no longer tell a narrowed list from an empty one`,
    );
    say(`${fork.dir}: ${transpiled.length} transpiled package(s) content-checked, the rest still managed`);
  });

  test(`★★ ${fork.dir} — a missing export is a BUILD ERROR, not a warning and a 500`, async () => {
    const { parser } = await webpackFacts(fork);
    assert.equal(
      parser.exportsPresence,
      'error',
      `${fork.dir} leaves webpack's default (a warning): \`next build\` exits 0 with a bundle whose import ` +
        `resolves to undefined, and the container throws on every request instead. This is the setting that ` +
        `turns "(0 , i.isServerActionSubmission) is not a function" into a red build naming the symbol.`,
    );
  });
}

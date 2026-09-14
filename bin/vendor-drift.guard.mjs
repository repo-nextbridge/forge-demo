// ★★ THE FORKS' COMMITTED LOCKS NAME TARBALLS THIS RELEASE STILL PRODUCES — the loop that was a human.
//
// ── WHY (caderno §B3, and a premise of the brief that the source contradicted) ───────────────────────────
//
// Twice (pk19 and pk21) the kit moved in the monorepo, `bin/fork-typecheck.guard.mjs` said so correctly
// («2 of 124 packed files differ», naming the files) — and the FIX was four gestures a person composed by
// hand from two guard messages: `bin/vendor-packages.sh <tree> storefront-coffee`, `bin/install-storefront.sh
// storefront-coffee`, then the same pair for `totem`. Nothing in this repository owned that step.
//
// ⚠️ AND THE STANDING EXPLANATION FOR THE CHURN WAS WRONG, which is why this guard is shaped the way it is.
// `f6cd939` re-stamped six integrity hashes and recorded that «`npm pack` embeds mtimes, so vendoring the
// same package twice writes a different tarball». MEASURED 2026-09-08, on this workstation:
//
//   · `pnpm pack` normalises everything a clock could touch — every tar entry carries mtime 1985-10-26
//     08:15 (pacote's constant) and uid/gid 0/0, and the gzip header's own mtime field is 0;
//   · five consecutive packs of `extensions/payment-promissory` in one tree: ONE sha256, 8 406 bytes;
//   · the same package packed from TWO different checkouts of the same commit, whose files' mtimes are ten
//     hours apart (`k8-midia` 09-07 22:14, `k24-medicao` 09-08 08:17): BYTE-IDENTICAL tarballs;
//   · and packing 217734df8 reproduced 13 of the 14 integrity hashes in `storefront-coffee`'s committed
//     lock, exactly. The tarball IS reproducible.
//
// The six hashes moved because the SOURCE moved: all six packages have real diffs between the tree the lock
// was vendored from (`6f15957a1`) and the one it pins now (`217734df8`) — `after-payment.tsx` in four of
// them, 777 changed lines in the kit. So the defect was never determinism. It was that a lock and a tree can
// disagree with nobody watching, and that the disagreement is indistinguishable, by eye, from the tarball
// being unstable. This file removes the first and settles the second: it RECOMPUTES the integrity from the
// pinned tree and compares, and the measurement above is why its failure message can tell the reader that a
// moved hash means moved SOURCE. (An executable "pack it twice" rule was written and then cut once the same
// measurement had been reproduced independently — the property holds, and paying half a second a run to
// re-prove it every time buys nothing this file does not already state.)
//
// ★ AND THE FIRST RUN PROVED THE POINT AGAIN, exactly as `fork-suite.guard.mjs`'s did: pointed at the tree
// as handed over, it went red on `@forgecommerce/contracts` — one package out of fifteen, whose committed
// hash was three commits stale. `npm ci` in `storefront-coffee` would have failed EINTEGRITY on it, in a
// pipeline, with no line anywhere saying why.
//
// ⚠️ AND THE REASON IT WAS THE ONE THAT ESCAPED IS THE SECOND RULE BELOW. `contracts` is not a DIRECT
// dependency of the vitrine — it must never be (`storefront-coffee/src/structure.test.ts`: a front speaks
// HTTP to the port and never links the kernel's types), so it arrives as an `overrides` entry. Direct
// packages are re-installed from their tarball by path (`npm install ./vendor/x.tgz` re-reads the file);
// override entries are resolved from the lock's integrity, out of npm's cache, and a re-vendored tarball
// under the same path is never opened. `bin/install-storefront.sh` now evicts those entries first.
//
// ── WHAT IT NEEDS, AND WHAT IT REFUSES TO DO ────────────────────────────────────────────────────────────
//
// It needs the Forge checkout `forge.lock` pins — the same derivation every other guard here uses
// (`bin/release-tree.mjs`), never a guess — and it packs with the product's OWN script,
// `scripts/pack-publishable.sh`, because a guard that packs by hand proves a path nobody ships (that script
// says so in its own header).
//
// ⚠️ IT NEVER BUILDS IN THE MONOREPO. Three of the seventeen publishable packages are `built` kind: their
// tarball carries a `dist/` that is not in git, and `pack-publishable.sh` builds one that is absent. That
// build DELETES and rewrites a directory half the workspace resolves into at runtime, and the same script's
// header carries the measurement of what that costs beside readers (4 546 absent-file samples in 30 million,
// 1 import failure in 290). A guard is a reader. So if a `built` package's entrypoint is not on disk this
// says NOT CHECKED and names it — never a silent green, and never a write into a tree it does not own.
//
//   node --test bin/vendor-drift.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/vendor-drift.guard.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { forks, KIT } from './forks.mjs';
import { pinnedCommit, readJson as read, releaseTree, ROOT } from './release-tree.mjs';

const say = (line) => console.error(`[vendor-drift] ${line}`);

/** `build` is the script that CONSUMES what was vendored, so it is the right question to ask a directory
 *  here: a fork that installs the kit and knows how to build is a fork whose lock has to be true. */
const FORKS = forks('build');

/** npm's own integrity string for a file on disk. `sha512-<base64>` is the shape `package-lock.json` uses,
 *  so the comparison is between two strings npm itself would have written. */
const integrityOf = (path) => `sha512-${createHash('sha512').update(readFileSync(path)).digest('base64')}`;

/** What a fork's COMMITTED lock says it installed from `vendor/`. The lock is the artifact a pipeline acts
 *  on (`npm ci` reads exactly this), so it — and not `node_modules`, and not the gitignored `vendor/` — is
 *  the thing that has to agree with the release. This guard therefore runs on a bare clone. */
function vendored(fork) {
  let lock;
  try {
    lock = read(join(fork.path, 'package-lock.json'));
  } catch {
    return null;
  }
  const out = [];
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (typeof entry?.resolved !== 'string' || !entry.resolved.startsWith('file:vendor/')) continue;
    out.push({
      name: path.replace(/^node_modules\//, ''),
      file: entry.resolved.slice('file:vendor/'.length),
      integrity: entry.integrity ?? null,
    });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

const PINNED = pinnedCommit();
const TREE = PINNED ? releaseTree(PINNED) : { tried: [] };

/** The directories a workspace package can live in, READ FROM THE WORKSPACE rather than typed here. The
 *  first version of this file listed `packages` and `extensions`, which is where the vendored packages
 *  happen to live — and it then reported `@forgecommerce/cli` as "no directory claims it", because the cli
 *  is under `apps/`. A second copy of the workspace's own layout is the same drift these guards exist for.
 *  Only the `<dir>/*` shape is understood; anything else is returned as an unreadable group so the caller
 *  can say NOT CHECKED instead of quietly seeing fewer packages. */
function workspaceGroups(treePath) {
  const file = join(treePath, 'pnpm-workspace.yaml');
  if (!existsSync(file)) return { groups: [], unreadable: ['pnpm-workspace.yaml is missing'] };
  const groups = [];
  const unreadable = [];
  let inPackages = false;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (/^packages:\s*$/.test(raw)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (!/^\s*-\s/.test(raw)) {
      if (/^\S/.test(raw)) break; // the next top-level key ends the list
      continue;
    }
    const glob = raw.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '');
    const simple = /^([\w.-]+)\/\*$/.exec(glob);
    if (simple) groups.push(simple[1]);
    else unreadable.push(glob);
  }
  return { groups, unreadable };
}

/** Every workspace package of a checkout, by the name it publishes under. Found by walking those groups
 *  rather than by asking `pnpm --filter` seventeen times: the answer has to be cheap, and a name this misses
 *  only ever produces a NOT CHECKED, never a green. */
function packagesOf(treePath) {
  const byName = new Map();
  for (const group of workspaceGroups(treePath).groups) {
    const base = join(treePath, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const manifest = read(join(base, entry.name, 'package.json'));
        byName.set(manifest.name, { dir: join(base, entry.name), manifest });
      } catch {
        /* not a package */
      }
    }
  }
  return byName;
}

/** The `built` packages whose `dist` is not on disk. Non-empty means this guard must not run: packing would
 *  build, and building writes into a tree that is not ours. */
function unbuilt(treePath) {
  const registry = join(treePath, 'scripts', 'publishing', 'publishable.json');
  if (!existsSync(registry)) return ['scripts/publishing/publishable.json is missing from the checkout'];
  const { groups, unreadable } = workspaceGroups(treePath);
  if (groups.length === 0) return ['pnpm-workspace.yaml declares no package group this file can read'];
  const byName = packagesOf(treePath);
  const missing = unreadable.map((glob) => `the workspace glob \`${glob}\` is not a shape this file reads`);
  for (const { name, kind } of read(registry)) {
    if (kind !== 'built') continue;
    const found = byName.get(name);
    if (!found) {
      missing.push(`${name} — publishable.json declares it and no directory of the checkout claims it`);
      continue;
    }
    const main = found.manifest.main;
    if (!main) {
      missing.push(`${name} — declares no \`main\`, so nothing can say whether its dist is on disk`);
      continue;
    }
    if (!existsSync(join(found.dir, main))) missing.push(`${name} — ${main} is not on disk`);
  }
  return missing;
}

/** Pack the release's publishable packages into a fresh directory, with the product's own script. */
function packInto(treePath, out) {
  execFileSync('bash', [join(treePath, 'scripts', 'pack-publishable.sh'), out], {
    cwd: treePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
}

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

say(`forks that build against the kit: ${FORKS.map((f) => f.dir).join(', ') || 'none'}`);
say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (TREE.path) say(`packing from: ${TREE.path} @ ${TREE.head.slice(0, 9)} (${TREE.how})`);
else if (PINNED) {
  say(`⚠️ NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say('   set FORGE_MONOREPO=<the release\'s checkout>.');
}
for (const fork of FORKS) {
  const entries = vendored(fork);
  say(entries ? `${fork.dir}: ${entries.length} vendored package(s) in its committed lock` : `${fork.dir}: no package-lock.json`);
}

// ── the premises, which are the anti-vacuum half ────────────────────────────────────────────────────────

test('this repository owns at least one fork that installs the kit from vendored tarballs', () => {
  // ⚠️ POINTED AT ZERO FORKS THIS FILE ACCUSES ITSELF. Every rule below iterates a list, and a list that
  // empties out turns them all green while proving nothing — the quietest way a loop dies. The day the
  // `@forgecommerce/*` packages are published, `bin/vendor-packages.sh` and this file are DELETED together;
  // until then their subject existing is a rule.
  assert.ok(FORKS.length > 0, `no directory of this repo depends on ${KIT} and declares a \`build\` script`);
  const withVendor = FORKS.filter((fork) => (vendored(fork) ?? []).length > 0);
  assert.ok(
    withVendor.length > 0,
    `${FORKS.length} fork(s) install ${KIT}, and not one of their committed package-lock.json files ` +
      'resolves a single dependency from `file:vendor/`. Either the packages are published now (delete this ' +
      'guard and its two scripts) or a lock was committed from an install that never saw the tarballs.',
  );
});

for (const fork of FORKS) {
  test(`★ ${fork.dir}'s lock records an integrity for every vendored tarball`, () => {
    // Without this, the comparison below can pass by having nothing to compare: an entry with no
    // `integrity` is an entry `npm ci` cannot verify either.
    const entries = vendored(fork);
    assert.ok(entries, `${fork.dir} has no package-lock.json — \`npm ci\` has nothing to install from`);
    const naked = entries.filter((e) => !e.integrity).map((e) => e.file);
    assert.deepEqual(naked, [], `${fork.dir}: vendored without an integrity hash — unverifiable by npm too`);
  });
}

// ── the rule nobody was holding ─────────────────────────────────────────────────────────────────────────

test('★★ the vendored tarballs the forks pin are the ones this release still produces', (t) => {
  if (!PINNED) {
    t.skip('NOT CHECKED — forge.lock no longer names a branch@sha, so there is no tree to pack');
    return;
  }
  if (!TREE.path) {
    t.skip(`NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine (set FORGE_MONOREPO)`);
    return;
  }
  const missing = unbuilt(TREE.path);
  if (missing.length > 0) {
    t.skip(
      `NOT CHECKED — ${TREE.path} has a \`built\` package with no dist on disk, and packing it would BUILD ` +
        `in a tree this repository does not own (see the header). \`pnpm build\` there first.\n  ` +
        missing.join('\n  '),
    );
    return;
  }

  const out = mkdtempSync(join(tmpdir(), 'forge-vendor-drift-'));
  try {
    packInto(TREE.path, out);
    const drifted = [];
    let compared = 0;
    for (const fork of FORKS) {
      for (const entry of vendored(fork) ?? []) {
        const tarball = join(out, entry.file);
        if (!existsSync(tarball)) {
          drifted.push(`${fork.dir}: ${entry.name} — ${entry.file} is not among what this release packs`);
          continue;
        }
        compared += 1;
        const now = integrityOf(tarball);
        if (now !== entry.integrity) {
          drifted.push(`${fork.dir}: ${entry.name}\n      lock  ${entry.integrity}\n      tree  ${now}`);
        }
      }
    }
    assert.ok(compared > 0, 'nothing was compared — the pack produced no tarball any fork names');
    assert.deepEqual(
      drifted,
      [],
      `${drifted.length} vendored package(s) no longer match ${PINNED.ref}. This is the drift that used to ` +
        'wait for somebody to read a typecheck failure, and in a pipeline it is an EINTEGRITY from `npm ci` ' +
        'with no line saying why. ONE command fixes it and commits nothing:\n\n' +
        `    bash bin/revendor-forks.sh ${TREE.path}\n\n` +
        'then commit the package-lock.json files it rewrites. ⚠️ A hash that moved is the SOURCE having ' +
        'moved, not the packer wobbling: `pnpm pack` was measured deterministic here on 2026-09-08 (see the ' +
        'header), so there is always a diff upstream to point at.\n\n  ' +
        drifted.join('\n  '),
    );
    say(`${compared} vendored tarball(s) identical to what ${PINNED.ref} packs`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// ── ★★ AND WHAT IS INSTALLED IS WHAT WAS VENDORED — the silent half, measured 2026-09-08 ───────────────

for (const fork of FORKS) {
  test(`★★ ${fork.dir} INSTALLED the tarballs in its own vendor/, not npm's cached copies of older ones`, (t) => {
    // ⚠️ THIS RULE EXISTS BECAUSE THE OPPOSITE WAS TRUE ON THIS BRANCH AND NOTHING SAID A WORD.
    //
    // A re-vendored tarball keeps its PATH — `vendor/forgecommerce-contracts-0.3.0.tgz` is the same string
    // every time — so `npm install` saw a lock entry it already satisfied and resolved it BY INTEGRITY out
    // of its content-addressed cache, never opening the file that had just been rewritten. Measured on a
    // clean worktree immediately after a full re-vendor from `v03/integra@217734df8`:
    //
    //     vendor/…contracts…tgz   dist/index.js  9ca046c7…  1462 lines   ← what the release packs
    //     node_modules/…          dist/index.js  5967a83c…  1288 lines   ← last week's, from the cache
    //
    // 174 lines of the release's `@forgecommerce/contracts` were missing from the fork. `npm install`
    // printed nothing, the committed lock kept the old hash, and `bin/revendor-forks.sh` reported "already
    // in step" because no lockfile had moved. `bin/install-storefront.sh` now EVICTS the `file:vendor/`
    // entries before installing, which leaves npm no lock to satisfy; this is the rule that proves it, and
    // that would catch the next mechanism npm invents for reusing a path it has already seen.
    //
    // The subject is npm's own hidden lockfile — `node_modules/.package-lock.json` — which records what is
    // ACTUALLY on disk under node_modules, as opposed to `package-lock.json`, which records what npm was
    // asked for. Comparing the two artifacts npm itself writes is the only way to see them disagree.
    const hidden = join(fork.path, 'node_modules', '.package-lock.json');
    const vendorDir = join(fork.path, 'vendor');
    if (!existsSync(hidden) || !existsSync(vendorDir)) {
      // `vendor/` is gitignored and `node_modules/` is not committed, so a bare clone legitimately has
      // neither. The rule above (lock vs tree) is the one that runs everywhere; this one runs where an
      // install actually happened.
      t.skip(
        `NOT CHECKED — ${fork.dir} has no ${existsSync(hidden) ? 'vendor/' : 'node_modules/.package-lock.json'} ` +
          `on disk. \`bash bin/revendor-forks.sh <path to the forge monorepo checkout>\` produces both.`,
      );
      return;
    }
    const installed = read(hidden).packages ?? {};
    const wrong = [];
    let checked = 0;
    for (const [key, entry] of Object.entries(installed)) {
      if (typeof entry?.resolved !== 'string' || !entry.resolved.startsWith('file:vendor/')) continue;
      const tarball = join(fork.path, entry.resolved.slice('file:'.length));
      if (!existsSync(tarball)) {
        wrong.push(`${key} — installed from ${entry.resolved}, which is not on disk any more`);
        continue;
      }
      checked += 1;
      const onDisk = integrityOf(tarball);
      if (entry.integrity !== onDisk) {
        wrong.push(`${key}\n      node_modules holds  ${entry.integrity}\n      vendor/ holds       ${onDisk}`);
      }
    }
    assert.ok(checked > 0, `${fork.dir} is installed and npm resolved NOTHING from vendor/ — that is the vacuum`);
    assert.deepEqual(
      wrong,
      [],
      `${fork.dir} is running a package that is not the one in its own vendor/. npm served a cached copy of ` +
        'an older tarball that had the same path. Re-run `bash bin/revendor-forks.sh <tree>`; if it happens ' +
        'again, the eviction in bin/install-storefront.sh stopped working.\n\n  ' +
        wrong.join('\n  '),
    );
    say(`${fork.dir}: ${checked} installed package(s) are byte-for-byte the tarballs in its vendor/`);
  });
}

// ── and the step that fixes a red one, which has to exist for the message above to be true ──────────────

test('★ the ONE command the failure names is a real, executable step of this repository', () => {
  // A guard whose fix is four gestures composed out of two other guards' messages is how §B3 happened
  // twice. The message above names one command; this asserts it exists and is not a sentence.
  const path = join(ROOT, 'bin', 'revendor-forks.sh');
  assert.ok(existsSync(path), 'bin/revendor-forks.sh is what the drift message tells the operator to run');
  // ⚠️ COMMENT LINES ARE STRIPPED FIRST, and that is not tidiness. The first version of this rule matched
  // the whole file: sabotaged with `forks=(storefront-coffee totem)` replacing the derivation, it stayed
  // GREEN, because the header still says the words `bin/forks.mjs`. A rule about behaviour that a paragraph
  // of prose can satisfy is a rule about prose.
  const code = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  assert.match(
    code,
    /forks\.mjs/,
    'the re-vendor step must DERIVE the forks the way every other loop here does — a typed list of two ' +
      'directories is the third fork nobody re-vendors. Nothing that RUNS in bin/revendor-forks.sh reads ' +
      'bin/forks.mjs.',
  );
});

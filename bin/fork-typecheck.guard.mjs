// ★★ THE FORK COMPILES AGAINST THE KIT IT PINS — the loop nobody had, on the contract nobody checked.
//
// Measured on 2026-09-03, rehearsing a from-zero install of this box (`forge-materials/DIARIO-CAIXA-NOVA.md`,
// F1). `pk6/M5` fixed `read.my_prices` never seeing a store-scoped promotion and made the store part of the
// kit's call. The monorepo's own storefront moved in that same slice. THIS repository's fork did not — it
// compiles somewhere else — and the arity error surfaced in the OVEN, four minutes into an image build:
//
//     storefront-coffee ./src/app/api/my-prices/route.ts:62:43
//     Type error: Expected 3 arguments, but got 2.
//
// ⚠️ WHAT MAKES IT A GAP AND NOT A SLIP: with that defect present, every loop anybody runs was GREEN.
//
//     pnpm test      (monorepo)   52/52 green      — the fork is not in that tree
//     pnpm typecheck (monorepo)   51/51 green      — same
//     bash bin/test.sh (here)   317/317 green      — this repo tests scripts and seed, never `next build`
//     the oven                    RED, at ~4 min   — the only place the pair was ever put together
//
// The contract between the kit and a FORKED storefront was verified by nobody, and that is a product-shaped
// hole, not a demo one: any customer who forks the vitrine breaks exactly this way, silently, on the first
// signature change, and finds out by baking. This file is that missing loop, on the cheap side: `tsc
// --noEmit` over the fork's own source, which is what read the kit's signature in the oven, without paying
// for a build. Measured here: 3.5 s for `storefront-coffee`, 1.5 s for `totem`, against ~4 min of oven.
//
// ── WHICH KIT, AND WHY THE QUESTION IS THE WHOLE POINT ──────────────────────────────────────────────────
//
// A typecheck is only worth its green if you can say WHAT it compiled against. The Forge packages are
// vendored here as tarballs (`bin/vendor-packages.sh` + `bin/install-storefront.sh`) out of a monorepo
// checkout on this machine, so "the kit" is a directory somebody chose — and on the same night this guard
// was written, TWO separate false conclusions on this bench came from reading the WRONG TREE (F4 in the same
// diary: the box seeded from a worktree 166 commits behind, frozen into a `.env` path). So:
//
//   · the tree is not guessed, it is DERIVED — `forge.lock`'s `built_from` names the commit this box's
//     images were baked from, and a checkout is accepted only if its HEAD is that commit;
//   · every run PRINTS the tree it used and the kit it read, whether it checked or skipped;
//   · no tree at that commit is answered with "NOT CHECKED", loudly, never with a silent green.
//
// ⚠️ AND A SKIP IS AN ANSWER, A GREEN IS NOT. Three states, all of them said out loud:
//   1. the fork is installed        → the typecheck RUNS. This is the rule that catches the F1 defect.
//   2. a checkout at the pinned sha → the installed kit is compared to it, file by file. This is what makes
//      the green above mean "the kit of this release" instead of "whatever is in node_modules".
//   3. neither                      → NOT CHECKED, with the reason and the command that would fix it.
//
//   node --test bin/fork-typecheck.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/fork-typecheck.guard.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
// ★ pk12/D2 — the tree discovery below the fold moved to `bin/release-tree.mjs` when a SECOND guard
// (`bin/store-mount-drift.guard.mjs`) had to answer the same question. Not one line of it changed; what it
// stopped being is a copy. Nothing else in this file moved.
import { gitOut, pinnedCommit, releaseTree, ROOT, readJson as read } from './release-tree.mjs';

const say = (line) => console.error(`[fork-typecheck] ${line}`);

/** The package every front of this repository forks the Forge surface through. One package, and a fork that
 *  installs it has chrome, theme, slots and the port clients — so it is also the one whose signatures a fork
 *  can fall behind. */
const KIT = '@forgecommerce/storefront-kit';

// ── the forks, derived from what they DEPEND ON ─────────────────────────────────────────────────────────

/** Every Next app this repository owns that installs the kit, found by reading manifests rather than from a
 *  list typed in here: a third fork tomorrow is covered without anybody remembering this file exists. */
function forks() {
  const out = [];
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    let manifest;
    try {
      manifest = read(join(ROOT, entry.name, 'package.json'));
    } catch {
      continue;
    }
    if (!manifest.dependencies?.[KIT]) continue;
    if (!manifest.scripts?.typecheck) continue;
    out.push({ dir: entry.name, path: join(ROOT, entry.name) });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

const FORKS = forks();

/** What `npm install` actually put on disk, or null. The kit ships its own `src/` (not a built `dist`), so
 *  the fork's `tsc` reads the kit's TypeScript directly — which is why an arity change upstream is visible
 *  here at all. */
function installedKit(fork) {
  const dir = join(fork.path, 'node_modules', ...KIT.split('/'));
  if (!existsSync(join(dir, 'package.json'))) return null;
  const lockEntry = (() => {
    try {
      return read(join(fork.path, 'package-lock.json')).packages?.[`node_modules/${KIT}`] ?? null;
    } catch {
      return null;
    }
  })();
  return { dir, version: read(join(dir, 'package.json')).version, integrity: lockEntry?.integrity ?? null };
}

const PINNED = pinnedCommit();
const TREE = PINNED ? releaseTree(PINNED) : { tried: [] };

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

say(`forks that install the kit: ${FORKS.map((f) => f.dir).join(', ') || 'none'}`);
say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (TREE.path) {
  say(`compiling against: ${TREE.path} @ ${TREE.head.slice(0, 9)} (${TREE.how})`);
  const dirty = gitOut(TREE.path, ['status', '--porcelain']);
  if (dirty) say(`⚠️ that tree has ${dirty.split('\n').length} uncommitted change(s) — it is not exactly ${PINNED.sha}`);
} else if (PINNED) {
  say(`⚠️ NOT CHECKED against a tree — no Forge checkout at ${PINNED.ref} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say('   set FORGE_MONOREPO=<the release\'s checkout>. Any green below means "the fork agrees with the kit');
  say('   that is INSTALLED", which is not the same sentence as "with the kit this release pins".');
}
for (const fork of FORKS) {
  const kit = installedKit(fork);
  say(
    kit
      ? `${fork.dir}: kit ${kit.version} installed, ${kit.integrity ?? 'no integrity in the lock'}`
      : `${fork.dir}: ⚠️ NOT INSTALLED — nothing to compile`,
  );
}

// ── the rule ────────────────────────────────────────────────────────────────────────────────────────────

test('this repository owns at least one fork of the vitrine', () => {
  // The premise. The day nobody forks the storefront here, every rule below passes by having no subject —
  // and a guard that is green because its subject left is the quietest way a loop dies.
  assert.ok(FORKS.length > 0, `no directory of this repo depends on ${KIT} and declares a \`typecheck\` script`);
});

for (const fork of FORKS) {
  test(`★★ ${fork.dir} COMPILES against the kit it installs`, (t) => {
    // The rule the oven was holding alone. `--incremental false` on purpose: this project's tsconfig asks for
    // incremental checking, and a `tsconfig.tsbuildinfo` written before the kit moved is exactly the stale
    // artifact that has already produced three false greens on this bench.
    const tsc = join(fork.path, 'node_modules', '.bin', 'tsc');
    if (!existsSync(tsc)) {
      t.skip(
        `NOT CHECKED — ${fork.dir} is not installed. \`bash bin/vendor-packages.sh <forge checkout> ${fork.dir}\` ` +
          `then \`bash bin/install-storefront.sh ${fork.dir}\` (or \`bash bin/build-coffee.sh <forge checkout>\`).`,
      );
      return;
    }
    try {
      execFileSync(tsc, ['--noEmit', '--incremental', 'false', '--pretty', 'false'], {
        cwd: fork.path,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      assert.fail(
        `${fork.dir} does not compile against the kit in its node_modules. This is the failure that used to ` +
          `wait for the oven:\n\n${(error.stdout ?? '') + (error.stderr ?? '')}`,
      );
    }
  });

  test(`the kit ${fork.dir} installed IS the kit this release pins`, (t) => {
    // Without this, the green above says "the fork agrees with whatever npm last put on disk" — which is true
    // of a kit vendored last week, and a fork that agrees with last week's kit is precisely the F1 defect
    // wearing a green badge. The tarball is a copy of the tree's own `src/`, so the comparison is bytes, and
    // the file list comes from the package's `files` manifest rather than from a walk: tests and internal
    // modules are not packed, and diffing the directories would report them forever.
    if (!PINNED) {
      t.skip('NOT CHECKED — forge.lock no longer names a branch@sha, so there is no tree to compare with');
      return;
    }
    if (!TREE.path) {
      t.skip(`NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine (set FORGE_MONOREPO)`);
      return;
    }
    const kit = installedKit(fork);
    if (!kit) {
      t.skip(`NOT CHECKED — ${fork.dir} is not installed, so there is no kit on disk to compare`);
      return;
    }
    const source = join(TREE.path, 'packages', 'storefront-kit');
    const packed = read(join(source, 'package.json')).files.filter((file) => file.startsWith('src/'));
    assert.ok(packed.length > 0, `${source}/package.json packs no src/ file — this rule lost its subject`);
    const differs = [];
    for (const file of packed) {
      let mine;
      try {
        mine = readFileSync(join(kit.dir, file));
      } catch {
        differs.push(`${file} (missing from the install)`);
        continue;
      }
      if (!readFileSync(join(source, file)).equals(mine)) differs.push(file);
    }
    assert.deepEqual(
      differs,
      [],
      `${fork.dir} installed a kit that is not the one ${PINNED.ref} carries — ${differs.length} of ` +
        `${packed.length} packed files differ. Re-vendor: \`bash bin/vendor-packages.sh ${TREE.path} ${fork.dir}\` ` +
        `then \`bash bin/install-storefront.sh ${fork.dir}\`.`,
    );
    say(`${fork.dir}: ${packed.length}/${packed.length} packed kit files identical to ${PINNED.ref}`);
  });
}

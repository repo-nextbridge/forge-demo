// ★★ THE FORK LEARNS THAT IT FELL BEHIND — the rule the café's vitrine did not inherit with the code.
//
// ── THE DEFECT, MEASURED ON THIS BENCH 2026-09-04, by the header that says which front answered ──────────
//
//     /s/outlet           → 404   x-forge-served-by: storefront          the fix is in the reference
//     /s/forge            → 404   x-forge-served-by: storefront
//     /s/inexistente-xyz  → 404   x-forge-served-by: storefront
//     /s/cafe             → 200   x-forge-served-by: storefront-coffee   ⛔ the fork never got it
//
// One address, two answers, because `storefront-coffee/` is a CUT of the reference vitrine and a cut is a
// snapshot. The product fixed `/s/<segment that resolves no store>` in the store-scoped root layout (P4:
// `requireStore`, then pk9/P1: `requirePublicStorefront`), the reference storefront and the checkout both
// moved, and a guard in the monorepo — `scripts/storefront/store-404.guard.test.ts` — holds every front in
// `apps/*` to it forever. THIS front is not in `apps/*`. It is in another repository, so that guard has never
// heard of it, every loop anybody runs here is green, and the only thing that knew was `curl`.
//
// ⚠️ THIS IS THE PRICE OF FORKING, HAPPENING. It is not a bug in the product and not a bug in the demo: the
// doctrine says a fork owns its front and stops receiving our fixes, and this is what that sentence costs on
// a Tuesday. What the demo was missing is not the fix — it is a way to KNOW. The sibling was measured by
// pk8/p3 (the fork's vitest overlay replaced `include` and tests travelled here and never ran) and by
// `bin/fork-typecheck.guard.mjs` (the fork's source and the kit's signatures were compiled together by
// nobody but the oven). Three shapes of one hole: THE FORK INHERITS THE CODE AND NOT THE RULE.
//
// ── WHAT THIS GUARD IS, AND WHY IT IS THIS SMALL ────────────────────────────────────────────────────────
//
// The whole cut cannot be compared: measured here, the fork's `src/` holds 263 files byte-identical to the
// reference's, 74 that differ, 58 the reference has and it does not, and 30 of its own. A tree diff would
// report the café's theme forever and this rule would be turned off within a week. So the jurisdiction is
// ONE KIND OF FILE — the STORE-SCOPED ROOT LAYOUT — and the reason is the same one the product's own guard
// gives for choosing it: it is the single parent of every route group of a store-scoped tree, so it is the
// one file every store URL of that deployable passes through. A rule mounted there applies to the whole
// front; a rule mounted anywhere else applies to the entrances somebody remembered.
//
// ★ AND THE RULE IS DERIVED, NEVER TYPED HERE. This file names no function. It reads the REFERENCE's own
// store-scoped root layouts out of the pinned release tree, takes the KIT modules and bindings they mount,
// and requires the fork's layout at the same path to mount them too. `requireStore` is caught today because
// the reference calls it; whatever the reference mounts there next month is caught by this file unchanged.
// That is the difference between a guard that closes this defect and one that closes its species.
//
// ⚠️ A RED HERE IS NOT AUTOMATICALLY "GO COPY THE PRODUCT". It says the reference grew a rule at the mount
// point and this fork did not follow — and the fork's owner is allowed to answer "I do not want it", by
// saying so in this file. What the fork may NOT do is not know.
//
// ── WHAT IT IS NOT ──────────────────────────────────────────────────────────────────────────────────────
//
// It compares SOURCE, so it proves the mount and never the response. The behaviour it stands for is proven
// in the monorepo, next to the kit function that implements it. This guard's claim is exactly: "the fork
// mounts what the reference mounts, at the file where mounting it means every URL".
//
//   node --test bin/store-mount-drift.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/store-mount-drift.guard.mjs

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { surfaceForks, surfaces } from './forks.mjs';
import { pinnedCommit, releaseTree } from './release-tree.mjs';

const say = (line) => console.error(`[store-mount] ${line}`);

/** The scope whose modules ARE the product's rules out here. A fork installs these by name; everything else
 *  it imports is its own file, and its own file is its own business. */
const KIT_SCOPE = '@forgecommerce/';

/**
 * ★ THE DIVERGENCES THIS FORK HAS DECIDED NOT TO ADOPT — empty today, and it is the affordance that makes the
 * failure message honest. Without it "refuse it" is advice with nowhere to go, and the only way to silence a
 * red would be to delete the rule, which silences the next one too.
 *
 * One entry per binding: `{ fork, layout, spec, name, why }`. `why` is not decoration — an unexplained waiver
 * is the fork falling behind with a lid on it.
 *
 * ⚠️ TWO THINGS KEEP THIS FROM BECOMING A HOLE. Every entry is PRINTED on every run, so a divergence can
 * never be quietly permanent; and an entry that matches nothing the reference asks for is RED, so a waiver
 * outlives its reason for exactly one run.
 */
const DIVERGENCES = [];

// ── the tree, and the surfaces it says a fork can be a cut OF ───────────────────────────────────────────

const PINNED = pinnedCommit();
const TREE = PINNED ? releaseTree(PINNED) : { tried: [] };

// ── reading a layout ────────────────────────────────────────────────────────────────────────────────────

/** Comments are prose ABOUT the mount; only the code is the mount. Stripped BEFORE the imports are read, so
 *  a commented-out import cannot satisfy the rule and prose naming a function cannot satisfy the call. This
 *  house has paid for that vacuity more than once. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The KIT modules a layout imports, each with the VALUE bindings it takes from them.
 *
 * ⚠️ `import type` IS SKIPPED, ON PURPOSE: a type is erased at build time, so a fork that does not need the
 * annotation is not a fork missing a rule. Only what runs counts as a mount.
 */
function kitImports(source) {
  const found = new Map();
  const pattern = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g;
  for (const [, typeOnly, clause, spec] of source.matchAll(pattern)) {
    if (typeOnly || !spec.startsWith(KIT_SCOPE)) continue;
    const names = clause
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith('type '))
      .map((part) => part.split(/\s+as\s+/)[0].trim());
    const set = found.get(spec) ?? new Set();
    for (const name of names) set.add(name);
    found.set(spec, set);
  }
  return found;
}

/** The store-scoped root layouts of a surface, DISCOVERED from its tree rather than listed here: any
 *  `src/app/<tree>/[store]/layout.tsx`. The vitrine has two (`s/` dynamic, `c/` edge-cacheable) and the fact
 *  that the second one is the twin everybody forgets is exactly why it is not typed out. */
function storeRootLayouts(base) {
  const app = join(base, 'src', 'app');
  if (!existsSync(app)) return [];
  const out = [];
  for (const entry of readdirSync(app, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = join('src', 'app', entry.name, '[store]', 'layout.tsx');
    if (existsSync(join(base, rel))) out.push(rel);
  }
  return out.sort();
}

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

const FORKS = surfaceForks(TREE);

say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (TREE.path) {
  say(`the reference read from: ${TREE.path} @ ${TREE.head.slice(0, 9)} (${TREE.how})`);
} else if (PINNED) {
  say(`⚠️ NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say("   set FORGE_MONOREPO=<the release's checkout>. Nothing below can compare this fork to anything.");
}
say(`forks of a packed surface: ${FORKS.map((f) => `${f.dir} (cut of ${f.surface.dir})`).join(', ') || 'none'}`);
for (const d of DIVERGENCES) say(`declared divergence: ${d.fork}/${d.layout} does NOT mount ${d.spec} → ${d.name} — ${d.why}`);

// ── the rule ────────────────────────────────────────────────────────────────────────────────────────────

test('a Forge checkout at the pinned commit was found (otherwise nothing here is a measurement)', (t) => {
  if (!PINNED) {
    t.skip('NOT CHECKED — forge.lock no longer names a branch@sha, so there is no tree to read');
    return;
  }
  if (!TREE.path) {
    t.skip(`NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine (set FORGE_MONOREPO)`);
    return;
  }
  assert.ok(surfaces(TREE).length > 0, `${TREE.path} has no scripts/publishing/surfaces.json entries to map a fork to`);
});

test('this repository owns at least one fork of a packed surface', (t) => {
  // The premise, and it is not decoration: the day the café's vitrine is renamed, deleted or stops declaring
  // the packed name, every rule below passes by having no subject — which is the quietest way a loop dies.
  if (!TREE.path) {
    t.skip('NOT CHECKED — without the release tree there is no table of packed surface names to match against');
    return;
  }
  assert.ok(
    FORKS.length > 0,
    'no directory of this repo has a package.json `name` matching a `packedName` in the release\'s ' +
      'scripts/publishing/surfaces.json — either the fork left, or it was renamed and this rule lost it',
  );
});

for (const fork of FORKS) {
  for (const rel of storeRootLayouts(join(TREE.path, fork.surface.dir))) {
    const referenceFile = join(TREE.path, fork.surface.dir, rel);
    const forkFile = join(fork.path, rel);

    test(`★★ ${fork.dir}/${rel} mounts every kit rule the reference mounts there`, (t) => {
      const wanted = kitImports(code(readFileSync(referenceFile, 'utf8')));
      assert.ok(
        wanted.size > 0,
        `${relative(TREE.path, referenceFile)} imports nothing from ${KIT_SCOPE}* — the reference this rule ` +
          'reads has no mount left to compare, so this test has silently stopped being about anything',
      );

      if (!existsSync(forkFile)) {
        // A fork may delete a whole store-scoped tree; then it serves no URL below it and there is no
        // unguarded entrance. Said out loud rather than passed over: the sweep must never look like it
        // checked a file it never opened.
        t.skip(
          `NOT CHECKED — ${fork.dir} has no ${rel}. The reference serves that tree and this fork does not, ` +
            'which is a divergence of its own; nothing below it can be unguarded because nothing is below it.',
        );
        return;
      }

      const forkCode = code(readFileSync(forkFile, 'utf8'));
      const mine = kitImports(forkCode);
      // What is left after the import block: an identifier that appears ONLY in its own `import` line is a
      // name the file took and never used, which is the shape a mount rots into when somebody deletes the
      // call and leaves the import — and it is exactly what the product's own guard checks for.
      const body = forkCode.replace(/import[\s\S]*?from\s*'[^']+';/g, '');
      const waived = DIVERGENCES.filter((d) => d.fork === fork.dir && d.layout === rel);
      const stale = waived.filter((d) => !wanted.get(d.spec)?.has(d.name));
      assert.deepEqual(
        stale.map((d) => `${d.spec} → ${d.name}`),
        [],
        `${fork.dir}/${rel}: a declared divergence names a mount the reference no longer asks for. The ` +
          'reason it was written for is gone; delete the entry rather than leave a waiver nobody can read.',
      );
      const behind = [];
      for (const [spec, names] of wanted) {
        const has = mine.get(spec);
        for (const name of names) {
          if (waived.some((d) => d.spec === spec && d.name === name)) continue;
          if (!has?.has(name)) behind.push(`${spec} → ${name} (never imported)`);
          else if (!new RegExp(`\\b${name}\\b`).test(body)) behind.push(`${spec} → ${name} (imported, never used)`);
        }
      }
      assert.deepEqual(
        behind,
        [],
        `${fork.dir} FELL BEHIND THE REFERENCE at ${rel} — the store-scoped root layout, the single parent ` +
          `of every route group of that tree.\n\n  the reference (${PINNED.ref}, ${fork.surface.dir}/${rel}) ` +
          `mounts what this fork does not:\n${behind.map((line) => `    · ${line}`).join('\n')}\n\n` +
          '  This is the price of forking, in the open: a fix that shipped in the reference vitrine does not\n' +
          '  travel to a cut of it. Two ways out, and both are decisions:\n' +
          `    · adopt it — read ${fork.surface.dir}/${rel} in the tree above and copy the mount, reasons included;\n` +
          '    · refuse it — this fork owns its front, and a divergence written down here stops being a\n' +
          '      surprise. Say so in this file, next to the name.',
      );
      say(`${fork.dir}/${rel}: ${[...wanted.values()].reduce((n, s) => n + s.size, 0)} kit mount(s) matched`);
    });
  }
}

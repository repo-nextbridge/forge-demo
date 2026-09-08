// ★ WHICH DIRECTORIES OF THIS REPOSITORY ARE FORKS OF A FORGE FRONT — asked by every guard that has
// something to say about them, and answered in ONE place.
//
// It was written inside `bin/fork-typecheck.guard.mjs` (2026-09-03) and moved here when `bin/fork-suite.
// guard.mjs` became the second guard that had to ask it. Nothing about the rule changed in the move; what it
// stopped being is a copy. The precedent is `bin/release-tree.mjs`, extracted from the same file for the same
// reason one slice earlier: two copies of "which trees are we talking about" is the exact shape of drift
// these guards exist to catch — the day a third front lands, one copy learns about it and the other does not.
//
// ⚠️ THE LIST IS DERIVED, NEVER TYPED. A fork is a directory whose `package.json` depends on the kit and
// declares the script the caller cares about. A third fork tomorrow is covered without anybody remembering
// that these files exist, and — the half that matters more — a fork that DROPS the script disappears from
// the list instead of failing loudly, which is why every caller also asserts the list is not empty.

import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { readJson, ROOT } from './release-tree.mjs';

/** The package every front of this repository forks the Forge surface through. One package, and a fork that
 *  installs it has chrome, theme, slots and the port clients — so it is also the one whose signatures a fork
 *  can fall behind. */
export const KIT = '@forgecommerce/storefront-kit';

/**
 * Every Next app this repository owns that installs the kit AND declares `script` in its manifest.
 * @param {string} script the npm script the caller is about to run — `typecheck`, `test`, …
 * @returns {{ dir: string, path: string }[]} sorted by directory name, so a run reads the same twice.
 */
export function forks(script) {
  const out = [];
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    let manifest;
    try {
      manifest = readJson(join(ROOT, entry.name, 'package.json'));
    } catch {
      continue;
    }
    if (!manifest.dependencies?.[KIT]) continue;
    if (!manifest.scripts?.[script]) continue;
    out.push({ dir: entry.name, path: join(ROOT, entry.name) });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

// ── the OTHER question, asked by the guards that compare this repo to the product ────────────────────────
//
// ★ THE SECOND DERIVATION, AND IT IS DELIBERATELY NOT THE FIRST. `forks(script)` above answers "which trees
// of this repo run something" — it needs no monorepo and covers the totem, which is ours and is a cut of
// nothing. What follows answers "which trees of this repo are a CUT OF a Forge surface, and of WHICH one" —
// which only the release can say, and which is the premise of every rule that compares the two.
//
// It was written twice, verbatim, in `bin/store-mount-drift.guard.mjs` and `bin/fork-chrome-drift.guard.mjs`
// and moved here when `bin/fork-refusal-drift.guard.mjs` would have been the THIRD copy. Nothing about it
// changed in the move. Two copies of "which trees are we talking about" is the exact shape of drift these
// guards exist to catch, and this file already exists to hold the answer.


/** The release's own table of forkable surfaces (`scripts/publishing/surfaces.json`): the packed project's
 *  name and the monorepo directory it was cut from. READ from the pinned tree, never assumed, so no guard
 *  has to know that a vitrine comes from `apps/storefront` — and a fork of the CHECKOUT tomorrow is covered
 *  by the same six lines.
 *  @param {{ path?: string }} tree the release tree from `releaseTree()`; `{}` when none was found.
 */
export function surfaces(tree) {
  if (!tree?.path) return [];
  const file = join(tree.path, 'scripts', 'publishing', 'surfaces.json');
  return existsSync(file) ? readJson(file) : [];
}

/**
 * Every directory of THIS repository whose package name is a packed surface name — the derived link between
 * a fork here and the reference app it came from. A fork that renamed its project leaves the list, loudly:
 * every caller reports the list before asserting, and asserts it is not empty.
 * @param {{ path?: string }} tree the release tree from `releaseTree()`.
 * @returns {{ dir: string, path: string, surface: { surface: string, dir: string, packedName: string } }[]}
 */
export function surfaceForks(tree) {
  const table = surfaces(tree);
  const out = [];
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    let name;
    try {
      name = readJson(join(ROOT, entry.name, 'package.json')).name;
    } catch {
      continue;
    }
    const surface = table.find((s) => s.packedName === name);
    if (surface) out.push({ dir: entry.name, path: join(ROOT, entry.name), surface });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

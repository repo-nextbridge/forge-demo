// ★★ WHICH DIRECTORIES OF THIS REPOSITORY ARE APPS OF THIS INSTANCE — and how one is put on disk so that a
// compiler and a runner can reach it. Asked by `bin/instance-app.guard.mjs`, answered here, in ONE place.
//
// It is the sibling of `bin/forks.mjs`, and deliberately so: that file answers "which directories are forks of
// a Forge front" by asking what they DEPEND ON, never by naming them. This one asks the same kind of question
// about the other species this repository owns.
//
// ⚠️ THE LIST IS DERIVED, NEVER TYPED, and the property it derives from is not one this file invented: the
// OVEN already uses it. `bin/build-local.sh:114` — "`--instance-apps`: it checks each app declares
// `forge.origin: "instance"`, copies it under `extensions/`, takes it OUT of the pnpm workspace". So the
// answer to "what makes a directory an app of this box?" is the same sentence on both sides of the bake, and
// the app this repository writes tomorrow is covered without anybody remembering that this file exists.
//
// ── WHY AN INSTANCE APP CANNOT SIMPLY BE `npm install`ED, AND WHAT IS DONE INSTEAD ───────────────────────
//
// Measured 2026-09-08 on `apps/payment-pos` and `apps/demo-gate`, then the two of them plus `apps/demo-setup`
// (pk26/D2) — the apps this box owns, and the list is DERIVED so a fourth costs nobody a line. Their manifests
// are written in the monorepo's vocabulary and NOTHING here or in the oven ever resolves it:
//
//     "@forgecommerce/contracts": "workspace:*"     ← a pnpm workspace link; there is no workspace here
//     "@types/node": "catalog:", "vitest": "catalog:", …   ← a pnpm catalog; there is no catalog here
//
// `catalog:` and `workspace:*` are protocols only pnpm understands, inside a workspace these apps are not in
// — the oven takes them OUT of it on purpose and "links its dependencies from what the image already carries"
// (bin/build-local.sh:115). So the specs are honest about WHAT the app needs and useless as an install plan,
// which is why this file links the same way the oven does: out of the Forge checkout this box's images were
// baked from (`bin/release-tree.mjs`), by name, into the app's own `node_modules/` (gitignored, like every
// other `node_modules` here). No registry is contacted and no resolver runs — measured at 1 ms and 5 ms
// for this box's first two apps, and unchanged in shape by the third.
//
// ★ AND THE LINKED SET IS DERIVED TOO — from the app's own `dependencies` + `devDependencies` +
// `peerDependencies`. An app that adds a dependency tomorrow gets it linked; an app that names a package the
// pinned tree does not carry is REPORTED BY NAME, never quietly skipped, because a suite that ran without the
// thing it declares proved something about a smaller program than the one the oven ships.

import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { candidates, checkout, pinnedCommit, readJson, releaseTree, ROOT } from './release-tree.mjs';

/** Where this repository keeps the apps it writes itself. The oven reads the same directory through
 *  `composition.json`'s `instanceApps[].source`, all of which are `./apps/<id>`. */
export const APPS_DIR = join(ROOT, 'apps');

/** The value `bin/build-local.sh` and the Forge oven both require of an app that belongs to ONE box. */
export const INSTANCE_ORIGIN = 'instance';

/**
 * Every directory under `apps/` that declares itself an app of THIS instance AND declares `script`.
 * @param {string} script the npm script the caller is about to run — `typecheck`, `test`, …
 * @returns {{ dir: string, path: string, manifest: object }[]} sorted by name, so a run reads the same twice.
 */
export function instanceApps(script) {
  const out = [];
  if (!existsSync(APPS_DIR)) return out;
  for (const entry of readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    let manifest;
    try {
      manifest = readJson(join(APPS_DIR, entry.name, 'package.json'));
    } catch {
      continue;
    }
    if (manifest.forge?.origin !== INSTANCE_ORIGIN) continue;
    if (!manifest.scripts?.[script]) continue;
    out.push({ dir: `apps/${entry.name}`, path: join(APPS_DIR, entry.name), manifest });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Every package name an app names, in any of the three places a manifest can name one. */
export function declaredDependencies(app) {
  return [
    ...new Set([
      ...Object.keys(app.manifest.dependencies ?? {}),
      ...Object.keys(app.manifest.devDependencies ?? {}),
      ...Object.keys(app.manifest.peerDependencies ?? {}),
    ]),
  ].sort();
}

/** A workspace package of the Forge checkout, by the name its own `package.json` declares — never by guessing
 *  a directory from the package name, because `@forgecommerce/contracts` lives in `packages/contracts`. */
function workspacePackage(tree, name) {
  const packages = join(tree, 'packages');
  if (!existsSync(packages)) return null;
  for (const entry of readdirSync(packages, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      if (readJson(join(packages, entry.name, 'package.json')).name === name) {
        return join(packages, entry.name);
      }
    } catch {
      /* not a package */
    }
  }
  return null;
}

/**
 * Where the pinned checkout keeps `name`, or a sentence saying why it cannot be linked.
 *
 * The root's own `node_modules/<name>` first, because that is the version the tree itself chose. pnpm only
 * puts a package there when the ROOT manifest names it, so most of an app's dependencies are not there and
 * have to be found in the store — where the directory is `<name with / as +>@<version>` plus, for a package
 * with peers, a hash. ⚠️ MORE THAN ONE MATCH IS REFUSED RATHER THAN GUESSED: picking one would silently
 * decide which React an app compiles against.
 */
export function resolveFromTree(tree, name) {
  const direct = join(tree, 'node_modules', name);
  if (existsSync(direct)) return { path: direct, how: 'the checkout\'s own node_modules' };
  const workspace = workspacePackage(tree, name);
  if (workspace) return { path: workspace, how: 'a workspace package of the checkout' };
  const store = join(tree, 'node_modules', '.pnpm');
  if (!existsSync(store)) return { error: `${name}: no node_modules/.pnpm in ${tree}` };
  const prefix = `${name.replace('/', '+')}@`;
  const matches = readdirSync(store).filter(
    (entry) => entry.startsWith(prefix) && existsSync(join(store, entry, 'node_modules', name)),
  );
  if (matches.length === 0) return { error: `${name}: this checkout does not carry it` };
  const versions = new Set(matches.map((entry) => entry.slice(prefix.length).split('_')[0]));
  if (versions.size > 1) {
    return { error: `${name}: this checkout carries ${[...versions].sort().join(', ')} — ambiguous` };
  }
  const version = [...versions][0];
  return { path: join(store, matches[0], 'node_modules', name), how: `the checkout's store (${version})` };
}

/**
 * Put everything `app` declares into `app/node_modules/`, as links into the pinned checkout.
 *
 * IDEMPOTENT AND CHEAP by construction — every link is removed and rewritten, so a tree that moved is picked
 * up rather than remembered. `node_modules/` is gitignored at every depth (.gitignore), and
 * `bin/build-local.sh`
 * copies an app to the oven with `--exclude node_modules`, so nothing written here can reach an image.
 * @returns {{ linked: string[], missing: string[] }}
 */
export function linkDependencies(tree, app) {
  const linked = [];
  const missing = [];
  for (const name of declaredDependencies(app)) {
    const found = resolveFromTree(tree, name);
    if (!found.path) {
      missing.push(found.error);
      continue;
    }
    const target = join(app.path, 'node_modules', name);
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target) || isLink(target)) rmSync(target, { recursive: true, force: true });
    symlinkSync(found.path, target, 'dir');
    linked.push(`${name} ← ${found.how}`);
  }
  return { linked, missing };
}

/** `existsSync` follows the link, so a link pointing at a tree that moved reads as absent and would never be
 *  replaced. This is the question that survives a dangling one. */
function isLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** An executable the pinned checkout installed — the runner and the compiler the apps declare but cannot
 *  install. Null when the checkout has no such bin, which the caller reports as NOT CHECKED. */
export function toolFromTree(tree, bin) {
  const path = join(tree, 'node_modules', '.bin', bin);
  return existsSync(path) ? path : null;
}


// ── THE CHECKOUT AN APP OF THIS BOX IS LINKED AGAINST ────────────────────────────────────────────────────

/** A Forge checkout can only lend an app its contracts if that package has been BUILT: `@forgecommerce/
 *  contracts` declares `main: ./dist/index.js`, and a tree with no `dist` links cleanly and then fails at
 *  import. Measured 2026-09-08 against the worktree at the pinned commit, which had never been built:
 *  `manifest.test.ts` alone went red and 14 of 23 tests ran — a RED that says nothing about this app. */
export function lendable(base) {
  const tree = checkout(base);
  if (!tree) return null;
  return existsSync(join(base, 'packages', 'contracts', 'dist', 'index.js')) ? tree : null;
}

/**
 * The Forge checkout to link from, and the sentence saying how honest the answer is.
 *
 * ⚠️ THE PINNED TREE IS PREFERRED AND NOT REQUIRED, and that is a different posture from
 * `bin/fork-typecheck.guard.mjs`'s kit comparison — deliberately. That rule asks "is this the kit the release
 * pins?", which only the pinned tree can answer. This one lends a COMPILER, a RUNNER and the contracts an
 * app's manifest is validated against, which is the same thing `bin/pack-apps.sh:66-74` already does with
 * whatever checkout the operator names. So: the pinned tree when it is on this machine and built, any Forge
 * checkout otherwise WITH THE FALLBACK SAID OUT LOUD, and NOT CHECKED when there is none.
 * @returns {{ path: string, head: string, how: string, pinned: boolean } | { tried: string[] }}
 */
export function lendingTree() {
  const tried = [];
  const pinned = pinnedCommit();
  if (pinned) {
    const found = releaseTree(pinned);
    if (found.path && lendable(found.path)) {
      return { ...found, pinned: true, how: `${found.how}, at the pinned ${pinned.ref}` };
    }
    tried.push(
      found.path
        ? `${found.path} — the tree at ${pinned.ref}, but @forgecommerce/contracts is not built ` +
          'there (pnpm build)'
        : `no checkout at ${pinned.ref} on this machine`,
    );
  }
  for (const base of candidates()) {
    const found = lendable(base);
    if (found) {
      return {
        ...found,
        pinned: false,
        how: `NOT the pinned tree — this is ${base} @ ${found.head.slice(0, 9)}`,
      };
    }
    tried.push(`${base} — not a Forge checkout with a built @forgecommerce/contracts`);
  }
  return { tried };
}

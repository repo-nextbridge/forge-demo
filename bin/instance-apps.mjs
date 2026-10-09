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
// Measured 2026-09-08 on `apps/payment-pos` and the box's other app of the day, then on `apps/demo-setup`
// (pk26/D2) too — the apps this box owns, and the list is DERIVED so a fourth costs nobody a line. Their manifests
// are written in the monorepo's vocabulary and NOTHING here or in the oven ever resolves it:
//
//     "@forgeco/contracts": "workspace:*"     ← a pnpm workspace link; there is no workspace here
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

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { forks } from './forks.mjs';
import { pinnedCommit, readJson, ROOT } from './release-tree.mjs';

/** Where this repository keeps the apps it writes itself. The oven reads the same directory through
 *  `composition.json`'s `instanceApps[].source`, all of which are `./apps/<id>`. */
export const APPS_DIR = join(ROOT, 'apps');

/** The value `bin/bake.sh` hands to the oven, and the oven requires of an app that belongs to ONE box. */
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
 *  a directory from the package name, because `@forgeco/contracts` lives in `packages/contracts`. */
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
    // ★ v032/C — A LINK ALREADY POINTING AT THE SAME PLACE IS LEFT ALONE. The lending tree is now ONE fork,
    // the same on every run, and `node --test` runs this guard beside `bin/fork-typecheck.guard.mjs`, which
    // compiles that fork — and with it this app. Measured 2026-10-09: rewriting the link every time opened a
    // window (rm, then symlink) in which the other process's `tsc` found the app's imports missing, and the
    // fork went red for a file nobody had changed.
    if (isLink(target) && readlinkSync(target) === found.path) {
      linked.push(`${name} ← ${found.how}`);
      continue;
    }
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

/** Can `forkPath` lend an app what it declares? Only an INSTALLED fork whose `@forgeco/contracts` is the
 *  release's: the contracts are what a manifest is validated against, and a stale install of another release
 *  would make the suite argue with code the kernel of this box never loads. */
export function lendable(forkPath, release) {
  try {
    const version = readJson(join(forkPath, 'node_modules', '@forgeco', 'contracts', 'package.json')).version;
    return `v${version}` === release ? { path: forkPath, version } : { stale: `v${version}` };
  } catch {
    return null;
  }
}

/**
 * ★★ v032/C — WHAT AN APP OF THIS BOX IS COMPILED AND TESTED AGAINST: AN INSTALLED FORK, AT THE RELEASE.
 *
 * Until v0.3.2 this lent from a Forge CHECKOUT at the pinned commit, built (`pnpm build`), because the kit and
 * the contracts reached this repository only through one. From v0.3.2 they reach it from npm: each fork
 * installs `@forgeco/*@<release>` exactly, plus react / react-dom / typescript / vitest / jsdom / the testing
 * library at the versions the monorepo's catalog pins — the names these apps declare. So a fork's install is
 * the release's published surface, which is also what the oven links an adopted app against
 * (`@forgeco/contracts` "from the release it is baking", templates/instance/README.md §5b).
 *
 * ⛔ THE PIN STILL DECIDES, as it did against a checkout (pk38/d9, measured: an app graded against a kit 545
 * commits behind went RED for a symbol added upstream). A fork whose `@forgeco/contracts` is not the release
 * `forge.lock` names is refused by version — `npm ci` in it, and it lends.
 *
 * The forks are tried in name order; the first that lends wins and is said in `how`.
 * @returns {{ path: string, head: string, how: string, clean: boolean } | { tried: string[] }}
 */
export function lendingTree() {
  const pinned = pinnedCommit();
  if (!pinned?.release) {
    return {
      tried: [
        `forge.lock pins ${pinned?.ref ?? 'nothing'}, not a release tag — the forks install a release from npm, ` +
          'so there is no pin to hold them to',
      ],
    };
  }
  const tried = [];
  for (const fork of forks('test')) {
    const found = lendable(fork.path, pinned.release);
    if (found?.path) {
      return {
        path: fork.path,
        head: pinned.release,
        how: `${fork.dir}'s npm install, @forgeco/contracts ${found.version} = ${pinned.release}`,
        clean: true,
      };
    }
    tried.push(
      found?.stale
        ? `${fork.dir} — installs @forgeco/contracts ${found.stale}, and forge.lock pins ${pinned.release} (npm ci in it)`
        : `${fork.dir} — not installed (cd ${fork.dir} && npm ci)`,
    );
  }
  if (tried.length === 0) tried.push('this repository has no fork that installs the kit and declares `test`');
  return { tried };
}


// ── ★★ v032/P4 — THE SAME LINKS, FOR A FORK'S BUILD, AND NOT ONLY FOR THE SUITE ─────────────────────────
//
// ⛔ THE DEFECT, MEASURED 2026-10-08 IN A FRESH CLONE OF THIS REPOSITORY. `bin/build-coffee.sh` died at
// `npm run build` because `apps/demo-setup/block/marks.tsx` imports `@forgeco/storefront-kit/media/src` and
// webpack resolves that from the app's REAL path — `apps/demo-setup/node_modules/`, which nothing but
// `bin/instance-app.guard.mjs` (at load, via `linkDependencies()` above) ever wrote. The fork's own
// `npm install` links `file:../apps/demo-setup` and never installs THAT directory's dependencies (they are
// `workspace:*`/`catalog:` — see the header). So a build worked only on a machine where `bin/test.sh` had
// already run once, an order nothing wrote down outside an adoption report.
//
// ★ THE FIX IS THE SAME FUNCTION, CALLED BY THE BUILD. `bin/link-instance-apps.mjs` is the CLI both
// `bin/build-*.sh` run between the fork's install and its `npm run build`; `bin/build-links.guard.mjs`
// holds every build script that compiles a fork to calling it, in that order.

/** Every app of this instance that `forkPath`'s manifest installs as a directory — `file:../apps/<id>` (the
 *  first of the three gestures `bin/front-apps.mjs` names). Derived from the manifest, so a fork that names a
 *  second app tomorrow gets it linked without this file changing. */
export function appsOfFork(forkPath) {
  const manifest = readJson(join(forkPath, 'package.json'));
  const specs = { ...manifest.dependencies, ...manifest.devDependencies };
  const out = [];
  for (const spec of Object.values(specs)) {
    if (typeof spec !== 'string' || !spec.startsWith('file:')) continue;
    const path = join(forkPath, spec.slice('file:'.length));
    if (dirname(path) !== APPS_DIR) continue;
    let app;
    try {
      app = readJson(join(path, 'package.json'));
    } catch {
      continue;
    }
    if (app.forge?.origin !== INSTANCE_ORIGIN) continue;
    out.push({ dir: `apps/${path.slice(APPS_DIR.length + 1)}`, path, manifest: app });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

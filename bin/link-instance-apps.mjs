#!/usr/bin/env node
// ★★ v032/P4 — A FORK'S BUILD LINKS THE APPS OF THIS BOX IT COMPILES, INSTEAD OF HOPING THE SUITE DID.
//
//   node bin/link-instance-apps.mjs <fork directory>
//   (called by bin/bake.sh between the fork's `npm ci` and its `npm run build` — not something a human has
//   to remember)
//
// ⛔ MEASURED 2026-10-08, A FRESH CLONE OF THIS REPOSITORY AT 37f9b8f, `bash bin/build-coffee.sh <forge>`:
// the fork installs, then `next build` fails to resolve `@forgeco/storefront-kit/media/src` from
// `apps/demo-setup/block/marks.tsx`. The app's `node_modules/` was written only by
// `bin/instance-app.guard.mjs` — i.e. by `bin/test.sh` — so a build worked only after a suite had run.
//
// ★ ONE IMPLEMENTATION: `linkDependencies()` of `bin/instance-apps.mjs`, the function the guard calls. What
// differs is the TREE, on purpose: the guard links from the PINNED release (`lendingTree()`), and a build
// links from the checkout it was HANDED — the same `<forge>` `bin/vendor-packages.sh` just packed the fork's
// kit from — so the app is compiled against the kit that ships next to it, never against whatever an older
// run of the suite left behind (measured on the owner's checkout on 2026-10-08: links into a v0.3.0 tree).
//
// ★★ v032/C — THE TREE IS THE FORK'S OWN INSTALL. The fork installs `@forgeco/*` at the release from npm, plus
// the react / typescript / vitest the monorepo's catalog pins at the same versions; that install IS the kit
// the fork ships with, so an app is linked from it and compiled against exactly that. There is no Forge
// checkout to hand over any more (the `<forge>` argument died with `bin/vendor-packages.sh`).
//
// ⚠️ A PACKAGE THE TREE CANNOT LEND IS A RED HERE, NOT A SKIP. The guard may say NOT CHECKED; a build that
// went on would fail later inside webpack, with a message that names neither the app nor the tree.

import { appsOfFork, declaredDependencies, linkDependencies } from './instance-apps.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const say = (line) => console.error(`[links] ${line}`);
const [forkArg] = process.argv.slice(2);
if (!forkArg) {
  say('usage: link-instance-apps.mjs <fork directory>');
  process.exit(2);
}
const fork = resolve(forkArg);
if (!existsSync(resolve(fork, 'package.json'))) {
  say(`${forkArg} has no package.json — not a fork of this repository.`);
  process.exit(1);
}
if (!existsSync(resolve(fork, 'node_modules', '@forgeco'))) {
  say(`${forkArg} is not installed (no node_modules/@forgeco) — run \`npm ci\` in it first.`);
  process.exit(1);
}
const tree = { path: fork };

const apps = appsOfFork(fork);
say(`${forkArg} installs ${apps.length} app(s) of this instance: ${apps.map((a) => a.dir).join(', ') || 'none'}`);
let failed = false;
for (const app of apps) {
  const { linked, missing } = linkDependencies(tree.path, app);
  say(`${app.dir}: ${linked.length}/${declaredDependencies(app).length} declared package(s) linked from ${tree.path}`);
  for (const line of missing) say(`  ⛔ ${line}`);
  if (missing.length > 0) failed = true;
}
if (failed) {
  say('⛔ the build would compile an app without what it declares — refusing here, by name.');
  process.exit(1);
}

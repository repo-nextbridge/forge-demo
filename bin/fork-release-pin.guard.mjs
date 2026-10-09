// ★★★ v032/C — WHAT THIS REPOSITORY INSTALLS OF FORGE IS THE RELEASE IT PINS, FROM npm, AND NOTHING ELSE.
//
//   node --test bin/fork-release-pin.guard.mjs        (or: bash bin/test.sh)
//
// It replaces `bin/vendor-drift.guard.mjs`, which proved that the 19 tarballs vendored into each fork out of a
// Forge CHECKOUT were the ones that checkout still produced. The tarballs are gone (spec v032, decision 6):
// the 19 `@forgeco/*` have been on npm since v0.3.0, the forks install them from there, and the root
// `package.json` installs the release's tools (`forge pack-extension`, `forge-lock-provenance`) the same way.
// What can still drift is the PIN, and it drifts in three places at once — so this holds, for the forks and
// for the root:
//
//   1 · every `@forgeco/*` dependency is the EXACT version `forge.lock`'s `forgeVersion` names — no range (a
//       range is a version npm chooses on the day of the install), no `file:` (the vendored shape), no other
//       release;
//   2 · the committed `package-lock.json` resolves each of them from the npm registry, with an integrity
//       hash — an install from anywhere else is a kit nobody can reproduce;
//   3 · what is INSTALLED on disk is that version (NOT CHECKED, by name, when a tree is not installed: `npm ci`).
//
// `bin/fork-typecheck.guard.mjs` then holds that the installed kit's bytes ARE the release's `src/` (read out of
// the release's oven) — the two together are the claim "the forks compile against v<release>".

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { pinnedCommit, ROOT } from './release-tree.mjs';

const say = (line) => console.error(`[fork-release-pin] ${line}`);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const SCOPE = '@forgeco/';
const REGISTRY = 'https://registry.npmjs.org/';

const PINNED = pinnedCommit();
const VERSION = PINNED?.release?.slice(1) ?? null;

/** Every directory here that installs a `@forgeco/*` package — derived from the manifests, never typed. */
const TREES = ['.', ...['storefront-coffee', 'totem'].filter((d) => existsSync(join(ROOT, d, 'package.json')))]
  .map((dir) => ({ dir, path: join(ROOT, dir), manifest: read(join(ROOT, dir, 'package.json')) }))
  .map((t) => ({
    ...t,
    forge: Object.entries({ ...t.manifest.dependencies, ...t.manifest.devDependencies }).filter(([n]) => n.startsWith(SCOPE)),
  }))
  .filter((t) => t.forge.length > 0);

say(`forge.lock pins ${PINNED?.ref ?? '<nothing>'}; trees that install ${SCOPE}*: ${TREES.map((t) => t.dir).join(', ') || 'none'}`);

test('⛔ the premise — the lock pins a RELEASE and at least the two forks and the root install from it', () => {
  assert.ok(VERSION, `forge.lock's forgeVersion is ${PINNED?.ref ?? 'absent'}, not a release tag — npm has nothing to pin to`);
  assert.deepEqual(TREES.map((t) => t.dir).sort(), ['.', 'storefront-coffee', 'totem'].sort());
});

for (const tree of TREES) {
  test(`★★ ${tree.dir}: every ${SCOPE}* is EXACTLY the release forge.lock pins`, () => {
    const wrong = tree.forge.filter(([, spec]) => spec !== VERSION).map(([n, spec]) => `${n}: ${spec}`);
    assert.deepEqual(
      wrong,
      [],
      `${tree.dir}/package.json does not pin ${SCOPE}* at ${VERSION} (forge.lock: ${PINNED?.ref}). A range, a ` +
        '`file:` tarball or another release is a kit the box was not baked with.',
    );
    assert.equal(tree.manifest.overrides, undefined, `${tree.dir}/package.json still carries \`overrides\` — the vendored shape`);
  });

  test(`★★ ${tree.dir}: the committed package-lock resolves them from the npm registry, with integrity`, () => {
    const lock = read(join(tree.path, 'package-lock.json'));
    const bad = [];
    let seen = 0;
    for (const [key, entry] of Object.entries(lock.packages ?? {})) {
      const at = key.lastIndexOf('node_modules/');
      if (at < 0 || !key.slice(at + 'node_modules/'.length).startsWith(SCOPE)) continue;
      seen += 1;
      if (entry.version !== VERSION) bad.push(`${key}: version ${entry.version}`);
      if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith(`${REGISTRY}${SCOPE}`)) {
        bad.push(`${key}: resolved ${entry.resolved}`);
      }
      if (typeof entry.integrity !== 'string' || !entry.integrity.startsWith('sha512-')) bad.push(`${key}: no integrity`);
    }
    assert.ok(seen >= tree.forge.length, `${tree.dir}/package-lock.json holds ${seen} ${SCOPE}* entries for ${tree.forge.length} dependencies`);
    assert.deepEqual(bad, [], `${tree.dir}/package-lock.json:\n  ${bad.join('\n  ')}`);
    say(`${tree.dir}: ${seen} ${SCOPE}* entries, all ${VERSION} from ${REGISTRY}`);
  });

  test(`★ ${tree.dir}: what is INSTALLED is that release`, (t) => {
    if (!existsSync(join(tree.path, 'node_modules', '@forgeco'))) {
      t.skip(`NOT CHECKED — ${tree.dir} is not installed: \`cd ${tree.dir} && npm ci\``);
      return;
    }
    const off = tree.forge
      .map(([name]) => {
        const file = join(tree.path, 'node_modules', ...name.split('/'), 'package.json');
        return existsSync(file) ? [name, read(file).version] : [name, '<missing>'];
      })
      .filter(([, v]) => v !== VERSION)
      .map(([n, v]) => `${n}: ${v}`);
    assert.deepEqual(off, [], `${tree.dir}/node_modules is not ${VERSION} — \`cd ${tree.dir} && npm ci\``);
  });
}

test('★ no fork keeps a vendor/ directory, and the scripts that filled one are gone', () => {
  for (const tree of TREES) assert.ok(!existsSync(join(tree.path, 'vendor')), `${tree.dir}/vendor/ is back`);
  for (const dead of ['vendor-packages.sh', 'revendor-forks.sh', 'install-storefront.sh', 'build-local.sh']) {
    assert.ok(!existsSync(join(ROOT, 'bin', dead)), `bin/${dead} is back — the release comes from npm and the oven now`);
  }
});

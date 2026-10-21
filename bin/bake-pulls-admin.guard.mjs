// ★★ KP-D1 (2026-10-21) — THE BAKE NO LONGER BAKES THE ADMIN: IT COPIES THE RELEASE'S ADMIN INTO THE LOCK.
//
//   node --test bin/bake-pulls-admin.guard.mjs        (or: bash bin/test.sh)
//
// The product's doctrine: pull by digest what does not differentiate the box, bake what carries an app that
// draws a screen. No app of this box draws in the admin, so `bin/bake.sh` bakes kernel, storefront, checkout
// and the two forks, and writes `admin: { ref, origin: "release" }` READ from the release's own forge.lock —
// never typed. What is graded here, without docker:
//   1 · BY RUNNING the block between `# >>> THE IMAGES THIS BOX PULLS FROM THE RELEASE` markers over fabricated
//       release locks: the admin's ref comes out of the file; a lock of another release, an admin that is not
//       `origin: "release"`, or a ref that is not a registry digest are refused, naming what is wrong.
//   2 · BY TEXT, comments stripped: the bake loop no longer names `admin`, and the lock's `admin` entry is the
//       pulled one. Put `admin` back in the loop and rule 2 is red (sabotage in RESULTADOS-kpd1).
//   3 · BY RUNNING the product's fence (`forge-lock-provenance`, installed at the release by `npm ci`) over THIS
//       repository's real composition.json and apps with a lock of the new shape: green. The red half — an
//       instance app that draws in the admin while the admin is `release` — is bin/deploy.guard.mjs's sabotage.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(ROOT, 'bin', 'bake.sh'), 'utf8');
// Whole-line comments out before judging the CODE (importing bake-own-list's stripper would re-run its tests
// in this file); trailing comments on the lines graded below do not occur.
const codeOf = (shell) => shell.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const D = (c) => `sha256:${c.repeat(64)}`;
const AR = 'southamerica-east1-docker.pkg.dev/probe/forge-kernel';

function block() {
  const m = SCRIPT.match(/# >>> THE IMAGES THIS BOX PULLS FROM THE RELEASE\n([\s\S]*?)# <<< THE IMAGES THIS BOX PULLS FROM THE RELEASE/);
  assert.ok(m, 'bin/bake.sh no longer marks THE IMAGES THIS BOX PULLS FROM THE RELEASE — this guard cannot run it');
  return m[1];
}

/** Run the marked block with `release` = v0.3.3 and `release_lock` = a fabricated file; print what it pulled. */
function runBlock(releaseLock) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-bake-pulls-'));
  try {
    writeFileSync(join(dir, 'release.lock'), typeof releaseLock === 'string' ? releaseLock : JSON.stringify(releaseLock));
    writeFileSync(
      join(dir, 'block.sh'),
      `set -euo pipefail\nrelease=v0.3.3\nrelease_lock=${JSON.stringify(join(dir, 'release.lock'))}\n` +
        `die() { printf '[bake] ⛔ %s\\n' "$*" >&2; exit 1; }\n${block()}\n` +
        `for k in "\${!PULLED[@]}"; do printf 'PULLED %s %s\\n' "$k" "\${PULLED[$k]}"; done\n`,
    );
    try {
      return { code: 0, out: execFileSync('bash', [join(dir, 'block.sh')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const releaseLock = (over = {}) => ({
  forgeVersion: 'v0.3.3',
  images: {
    kernel: { ref: `${AR}/forge-kernel@${D('a')}`, origin: 'release' },
    admin: { ref: `${AR}/forge-admin@${D('d')}`, origin: 'release' },
    ...over,
  },
});

test('★★ the admin comes OUT of the release’s lock — its ref, by digest, and nothing typed', () => {
  const r = runBlock(releaseLock());
  assert.equal(r.code, 0, r.out);
  assert.equal(r.out.trim(), `PULLED admin ${AR}/forge-admin@${D('d')}`);
});

test('⟂ a release lock of ANOTHER release is refused, naming both versions', () => {
  const r = runBlock({ ...releaseLock(), forgeVersion: 'v0.3.2' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /v0\.3\.2, and this repository pins v0\.3\.3/);
});

test('⟂ an admin that is not the release’s own (origin "own build") is refused', () => {
  const r = runBlock(releaseLock({ admin: { ref: `${AR}/forge-admin@${D('d')}`, origin: 'own build' } }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /does not pin admin as origin "release"/);
});

test('⟂ an admin pinned by TAG, or with no registry host, is refused', () => {
  for (const ref of [`${AR}/forge-admin:v0.3.3`, `forge-admin@${D('d')}`]) {
    const r = runBlock(releaseLock({ admin: { ref, origin: 'release' } }));
    assert.equal(r.code, 1, `${ref} was accepted:\n${r.out}`);
    assert.match(r.out, /not a registry ref by digest/);
  }
});

test('⟂ a release lock with no admin at all is refused, not written as an empty pin', () => {
  const { admin, ...rest } = releaseLock().images;
  const r = runBlock({ forgeVersion: 'v0.3.3', images: rest });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /admin/);
});

test('★★ the CODE bakes kernel, storefront and checkout — and NOT the admin — and writes the pulled admin', () => {
  const code = codeOf(SCRIPT);
  const loop = code.match(/^for target in ([a-z][^;]*); do$/m);
  assert.ok(loop, 'bin/bake.sh has no recipe loop this guard recognises');
  assert.deepEqual(loop[1].trim().split(/\s+/), ['kernel', 'storefront', 'checkout'], `the recipe loop bakes: ${loop[1]}`);
  assert.match(code, /--argjson admin "\$\(pulled_entry "\$\{PULLED\[admin\]\}"\)"/, 'the lock’s admin is not the pulled one');
  assert.match(code, /pulled_entry\(\) \{ jq -n --arg ref "\$1" '\{ref: \$ref, origin: "release"\}'; \}/, 'a pulled entry is not { ref, origin: "release" }');
  assert.match(code, /--release-lock "\$RUNNER_TEMP\/release\/forge\.lock"|release_lock=/, 'the bake does not take the release’s lock');
});

test('★ the CI hands the bake the SAME release lock it reads the oven from', () => {
  const yml = readFileSync(join(ROOT, '.github', 'workflows', 'bake.yml'), 'utf8');
  assert.match(yml, /gh release download "\$TAG" -R repo-nextbridge\/forge -p forge\.lock -D "\$RUNNER_TEMP\/release"/);
  assert.match(yml, /bash bin\/bake\.sh --release-lock "\$RUNNER_TEMP\/release\/forge\.lock"/);
});

// ── 3 · THE PRODUCT'S FENCE, ON THIS REPOSITORY, WITH THE LOCK THE BAKE NOW WRITES ─────────────────────────
const FENCE = join(ROOT, 'node_modules', '.bin', 'forge-lock-provenance');

test('★★ forge-lock-provenance (the release’s) is GREEN on this repository with admin: release', { skip: existsSync(FENCE) ? false : 'NOT CHECKED — the release’s tools are not installed: `npm ci` at the root' }, () => {
  const lock = JSON.parse(readFileSync(join(ROOT, 'forge.lock'), 'utf8'));
  lock.images.admin = { ref: `${AR}/forge-admin@${D('d')}`, origin: 'release' };
  const dir = mkdtempSync(join(tmpdir(), 'forge-bake-pulls-fence-'));
  try {
    writeFileSync(join(dir, 'forge.lock'), JSON.stringify(lock, null, 2));
    let out;
    try {
      out = execFileSync(FENCE, ['--root', ROOT, '--lock', join(dir, 'forge.lock')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      assert.fail(`the fence refused the lock the bake now writes:\n${e.stdout ?? ''}${e.stderr ?? ''}`);
    }
    assert.match(out, /admin/, `the fence did not grade the admin at all:\n${out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

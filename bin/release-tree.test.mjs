// ★★ WHICH TREE `releaseTree` HANDS BACK WHEN MORE THAN ONE IS AT THE PINNED COMMIT — held here because the
// answer decides what every guard in this directory measures the box against.
//
// ⛔ THE DEFECT, MEASURED AT THE pk36 CUT. `releaseTree` returned the FIRST checkout whose HEAD was the pinned
// commit and never asked whether that tree still held the release's bytes. It handed back a worktree with a
// slice running in it, the cut was packed out of that, and the drift it reported was the slice's uncommitted
// edits — an accusation about a difference that did not exist. The tree had the RIGHT COMMIT and lied anyway,
// which is the third fold of "measured against the wrong tree" this repository has paid for: an old tree
// (pk27), a sibling's live tree (pk34), and now a dirty tree at the right commit.
//
// ⇒ the property: among the trees at the pinned commit, a CLEAN one is preferred, a dirty one is still an
// answer (a developer editing the monorepo next door must not be told the release is missing), and whichever
// was taken SAYS SO in `how`.
//
// ⚠️ EVERY FIXTURE HERE IS BUILT BY THIS FILE, in a temp directory, and reached through the `env` argument
// rather than through `process.env` — so this test cannot be changed by which shell ran it, which is the
// second defect the same slice fixed one file over (bin/composition-pin.test.mjs).
//
//   node --test bin/release-tree.test.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { candidates, releaseTree } from './release-tree.mjs';

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.email=a@b.c', '-c', 'user.name=fixture', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

/**
 * A directory that is a Forge checkout by every test `checkout()` applies — it carries
 * `packages/storefront-kit/package.json` and git can name a commit for it — plus a second worktree of the
 * same clone parked at the same commit. Both are the pinned commit; only their cleanliness differs.
 */
function clone() {
  const root = mkdtempSync(join(tmpdir(), 'forge-release-tree-'));
  const main = join(root, 'main');
  mkdirSync(join(main, 'packages', 'storefront-kit'), { recursive: true });
  writeFileSync(join(main, 'packages', 'storefront-kit', 'package.json'), '{"name":"@forgecommerce/storefront-kit"}\n');
  git(main, 'init', '-q', '-b', 'release');
  git(main, 'add', '-A');
  git(main, 'commit', '-q', '-m', 'the release');
  const sha = git(main, 'rev-parse', 'HEAD');
  return {
    root,
    main,
    pinned: { ref: `release@${sha.slice(0, 9)}`, sha },
    /** A second working tree of the same clone, at the same commit — the sibling a dirty tree can lose to. */
    sibling() {
      const path = join(root, 'sibling');
      git(main, 'worktree', 'add', '-q', '--detach', path, sha);
      return path;
    },
    dirty(path) {
      writeFileSync(join(path, 'packages', 'storefront-kit', 'package.json'), '{"name":"edited by a slice"}\n');
    },
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('★ the environment is an ARGUMENT — the tree a child would find, asked for from here', () => {
  const fixture = clone();
  try {
    assert.ok(
      candidates({ FORGE_MONOREPO: fixture.main }).includes(fixture.main),
      'the first door of the search is no longer the FORGE_MONOREPO of the environment it was handed',
    );
    assert.ok(
      !candidates({}).includes(fixture.main),
      'an environment that names no checkout still produced one — this function is reading an ambient fact',
    );
  } finally {
    fixture.close();
  }
});

test('★★ a CLEAN tree at the pinned commit is the answer, and it says so', () => {
  const fixture = clone();
  try {
    const found = releaseTree(fixture.pinned, { FORGE_MONOREPO: fixture.main });
    assert.equal(found.path, fixture.main, `the tree at the pinned commit was not found: ${found.tried?.join('; ')}`);
    assert.equal(found.clean, true, found.how);
    assert.match(found.how, /checked out here/);
  } finally {
    fixture.close();
  }
});

test('★★★ a DIRTY tree loses to a clean one at the SAME commit — the pk36 cut, held', () => {
  const fixture = clone();
  try {
    const sibling = fixture.sibling();
    fixture.dirty(fixture.main);

    const found = releaseTree(fixture.pinned, { FORGE_MONOREPO: fixture.main });
    assert.equal(
      found.path,
      sibling,
      'the first tree at the pinned commit was taken even though a slice is running in it, and the clean ' +
        `sibling next door was never reached. Took: ${found.path} (${found.how})`,
    );
    assert.equal(found.clean, true, found.how);
  } finally {
    fixture.close();
  }
});

test('★★ a dirty tree is still an ANSWER when it is the only one — and it arrives saying what is on top of it', () => {
  const fixture = clone();
  try {
    fixture.dirty(fixture.main);
    const found = releaseTree(fixture.pinned, { FORGE_MONOREPO: fixture.main });
    // ⛔ NOT a refusal: a machine whose only checkout is being edited must still be able to grade, or every
    // guard in bin/ goes NOT CHECKED the moment somebody opens the monorepo next door.
    assert.equal(found.path, fixture.main, `the only tree at the pinned commit was refused: ${found.tried?.join('; ')}`);
    assert.equal(found.clean, false, found.how);
    assert.match(found.how, /uncommitted change/, `the sentence does not say the tree is not the release: ${found.how}`);
  } finally {
    fixture.close();
  }
});

test('★ no tree at the commit is NOT CHECKED material — the list of what was looked at, and why each was refused', () => {
  const fixture = clone();
  try {
    const nowhere = { ref: 'nowhere/none@0123456789abcdef0123456789abcdef01234567', sha: '0123456789abcdef0123456789abcdef01234567' };
    const found = releaseTree(nowhere, { FORGE_MONOREPO: fixture.main });
    assert.equal(found.path, undefined, 'a tree claimed to be at a commit no clone on this machine has');
    assert.ok(Array.isArray(found.tried) && found.tried.length > 0, 'it came back with no tree AND no reasons');
    assert.ok(
      found.tried.some((line) => line.startsWith(fixture.main)),
      `the fixture it was pointed at is not in the list of what was tried: ${found.tried.join('; ')}`,
    );
  } finally {
    fixture.close();
  }
});

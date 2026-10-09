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

import { BENCH_OVERRIDE, candidates, pinDiagnosis, releaseTree } from './release-tree.mjs';

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
  writeFileSync(join(main, 'packages', 'storefront-kit', 'package.json'), '{"name":"@forgeco/storefront-kit"}\n');
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
      candidates({ [BENCH_OVERRIDE]: fixture.main }).includes(fixture.main),
      'the first door of the search is no longer the bench override of the environment it was handed',
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
    const found = releaseTree(fixture.pinned, { [BENCH_OVERRIDE]: fixture.main });
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

    const found = releaseTree(fixture.pinned, { [BENCH_OVERRIDE]: fixture.main });
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
    const found = releaseTree(fixture.pinned, { [BENCH_OVERRIDE]: fixture.main });
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
    const found = releaseTree(nowhere, { [BENCH_OVERRIDE]: fixture.main });
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

// ── ★★★ THE TWO SENTENCES — "the product moved on" IS NOT "the installed kit is wrong" (pk42/s2) ──────────
//
// ⛔ THE DEFECT, MEASURED ON THIS TREE 2026-09-16. A machine with no tree at the pin got one sentence for
// both states — `… @ <other sha> — a different commit` — and 45 of 1187 tests reported NOT CHECKED behind
// it. 37 of those were the first state: the clone HELD the pinned commit and the product's branch was 34
// commits ahead of it, which is a lock that aged and not a kit that is wrong. The second state — no clone
// here holds the commit at all — is the one provenance was built for, and it may never be softened: a fork
// once ran 174 lines behind the release, green and silent.
//
// ⇒ neither state grades anything (both still say NOT CHECKED); what they may not do is read alike.

/** A clone whose branch has moved ON past the commit the lock pins — the state of every bench after a cut. */
function aged(commitsAfter) {
  const root = mkdtempSync(join(tmpdir(), 'forge-pin-aged-'));
  const main = join(root, 'main');
  mkdirSync(join(main, 'packages', 'storefront-kit'), { recursive: true });
  writeFileSync(join(main, 'packages', 'storefront-kit', 'package.json'), '{"name":"@forgeco/storefront-kit"}\n');
  git(main, 'init', '-q', '-b', 'release');
  git(main, 'add', '-A');
  git(main, 'commit', '-q', '-m', 'the release');
  const sha = git(main, 'rev-parse', 'HEAD');
  for (let i = 0; i < commitsAfter; i++) {
    writeFileSync(join(main, `after-${i}.txt`), 'the product moved on\n');
    git(main, 'add', '-A');
    git(main, 'commit', '-q', '-m', `after ${i}`);
  }
  return { main, pinned: { ref: `release@${sha}`, sha }, close: () => rmSync(root, { recursive: true, force: true }) };
}

test('★★★ the pin is an ANCESTOR of the tree next door — that is a LOCK THAT AGED, and it is counted', () => {
  const fixture = aged(3);
  try {
    const verdict = pinDiagnosis(fixture.pinned, { [BENCH_OVERRIDE]: fixture.main });
    assert.equal(
      verdict.kind,
      'lock-behind',
      `a clone holding the pin with its branch 3 commits past it was diagnosed ${verdict.kind}: ${verdict.sentence}`,
    );
    assert.equal(verdict.ahead, 3, `the distance is not counted: ${verdict.sentence}`);
    // ⛔ THE HALF THAT MATTERS: this sentence may not accuse the kit. The kit was never asked about.
    assert.match(verdict.sentence, /AHEAD/, verdict.sentence);
    assert.doesNotMatch(
      verdict.sentence,
      /NO CLONE ON THIS MACHINE HOLDS/,
      `an aged lock is being reported with the sentence reserved for a kit nothing can vouch for: ${verdict.sentence}`,
    );
  } finally {
    fixture.close();
  }
});

test('★★★ a commit NO clone holds is the grave one, and it says so in different words', () => {
  const fixture = aged(1);
  try {
    const nowhere = { ref: 'nowhere/none@0123456789abcdef0123456789abcdef01234567', sha: '0123456789abcdef0123456789abcdef01234567' };
    const verdict = pinDiagnosis(nowhere, { [BENCH_OVERRIDE]: fixture.main });
    assert.equal(verdict.kind, 'pin-unreachable', verdict.sentence);
    assert.match(verdict.sentence, /NO CLONE ON THIS MACHINE HOLDS/, verdict.sentence);
    // ⚠️ AND THE TWO ARE NOT THE SAME STRING — the whole slice is that a reader can tell them apart.
    const agedVerdict = pinDiagnosis(fixture.pinned, { [BENCH_OVERRIDE]: fixture.main });
    assert.notEqual(agedVerdict.sentence, verdict.sentence, 'the two states still produce one sentence');
    assert.notEqual(agedVerdict.kind, verdict.kind);
  } finally {
    fixture.close();
  }
});

test('★★ the verdict rides the list every caller already prints — no call site had to be edited', () => {
  const fixture = aged(2);
  try {
    const found = releaseTree(fixture.pinned, { [BENCH_OVERRIDE]: fixture.main });
    // The fixture's HEAD is 2 commits past the pin, so there is no tree at it — the shape this is about.
    assert.equal(found.path, undefined, `a tree at the pin was claimed: ${found.path}`);
    assert.equal(found.diagnosis?.kind, 'lock-behind', JSON.stringify(found.diagnosis));
    assert.equal(
      found.tried.at(-1),
      found.diagnosis.sentence,
      'the diagnosis is not the last line of `tried`, so the fourteen guards that print that list in a loop ' +
        'never show it and this slice reaches nobody',
    );
    // ⛔ THE CONTRACT THE OTHER FILES ASSERT: every line of `tried` says where it looked and why it was refused.
    for (const line of found.tried) assert.match(line, /—/, `"${line}" carries no reason`);
  } finally {
    fixture.close();
  }
});

// ── ★★ v032/C — A LOCK THAT PINS A RELEASE, AND THE TREE CUT OUT OF ITS OVEN ────────────────────────────────
//
// From v0.3.2 `forge.lock` pins a TAG and the tree comes out of that release's oven (`ovenTree`, docker). What
// is held here without docker: the bench override accepts a CUT only when the cut says it is the pinned
// release (its `.forge-release-tree.json`), a cut of another release is refused naming both, and a file read
// of a DIRECTORY answers in the `git show <rev>:<dir>` shape `bin/app-manifest.mjs#templatesOf` parses.

/** A fake cut: the mark `ovenTree` writes, plus one template directory and one file. */
function fakeCut(release) {
  const dir = mkdtempSync(join(tmpdir(), 'release-cut-'));
  writeFileSync(join(dir, '.forge-release-tree.json'), JSON.stringify({ release, oven: 'fixture', image: 'sha256:fixture' }));
  mkdirSync(join(dir, 'apps', 'probe', 'src', 'templates', 'home'), { recursive: true });
  writeFileSync(join(dir, 'apps', 'probe', 'src', 'templates', 'registry.ts'), '// fixture\n');
  return dir;
}
/** An environment whose oven cannot answer, so only the override can: no image by this name exists. */
const noOven = (override) => ({ [BENCH_OVERRIDE]: override, FORGE_OVEN_IMAGE: 'v032-c-no-such-oven:none' });
const release = (tag) => ({ ref: tag, sha: tag, release: tag });

test('★★ a cut of the PINNED release under the bench override is the tree, and says how it was found', () => {
  const cut = fakeCut('v9.9.9');
  try {
    const found = releaseTree(release('v9.9.9'), noOven(cut));
    assert.equal(found.path, cut, `the cut was not taken: ${JSON.stringify(found.tried)}`);
    assert.match(found.how, /a cut of the v9\.9\.9 oven/);
  } finally {
    rmSync(cut, { recursive: true, force: true });
  }
});

test('★★★ SABOTAGE — a cut of ANOTHER release is refused, naming both, and the verdict is the release one', () => {
  const cut = fakeCut('v9.9.8');
  try {
    const found = releaseTree(release('v9.9.9'), noOven(cut));
    assert.equal(found.path, undefined, `a cut of v9.9.8 was graded as v9.9.9`);
    assert.ok(found.tried.some((line) => /a cut of the v9\.9\.8 oven, not of v9\.9\.9/.test(line)), found.tried.join('\n'));
    assert.equal(found.diagnosis.kind, 'release-unreachable');
  } finally {
    rmSync(cut, { recursive: true, force: true });
  }
});

test('★ a directory read from the release answers in the `git show <rev>:<dir>` shape', async () => {
  const cut = fakeCut('v9.9.9');
  const before = process.env[BENCH_OVERRIDE];
  const oven = process.env.FORGE_OVEN_IMAGE;
  process.env[BENCH_OVERRIDE] = cut;
  process.env.FORGE_OVEN_IMAGE = 'v032-c-no-such-oven:none';
  try {
    const { fileAtPinned } = await import('./release-tree.mjs');
    const found = fileAtPinned(release('v9.9.9'), 'apps/probe/src/templates');
    assert.ok(found.text, JSON.stringify(found.tried));
    const lines = found.text.split('\n');
    assert.equal(lines[0], 'tree v9.9.9:apps/probe/src/templates');
    assert.equal(lines[1], '');
    assert.ok(lines.includes('home/'), 'a directory is not listed with its trailing slash');
    assert.ok(lines.includes('registry.ts'), 'a file is not listed');
  } finally {
    if (before === undefined) delete process.env[BENCH_OVERRIDE];
    else process.env[BENCH_OVERRIDE] = before;
    if (oven === undefined) delete process.env.FORGE_OVEN_IMAGE;
    else process.env.FORGE_OVEN_IMAGE = oven;
    rmSync(cut, { recursive: true, force: true });
  }
});

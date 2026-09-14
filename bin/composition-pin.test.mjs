// ★★ pk35/D6 — THE COMPOSITION GUARD GRADES AGAINST THE RELEASE THESE IMAGES WERE BAKED FROM, OR IT SAYS IT
// CANNOT. It is not allowed to grade against whatever Forge tree was lying around.
//
// ⛔ THE DEFECT, MEASURED 2026-09-14 ON THIS BRANCH, BEFORE THE FIX. `bin/composition.guard.mjs` accepted the
// FIRST directory holding `extensions/composition.base.json` — `FORGE_MONOREPO` or one of three hard-coded
// neighbours — and never asked which COMMIT it was. Pointed at `wt-v03/d2-onda1` (pk3/integra, hundreds of
// commits behind the pinned `v03/integra@e8fc602d4`) it reported, confidently and in the guard's own words:
//
//     ✖ this box composes only apps the release CARRIES, and only platform ones
//         [ 'content — the release carries no such app (rule `not-carried`)' ]
//     ✖ ★ the monorepo mirror is this list, in this order
//
// All three accusations are FALSE about the box: at the pinned commit `extensions/content` exists and
// `infra/fleet/lists/demo-instance.json` matches `composition.json` entry for entry. The guard was reading a
// different release and blaming this repository for the difference — the species this house catalogues, a
// signal that does not know it cannot know, in its worst form: it tells a human to fix what is not broken.
//
// ★ THE SIBLING ALREADY DID THIS RIGHT. `bin/instance-app.guard.mjs` and `bin/app-blocks.guard.mjs` resolve
// the tree through `releaseTree(pinnedCommit())` and say NOT CHECKED, by name, when the machine cannot reach
// it. This file holds that property for the composition guard by RUNNING it — against an impostor tree that
// the old resolution would have accepted, and against the pinned one.
//
//   node --test bin/composition-pin.test.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { pinnedCommit, releaseTree } from './release-tree.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'composition.guard.mjs');
const PINNED = pinnedCommit();

/**
 * The environment a child gets when it is pointed at `forge` — built here, so that the question "which tree
 * will that child find?" can be asked from this process with the same answer.
 *
 * ⛔ THE DEFECT THIS SHAPE ENDS, measured 2026-09-14. This file used to point the child at a fixture and then
 * resolve the expected tree out of ITS OWN `process.env`. With `FORGE_MONOREPO` exported in the shell the two
 * disagreed by construction: the parent saw the release, the child — whose `FORGE_MONOREPO` is the fixture —
 * correctly said NOT CHECKED, and the test called that a failure of the guard. A test whose verdict depends on
 * which variables the caller happened to export is measuring the shell.
 */
const childEnv = (forge) => {
  const env = { ...process.env, FORGE_MONOREPO: forge };
  delete env.NODE_TEST_CONTEXT;
  return env;
};

/**
 * Run the composition guard with `FORGE_MONOREPO` pointed somewhere, and hand back everything it said.
 *
 * ⚠️ `node <file>` AND NOT `node --test <file>`: a `node:test` file executed from inside a `node --test` run
 * answers `run() is being called recursively within a test file. skipping running files.` and grades NOTHING
 * while exiting 0 — a green that means the subject never ran. Standalone execution prints the same tests and
 * the same `ℹ pass/fail/skipped` summary, and `NODE_TEST_CONTEXT` is dropped so the child does not inherit
 * this run's reporter either.
 */
async function guard(forge) {
  const options = { env: childEnv(forge), cwd: join(HERE, '..'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 };
  try {
    const { stdout, stderr } = await run(process.execPath, [GUARD], options);
    return { code: 0, out: stdout + stderr };
  } catch (error) {
    return { code: error.code ?? 1, out: (error.stdout ?? '') + (error.stderr ?? '') };
  }
}

/** A count off the run's own summary, or -1 when the summary is not there — which is never a pass. */
const tally = (out, word) => Number(new RegExp(`^ℹ ${word} (\\d+)$`, 'm').exec(out)?.[1] ?? -1);

/**
 * ★ A TREE THAT IS A FORGE CHECKOUT BY EVERY TEST THE GUARD IS ALLOWED TO APPLY EXCEPT THE COMMIT.
 *
 * It carries `packages/storefront-kit/package.json` (what `checkout()` looks for), an
 * `extensions/composition.base.json` (what the OLD resolution looked for) and a git history of its own, so
 * the only thing wrong with it is that its HEAD is not the pinned sha. Anything the guard says about this
 * directory other than "that is not the release" is an accusation about the wrong tree.
 */
function impostor() {
  const dir = mkdtempSync(join(tmpdir(), 'forge-impostor-'));
  mkdirSync(join(dir, 'packages', 'storefront-kit'), { recursive: true });
  writeFileSync(join(dir, 'packages', 'storefront-kit', 'package.json'), '{"name":"@forgecommerce/storefront-kit"}');
  mkdirSync(join(dir, 'extensions', 'nothing-this-box-composes'), { recursive: true });
  writeFileSync(
    join(dir, 'extensions', 'nothing-this-box-composes', 'package.json'),
    '{"name":"@forgecommerce/ext-nothing-this-box-composes","forge":{"origin":"platform"}}',
  );
  writeFileSync(
    join(dir, 'extensions', 'composition.base.json'),
    JSON.stringify({ apps: [{ id: 'nothing-this-box-composes', package: '@forgecommerce/ext-nothing-this-box-composes' }] }),
  );
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'impostor');
  git('-c', 'user.email=a@b.c', '-c', 'user.name=impostor', 'commit', '-q', '--allow-empty', '-m', 'not the release');
  return { dir, close: () => rmSync(dir, { recursive: true, force: true }) };
}

test('★★★ a tree that is NOT the pinned release is never the tree this box is graded against', async () => {
  assert.ok(PINNED, 'forge.lock no longer pins a branch@sha, so this whole file is about a world that is gone');
  const fake = impostor();
  try {
    // ⛔ ANTI-VACUUM ON THE FIXTURE ITSELF: if the impostor were not a plausible Forge tree, a guard that
    // refused it would be proving nothing. `extensions/composition.base.json` is the ONE file the old
    // resolution asked for, and this directory has it — with an app on it that this box does not compose, so
    // a guard that read it would be loud about it.
    assert.ok(existsSync(join(fake.dir, 'extensions', 'composition.base.json')));

    const { code, out } = await guard(fake.dir);
    assert.equal(tally(out, 'fail'), 0, `the guard accused this box while reading the wrong tree:\n${out}`);
    assert.equal(code, 0, out);
    // ★ THE PROPERTY, and it is stated over the guard's OWN sentence about where it looked. `grading
    // against: <the impostor>` is the defect; anything else is the fix.
    assert.ok(
      !out.includes(`grading against: ${fake.dir}`),
      `the guard graded this box against a tree that is not ${PINNED.ref}:\n${out}`,
    );
    // And the accusations that used to come out of exactly that, named so this test dies with the defect
    // rather than outliving it.
    assert.ok(!out.includes('not-carried'), `still accusing \`not-carried\` off a foreign tree:\n${out}`);
    assert.ok(!out.includes('nothing-this-box-composes'), `the impostor's app reached a verdict:\n${out}`);

    // ⚠️ WHICH OF THE TWO HONEST ANSWERS THIS MACHINE GIVES DEPENDS ON THIS MACHINE, so both are spelled out
    // rather than one being assumed: a developer who also has the release gets it graded (the impostor is
    // skipped past), and a developer who does not gets NOT CHECKED with the pin named. The failure mode this
    // file exists for — a verdict off the impostor — is refused above in both.
    //
    // ★ ASKED IN THE CHILD'S ENVIRONMENT, NEVER IN THIS ONE — see `childEnv`. The child's `FORGE_MONOREPO` is
    // the impostor, so the only release it can reach is one of the neighbouring layouts; resolving that from
    // this process's own variables would demand of the child a tree the child was never told about.
    const here = releaseTree(PINNED, childEnv(fake.dir));
    if (here.path) {
      assert.ok(
        out.includes(`grading against: ${here.path}`),
        `this machine holds ${PINNED.ref} at ${here.path} and the guard did not use it:\n${out}`,
      );
      assert.equal(tally(out, 'skipped'), 0, out);
    } else {
      assert.match(out, /NOT CHECKED/, out);
      assert.ok(out.includes(PINNED.ref), `the warning does not name the pinned release:\n${out}`);
      assert.ok(out.includes(fake.dir), `the warning does not say which tree it looked at and rejected:\n${out}`);
      assert.ok(tally(out, 'skipped') > 0, `nothing was reported NOT CHECKED:\n${out}`);
    }
    // ⛔ ANTI-VACUUM ON THE RUN: a child that graded nothing at all would satisfy every line above. The rules
    // that need nothing but this repository must have run either way.
    assert.ok(tally(out, 'pass') > 0, `nothing ran at all:\n${out}`);
  } finally {
    fake.close();
  }
});

test('★★ the warning the no-tree machine gets NAMES the pin and what was looked at', () => {
  // ⛔ THE HALF A MACHINE THAT HOLDS THE RELEASE CANNOT DEMONSTRATE, held on the resolver the guard's message
  // is built out of. `releaseTree` is asked for a commit no clone can have, which is the state of any machine
  // without this release: it must come back with the LIST of what it tried — that list is the whole content
  // of the guard's `NOT CHECKED`, and a skip that cannot say what would fix it is the silence bin/test.sh's
  // strict mode refuses.
  const nowhere = { ref: 'nowhere/none@0123456789abcdef0123456789abcdef01234567', sha: '0123456789abcdef0123456789abcdef01234567' };
  const answer = releaseTree(nowhere);
  assert.equal(answer.path, undefined, `a clone on this machine claims to be at ${nowhere.sha}`);
  assert.ok(Array.isArray(answer.tried) && answer.tried.length > 0, 'it came back with no tree AND no reasons');
  for (const line of answer.tried) assert.match(line, /—/, `"${line}" says where it looked and not why it was refused`);
});

test('★★ pointed at the pinned release, the guard GRADES — no skip, no failure', async (t) => {
  const tree = PINNED ? releaseTree(PINNED) : { tried: ['forge.lock pins no branch@sha'] };
  if (!tree.path) {
    t.skip(`NOT CHECKED — no Forge checkout at ${PINNED?.ref} on this machine: ${tree.tried.join('; ')}`);
    return;
  }
  const { code, out } = await guard(tree.path);
  assert.equal(tally(out, 'skipped'), 0, `the pinned tree is right here and the guard still refused to grade:\n${out}`);
  assert.equal(tally(out, 'fail'), 0, out);
  assert.equal(code, 0, out);
  assert.ok(tally(out, 'pass') > 0, out);
});

// ★★ AN APP OF THIS BOX DOES NOT REACH THE OVEN WITHOUT HAVING BEEN COMPILED AND TESTED — the loop nobody
// had, on the only code in this repository that runs INSIDE the kernel.
//
// Measured on 2026-09-08, on this branch, before this guard existed. `apps/payment-pos` and `apps/demo-gate`
// carry five vitest files between them, and the answer to "who runs them" was NOBODY:
//
//     bash bin/test.sh              `find bin seed …` (bin/test.sh:33) — apps/ is not in it
//     bin/fork-suite.guard.mjs      iterates forks('test'), and a fork is a directory that depends on the
//     bin/fork-typecheck.guard.mjs  storefront kit (bin/forks.mjs:39). Neither app does; both are invisible.
//     bin/pack-apps.sh              packs the artifact. It never compiles and never tests.
//     bin/build-local.sh            copies the app into the oven's context. Same.
//     the repository                has no CI — no .github/, no pipeline of any kind.
//
// ⇒ an app of this instance could be written, committed, packed into `extensions/`, baked into an image and
// served to a buyer without a compiler or a runner ever having read it. And this app class is not decoration:
// `payment-pos` is a payment DRIVER and the block that tells a buyer who charged them — which has already been
// wrong once on this bench (see `bin/pos-after-payment.guard.mjs`).
//
// ── AND THE FIRST RUN FOUND THAT NEITHER APP COULD EVEN BE LOADED, FOR TWO SEPARATE REASONS ──────────────
//
// Both are the same sentence — A CONFIG POINTING AT A FILE OF THE OTHER REPOSITORY — and both were invisible
// for exactly as long as nothing tried:
//
//   · `apps/*/tsconfig.json` extends `../../tsconfig.base.json`, which is a file of the Forge MONOREPO. There
//     was none here, so `tsc` could not start AND the RUNNER could not either — vitest reads the tsconfig to
//     transform TypeScript, and answered `[TSCONFIG_ERROR] Failed to load tsconfig for 'manifest.test.ts':
//     Tsconfig not found`, 2 files failed, 0 tests. The app only compiled after being COPIED into the
//     monorepo as `.instance-apps/<id>/`, where the same relative path lands on a file that exists.
//   · `apps/demo-gate/vitest.config.ts` imported `TIMEOUTS` from `../../vitest.shared` — same shape, same
//     repository confusion: `Module not found`, and the config never loaded at all.
//
// This guard fixes neither by hand: it holds the property (rule 2 below) so a third app cannot arrive with a
// third pointer into a repository it does not live in.
//
// ── WHY IT LIVES IN `bin/test.sh` AND NOT IN THE BAKE, WHICH WAS THE OTHER CANDIDATE ─────────────────────
//
// `bin/build-local.sh` was the honest alternative — it already receives the Forge checkout as `$1` and it is
// the step that copies these apps into the oven's context (bin/build-local.sh:120-133), so a gate there would
// make "no untested app reaches the oven" true by construction. It is not where this went, for two measured
// reasons: the bake takes minutes and is run rarely, so a defect found there is a defect found LATE — the
// same trade `bin/fork-typecheck.guard.mjs` already decided (3.5 s of tsc against ~4 min of oven); and this
// repository has written down what a second command costs — "A guard nobody knows how to invoke is
// decoration" (bin/test.sh:2). ⇒ the loop everybody already runs. Rule 6 keeps the bake honest from here: the
// set the oven will copy is asserted to BE the set this file just compiled and ran.
//
// ── ⚠️ IT INSTALLS THE APPS ITSELF, AND THAT IS A DECISION ───────────────────────────────────────────────
//
// The sibling guards say NOT CHECKED when a fork has no `node_modules`, because installing a fork is `npm
// install` against vendored tarballs — seconds of work, network-shaped, with a lockfile of its own to respect.
// An instance app has none of that: its manifest speaks `catalog:` and `workspace:*`, protocols only pnpm
// understands inside a workspace this app is not in (see bin/instance-apps.mjs), so there is no install to
// respect and nothing to be stale. What it needs is exactly what the OVEN gives it — "links its dependencies
// from what the image already carries" (bin/build-local.sh:115) — and doing the same here is a symlink farm
// into a Forge checkout, measured at 1 and 5 ms for the two apps, into a `node_modules/` git ignores and
// `bin/build-local.sh` excludes from the copy. A step a human must remember before the loop is a step that
// gets skipped, which is the whole reason these suites had never run.
//
// ⚠️ AND A SKIP IS AN ANSWER, A GREEN IS NOT — the posture is copied from the fork guards on purpose:
//   1. a Forge checkout with a BUILT contracts package → everything below RUNS.
//   2. no such checkout                                → NOT CHECKED, with the reason and what would fix it.
//   3. a checkout that cannot lend some package an app declares → NOT CHECKED for that app, BY NAME. Never a
//      run against a smaller program than the one the oven ships.
// The tree is preferred pinned and said out loud when it is not — see `lendingTree()` for why that differs
// from the kit comparison next door.
//
//   node --test bin/instance-app.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/instance-app.guard.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import test from 'node:test';
import {
  declaredDependencies,
  instanceApps,
  lendingTree,
  linkDependencies,
  toolFromTree,
} from './instance-apps.mjs';
import { pinnedCommit, readJson, releaseTree, ROOT } from './release-tree.mjs';

const say = (line) => console.error(`[instance-app] ${line}`);

/** Both rules below need the app to be RUNNABLE, so the list is asked for once with the script that proves
 *  it. An app that drops `test` disappears from here — which rule 6 turns into an accusation rather than a
 *  silence, by comparing this list to the one the oven is going to bake. */
const APPS = instanceApps('test');
const TREE = lendingTree();
const PINNED = pinnedCommit();

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

say(`apps of this instance: ${APPS.map((a) => a.dir).join(', ') || 'none'}`);
say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (TREE.path) {
  say(`linking from: ${TREE.path} (${TREE.how})`);
  if (!TREE.pinned) {
    say('   ⚠️ a green below means "this app agrees with THAT tree", not "with the tree these images carry".');
  }
} else {
  say('⚠️ NOT CHECKED — no Forge checkout with a built @forgecommerce/contracts on this machine.');
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say('   set FORGE_MONOREPO=<a Forge checkout> and run `pnpm build` there.');
}

/** app.dir → the packages it declares that the tree could not lend. Empty is the only state that runs. */
const incomplete = new Map();
if (TREE.path) {
  for (const app of APPS) {
    const { linked, missing } = linkDependencies(TREE.path, app);
    if (missing.length > 0) incomplete.set(app.dir, missing);
    say(
      `${app.dir}: ${linked.length}/${declaredDependencies(app).length} declared package(s) linked` +
        (missing.length > 0 ? ` — ⚠️ ${missing.join('; ')}` : ''),
    );
  }
}

/** The reason this app cannot be judged right now, or null. */
function notChecked(app) {
  if (!TREE.path) {
    return (
      'NOT CHECKED — no Forge checkout with a built @forgecommerce/contracts ' +
      '(set FORGE_MONOREPO, then `pnpm build` there)'
    );
  }
  const missing = incomplete.get(app.dir);
  if (missing) return `NOT CHECKED — ${TREE.path} cannot lend: ${missing.join('; ')}`;
  return null;
}

/** Run one of the checkout's binaries from the app's own directory. `execFileSync` throws on a non-zero exit
 *  and ONLY THEN carries `stdout`/`stderr`, so both are asked for in both branches. */
function run(app, bin, args) {
  const tool = toolFromTree(TREE.path, bin);
  if (!tool) return { ok: false, absent: true, output: `${TREE.path} has no node_modules/.bin/${bin}` };
  try {
    const stdout = execFileSync(tool, args, {
      cwd: app.path,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // A suite is minutes-shaped in the worst case; the ceiling is here to catch a HANG, not slowness.
      timeout: 15 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, output: stdout };
  } catch (error) {
    return { ok: false, output: (error.stdout ?? '') + (error.stderr ?? '') };
  }
}

// ── the rules ───────────────────────────────────────────────────────────────────────────────────────────

test('this repository owns at least one app of its own', () => {
  // ⚠️ THE PREMISE, AND IT IS A RULE RATHER THAN AN ASSUMPTION because this repository has already paid for
  // the other shape: taking the only specimen of a species away killed the guards that spoke for it, and they
  // went GREEN doing it. Every rule below is written `for (const app of APPS)`, so an empty list passes them
  // all by having no subject. Here the emptiness is the failure.
  assert.ok(
    APPS.length > 0,
    `no directory under apps/ declares \`forge.origin: "instance"\` and a \`test\` script. Either this box ` +
      `stopped writing its own apps — in which case this guard and bin/pack-apps.sh have no subject — or an ` +
      `app lost the declaration the OVEN reads to adopt it (bin/build-local.sh:114), and is about to be ` +
      `refused by the bake instead of by this line.`,
  );
});

test('★★ every instance app extends a tsconfig THIS repository has', () => {
  // The defect that made every other rule impossible, held as a property instead of fixed once. It is derived
  // from what each app's own config SAYS rather than from a filename: a base outside this repository is one
  // that resolves only after the app has been copied somewhere else, and "it compiles in the oven" is exactly
  // the state this fatia exists to end.
  const broken = [];
  for (const app of APPS) {
    const configPath = join(app.path, 'tsconfig.json');
    if (!existsSync(configPath)) {
      broken.push(`${app.dir}: no tsconfig.json, so nothing can typecheck it`);
      continue;
    }
    const extend = readJson(configPath).extends;
    if (typeof extend !== 'string') continue;
    // Only a relative path can point out of the tree; a bare specifier is a package and npm's problem.
    if (!extend.startsWith('.')) continue;
    const base = resolve(app.path, extend);
    const inside = relative(ROOT, base);
    if (inside.startsWith('..') || isAbsolute(inside)) {
      broken.push(`${app.dir}/tsconfig.json extends ${extend} → ${base}, which is outside this repository`);
    } else if (!existsSync(base)) {
      broken.push(`${app.dir}/tsconfig.json extends ${extend} → ${inside}, which does not exist here`);
    }
  }
  assert.deepEqual(
    broken,
    [],
    `an app of this box cannot be compiled where it lives:\n  ${broken.join('\n  ')}\n\nA tsconfig that ` +
      `resolves only inside the Forge monorepo means the app is checked by the oven or by nobody.`,
  );
});

test('the tsconfig base this repository carries IS the one the pinned release carries', (t) => {
  // Without this the rule above is satisfied by ANY file with the right name, and an app of this box would
  // compile under options the kernel that loads it was never built with. It is the same sentence
  // `bin/fork-typecheck.guard.mjs` holds for the kit, and it is a SEPARATE rule for the same reason: the
  // comparison needs the pinned tree, and the compilation does not.
  if (!PINNED) {
    t.skip('NOT CHECKED — forge.lock no longer names a branch@sha, so there is no tree to compare with');
    return;
  }
  const pinnedTree = releaseTree(PINNED);
  if (!pinnedTree.path) {
    t.skip(`NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine (set FORGE_MONOREPO)`);
    return;
  }
  const bases = new Set();
  for (const app of APPS) {
    const configPath = join(app.path, 'tsconfig.json');
    if (!existsSync(configPath)) continue;
    const extend = readJson(configPath).extends;
    if (typeof extend === 'string' && extend.startsWith('.')) {
      bases.add(relative(ROOT, resolve(app.path, extend)));
    }
  }
  assert.ok(bases.size > 0, 'no instance app extends a tsconfig of this repo — this rule lost its subject');
  for (const base of [...bases].sort()) {
    const theirs = join(pinnedTree.path, base);
    assert.ok(existsSync(theirs), `${base} has no counterpart at ${PINNED.ref} — this copy answers to nothing`);
    assert.ok(
      readFileSync(join(ROOT, base)).equals(readFileSync(theirs)),
      `${base} differs from the one ${PINNED.ref} carries. This box's apps are compiled by the kernel of ` +
        `that release: \`cp ${theirs} ${base}\`.`,
    );
    say(`${base} is byte-identical to ${PINNED.ref}`);
  }
});

for (const app of APPS) {
  test(`★★ ${app.dir} COMPILES where it lives`, (t) => {
    // `--incremental false` on purpose: a `tsconfig.tsbuildinfo` written before the contracts moved is exactly
    // the stale artifact that has already produced false greens on this bench.
    const skip = notChecked(app);
    if (skip) {
      t.skip(skip);
      return;
    }
    const result = run(app, 'tsc', ['--noEmit', '--incremental', 'false', '--pretty', 'false']);
    if (result.absent) {
      t.skip(`NOT CHECKED — ${result.output}`);
      return;
    }
    assert.ok(
      result.ok,
      `${app.dir} does not compile. It is loaded by the kernel, so this used to wait for a \`docker build\` ` +
        `— or for a buyer:\n\n${result.output}`,
    );
  });

  test(`★★ ${app.dir} has tests for its runner to COLLECT`, (t) => {
    // ⚠️ THE RULE AGAINST THE VACUUM, separate from the run below for the reason `bin/fork-suite.guard.mjs`
    // measured and wrote down: an exit code cannot carry the vacuum — `vitest list` exits 0 on nothing, and
    // `vitest run` stops failing on nothing the day anybody sets `passWithNoTests` for an unrelated reason.
    // What is asserted is the COUNT of files the app's OWN config collected, which no flag turns into a pass.
    const skip = notChecked(app);
    if (skip) {
      t.skip(skip);
      return;
    }
    const listed = run(app, 'vitest', ['list', '--filesOnly']);
    if (listed.absent) {
      t.skip(`NOT CHECKED — ${listed.output}`);
      return;
    }
    const files = listed.output.split('\n').filter((line) => /\.test\.[cm]?[jt]sx?$/.test(line.trim()));
    assert.ok(
      files.length > 0,
      `${app.dir} declares a \`test\` script and its runner collected NO test file. A suite that is not ` +
        `there cannot be green — this is the vacuum, not a pass.\n\n${listed.output}`,
    );
    // NAMED, not counted: `bash bin/test.sh` hands 50-odd files to `node --test`, and a suite that lives in
    // another tree has to say which files it ran, or the next person greps bin/ for a test that is not there.
    say(`${app.dir}: ${files.length} test file(s) collected — ${files.map((f) => f.trim()).sort().join(', ')}`);
  });

  test(`★★ ${app.dir}'s OWN suite passes`, (t) => {
    const skip = notChecked(app);
    if (skip) {
      t.skip(skip);
      return;
    }
    const result = run(app, 'vitest', ['run']);
    if (result.absent) {
      t.skip(`NOT CHECKED — ${result.output}`);
      return;
    }
    assert.ok(
      result.ok,
      `${app.dir}'s own vitest suite is RED. It lives in ${app.dir}, not in bin/ — reproduce with ` +
        `\`node --test bin/instance-app.guard.mjs\`.\n\n${result.output}`,
    );
    // The count is SAID rather than asserted: a number in a green run is what makes "these tests ran" a fact
    // a reader can check, and pinning it would fail every time somebody writes one more test.
    const tally = result.output.match(/Tests\s+(\d+ passed.*)$/m)?.[1];
    say(`${app.dir}: ${tally ?? 'suite green, and vitest printed no tally'}`);
  });
}

test('★★ every app the OVEN will bake is one this file just compiled and ran', () => {
  // ★ THE RULE THAT ANSWERS THE QUESTION THIS GUARD OPENED, and the reason the loop above is allowed to be
  // derived. `composition.json`'s `instanceApps` is what `bin/build-local.sh` copies into `.instance-apps/`
  // and hands to the oven; `APPS` is what declared itself testable. The two lists are derived from different
  // facts in different files, so they can disagree — and each direction of disagreement is a real defect:
  //
  //   · in the oven's list, not here  → an app is about to be baked into the kernel without a compiler or a
  //     runner having read it. That is the exact state this fatia found and closed.
  //   · here, not in the oven's list  → an app of this box that no image carries: either dead code, or the
  //     composition entry somebody forgot, which the bake will never tell them.
  const composed = readJson(join(ROOT, 'composition.json')).instanceApps ?? [];
  const oven = composed.map((entry) => relative(ROOT, resolve(ROOT, entry.source))).sort();
  const checked = APPS.map((app) => app.dir).sort();
  assert.deepEqual(
    oven.filter((dir) => !checked.includes(dir)),
    [],
    `composition.json puts an app in the oven that this guard cannot check. It must declare ` +
      `\`forge.origin: "instance"\` (which the bake also requires, bin/build-local.sh:114) and a \`test\` ` +
      `script.\n  oven: ${oven.join(', ')}\n  checked: ${checked.join(', ')}`,
  );
  assert.deepEqual(
    checked.filter((dir) => !oven.includes(dir)),
    [],
    `this repository owns an app that composition.json does not compose, so no image carries it.\n  ` +
      `oven: ${oven.join(', ')}\n  checked: ${checked.join(', ')}`,
  );
  say(`the oven's list and the checked list agree: ${checked.join(', ')}`);
});

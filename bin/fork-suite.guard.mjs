// ★★ THE FORK'S OWN SUITE IS RUN BY SOMEBODY — and that somebody is this file, reached by `bash bin/test.sh`.
//
// `storefront-coffee/` and `totem/` each carry a vitest suite of their own: 774 and 171 tests on the day this
// was written. Measured on 2026-09-05, on this branch, before this guard existed:
//
//     bash bin/test.sh          runs bin/ and seed/ only — `find bin seed …` (bin/test.sh:18)
//     bin/build-coffee.sh       vendors, installs, `npm run build`, `docker build` — no `npm test`
//     bin/build-totem.sh        same shape, same absence
//     storefront-coffee/Dockerfile   copies `.next/standalone`; the image never runs a test
//     the repository            has no CI — no .github/, no pipeline of any kind
//
// ⇒ the only thing that reached the forks was `tsc`, through `bin/fork-typecheck.guard.mjs`. 945 tests were
// written, committed, and executed by nobody. `bin/install-storefront.sh` even ends by printing "Next:
// `npm test`" — a sentence, not a loop.
//
// ★ AND THE FIRST RUN PROVED THE POINT, WHICH IS WHY THIS IS NOT HYGIENE. Pointed at the coffee fork for the
// first time, the suite came back RED: 10 tests in 2 files, both of them fixtures left behind by fixes that
// travelled into the fork's SOURCE and stopped there —
//
//   · src/app/api/my-prices/route.test.ts — pk6/M5 made the store part of the overlay's call
//     (`resolveRequestStore`, route.ts:70). The route learned it in the oven; its test never did, so four
//     assertions were reading a 204 the route now returns for a request no store claims.
//   · src/app/s/[store]/gate-slot.test.tsx — P4 put `requireStore` in the store layout (layout.tsx:53) and
//     pk12/D2 dragged it to this fork. The test mocks the kit's `config`, not `require-store.server`, so all
//     six of its cases rendered a 404 instead of a page.
//
// Both were invisible for as long as nobody ran them, and both are the same sentence: A FORK INHERITS THE
// CODE AND NOT THE RULE. `bin/fork-typecheck.guard.mjs` gave it the compiler; this gives it the suite.
//
// ── WHY IT LIVES IN `bin/test.sh` AND NOT IN A `bin/test-forks.sh` OF ITS OWN ────────────────────────────
//
// Because a second command is a second thing to remember, and this repository already wrote down what that
// costs: "A guard nobody knows how to invoke is decoration" (bin/test.sh:2). The forks got into this state
// precisely by being a step somebody had to choose.
//
// ★ AND THE PRICE IS WORK, NOT WALL CLOCK. The durable number is what the two suites cost on their own:
//
//     storefront-coffee   `npm test`   ~4.0 s   (125 files, 774 tests)
//     totem               `npm test`   ~1.2 s   ( 18 files, 171 tests)
//     node --test bin/fork-suite.guard.mjs, both plus two collections   5.57 · 6.59 s
//
// Inside `bin/test.sh` that is very nearly free, because the script hands 44 files to `node --test`, which
// already runs them in parallel: with the machine quiet, three samples each, the only change being whether
// this file exists — 8.16 · 8.17 · 8.13 s without, 8.16 · 8.17 · 9.19 s with. The work still happened (user
// time over the run went 8.2 s → 104 s); it went into cores that were idle.
//
// ⚠️ DO NOT READ "≈ FREE" AS A PROPERTY OF THE GUARD. Repeating the same pairs later the same night, with
// eight agents on this box and a load average of 153, gave 12.9/9.7, 8.3/38.0, 33.9/31.7, 10.0/10.4 — noise
// that swamps the signal in BOTH directions. On a saturated or one-core runner the honest figure is the 5.6 s
// above, which is still nowhere near the 3x the brief warned would be a decision rather than a detail. And
// it is the old 8.1 s again for anybody who has not installed the forks, because an absent `node_modules` is
// answered with NOT CHECKED rather than with a run.
//
// The BUILD scripts still do not run it, deliberately: `bin/build-coffee.sh` produces an artifact and a
// suite is not part of producing one, `next build` already carries the typecheck, and a build that runs
// jsdom is a build that fails for reasons the image cannot show.
//
// ⚠️ AND A SKIP IS AN ANSWER, A GREEN IS NOT — the posture is copied from `fork-typecheck.guard.mjs` on
// purpose. A suite that could not run is not a suite that passed, so a fork with no `node_modules` is said
// out loud, with the command that would fix it, and never quietly counted as fine.
//
//   node --test bin/fork-suite.guard.mjs          (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { forks, KIT } from './forks.mjs';

const say = (line) => console.error(`[fork-suite] ${line}`);

/** A fork of this repository is one that installs the kit; one with a SUITE is one that also declares how to
 *  run it. The `test` script is the fork's own answer to "how", so this guard drives it rather than inventing
 *  a vitest invocation of its own — a fork that switches runners tomorrow is still covered. */
const FORKS = forks('test');

/** The runner the fork installed, or null. Never the host's or a hoisted one: the version that matters is the
 *  one the fork's own lockfile pinned, because that is what its config was written against. */
const runner = (fork) => {
  const bin = join(fork.path, 'node_modules', '.bin', 'vitest');
  return existsSync(bin) ? bin : null;
};

const NOT_INSTALLED = (fork) =>
  `NOT CHECKED — ${fork.dir} has no vitest on disk. \`bash bin/vendor-packages.sh <forge checkout> ` +
  `${fork.dir}\` then \`bash bin/install-storefront.sh ${fork.dir}\`.`;

/** Run the fork's own runner, from the fork's own directory, and hand back what a failure would need to be
 *  read. `execFileSync` throws on a non-zero exit and ONLY THEN carries `stdout`/`stderr`, so both are asked
 *  for in both branches: a child that succeeds while complaining would otherwise be read as silence. */
function run(fork, args) {
  try {
    const stdout = execFileSync(runner(fork), args, {
      cwd: fork.path,
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

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

say(`forks with a suite of their own: ${FORKS.map((f) => f.dir).join(', ') || 'none'}`);
for (const fork of FORKS) say(runner(fork) ? `${fork.dir}: vitest installed` : `${fork.dir}: ⚠️ NOT INSTALLED`);

// ── the rule ────────────────────────────────────────────────────────────────────────────────────────────

test('this repository owns at least one fork with a suite of its own', () => {
  // The premise. The day the forks stop declaring a `test` script, every rule below passes by having no
  // subject — and a guard that is green because its subject left is the quietest way a loop dies.
  assert.ok(
    FORKS.length > 0,
    `no directory of this repo depends on ${KIT} and declares a \`test\` script`,
  );
});

for (const fork of FORKS) {
  test(`★★ ${fork.dir} has tests for its runner to COLLECT`, (t) => {
    // ⚠️ THE RULE AGAINST THE VACUUM, and it is a SEPARATE rule because the run below cannot be trusted with
    // it. Measured 2026-09-05 by standing a third fork-shaped directory next to the two real ones — kit
    // dependency, `test` script, vitest config, empty `src/` — and pointing this guard at it:
    //
    //     vitest list --filesOnly                    printed nothing and exited 0    ← green, on nothing
    //     vitest run                                 "No test files found", exited 1
    //     vitest run + `passWithNoTests: true`       exited 0 — and the rule below went GREEN ON NOTHING
    //
    // The third line is the one that decided the shape of this file. An exit code cannot carry the vacuum:
    // `list` never fails on it, and `run` stops failing on it the day anybody sets a config key for an
    // unrelated reason. What this asserts is therefore the COUNT — files the fork's OWN config actually
    // collected — which no flag can turn into a pass. A fork whose suite was deleted, moved out of
    // `include`, or never existed is accused here by name instead of reported as success.
    if (!runner(fork)) {
      t.skip(NOT_INSTALLED(fork));
      return;
    }
    const listed = run(fork, ['list', '--filesOnly']);
    const files = listed.output.split('\n').filter((line) => /\.test\.[cm]?[jt]sx?$/.test(line.trim()));
    assert.ok(
      files.length > 0,
      `${fork.dir} declares a \`test\` script and its runner collected NO test file. A suite that is not ` +
        `there cannot be green — this is the vacuum, not a pass.\n\n${listed.output}`,
    );
    say(`${fork.dir}: ${files.length} test file(s) collected`);
  });

  test(`★★ ${fork.dir}'s OWN suite passes`, (t) => {
    // The rule nobody was holding. It runs the fork's suite in the fork's directory with the fork's runner,
    // and the failure message NAMES the fork: `bin/test.sh` runs 40-odd files and a red one has to say which
    // tree it came from, or the next person greps this repository for a test that lives in another.
    if (!runner(fork)) {
      t.skip(NOT_INSTALLED(fork));
      return;
    }
    const result = run(fork, ['run']);
    assert.ok(
      result.ok,
      `${fork.dir}'s own vitest suite is RED. It lives in ${fork.dir}/src, not in bin/ — reproduce with ` +
        `\`cd ${fork.dir} && npm test\`.\n\n${result.output}`,
    );
  });
}

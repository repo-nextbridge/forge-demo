// ★★★ A TEST THAT DID NOT RUN MAY NOT READ LIKE A TEST THAT PASSED — the census of `bin/test.sh`, graded.
//
//   node --test bin/test-census.guard.mjs      (or: bash bin/test.sh)
//
// ⛔ THE DEFECT THIS HOLDS, MEASURED ON THIS TREE 2026-09-16. A plain run of `bash bin/test.sh` ended with
// `ℹ pass 1145 · ℹ fail 0 · ℹ skipped 45` and exited 0. Forty-five rules had REPORTED instead of running —
// among them every rule that compiles this box's own apps (`apps/demo-setup`, `apps/payment-pos`)
// — and their names were scattered through nine hundred lines above a summary that ended
// in `fail 0`. Thirty-six of the forty-five had ONE cause, and nothing at the end of the run named it.
//
// ★ NOT CHECKED STAYS A LEGITIMATE ANSWER on a developer's machine — `bin/test.sh` says at length why, and
// this file does not argue with it. What it holds is that the answer is COUNTED, NAMED and LAST: a run that
// graded 1145 of 1190 may not end on a line that reads like 1190.
//
// ⚠️ WHAT THIS GUARD REACHES, SAID OUT LOUD: the `census` function, sourced out of `bin/test.sh` between its
// markers and run over fabricated `node --test` output. It does NOT run `bin/test.sh` — a guard that did
// would invoke itself, because that script is what finds the guards — so the wiring AROUND the function (the
// `tee`, the strict refusal) is asserted on the text of the script rather than executed.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(ROOT, 'bin', 'test.sh'), 'utf8');

/** The census, taken out of `bin/test.sh` — the block between its markers, and nothing else. */
function censusBlock() {
  const block = SCRIPT.match(/\n# >>> THE CENSUS\n([\s\S]*?)\n# <<< THE CENSUS\n/);
  assert.ok(
    block,
    'bin/test.sh no longer marks its census block with `# >>> THE CENSUS` / `# <<< THE CENSUS`. Those markers ' +
      'are how this file grades the function without running the script that finds it, so a rename here is a ' +
      'guard that grades nothing.',
  );
  return block[1];
}

/** Run the census over a fabricated run-summary. Returns `{ status, out }` — everything it said, on stderr. */
function census(summary) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-census-'));
  try {
    const runOut = join(dir, 'run.txt');
    writeFileSync(runOut, summary);
    // ⚠️ `exec 2>&1` FIRST: the census writes every line to stderr — which is right, it is a report about
    // a run — and a capture that took only stdout would grade an empty string and pass over anything.
    const script = `exec 2>&1\nHERE=${JSON.stringify(ROOT)}\n${censusBlock()}\ncensus ${JSON.stringify(runOut)} 0\n`;
    const proc = execFileSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, out: proc };
  } catch (err) {
    return { status: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The tail `node --test` prints. `skips` are the `﹣` lines that would sit above it. */
const run = ({ tests, pass, skipped, skips = [] }) =>
  `${skips.map((s) => `﹣ ${s}\n`).join('')}ℹ tests ${tests}\nℹ suites 0\nℹ pass ${pass}\nℹ fail 0\nℹ cancelled 0\nℹ skipped ${skipped}\nℹ todo 0\n`;


test('★★★ a run with NOT CHECKED tests ends with the COUNT, and the count is not the pass count', () => {
  const { out } = census(
    run({ tests: 1190, pass: 1145, skipped: 45, skips: ['★★ apps/demo-setup COMPILES where it lives # NOT CHECKED — no checkout'] }),
  );
  assert.match(out, /NOT CHECKED · 45 of 1190/, `the census does not state how many of how many:\n${out}`);
  assert.match(out, /GRADED 1145\/1190 · NOT CHECKED 45/, `the closing line does not separate graded from reported:\n${out}`);
  assert.match(out, /`fail 0` is a statement about 1145 tests/, `nothing warns that the green covers less than it looks like:\n${out}`);
  // ★ AND THE WAY TO MAKE IT A RED IS OFFERED — to a run that is not already strict.
  assert.match(out, /FORGE_STRICT_CHECKS=1/, `the census names no way to turn NOT CHECKED into a failure:\n${out}`);
});

test('★★★ …and it NAMES them, one by one — a count with no names is a number, not a repair', () => {
  const { out } = census(
    run({
      tests: 3,
      pass: 1,
      skipped: 2,
      skips: ['★★ apps/demo-setup COMPILES where it lives # NOT CHECKED — no checkout', '★★ totem’s OWN suite passes # NOT CHECKED — not installed'],
    }),
  );
  assert.match(out, /apps\/demo-setup COMPILES where it lives/, `the skipped tests are counted and not named:\n${out}`);
  assert.match(out, /totem’s OWN suite passes/, out);
});

test('★★★ …and it names the PROVENANCE, because one missing tree silences most of them', () => {
  const { out } = census(run({ tests: 10, pass: 9, skipped: 1, skips: ['a rule # NOT CHECKED — no Forge checkout'] }));
  assert.match(out, /^\s*pin\s+\S/m, `the census does not report which release these images are pinned to:\n${out}`);
  // ⛔ AND THE VERDICT IS THE TWO-SENTENCE ONE. `kind` is `lock-behind` on a bench whose product moved on and
  // `pin-unreachable` where nothing holds the commit; both are printed, neither may be missing.
  assert.match(out, /^\s*(verdict|kind)\s+\S/m, `the provenance verdict is not in the census:\n${out}`);
});

test('★★ a run where everything RAN says so, and says nothing else', () => {
  const { status, out } = census(run({ tests: 1190, pass: 1190, skipped: 0 }));
  assert.equal(status, 0, out);
  assert.match(out, /NOT CHECKED 0/, out);
  assert.doesNotMatch(out, /REPORTED INSTEAD OF RUNNING/, `a clean run was given the census of a skipped one:\n${out}`);
});

test('★★★ ANTI-VACUUM — a run that printed no summary is REFUSED, never counted as zero', () => {
  const { status, out } = census('✔ something ran and then the process died\n');
  assert.equal(status, 1, `a run with no \`ℹ skipped\` line was silently read as "nothing was skipped":\n${out}`);
  assert.match(out, /CANNOT BE TAKEN/, out);
});

// ── THE WIRING AROUND THE FUNCTION — asserted on the script's text, for the reason in the header ───────────

test('★★ the census is taken on EVERY run, strict or not — it is not a mode', () => {
  assert.match(
    SCRIPT,
    /\ncensus "\$out" "\$rc" \|\| exit 1\n/,
    'bin/test.sh no longer calls the census unconditionally after the run. A census only the pipeline takes ' +
      'leaves the dev machine — which is where the 45 NOT CHECKED were measured — reading `fail 0` again.',
  );
  assert.match(
    SCRIPT,
    /node --test "\$\{files\[@\]\}" 2>&1 \| tee "\$out"/,
    'the run is no longer teed to a file, so there is nothing for the census to read.',
  );
});

test('★★★ STRICT still turns a NOT CHECKED into a RED — the pipeline mode is not softened by the census', () => {
  const strict = SCRIPT.slice(SCRIPT.indexOf('if [ "$strict" = 1 ] && [ "${skipped:-0}" -gt 0 ]'));
  assert.ok(strict.length > 0, 'bin/test.sh no longer refuses a skipped run under FORGE_STRICT_CHECKS.');
  assert.match(strict, /exit 1/, `the strict branch no longer exits non-zero:\n${strict}`);
});

// ★★ THE RESET ENDS WARM, MEASURED AND REPORTED — and the three steps that do it are wired in ONE order.
//
// ⚠️ "GRADED" USED TO BE THE WORD, AND IT WOULD NOW BE A LIE. Step 14 stopped deciding the birth's exit code
// on 05/09, when warmth was demoted to a REPORT: it still runs, still says everything, and no longer fails the
// birth on warmth — because it was red on EVERY run of this box by construction. What it still fails on is a
// store `seed/box.json` declares and the box does not hold, which is not warmth at all. The tests below are
// the record of that decision, in both directions.
//
// `bin/warm-box.mjs`, `bin/online-only.mjs` and `bin/verify-config.mjs` have suites of their own that run
// them against fake boxes. What none of those can see is whether `bin/box-up.sh` CALLS them, in the right
// order, and turns their failure into an exit code — which is exactly the class of defect this repository
// has paid for four times (the totem announced without starting, two doors announced with one claimed, a ✓
// printed without a row read, a promotion green on an empty box).
//
// A real birth costs ~17 minutes, so what runs here is the TAIL of the script rather than the whole of it:
// the exit block is extracted and executed for real, with the variables set, and its status is graded. The
// order and the wiring are read from the source, and that trade is stated rather than hidden.
//
//   node --test bin/reset-complete.guard.mjs      (or: bash bin/test.sh)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8');
const DOWN = readFileSync(join(ROOT, 'bin/box-down.sh'), 'utf8');

/** Where a step's `say` line begins, so the order of the tail can be compared as positions in one file. */
const at = (needle) => {
  const i = SRC.indexOf(needle);
  assert.ok(i > 0, `bin/box-up.sh no longer contains ${JSON.stringify(needle)}`);
  return i;
};

test('★★★ the reset REBORNS, then purges, then warms, then grades — and that order is the whole decision', () => {
  const verdictData = at("say '12 · the verdict");
  const online = at("say '13 ·");
  const warm = at("say '14 ·");
  const verdictConfig = at("say '15 ·");
  // ⚠️ PURGING BEFORE THE REBIRTH IS THE INTUITIVE ORDER AND IT IS THE WRONG ONE: an edge purged first
  // refills itself from the origin being destroyed during the ~17 minutes the birth takes, and comes out of
  // the reset holding exactly what the purge was for.
  assert.ok(verdictData < online, 'the online-only step runs before the box has finished being born');
  assert.ok(online < warm, 'the box is warmed BEFORE the edge is purged — the purge would then throw the warmth away');
  assert.ok(warm < verdictConfig, 'the configuration is graded before the box is warm, so the verdict cannot see a cold box');
  assert.ok(verdictConfig < at("say 'the bench'"), 'the summary is printed before the last two steps have run');
});

test('★★ each of the three is actually CALLED, through host_node, from the birth', () => {
  for (const script of ['online-only.mjs', 'warm-box.mjs', 'verify-config.mjs']) {
    assert.match(
      SRC,
      new RegExp(`host_node "\\$HERE/bin/${script.replace('.', '\\.')}"`),
      `bin/box-up.sh never runs bin/${script} — a step nobody invokes is decoration`,
    );
  }
});

test('★★ warming is once per tenant, with that tenant\'s own token — the read face resolves it from the credential', () => {
  const block = SRC.slice(at("say '14 ·"), at("say '15 ·"));
  assert.match(block, /for t in \$TENANTS/, 'the warming step does not loop over the tenants');
  assert.match(
    block,
    /FORGE_SEED_TOKEN="\$tokval"/,
    'the warming step does not hand each tenant its own token — one token cannot speak for two tenants',
  );
  assert.match(block, /--api "\$FORGE_PUBLIC_ORIGIN"/, 'the warming step does not warm the address the box publishes itself at');
});

test('★★★ warming stopped being a GATE and did not stop RUNNING — the three ways that could have gone wrong', () => {
  const block = SRC.slice(at("say '14 ·"), at("say '14-bis ·"));
  // 1 · not deleted, not silenced, not `|| true`d. What was asked for is a report, not the step going away.
  assert.doesNotMatch(
    block,
    /warm-box\.mjs[^\n]*\|\|\s*true/,
    'the warming step was turned into `|| true`. It was asked to REPORT, which means it still runs AND still ' +
      'says everything — a step whose output nobody keeps is a step that was deleted with extra characters.',
  );
  assert.doesNotMatch(
    block,
    /warm-box\.mjs[^\n]*>\s*\/dev\/null/,
    'the warming step\'s output is thrown away — the report IS the step now',
  );
  // 2 · the status is CAPTURED rather than tested. `if step; then` can only tell zero from non-zero, and this
  //     step now answers 0/1/2/3 — folding 3 into 1 would lose the one red it still owns.
  assert.match(
    block,
    /case "\$\?" in/,
    'the warming step\'s status is not read as a number. It answers 0 (warm), 1 (a report: not fully warm), ' +
      '2 (could not ask) and 3 (a store this repository declares was never built), and only the last is a red.',
  );
  // ⚠️ THE ACCUMULATION, NOT THE DECLARATION. `MISSING_STORE=''` opens the step four lines up, so matching
  //    `MISSING_STORE=` was green with the recording line deleted — measured by sabotage, 05/09.
  assert.match(
    block,
    /MISSING_STORE="\$MISSING_STORE/,
    'nothing in the warming step RECORDS a store that was never built. The variable being declared is not the ' +
      'variable being written: a red that is initialised empty and never appended to is a red that never fires.',
  );
  // 3 · and the exit conjunction is where the decision actually lives. Read from the source rather than only
  //     executed, so that a `COLD` smuggled back into the line is named here even if a test above forgets.
  // ⚠️ `lastIndexOf`, NOT `indexOf`: `SHUT` also opens the printf that PRINTS its sentence, four blocks
  //    earlier, and reading that line instead would have graded a message as if it were the decision.
  const conjunction = SRC.slice(SRC.lastIndexOf('if [ -n "${SHUT:-}"')).split('\n')[0];
  assert.ok(
    conjunction.includes('exit') || conjunction.includes('||'),
    `the exit conjunction moved; this guard is reading ${conjunction}`,
  );
  assert.ok(
    !/\bCOLD\b/.test(conjunction),
    `COLD is back in the exit conjunction: ${conjunction}\nIt was removed on purpose on 05/09 — the ` +
      'warming step was red on every birth of this box by construction, so it graded nothing.',
  );
  assert.ok(conjunction.includes('MISSING_STORE'), `MISSING_STORE left the exit conjunction: ${conjunction}`);
});

test("★★ the tear-down does NOT purge the edge — the order lives in box-up, and having it in both is having it wrong", () => {
  assert.ok(
    !/online-only|purge/i.test(DOWN),
    'bin/box-down.sh purges something. Purging at teardown is the ordering defect this slice exists to avoid: ' +
      'the CDN refills from the dying origin during the birth that follows.',
  );
});

// ── ★ THE EXIT BLOCK, RUN RATHER THAN READ ───────────────────────────────────────────────────────────────
//
// The three states below all mean "the box is standing and is not finished", and every wrapper reads the
// status before it reads the prose. Extracting the block and executing it is the one part of the tail that
// can be measured without a 17-minute birth.

/** The last block of `bin/box-up.sh`: everything from the closing summary's blank line to the end. */
function runExitBlock(vars) {
  const start = SRC.indexOf("# ⛔ LAST LINE, AND IT IS NON-ZERO ON PURPOSE.");
  assert.ok(start > 0, 'the exit block is gone — this guard is about a block that must exist');
  const block = SRC.slice(start);
  const assigns = Object.entries(vars)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n');
  // ⚠️ THE SUCCESS BRANCH KEEPS stderr TOO, AND THAT LINE IS A REPAIR. `execFileSync` returns only stdout, and
  // every one of these printfs writes to STDERR — so a block that EXITS 0 WHILE SPEAKING (which is exactly
  // what a warmth REPORT is, since 05/09) was read here as a block that said nothing. It was invisible while
  // every talking case also failed; the first test of a report measured it as silence.
  const capture = (fn) => {
    const err = mkdtempSync(join(tmpdir(), 'reset-guard-'));
    const path = join(err, 'stderr');
    try {
      const status = fn(path);
      return { status, out: readFileSync(path, 'utf8') };
    } finally {
      rmSync(err, { recursive: true, force: true });
    }
  };
  return capture((errPath) => {
    const script = `set -uo pipefail\n${assigns}\n${block}\n`;
    try {
      execFileSync('bash', ['-c', script], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', openSync(errPath, 'w')],
      });
      return 0;
    } catch (error) {
      return error.status ?? -1;
    }
  });
}

const CLEAN = {
  UNSETTLED: '',
  UNSETTLED_EXTRA: '',
  COLD: '',
  WARM_UNKNOWN: '',
  MISSING_STORE: '',
  MISCONFIGURED: '',
  ONLINE_ONLY_FAILED: '',
};

test('★★ a birth with nothing wrong exits 0 — the control, without which every red below proves nothing', () => {
  const { status } = runExitBlock(CLEAN);
  assert.equal(status, 0, 'the exit block is red on a clean birth');
});

// ── ★★★ WARMTH IS A REPORT, AND THE SABOTAGE IS THAT IT STAYS ONE ────────────────────────────────────────
//
// WARMTH WAS DEMOTED TO A REPORT ON 05/09. The step used to be in the conjunction below and it was red on
// EVERY birth of this box by construction: the warmer plans ~420 pages plus ~20 400 image derivatives found in
// the pages' `srcset`, against the VITRINE's own 15-minute DEFAULT (`DEFAULT_MAX_DURATION_MS`, in the
// product), so every run ended `15865 urls were never visited`. It also produced FALSE red — `failed=198`
// during a birth, `failed=0` for the same URLs on the idle box minutes later, because it is the last step of
// the birth and races the tail of the seed.
//
// ⚠️ HALF OF THAT WAS REPAIRED — TWICE — AND THIS TEST STAYS ANYWAY. pk21/d2 replaced the constant with a
// ceiling `bin/warm-box.mjs` DERIVED from the plan it measured; pk35/p1 then took the clock out of the
// product's judgement altogether (a window of NON-progress), and pk35/d5 stopped this repository sending a
// ceiling to a front that can bound itself. So "red by construction" is gone. The FALSE red is not, and
// neither is a cold box on a day the vitrine misbehaves; warmth is still a report, and these two tests are
// what stop it drifting back.
//
// ★ A step that is ALWAYS red is a step people learn to skip, and then it is worth nothing on the day it is
// right. So warmth is printed and not counted — and these two tests are what stops it drifting back, in EITHER
// direction: the first fails if `COLD` re-enters the conjunction, the second fails if the report goes quiet.

test('★★★ a tenant that did NOT come out warm still exits 0 — warmth is a report, not a gate', () => {
  const { status, out } = runExitBlock({ ...CLEAN, COLD: ' forgecafe' });
  assert.equal(
    status,
    0,
    `a cold tenant failed the birth. Warmth was taken out of the conjunction on purpose on 05/09 — a ` +
      `step that is red on every run grades nothing:\n${out}`,
  );
});

test('★★★ …and it SAYS SO, by name — a gate replaced by a silence is worse than the gate', () => {
  const { out } = runExitBlock({ ...CLEAN, COLD: ' forgecafe' });
  assert.match(out, /WARM/, `the birth said nothing about warmth at all:\n${out}`);
  assert.match(out, /forgecafe/, `the report does not name the tenant it is about:\n${out}`);
  // It must not read like a failure either: an operator who sees ⛔ learns nothing from a line that is a note.
  assert.match(out, /REPORT/, `the warmth line does not say it is a report:\n${out}`);
});

test('★★ warmth that could not be ASKED is a THIRD sentence, and it is a report too', () => {
  const { status, out } = runExitBlock({ ...CLEAN, WARM_UNKNOWN: ' forgeco' });
  assert.equal(status, 0, `"nothing was learned" failed the birth:\n${out}`);
  assert.match(out, /UNKNOWN/, out);
  assert.match(out, /forgeco/, out);
});

test('★★★ but a store this repository DECLARES and the box does not hold is STILL red — that is not warmth', () => {
  // ⚠️ THE HALF THAT MUST NOT HAVE BEEN DROPPED WITH THE OTHER. `bin/verify-seed.mjs` grades the stores the
  // PORT reports and `bin/prove-doors.mjs` opens the doors of the stores the PORT reports — so a store that
  // was never built is a store neither of them asks about. `bin/warm-box.mjs` exits 3 for it, and it is its
  // own variable precisely so that taking warmth out of the conjunction could not take this out too.
  const { status, out } = runExitBlock({ ...CLEAN, MISSING_STORE: ' forgeco' });
  assert.equal(status, 1, `a box missing a declared store exited 0:\n${out}`);
  assert.match(out, /MISSING A STORE/, out);
  assert.match(out, /forgeco/, out);
});

test('★★★ a configuration that is not what the box declares makes the birth exit 1', () => {
  const { status, out } = runExitBlock({ ...CLEAN, MISCONFIGURED: '1' });
  assert.equal(status, 1, `a misconfigured box exited 0:\n${out}`);
  assert.match(out, /CONFIGURATION/, out);
});

test('★★ an online-only facility that was configured and could not run makes the birth exit 1', () => {
  const { status, out } = runExitBlock({ ...CLEAN, ONLINE_ONLY_FAILED: '1' });
  assert.equal(status, 1, `a facility that refused exited 0:\n${out}`);
  assert.match(out, /ONLY EXISTS ONLINE/, out);
});

test('★★★ a cold tenant found AFTER an unsettled one still reaches the screen — the old block exited where it printed', () => {
  // The two pre-existing exits print and leave. A reason added below them would be computed and never seen,
  // which is the same shape as a ⚠️ four hundred lines above the line that says the opposite. This matters
  // MORE now that warmth is only a report: a report that is computed and never printed is nothing at all.
  const { status, out } = runExitBlock({ ...CLEAN, UNSETTLED: ' forgeco', COLD: ' forgecafe' });
  assert.equal(status, 1, out);
  assert.match(out, /DID NOT SETTLE/, out);
  assert.match(out, /NOT COME OUT FULLY WARM/, `the warmth report was computed and never printed:\n${out}`);
});

test('★★★ …and the NEIGHBOURS were not loosened along with it — each still fails the birth on its own', () => {
  // ⛔ THE OTHER HALF OF THE SABOTAGE. Taking one reason out of a conjunction is exactly the edit that takes
  //    three out by accident, and the conjunction is one line long.
  for (const [name, value] of [
    ['SHUT', ' forgecafe'],
    ['MISCONFIGURED', '1'],
    ['ONLINE_ONLY_FAILED', '1'],
    ['MISSING_STORE', ' forgeco'],
  ]) {
    const { status, out } = runExitBlock({ ...CLEAN, [name]: value });
    assert.equal(status, 1, `${name} no longer fails the birth:\n${out}`);
  }
});

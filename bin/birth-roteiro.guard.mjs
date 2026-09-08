// ★★ THE BIRTH HAS TO BE ABLE TO SAY WHAT IT DID — every step, and the reason for every one it skipped.
//
//   node --test bin/birth-roteiro.guard.mjs        (or: bash bin/test.sh)
//
// ── THE DEFECT THIS EXISTS FOR (pk24/§B1) ─────────────────────────────────────────────────────────────────
//
// `bin/box-up.sh` ran step 14 — ~1h10 of warming — unconditionally, and the only flags it accepted were
// `--tailnet` and `--localhost`. A pipeline that wanted a fast birth and a warm-up on a cron had no way to
// ask for one, so the answer was going to be somebody's hand on a keyboard. The ruler of this sprint (Renan,
// 08/09) is that this is a defect: *describe the pipeline — bake → be born → seed → prove — without a single
// sentence that starts with "and then I…"*.
//
// ⚠️ AND THE FLAG IS THE EASY HALF. The moment a step can be skipped, the birth can be WRONG IN SILENCE: a
// run that skipped something and never said so is a summary that lies, and this repository has been caught
// four times by summaries that described intent instead of result (`bin/bench-summary.guard.mjs` collects
// them). So the flag came with a ledger: `BIRTH_STEPS` declares the steps, each step's own `say` STAMPS
// itself as it happens, `skip` records the ones that did not with their reason, and `bin/roteiro.mjs` grades
// the three lists against each other at the end of every birth.
//
// ── WHAT THIS FILE PROVES, AND HOW IT AVOIDS COSTING 19 MINUTES ───────────────────────────────────────────
//
// A real birth is ~19 minutes and needs a machine with docker; these checks are seconds. The trade is taken
// in three layers rather than by grepping and hoping:
//
//   1 · THE LEDGER IS THE SCRIPT'S OWN LIST. The ids in `BIRTH_STEPS`, the ids in the `say '<id> · …'` calls
//       and the ids in the file's header map are compared in the directions that can catch a drift. A step
//       deleted, renamed or added on one side alone is red here.
//   2 · THE PLAN IS RUN FOR REAL. `bash bin/box-up.sh --plan [--no-warm]` is executed — it touches nothing,
//       it starts nothing — and its output is what is graded. That is the whole of "which steps would this
//       invocation run", answered by the script itself rather than by a regex over it.
//   3 · THE GRADER IS RUN FOR REAL. `bin/roteiro.mjs` is given the ledger of a run that skipped a step in
//       silence, of one that both ran and skipped a step, and of one with an empty declaration — the three
//       shapes the closing summary must never print in green.
//
// ⛔ AND ONE THING IS PROVEN STRUCTURALLY BECAUSE NOTHING ELSE CAN: that `--no-warm` skips step 14 AND NOT
// 14-bis. Warmth is a report; the doors are the truth about whether the box is standing (that step exists
// because sign-in was dead on three of four shops while every other step of the birth was green). So the
// body of the "do not warm" branch is extracted from the source and read: it must contain the warmer and
// must NOT contain the door prover.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const BOX_UP = read('bin/box-up.sh');

/** The declared ledger, parsed out of `BIRTH_STEPS='…'` — `<id>|<title>` per line. */
function declaredSteps() {
  const block = BOX_UP.match(/\nBIRTH_STEPS='([\s\S]*?)'\n/);
  assert.ok(
    block,
    "bin/box-up.sh no longer declares BIRTH_STEPS='…'. That list IS the roteiro; without it the closing " +
      'summary has nothing to grade the run against and this guard has nothing to grade at all.',
  );
  return block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf('|');
      assert.ok(at > 0, `BIRTH_STEPS line ${JSON.stringify(line)} is not \`<id>|<title>\``);
      return { id: line.slice(0, at), title: line.slice(at + 1) };
    });
}

/** The ids the script really stamps: the leading token of every `say '<id> · …'`. */
function saidSteps() {
  return [...BOX_UP.matchAll(/^\s*say ['"]([0-9][^ ]*) ·/gm)].map((m) => m[1]);
}

/** `bash bin/box-up.sh <args…>`, run for real. It reads no `.env` and starts nothing on this path. */
function run(args) {
  try {
    return { status: 0, out: execFileSync('bash', [join(ROOT, 'bin/box-up.sh'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { status: error.status ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** `bin/roteiro.mjs`, run for real over a ledger this test hands it. */
function roteiro({ mode = 'result', steps, ran = '', skipped = '' }) {
  const args = ['--mode', mode, '--steps', steps, '--ran', ran, '--skipped', skipped];
  try {
    return { status: 0, out: execFileSync(process.execPath, [join(ROOT, 'bin/roteiro.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { status: error.status ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

// ── 1 · THE LEDGER IS THE SCRIPT'S OWN LIST ───────────────────────────────────────────────────────────────

test('★ the ledger is not empty, and it is the birth this box really has', () => {
  // ⚠️ ANTI-VACUITY FIRST. Every rule below compares two lists; two empty lists agree perfectly, and a guard
  //    that goes green over nothing is the failure this house has measured more than once.
  const steps = declaredSteps();
  assert.ok(
    steps.length >= 15,
    `BIRTH_STEPS declares ${steps.length} step(s). This birth is fifteen numbered steps plus its wiring, so ` +
      'a number this small means the declaration was gutted and every comparison below is now vacuous.',
  );
  assert.ok(saidSteps().length >= 15, 'bin/box-up.sh no longer opens its steps with `say \'<id> · …\'` — the stamps are gone, so the roteiro would report a birth in which nothing ran.');
  for (const step of steps) assert.ok(step.title.trim(), `step ${step.id} is declared with no title — the roteiro would print a bare id at somebody at 3am.`);
});

test('★★★ every step the script RUNS is declared, and every step declared is RUN by the script', () => {
  const declared = declaredSteps().map((s) => s.id);
  const said = saidSteps();
  const undeclared = said.filter((id) => !declared.includes(id)).sort();
  const unreached = declared.filter((id) => !said.includes(id)).sort();
  assert.deepEqual(
    undeclared,
    [],
    `bin/box-up.sh runs step(s) ${undeclared.join(', ')} that BIRTH_STEPS does not declare. The closing ` +
      'roteiro reds on exactly this at runtime — the ledger and the script have parted ways — but it costs a ' +
      '19-minute birth to find out.',
  );
  assert.deepEqual(
    unreached,
    [],
    `BIRTH_STEPS declares step(s) ${unreached.join(', ')} that no \`say\` in the script ever stamps. Either ` +
      'the step was deleted (take it out of the ledger, deliberately) or its `say` was, in which case the ' +
      'step is invisible to the summary that is supposed to account for it.',
  );
  assert.equal(new Set(declared).size, declared.length, 'BIRTH_STEPS declares the same id twice.');
});

test('★★ the map in the file\'s own header names no step the ledger has lost', () => {
  // The header is the map a human reads first ("that order IS the map of how this box is born"). It is a
  // subset on purpose — 0c, 3b, 3c and 3d are wiring rather than numbered steps — so the direction that has
  // to hold is: nothing in the map is missing from the ledger.
  const header = BOX_UP.slice(0, BOX_UP.indexOf('set -uo pipefail'));
  const mapped = [...header.matchAll(/^#\s{1,3}(\d+(?:-bis)?)[. ]\s/gm)].map((m) => m[1]);
  assert.ok(mapped.length >= 15, `the header map parsed to ${mapped.length} step(s) — it is the map this test grades, and it is not there any more.`);
  const declared = declaredSteps().map((s) => s.id);
  const missing = mapped.filter((id) => !declared.includes(id)).sort();
  assert.deepEqual(missing, [], `the header map names step(s) ${missing.join(', ')} that BIRTH_STEPS does not.`);
});

test('★ the README\'s table of the birth names no step this box does not have', () => {
  // ⚠️ A LIST IN A SECOND PLACE HAS NOBODY TO KEEP IT HONEST — the lesson this pack opens with. The README
  //    prints the same sequence for a reader who is not reading the script; this is the one direction that
  //    can be checked from here (the table is deliberately shorter: the wiring steps are not in it).
  const readme = read('README.md');
  const at = readme.indexOf('### What `bin/box-up.sh` does, in order');
  assert.ok(at > 0, 'README.md no longer carries the table of the birth — this check has no subject.');
  const table = readme.slice(at, readme.indexOf('\n### ', at + 10));
  const rows = [...table.matchAll(/^\| (\d+[a-z]*) \|/gm)].map((m) => m[1]);
  assert.ok(rows.length >= 15, `the README table parsed to ${rows.length} row(s).`);
  const declared = declaredSteps().map((s) => s.id);
  const unknown = rows.filter((id) => !declared.includes(id)).sort();
  assert.deepEqual(unknown, [], `README.md documents step(s) ${unknown.join(', ')} that bin/box-up.sh does not declare.`);
});

// ── 2 · THE PLAN, RUN FOR REAL ────────────────────────────────────────────────────────────────────────────

test('★★★ `--plan` describes the whole birth, and says out loud that it is a PLAN', () => {
  const { status, out } = run(['--plan']);
  assert.equal(status, 0, `bash bin/box-up.sh --plan exited ${status}:\n${out}`);
  assert.match(out, /PLAN: nothing has run yet/, `the plan does not label itself as intent:\n${out}`);
  for (const step of declaredSteps()) {
    assert.match(
      out,
      new RegExp(`→\\s+${step.id.replace('-', '\\-')}\\s`),
      `step ${step.id} (${step.title}) is not in the plan:\n${out}`,
    );
  }
  // And it names the one thing that is NOT a step of the birth, because that is the sentence the pipeline
  // was missing: the box is born on localhost and something else has to point it at its address (§B5).
  assert.match(out, /--promote/, `the plan never names the promotion, which is the step after the birth:\n${out}`);
});

test('★★★ pk24/§B1 — `--no-warm` drops step 14 and SAYS SO, with the reason and the way to warm later', () => {
  const { status, out } = run(['--plan', '--no-warm']);
  assert.equal(status, 0, `bash bin/box-up.sh --plan --no-warm exited ${status}:\n${out}`);
  assert.match(out, /⏭\s+14\s.*WILL BE SKIPPED/, `step 14 is not marked skipped by a run that asked not to warm:\n${out}`);
  assert.match(out, /why: .*--no-warm/, `the skipped step gives no reason. "Skipped" alone is what this whole ledger exists to forbid:\n${out}`);
  assert.match(
    out,
    /warm-box\.mjs --tenant/,
    `the reason does not say how to warm the box later. A cron is the whole point of the flag, and the ` +
      `command is the one thing the operator needs from this line:\n${out}`,
  );
  // ⛔ AND 14-bis IS NOT SKIPPED WITH IT. Warmth is optional; proving every door of every shop opens is not.
  assert.match(out, /→\s+14-bis\s/, `--no-warm also dropped 14-bis. A shop nobody can sign in to is a red box, and warmth has nothing to do with it:\n${out}`);
});

test('★★★ the warm-less branch skips the WARMER and nothing else — the doors are not warmth', () => {
  // Structural, and it is the one thing the plan alone cannot prove: the plan says 14-bis will run, and the
  // body of the skip branch is what makes that true. `bin/prove-doors.mjs` inside it would be the pk24
  // defect written back in — the flag would silently take away the step that exists because sign-in was dead
  // on three of four shops with every other step green.
  const at = BOX_UP.indexOf('if [ "$WARM" != 1 ]; then');
  assert.ok(at > 0, 'bin/box-up.sh has no `if [ "$WARM" != 1 ]` branch — step 14 cannot be skipped at all, so --no-warm is a lie.');
  // ⚠️ THE SLICE ENDS AT THE BRANCH'S OWN `fi`, NOT AT THE 14-bis HEADING — measured while sabotaging this:
  //    with the `fi` moved past the doors loop (the exact edit this test is about) a slice bounded by the
  //    heading no longer contained a `fi`, and the anti-vacuity check fired first. Red either way, but the
  //    wrong sentence: it accused this guard of not parsing instead of naming the step that was taken away.
  const closing = BOX_UP.indexOf('\nfi\n', at);
  assert.ok(closing > at, 'the warm branch never closes — re-read this guard before believing it.');
  const branch = BOX_UP.slice(at, closing + 4);
  assert.ok(branch.length > 200, 'the warm branch did not parse — re-read this guard before believing it.');
  assert.match(branch, /warm-box\.mjs/, 'the branch this guard believes is the warming step does not run the warmer.');
  assert.match(branch, /skip 14 "\$WARM_SKIP_WHY"/, 'the skip is not DECLARED — a step dropped without `skip` is a step the roteiro cannot mention.');
  assert.ok(
    !branch.includes('prove-doors.mjs'),
    'the doors step is inside the branch `--no-warm` disables. Warmth is a report; whether every shop can be signed in to is not.',
  );
});

test('★★★ the PLAN knows about every skip the RUN can declare — one list cannot drift from the other', () => {
  // ⚠️ THE HOLE THIS CLOSES, AND IT IS THE ONLY HAND-KEPT PAIR IN THE MECHANISM. `--plan` cannot run the
  //    birth, so it states the skips from `PLANNED_SKIPS`, while the run states them from the `skip` calls it
  //    actually reaches. A second `skip` added tomorrow and not mirrored in the plan would make `--plan` a
  //    confident lie about the very thing it exists to answer — and nothing at runtime could notice, because
  //    at runtime the plan is not there to disagree with.
  const skipped = [...BOX_UP.matchAll(/^\s*skip ([^ ]+) /gm)].map((m) => m[1]).sort();
  const planned = [...BOX_UP.matchAll(/PLANNED_SKIPS="([^=]+)=/g)].map((m) => m[1]).sort();
  assert.ok(skipped.length >= 1, 'no `skip` call in bin/box-up.sh — no step can be skipped at all, so --no-warm does nothing.');
  assert.deepEqual(
    planned,
    skipped,
    `--plan announces skips for [${planned.join(', ')}] and the birth can declare skips for ` +
      `[${skipped.join(', ')}]. Whichever list is short is the one that lies.`,
  );
});

test('★★ --plan and --no-warm are refused where they mean nothing, instead of being ignored', () => {
  // A flag silently accepted and not applied is the same class of lie as a skipped step nobody mentions.
  for (const args of [['--promote', 'tailnet', '--no-warm'], ['--promote', 'tailnet', '--plan']]) {
    const { status, out } = run(args);
    assert.equal(status, 1, `\`box-up.sh ${args.join(' ')}\` was accepted; the promotion has no step list to plan or to warm:\n${out}`);
    assert.match(out, /about the BIRTH/, `the refusal does not say why:\n${out}`);
  }
});

// ── 2b · WHAT THE SKIP MESSAGE CLAIMS, GRADED AGAINST WHAT THE OTHER STEPS REALLY ASK ─────────────────────
//
// ⛔ THE DEFECT, MEASURED IN THIS SLICE AND ALREADY TWO FILES DEEP. `bin/warm-box.mjs` said step 14 was
// *"the ONLY one that can see"* a store `seed/box.json` declares and the box does not hold. It was TRUE when
// written (`e6df443`, 2026-09-05) and FALSE two days later: `b72eca4` (2026-09-07) gave `bin/prove-doors.mjs`
// the same loop over the same two sources, reds on it, and its own suite covers it. Nobody updated the
// sentence — and this slice copied it, in good faith, into the message an operator reads AT THE MOMENT OF
// DECIDING to skip. It told him he was giving up a check that 14-bis goes on making.
//
// ★ SO THE CLAIM IS DERIVED FROM THE SOURCE THAT WOULD HAVE TO CHANGE. If `prove-doors` still grades the
// declared-store disagreement, no file may say the warmer is the only one that can. If it ever loses that
// loop, THIS test goes red and the message has to be rewritten back — which is the whole point: the prose
// cannot drift away from the mechanism in silence a third time.
test('★★★ nothing claims the warming step is the ONLY one that sees a declared store the box lacks', () => {
  const doors = read('bin/prove-doors.mjs');
  // 1 · the FACT, read where it lives. Anti-vacuity: the check must be there AND be a failure, or the
  //     exclusivity claim would be true again and rule 2 below would be forbidding a true sentence.
  const grades = /bad\(\s*\n?\s*handle,\s*\n?\s*`declared in seed\/box\.json and NOT in this box/.test(doors);
  assert.ok(
    grades,
    'bin/prove-doors.mjs no longer REFUSES over a store seed/box.json declares and the box does not hold. ' +
      'That check is what makes the --no-warm message true; if it really went away on purpose, step 14 is ' +
      'the only asker again and both messages this test guards have to say so.',
  );
  assert.match(doors, /process\.exit\(failures === 0 \? 0 : 1\)/, 'bin/prove-doors.mjs no longer turns a ✗ into a non-zero exit, so "it refuses" is not a claim this box can make.');

  // 2 · …and therefore nobody may claim exclusivity. Both files that speak about it are graded, because the
  //     defect this test exists for is precisely that the sentence had been copied into a second place.
  for (const file of ['bin/warm-box.mjs', 'bin/box-up.sh']) {
    const body = read(file);
    // ⚠️ BOTH SPELLINGS, AND THE SECOND IS WHY THIS LINE IS A LIST. The first version of this test matched
    //    only "the ONLY one/step that can see" and went green over two more copies in bin/box-up.sh phrased
    //    as "no other step can see it" — one of them the sentence a RED birth prints at the operator.
    const claims = [...body.matchAll(/ONLY (?:one|step) that can see|no other step can see/gi)];
    assert.deepEqual(
      claims.map((m) => m[0]),
      [],
      `${file} claims the warming step is the only one that can see a store this repository declares and the ` +
        'box does not hold. bin/prove-doors.mjs asks the same question, from the same two sources, and reds ' +
        'on it — so that sentence is false, and it is the sentence somebody reads while deciding to skip.',
    );
  }

  // ⚠️ AND A RETIRED CLAIM MUST BE PARAPHRASED, NEVER QUOTED VERBATIM, in the comment that retires it: this
  //    check reads the file, so a comment carrying the old sentence in quotes is indistinguishable from the
  //    file still making it. Measured here — the first correction of bin/box-up.sh quoted it and went red.
  //
  // 3 · and the message an operator reads NAMES the step that keeps asking. Deleting the false half without
  //     putting the true half in its place would leave him guessing what --no-warm costs.
  const message = BOX_UP.match(/^WARM_SKIP_WHY='([^']*)'/m);
  assert.ok(message, 'bin/box-up.sh no longer declares WARM_SKIP_WHY — the skip has no reason to print.');
  assert.match(message[1], /14-bis/, 'the --no-warm message does not name the step that goes on asking the declared-store question.');
  assert.match(message[1], /CREDENTIAL/, 'the message does not carry the nuance that 14-bis resolves its store list from the credential rather than from --tenant.');
});

// ── 3 · THE GRADER, RUN FOR REAL ──────────────────────────────────────────────────────────────────────────

const LEDGER = '1|first\n2|second\n3|third';

test('★★★ a step that neither RAN nor was declared SKIPPED makes the run red, by name', () => {
  // ⛔ THIS IS THE SHAPE THE ROTEIRO EXISTS FOR: an `if` added around a step, a `say` lost in a refactor, a
  //    loop that never entered. Everything else about the birth can be green while it is true.
  const { status, out } = roteiro({ steps: LEDGER, ran: '1 3' });
  assert.notEqual(status, 0, `a summary that could not account for step 2 exited 0:\n${out}`);
  assert.match(out, /NEITHER RAN NOR WAS DECLARED SKIPPED/, `the roteiro does not say what is wrong:\n${out}`);
  assert.match(out, /\b2\b/, `the roteiro never names the step it cannot account for:\n${out}`);
});

test('★★ …and a run that accounts for every step is green, with the skipped one carrying its reason', () => {
  const { status, out } = roteiro({ steps: LEDGER, ran: '1 3', skipped: '2=asked with --no-warm' });
  assert.equal(status, 0, `a fully accounted run was reported red:\n${out}`);
  assert.match(out, /⏭\s+2\s.*SKIPPED/, `the skipped step is not shown as skipped:\n${out}`);
  assert.match(out, /why: asked with --no-warm/, `the reason is not printed, so the summary says "skipped" and nothing else:\n${out}`);
  assert.match(out, /RESULT: every ✓ below was stamped by the step itself/, `the result does not label itself as a result:\n${out}`);
});

test('★★ a step that RAN *and* was declared skipped is red — two answers about one step', () => {
  const { status, out } = roteiro({ steps: LEDGER, ran: '1 2 3', skipped: '2=asked with --no-warm' });
  assert.notEqual(status, 0, `a step that both ran and was skipped exited 0:\n${out}`);
  assert.match(out, /RAN \*AND\* WAS DECLARED SKIPPED/, out);
});

test('★★ "skipped" with no reason is refused — the reason is the whole point of declaring it', () => {
  const { status, out } = roteiro({ steps: LEDGER, ran: '1 3', skipped: '2=' });
  assert.notEqual(status, 0, `a step skipped with no reason was accepted:\n${out}`);
  assert.match(out, /NO reason/, out);
});

test('★★ a stamp for a step nothing declares is red — the ledger stopped being the map', () => {
  const { status, out } = roteiro({ steps: LEDGER, ran: '1 2 3 99' });
  assert.notEqual(status, 0, `a step ran that the declaration does not list, and the roteiro shrugged:\n${out}`);
  assert.match(out, /99/, out);
});

test('★★★ the grader ACCUSES ITSELF over an empty declaration instead of blessing everything', () => {
  // ⚠️ A roteiro over no steps prints a tidy empty list and every rule above passes in silence. This box has
  //    measured that exact green three times in one day, in three different guards.
  const { status, out } = roteiro({ steps: '', ran: '1 2 3' });
  assert.notEqual(status, 0, `an EMPTY step declaration produced a green roteiro:\n${out}`);
  assert.match(out, /EMPTY step declaration/, out);
});

// ── 4 · AND THE BIRTH REALLY CONSULTS IT ──────────────────────────────────────────────────────────────────

test('★★★ the closing roteiro reads what the RUN stamped, and its verdict reaches the exit code', () => {
  // ⛔ THE MECHANISM CAN BE PERFECT AND STILL BE WORTH NOTHING if the birth prints it and ignores it: an exit
  //    code is what every wrapper reads before it reads the prose (`bin/bench-summary.guard.mjs`, same shape).
  const call = BOX_UP.match(/node "\$HERE\/bin\/roteiro\.mjs" --mode result[^\n]*\n[^\n]*/);
  assert.ok(call, 'bin/box-up.sh never runs bin/roteiro.mjs in result mode — the birth prints no roteiro at all.');
  assert.match(call[0], /--ran "\$STEPS_RAN"/, 'the closing roteiro is not given what the run stamped.');
  assert.match(call[0], /--skipped "\$STEPS_SKIPPED"/, 'the closing roteiro is not given what the run declared skipped.');
  assert.ok(
    !call[0].includes('$PLANNED_SKIPS'),
    'the SUMMARY is being fed the PLAN. Intent describing result is the exact shape four defects of this box ' +
      'already had; `PLANNED_SKIPS` belongs to `--plan` and to nothing else.',
  );
  assert.match(call[0], /ROTEIRO_INCOMPLETE=1/, 'the roteiro\'s verdict is thrown away.');
  const conjunction = BOX_UP.match(/^if \[ -n "\$\{SHUT:-\}" \][^\n]*\n\s*exit 1/m);
  assert.ok(conjunction, 'the closing exit conjunction moved — re-read this guard before believing it.');
  assert.match(conjunction[0], /ROTEIRO_INCOMPLETE/, 'a birth that cannot account for its own steps still exits 0.');
});

test('★★ the stamp is taken by `say` itself — nothing keeps a second list by hand', () => {
  const appends = [...BOX_UP.matchAll(/STEPS_RAN="\$STEPS_RAN/g)];
  assert.equal(
    appends.length,
    1,
    `${appends.length} places append to STEPS_RAN. It is stamped by \`say\` and by nothing else, precisely ` +
      'so that a step cannot claim to have run without printing that it did.',
  );
  const sayFn = BOX_UP.match(/^say\(\) \{[\s\S]*?^\}/m);
  assert.ok(sayFn, 'bin/box-up.sh has no `say()` — the stamps have nowhere to come from.');
  assert.match(sayFn[0], /STEPS_RAN/, '`say` no longer stamps the step it announces.');
});

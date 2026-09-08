#!/usr/bin/env node
// ★★ THE BIRTH DESCRIBES ITSELF — which steps it will run, which it ran, which it SKIPPED and WHY.
//
//   node bin/roteiro.mjs --mode plan   --steps "<id|title>…" --skipped "<id>=<why>…"
//   node bin/roteiro.mjs --mode result --steps "<id|title>…" --ran "<id> <id>…" --skipped "<id>=<why>…"
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────
//
// Renan's ruler for this sprint: *describe the pipeline — bake → be born → seed → prove — without a single
// sentence that starts with "and then I…"*. `bin/box-up.sh` could not: its step list lived in a comment at
// the top of the file, so the only way to know what a run DID was to read four hundred lines of scrollback
// and trust that every step still had a `say` line. A step that stops running is then invisible, and a step
// that is SKIPPED ON PURPOSE (pk24: the birth can now be asked not to warm) is indistinguishable from one
// that silently disappeared.
//
// ── ★★ AND THE TWO MODES ARE NOT THE SAME SENTENCE, WHICH IS THE WHOLE CARE HERE ─────────────────────────
//
// `bin/bench-summary.guard.mjs` names the shape this house keeps paying for:
//
//     THE SUMMARY DERIVED FROM INTENT (a port variable, a config file) INSTEAD OF FROM RESULT.
//
// So the two modes are LABELLED as what they are, in the output, every time:
//
//   plan    what this invocation WILL do. It is intent, it is printed before anything runs, and it is
//           allowed to be intent because it promises nothing about a box — nothing has happened yet.
//   result  what the run DID. `--ran` carries the ids the run STAMPED (every `say '<id> · …'` in box-up.sh
//           records itself as it happens) and `--skipped` the ones it declared skipped, with the reason.
//           This mode grades: a declared step that neither ran nor was declared skipped is a RED, because
//           the only two honest endings for a step are "it happened" and "it did not happen, because …".
//
// ⛔ THE THREE FAILURES IT REPORTS, and each is a different lie:
//   · a declared step that NEITHER ran nor was skipped — the summary would be silent about it;
//   · a step that ran AND was declared skipped — two answers about one step;
//   · a stamped or skipped id the declaration does not know — the ledger is not the map any more.
//
// It takes its whole subject from its arguments (no file reading, no environment): that is what lets
// `bin/birth-roteiro.guard.mjs` prove every one of those reds in milliseconds, where proving them against a
// real birth costs ~19 minutes.

import process from 'node:process';

const TAG = '[roteiro]';

function argOf(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 || i === process.argv.length - 1 ? fallback : process.argv[i + 1];
}

/** `<id>|<title>` per line. The id is what everything else is keyed on; the title is for the human. */
function parseSteps(raw) {
  const steps = [];
  for (const line of raw.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    const at = text.indexOf('|');
    steps.push(at === -1 ? { id: text, title: '' } : { id: text.slice(0, at).trim(), title: text.slice(at + 1).trim() });
  }
  return steps;
}

/** `<id>=<why>` per line. A skip with no reason is refused: "skipped" alone is the sentence this file exists to forbid. */
function parseSkipped(raw) {
  const out = new Map();
  for (const line of raw.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    const at = text.indexOf('=');
    const id = at === -1 ? text : text.slice(0, at).trim();
    const why = at === -1 ? '' : text.slice(at + 1).trim();
    out.set(id, why);
  }
  return out;
}

const mode = argOf('mode', 'result');
if (mode !== 'plan' && mode !== 'result') {
  console.error(`${TAG} --mode must be "plan" or "result"; got ${JSON.stringify(mode)}.`);
  process.exit(2);
}

const steps = parseSteps(argOf('steps'));
const ran = new Set(argOf('ran').split(/\s+/).filter(Boolean));
const skipped = parseSkipped(argOf('skipped'));

// ⚠️ ANTI-VACUITY, AND IT IS THE FIRST THING. A roteiro over an EMPTY declaration prints a tidy empty list
// and exits 0 — a guard pointed at nothing that blesses everything, which this repository has measured more
// than once. There is no birth with no steps, so an empty `--steps` is this tool accusing itself.
if (steps.length === 0) {
  console.error(
    `${TAG} refusing to print a roteiro over an EMPTY step declaration. Whoever called this passed no ` +
      '--steps, so there is nothing to grade and a green here would mean "every step is accounted for".',
  );
  process.exit(2);
}

const declared = new Set(steps.map((s) => s.id));
const width = Math.max(...steps.map((s) => s.id.length));
const pad = (id) => id.padEnd(width, ' ');
const say = (line) => console.log(`   ${line}`);

const problems = [];

say(
  mode === 'plan'
    ? '★ THE ROTEIRO — what this invocation WILL do (a PLAN: nothing has run yet)'
    : '★ THE ROTEIRO — what this run DID (a RESULT: every ✓ below was stamped by the step itself)',
);
say('');

for (const step of steps) {
  const why = skipped.get(step.id);
  const didRun = ran.has(step.id);
  if (mode === 'plan') {
    if (why === undefined) say(`  →  ${pad(step.id)}  ${step.title}`);
    else {
      say(`  ⏭  ${pad(step.id)}  ${step.title}   — WILL BE SKIPPED`);
      say(`     ${' '.repeat(width)}  why: ${why}`);
    }
    continue;
  }
  if (didRun && why !== undefined) {
    say(`  ⛔ ${pad(step.id)}  ${step.title}   — RAN *AND* WAS DECLARED SKIPPED`);
    problems.push(`${step.id} both ran and was declared skipped ("${why}") — two answers about one step.`);
  } else if (didRun) {
    say(`  ✓  ${pad(step.id)}  ${step.title}`);
  } else if (why !== undefined) {
    say(`  ⏭  ${pad(step.id)}  ${step.title}   — SKIPPED`);
    say(`     ${' '.repeat(width)}  why: ${why}`);
  } else {
    say(`  ⛔ ${pad(step.id)}  ${step.title}   — NEITHER RAN NOR WAS DECLARED SKIPPED`);
    problems.push(
      `${step.id} (${step.title}) neither ran nor was declared skipped. The summary would have said ` +
        'nothing about it at all, which is the one ending a step is not allowed to have.',
    );
  }
}

// A stamp or a skip for something the declaration does not know: the ledger and the script have parted ways.
for (const id of [...ran].sort()) {
  if (!declared.has(id)) problems.push(`step "${id}" ran and the declaration does not list it.`);
}
for (const id of [...skipped.keys()].sort()) {
  if (!declared.has(id)) problems.push(`step "${id}" was declared skipped and the declaration does not list it.`);
}
for (const [id, why] of skipped) {
  if (!why) problems.push(`step "${id}" is declared skipped with NO reason — "skipped" alone is not an answer.`);
}

if (problems.length > 0) {
  say('');
  console.error(`${TAG} ⛔ THIS ROTEIRO DOES NOT ACCOUNT FOR EVERY STEP THE BIRTH DECLARES:`);
  for (const problem of problems) console.error(`   · ${problem}`);
  console.error('');
  process.exit(1);
}

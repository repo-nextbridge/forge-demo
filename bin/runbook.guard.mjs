// ★★ THE RUNBOOK'S LIST OF MANDATORY VARIABLES IS DERIVED, NOT TYPED — and this file is what makes that true.
//
//   node --test bin/runbook.guard.mjs        (or: bash bin/test.sh)
//
// ── THE DEFECT THIS EXISTS FOR, AND IT IS THE ONE THIS REPOSITORY KEEPS PAYING FOR ────────────────────────
//
// `docs/operations/runbook-demo.md` tells an operator which variables to fill before this box is born. A
// runbook that ENUMERATES them by hand is the 143rd copy of a list that already exists somewhere: it is
// right on the day it is written and it ages in silence, because nothing on the box disagrees with a
// paragraph. Measured on 2026-09-04, while writing that document: the product documents 144 variables
// (`docs/reference/configuration.md`, generated) and this box's `.env.example` names 46 of them — the card
// that asked for the runbook said "41 lines", a number that was true of neither file any more. A hand list
// is that, forever.
//
// ★ SO THE LIST HAS ONE SOURCE AND IT IS THE COMPOSE, BECAUSE THE COMPOSE IS WHAT REFUSES.
//
//     `${VAR:?message}` in compose.yml / compose.override.yml IS the definition of "mandatory": compose
//     interpolates the WHOLE file on every command, so a missing one stops `docker compose up` by name,
//     before a container starts. Nothing else on this box has that authority, and no second file has to
//     agree with it.
//
// The runbook carries the same set as a table between two markers, and this guard grades the two against
// each other in both directions: a variable compose starts demanding and the runbook does not mention is
// red; a row the runbook keeps after compose stopped demanding it is red too, because a runbook that asks
// for a variable nothing reads teaches the operator to ignore the list.
//
// ── AND WHERE EACH ONE COMES FROM IS DERIVED AS WELL ──────────────────────────────────────────────────────
//
// "Mandatory" does not mean "typed by a human", and conflating the two is how an operator ends up inventing
// a value for `FORGE_IMAGE`. Every required variable is claimed by exactly ONE of three files, and which one
// is a fact this repository can read:
//
//   `.env.example`             the boring configuration — the operator writes it into `.env`
//   `env-source.sh`            a secret — it is exported into the shell and never lands on disk
//   `bin/images-from-lock.sh`  derived from `forge.lock` — the operator NEVER types it
//
// A required variable claimed by NONE of the three is the worst case and has no red anywhere else: the box
// refuses to start, and nothing tells the operator where the value is supposed to come from. That is a
// failure here.
//
// ── ⚠️ AND IT ACCUSES ITSELF ──────────────────────────────────────────────────────────────────────────────
//
// A guard whose derivation silently returns nothing is indistinguishable from a guard that looked and found
// everything in order — this repository has measured that three times in one day. So the first test grades
// the DERIVATION: the two compose files must exist, be non-empty, and yield a plausible number of required
// variables. If a refactor moves the requirement out of the compose, this goes red naming the file, instead
// of blessing an empty list.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch (error) {
    assert.fail(`${rel} could not be read (${error.code ?? error.message}). This guard derives its whole answer from that file; without it there is no list to grade, and a green here would mean nothing.`);
  }
};

const RUNBOOK_PATH = 'docs/operations/runbook-demo.md';
const COMPOSE_FILES = ['compose.yml', 'compose.override.yml'];

/**
 * Compose's own "this must be set" form. `${VAR:?msg}` refuses an unset OR EMPTY value; `${VAR?msg}` refuses
 * only an unset one — a variable that must EXIST and may be blank. The difference is not pedantry here:
 * `FORGE_ADMIN_TENANT` is deliberately the second, because empty is what puts this box in host mode, and a
 * runbook that told an operator to fill it would take the box out of the mode it runs in.
 *
 * ⚠️ Full-line comments are stripped first. Compose does not interpolate them, so a `${X:?…}` inside one is
 * documentation, not a requirement, and counting it would put a variable in the runbook that nothing reads.
 */
function requiredFrom(source) {
  const body = source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  const found = new Map();
  for (const m of body.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(:?)\?/g)) {
    const [, name, colon] = m;
    // `:?` (refuses empty) wins over `?` (accepts empty) if a name somehow appears as both.
    if (!found.has(name) || colon === ':') found.set(name, colon === ':' ? 'no' : 'yes');
  }
  return found;
}

/** The union over every compose file this box runs, with the `may be empty` verdict carried along. */
function requiredVariables() {
  const all = new Map();
  for (const file of COMPOSE_FILES) {
    for (const [name, mayBeEmpty] of requiredFrom(read(file))) {
      if (!all.has(name) || mayBeEmpty === 'no') all.set(name, mayBeEmpty);
    }
  }
  return all;
}

/** Which of the three files claims a variable — the answer to "where does this value come from?". */
const SOURCES = [
  { label: '.env', file: '.env.example', claims: (body, name) => new RegExp(`^${name}=`, 'm').test(body) },
  { label: 'segredo', file: 'env-source.sh', claims: (body, name) => new RegExp(`^\\s*(require ${name}\\s|export ${name}=)`, 'm').test(body) },
  { label: 'forge.lock', file: 'bin/images-from-lock.sh', claims: (body, name) => new RegExp(`^${name}=`, 'm').test(body) },
];

function provenanceOf(name) {
  return SOURCES.filter((s) => s.claims(read(s.file), name)).map((s) => s.label);
}

/**
 * The runbook's table, read out of the document between its two markers. The markers are what make this a
 * derivation instead of a grep: a row that leaves the block stops being graded, and that has to be a visible
 * edit rather than a paragraph drifting out of scope.
 */
function runbookRows() {
  const doc = read(RUNBOOK_PATH);
  const block = doc.match(/<!-- BEGIN required-env[^>]*-->\n([\s\S]*?)<!-- END required-env -->/);
  assert.ok(
    block,
    `${RUNBOOK_PATH} has no <!-- BEGIN required-env --> … <!-- END required-env --> block. That block IS the ` +
      'list this guard grades; without it the runbook enumerates variables that nothing checks, which is the ' +
      'shape this file exists to forbid.',
  );
  const rows = [];
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\|\s*`([A-Z_][A-Z0-9_]*)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (m) rows.push({ name: m[1], source: m[2].trim(), mayBeEmpty: m[3].trim() });
  }
  return rows;
}

// ── the derivation grades ITSELF first ────────────────────────────────────────────────────────────────────

test('★★ the derivation is not empty — a guard pointed at nothing must accuse itself, not go green', () => {
  for (const file of COMPOSE_FILES) {
    const body = read(file);
    assert.ok(body.trim().length > 0, `${file} is empty; there is no requirement to derive from it.`);
  }
  const required = requiredVariables();
  assert.ok(
    required.size >= 8,
    `only ${required.size} mandatory variable(s) found across ${COMPOSE_FILES.join(' + ')}. This box needs a ` +
      'database, a vault key, four image digests, an origin and two hostnames before it can start, so a ' +
      "number this small means the `${VAR:?…}` form left the compose and this guard is now grading nothing.",
  );
  for (const file of COMPOSE_FILES) {
    assert.ok(
      /\$\{[A-Za-z_][A-Za-z0-9_]*:?\?/.test(read(file)),
      `${file} no longer contains a single \`\${VAR:?…}\`. Either it stopped being a file this box runs, or ` +
        'the requirement moved somewhere this guard cannot see — and the second is silent.',
    );
  }
});

// ── the two directions ────────────────────────────────────────────────────────────────────────────────────

test('★★★ every variable the compose REFUSES to start without is named in the runbook', () => {
  const required = [...requiredVariables().keys()].sort();
  const listed = new Set(runbookRows().map((r) => r.name));
  const missing = required.filter((name) => !listed.has(name));
  assert.deepEqual(
    missing,
    [],
    `the compose refuses to start without ${missing.join(', ')}, and ${RUNBOOK_PATH} does not name ` +
      `${missing.length === 1 ? 'it' : 'them'}. An operator following that runbook would reach ` +
      '`docker compose up` and be stopped by a variable the document never mentioned.',
  );
});

test('★★ …and the runbook asks for nothing the compose stopped requiring', () => {
  const required = requiredVariables();
  const stale = runbookRows()
    .map((r) => r.name)
    .filter((name) => !required.has(name))
    .sort();
  assert.deepEqual(
    stale,
    [],
    `${RUNBOOK_PATH} still demands ${stale.join(', ')}, which no compose file requires any more. A list that ` +
      'asks for values nothing reads is how an operator learns to skim the list.',
  );
});

// ── where each value comes from ───────────────────────────────────────────────────────────────────────────

test('★★★ every mandatory variable has exactly ONE origin, and the runbook states that origin', () => {
  const rows = new Map(runbookRows().map((r) => [r.name, r]));
  const problems = [];
  for (const name of [...requiredVariables().keys()].sort()) {
    const origins = provenanceOf(name);
    if (origins.length === 0) {
      problems.push(
        `${name}: nothing on this box claims it — not .env.example, not env-source.sh, not ` +
          'bin/images-from-lock.sh. The box refuses to start and the operator has nowhere to get the value.',
      );
      continue;
    }
    if (origins.length > 1) {
      problems.push(`${name}: claimed by ${origins.join(' and ')} at once — two places to set one value is two answers.`);
      continue;
    }
    const row = rows.get(name);
    if (row && row.source !== origins[0]) {
      problems.push(`${name}: the runbook says it comes from "${row.source}", the repository says "${origins[0]}".`);
    }
  }
  assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}\n`);
});

test('★★ the runbook marks as "may be empty" exactly the variables compose lets be empty', () => {
  const required = requiredVariables();
  const wrong = [];
  for (const row of runbookRows()) {
    const declared = required.get(row.name);
    if (declared === undefined) continue; // the stale-row test above owns that case
    const said = /^sim\b/i.test(row.mayBeEmpty) ? 'yes' : 'no';
    if (said !== declared) {
      wrong.push(
        `${row.name}: the runbook says "${row.mayBeEmpty}", the compose uses \`\${${row.name}${declared === 'yes' ? '?' : ':?'}…}\` ` +
          `⇒ empty is ${declared === 'yes' ? 'ACCEPTED' : 'REFUSED'}. Telling an operator to fill a variable whose empty ` +
          'value is the configuration changes what the box is.',
      );
    }
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
});

// ── the gap this document is born with ────────────────────────────────────────────────────────────────────

test('★ the runbook still says out loud that it is incomplete, and between which two steps', () => {
  const doc = read(RUNBOOK_PATH);
  const gap = doc.match(/<!-- BEGIN staging-gap -->\n([\s\S]*?)<!-- END staging-gap -->/);
  assert.ok(
    gap,
    `${RUNBOOK_PATH} no longer carries the <!-- BEGIN staging-gap --> block. That block is the document ` +
      'saying it describes a sequence that is going to grow a step; without it the runbook reads as final ' +
      'and ages in silence, which is the one thing it was asked not to do.',
  );
  for (const needle of ['3', '5']) {
    assert.ok(
      gap[1].includes(needle),
      `the gap block no longer names step ${needle}. The missing degrau falls BETWEEN steps 3 and 5 of §2 — ` +
        'a gap that does not say where it goes is a disclaimer, not a map.',
    );
  }
});

// ★★ THE EVIDENCE IS TAKEN **BEFORE** ANYTHING RECREATES A CONTAINER — and the order is what is graded.
//
// The capture mechanism working proves nothing on its own: on 2026-09-05 the kernel's log existed, was
// perfectly readable, and was gone twenty-two seconds later because the failure message told the operator to
// run the one command that ends in `docker compose up -d --force-recreate`. What saves the evidence is not
// the existence of `bin/capture-evidence.mjs` — it is WHERE in `bin/box-up.sh` it is called from. So that
// placement is a graded property of the file, not a habit of whoever edits it next.
//
// TWO PLACEMENTS, TWO REASONS:
//   · `die()`            — every red exit of a birth. The seed's 502 left through here.
//   · the promotion      — `--tailnet` recreates seven services; the capture must precede that line.
//
// ── ⚠️ AND THE GUARD ACCUSES ITSELF WHEN IT LOSES ITS SUBJECT ───────────────────────────────────────────────
//
// A guard that looks for "A before B" and cannot find B is a guard that passes for the rest of time. That is
// the exact shape of the vacuum failure this repository keeps paying for: the check stays green while the
// thing it checks stops existing. So EVERY anchor below is asserted to exist first, with its own message,
// and the ordering assertions run only once both ends are real.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOX_UP = join(ROOT, 'bin', 'box-up.sh');
const source = readFileSync(BOX_UP, 'utf8');
const lines = source.split('\n');

/** Line numbers (1-based) of every line that matches, code only — a mention inside a comment is prose. */
const hits = (re) =>
  lines
    .map((line, i) => ({ n: i + 1, line }))
    .filter(({ line }) => !/^\s*#/.test(line) && re.test(line))
    .map(({ n }) => n);

describe('the anchors this guard grades still exist', () => {
  // ⚠️ THESE ARE THE SELF-ACCUSATIONS. Each one names what disappeared, so a rename does not silently
  // decommission the ordering checks below it.
  it('bin/box-up.sh has a `die()`, which is how a red birth leaves', () => {
    assert.ok(
      hits(/^die\(\)/).length === 1,
      'no `die()` in bin/box-up.sh. This guard exists to prove a red birth captures evidence BEFORE it ' +
        'exits; with no `die()` it has no subject and must not stay green — find where the script now ' +
        'exits on failure and re-point this check.',
    );
  });

  it('the promotion still ends in a --force-recreate, which is what destroys the witness', () => {
    assert.ok(
      hits(/--force-recreate/).length >= 1,
      'no `--force-recreate` in bin/box-up.sh. That line is the whole reason this slice exists (the ' +
        'container that served the seed was created 04:01:44 and replaced 04:02:06). If the promotion no ' +
        'longer recreates anything, DELETE this check deliberately — do not let it pass by absence.',
    );
  });

  it('the capture script is actually reached from the birth script', () => {
    assert.ok(
      hits(/capture-evidence\.mjs/).length >= 1,
      'bin/box-up.sh never runs bin/capture-evidence.mjs. The mechanism can be perfect and still save ' +
        'nothing: what preserves a red birth is the CALL, from the paths below.',
    );
    assert.ok(
      hits(/^capture_evidence\(\)/).length === 1,
      'no `capture_evidence()` shell function in bin/box-up.sh — the two call sites graded below have ' +
        'nothing to call.',
    );
  });
});

/** Every INVOCATION of the shell wrapper (its own definition line excluded). */
const invocations = hits(/(^|[;&|]|\s)capture_evidence\s+["'$a-z]/i).filter((n) => !/^capture_evidence\(\)/.test(lines[n - 1]));

describe('where the capture sits', () => {
  it('★ the promotion captures BEFORE it recreates — the 22 seconds that ate the 04:01 evidence', () => {
    const recreate = hits(/--force-recreate/)[0];
    const before = invocations.filter((n) => n < recreate);
    assert.ok(
      before.length >= 1,
      `bin/box-up.sh:${recreate} recreates the services, and no \`capture_evidence\` call precedes it ` +
        `(invocations at: ${invocations.join(', ') || 'none'}). A capture AFTER the recreate reads the log ` +
        'of a container that was born seconds ago and knows nothing about the run that failed.',
    );
    // ★ AND IT HAS TO BE THE PROMOTION'S OWN, not some call four hundred lines up that happens to sort
    // first. Ten lines is the whole window between "here is what we are about to destroy" and destroying it.
    assert.ok(
      before.some((n) => recreate - n <= 10),
      `the nearest capture is bin/box-up.sh:${before.at(-1)}, ${recreate - before.at(-1)} lines above the ` +
        'recreate at ' + recreate + '. Anything can happen in between; put it immediately before the line.',
    );
  });

  it('★ a red birth captures before it exits — `die()` is the only way out of a failed step', () => {
    const dieLine = hits(/^die\(\)/)[0];
    // `die()` is a one-line function in this script; the capture has to be inside it, before the `exit 1`.
    const body = lines[dieLine - 1];
    assert.match(
      body,
      /capture_evidence/,
      `bin/box-up.sh:${dieLine} — \`die()\` exits without taking evidence. Every failed step of a birth ` +
        'leaves through here, including the `catalog.collection.pin → HTTP 502` of 2026-09-05.',
    );
    assert.ok(
      body.indexOf('capture_evidence') < body.indexOf('exit 1'),
      '`die()` exits before it captures. The order is the whole point.',
    );
  });

  it('the capture never changes the verdict of the run that called it', () => {
    // A post-mortem that can turn a green promotion red, or that can mask a red birth, is worse than none.
    const runner = hits(/capture-evidence\.mjs/);
    assert.ok(runner.length >= 1, 'nothing runs capture-evidence.mjs — see the anchor check above.');
    // The wrapper swallows the child's status once, for every caller. Graded on the definition rather than
    // on each call site so that adding a third caller cannot forget it.
    const defAt = hits(/^capture_evidence\(\)/)[0];
    const fn = lines.slice(defAt - 1, defAt + 8).join('\n');
    assert.match(
      fn,
      /\|\|\s*true/,
      'capture_evidence() lets the post-mortem fail the run that called it. A birth that already failed is ' +
        'not improved by a second failure on top of it.',
    );
  });

  it('and it stays quiet on a run that never started a container', () => {
    // `die 'jq is required.'` has no box to take evidence from; an accusation there is noise on the one
    // screen that has to stay readable. The mechanism's own void-accusation is `bin/evidence.test.mjs`'s.
    const defAt = hits(/^capture_evidence\(\)/)[0];
    const fn = lines.slice(defAt - 1, defAt + 8).join('\n');
    assert.match(fn, /BOX_TOUCHED/, 'capture_evidence() does not check whether this run ever started a container.');
    assert.ok(hits(/^BOX_TOUCHED=1$/).length >= 1, 'nothing ever sets BOX_TOUCHED=1, so the capture is dead code.');
  });
});

describe('the operator is told where it went', () => {
  it('the remains directory is gitignored — it is a box\'s corpse, not source', () => {
    const ignored = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    assert.match(
      ignored,
      /^postmortem\/$/m,
      '`postmortem/` is not in .gitignore. Container logs carry tokens, hostnames and buyer data; the ' +
        'first red birth would offer to commit them.',
    );
  });
});

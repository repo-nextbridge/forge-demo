#!/usr/bin/env node
// ⛔ THE CACHE BUST IS THE LAST THING EVERY PHASE DOES — and this is the rule that holds the word LAST.
//
// ★ WHY A GUARD AND NOT A COMMENT. The bust is invisible when it is wrong. A seed that composes a home and
// then leaves the shop serving the previous render exits 0, logs nothing unusual, and the symptom lands on
// whoever opens the page — who has no reason on earth to suspect a seed. That is exactly how it stayed
// wrong for the eight days the `APOSENTA-VITRINE-MJS` card sat open: the bust was a private step of
// `seed/vitrine.mjs`, so it covered the SPORTS store alone and ran with three further writers behind it
// (`seedLogistics`, `seedAudience`, `seedCommerce`) inside the very same phase.
//
// ⇒ TWO THINGS ARE GRADED, and neither is a list of anything:
//
//   1. EVERY PHASE OF `bin/seed.mjs` ENDS WITH THE PURGE. The phases are found by their own end markers in
//      the file, so a THIRD phase added tomorrow is graded the day it is written, with no edit here.
//   2. NOTHING RUNS AFTER IT. The last executable line before each end marker must BE the purge call. Append
//      a write below it and this goes red naming the line you appended — which is the only moment anybody
//      would ever notice, because the run itself will not complain.
//
// ⚠️ ANTI-VACUUM. A guard that passes because it found no phase is a guard that grades nothing. If the end
// markers stop being found, or the purge module stops being imported, this fails on that alone.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(HERE, 'bin/seed.mjs');
const source = readFileSync(SEED, 'utf8');
const lines = source.split('\n');

/** The call the seed makes, spelled once. A different spelling here than in the file is the guard lying. */
const CALL = 'await purgeStorefrontCache({ api, read, rows, log });';

/** Every phase's closing line, FOUND rather than listed: `} // ── end of the <name> phase ───…`. */
const ENDS = lines
  .map((line, i) => ({ line, i }))
  .filter(({ line }) => /^\}\s*\/\/\s*──\s*end of the .* phase/.test(line))
  .map(({ line, i }) => ({ name: /end of the (.*?) phase/.exec(line)[1], at: i }));

/** Executable, i.e. not blank and not a `//` comment. Block comments do not appear at this nesting. */
const isCode = (line) => line.trim() !== '' && !line.trim().startsWith('//');

test('bin/seed.mjs imports the box-wide purge — the module the bust now lives in', () => {
  // `assert.ok`, never `assert.match`: a failed match prints the WHOLE 80 KB of bin/seed.mjs as `actual`,
  // which buries the sentence that says what to do.
  assert.ok(
    /import \{ purgeStorefrontCache \} from '\.\.\/seed\/purge\.mjs';/.test(source),
    'bin/seed.mjs no longer imports seed/purge.mjs. The cache bust used to be a private step of\n' +
      'seed/vitrine.mjs, where it covered one store of four; deleting the import puts it back to zero, and\n' +
      'the only symptom is a shop serving the render it had before the seed ran.',
  );
});

test('THE VACUUM: the phases are found, so this guard has something to grade', () => {
  assert.ok(
    ENDS.length >= 2,
    `bin/seed.mjs shows ${ENDS.length} phase-end marker(s); the file has had two (curated, window) since\n` +
      'the window was split out. Either the markers were renamed — in which case this guard was silently\n' +
      'grading nothing — or the phases are gone. Both need a human.',
  );
});

for (const phase of ENDS) {
  test(`the ${phase.name} phase ENDS with the cache bust — nothing may run after it`, () => {
    let at = phase.at - 1;
    while (at >= 0 && !isCode(lines[at])) at -= 1;
    assert.ok(at >= 0, `no executable line found before the end of the ${phase.name} phase`);
    assert.equal(
      lines[at].trim(),
      CALL,
      `the LAST thing the ${phase.name} phase does is\n` +
        `    ${lines[at].trim()}\n` +
        `  (bin/seed.mjs:${at + 1}), and it must be\n` +
        `    ${CALL}\n` +
        '  Everything a phase writes after the bust lands behind a cache this run has just declared fresh.\n' +
        '  Move your step ABOVE the purge — that is the whole of the rule.',
    );
  });
}

test('the purge is called once per phase and nowhere else — one owner, not several', () => {
  const calls = lines.filter((line) => line.trim() === CALL).length;
  assert.equal(
    calls,
    ENDS.length,
    `bin/seed.mjs makes ${calls} purge call(s) for ${ENDS.length} phase(s). One per phase: a second call\n` +
      'inside a phase is a second author of the same fact, and the earlier one then busts a cache that the\n' +
      'steps between the two are still filling.',
  );
});

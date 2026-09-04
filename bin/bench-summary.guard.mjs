// ★★ THE BENCH BLOCK PRINTS WHAT STOOD UP, NEVER WHAT WAS ASKED FOR.
//
// F8 of the from-zero install rehearsal (03–04/09): a birth in which the totem never started still ended
// with `totem http://localhost:8203` in the summary and exit 0. Both failure paths of step 7 were `note`,
// not `die`, and the `⚠️` sat ~370 lines above the line that said the opposite. It is the fourth occurrence
// of one shape that night — the promotion announcing two admin doors having claimed one, the verifier
// accusing correct data, the ✓ printed without a row being read:
//
//   ⇒ THE SUMMARY DERIVED FROM INTENT (a port variable, a config file) INSTEAD OF FROM RESULT.
//
// This reads the source rather than running a birth, and that is the trade: a real birth costs ~19 minutes
// and this costs milliseconds. It cannot prove the totem starts; it CAN prove the summary is not allowed to
// claim it did. The behavioural half is the birth itself, which now exits non-zero and says which thing is
// not standing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'box-up.sh'), 'utf8');

/** The bench block — from `say 'the bench'` to the end of the file. */
function benchBlock() {
  const i = SRC.indexOf("say 'the bench'");
  assert.ok(i > 0, "the bench block is gone — this guard is about a block that must exist");
  return SRC.slice(i);
}

test('the totem address is printed only under a flag the RUN set', () => {
  const bench = benchBlock();
  const line = bench.split('\n').find((l) => l.includes('totem     http://'));
  assert.ok(line, 'no totem address line in the bench block');
  // The address must live inside a conditional on the flag, not at the block's top level.
  const before = bench.slice(0, bench.indexOf(line));
  assert.match(
    before.slice(-400),
    /if \[ -n "\$\{TOTEM_UP:-\}" \]/,
    'the totem address is printed unconditionally — a birth where it never started would announce it anyway',
  );
});

test('step 7 raises the flag only when the container actually came up', () => {
  // `TOTEM_UP=1` must be reachable ONLY from the success branch of the `dc up` it guards.
  const raises = [...SRC.matchAll(/TOTEM_UP=1/g)];
  assert.equal(raises.length, 1, 'the flag is raised in more than one place — one of them will drift');
  const around = SRC.slice(Math.max(0, raises[0].index - 260), raises[0].index);
  assert.match(around, /if dc up -d totem/, 'the flag is not guarded by the command whose success it claims');
});

test('a totem that did not stand makes the run exit non-zero', () => {
  assert.match(
    SRC,
    /UNSETTLED_EXTRA[\s\S]{0,400}exit 1/,
    'nothing turns "the totem is not running" into an exit code — a script downstream reads the code, not the prose',
  );
});

test('the forked shop prints its RESOLVED id, never a placeholder', () => {
  const bench = benchBlock();
  assert.ok(
    !bench.includes('<cafe store id>'),
    'the bench block still prints a literal placeholder — an address nobody can paste',
  );
  assert.match(bench, /\$\{CAFE_STORE\}/, 'the café line does not print the id step 3c resolved');
});

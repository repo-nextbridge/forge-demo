// ★★ STEP 9 SPEAKS WHILE IT WORKS — the speaking seed of `bin/box-up.sh`, RUN, not read.
//
//   node --test bin/seed-heartbeat.guard.mjs      (or: bash bin/test.sh)
//
// ⛔ THE DEFECT THIS HOLDS, MEASURED 2026-10-10 (RESULTADOS-dx0 N10). Step 9 was `dc run … seed-demo.js 2>&1 |
// tail -6`: `tail` holds everything until the one-shot exits, and the catalogue takes 20+ minutes on a bench.
// The terminal said nothing for 21 of them while the kernel was writing its progress into the database every
// second. A new developer cannot tell that from a hang.
//
// WHAT THIS GUARD REACHES, SAID OUT LOUD: the block between `# >>> THE SPEAKING SEED` / `# <<< THE SPEAKING
// SEED`, sourced into bash with a FAKE `dc` (a one-shot that talks for ~3 s, and a database that answers one
// progress row) and a 1-second beat. It does not start a container. Whether step 9 CALLS that block is
// asserted on the script's code with comments stripped. The real run is in RESULTADOS-dx-i4.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(ROOT, 'bin', 'box-up.sh'), 'utf8');

/** Code only: a `#` comment line says nothing about what runs. */
const code = (text) =>
  text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

function block() {
  const m = SCRIPT.match(/\n# >>> THE SPEAKING SEED\n([\s\S]*?)\n# <<< THE SPEAKING SEED\n/);
  assert.ok(
    m,
    'bin/box-up.sh no longer marks `# >>> THE SPEAKING SEED` / `# <<< THE SPEAKING SEED`. Those markers are ' +
      'how this guard runs the block, so a rename here is a guard that runs nothing.',
  );
  return m[1];
}

// A one-shot that talks for ~3 s and ends on ten numbered lines; a database with one running action.
const FAKE = String.raw`
note() { printf '   %s\n' "$*" >&2; }
dc() {
  case "$1" in
    run) echo '[seed-demo] media: catalog verified'; sleep 3
         for i in 1 2 3 4 5 6 7 8 9 10; do echo "[seed-demo] closing line $i"; done
         return "$STUB_RC" ;;
    exec) printf 'demo-data:populate\tSKUs\t4120\t8708\n' ;;
  esac
}
`;

function run(rc) {
  const sh =
    block() +
    FAKE +
    `\nFORGE_SEED_HEARTBEAT_S=1 seed_demo_speaking forgeco loja; r=$?\necho "END rc=$r" >&2; sleep 2.5\n`;
  const out = spawnSync('bash', ['-c', sh], { encoding: 'utf8', env: { ...process.env, STUB_RC: String(rc) } });
  return out.stderr;
}

test('step 9 beats WHILE the one-shot runs, with the phase and count the database holds', () => {
  const err = run(0);
  const beats = err.split('\n').filter((l) => l.includes('⏱'));
  assert.ok(
    beats.length >= 2,
    `a one-shot that ran ~3 s with a 1 s beat produced ${beats.length} beat(s). Step 9 is silent again — the ` +
      `21 minutes of RESULTADOS-dx0 N10. stderr was:\n${err}`,
  );
  assert.match(beats[0], /forgeco · demo-data:populate — SKUs 4120\/8708/);
  assert.match(err, /kernel: \[seed-demo\] media: catalog verified/);
});

test('it still ends on the kernel\'s LAST SIX lines, and the beat dies with it', () => {
  const err = run(0);
  const [before, after] = err.split('END rc=0');
  assert.ok(after !== undefined, `the function did not return rc=0:\n${err}`);
  for (let i = 5; i <= 10; i++) assert.match(before, new RegExp(`closing line ${i}\\n`));
  assert.doesNotMatch(before, /closing line 4\n/, 'more than the last six lines were printed');
  assert.doesNotMatch(after, /⏱/, 'a beat arrived AFTER step 9 returned — the heartbeat outlived its seed');
});

test('a failing one-shot is a failing step: its exit code comes back', () => {
  assert.match(run(3), /END rc=3/);
});

test('step 9 calls the speaking seed and pipes the one-shot into nothing', () => {
  const step9 = SCRIPT.match(/\nsay '9 ·[\s\S]*?\nsay '10 ·/);
  assert.ok(step9, 'step 9 / step 10 headers moved; this guard can no longer find step 9');
  const c = code(step9[0]);
  assert.match(c, /\bseed_demo_speaking "\$t" "\$handle"/);
  assert.doesNotMatch(c, /seed-demo\.js[^\n]*\|/, 'step 9 pipes seed-demo again — a pipe into tail is the silence');
});

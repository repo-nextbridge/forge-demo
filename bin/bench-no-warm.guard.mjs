// ★★ DX-I6 — A LOCAL BENCH IS BORN WITHOUT WARMING; A REMOTE OR PROMOTED BOX STILL WARMS.
//
//   node --test bin/bench-no-warm.guard.mjs      (or: bash bin/test.sh)
//
// ⛔ WHAT IT STOPS, MEASURED 2026-10-10 (DX-I2): step 14 costs 5 min 05 s for 21 615 urls on a local bench and
// only spares the FIRST visitor a cold cache — on a bench, the developer who just paid the five minutes. So
// `bin/box-up.sh` now decides the default from `FORGE_PUBLIC_ORIGIN`: loopback (the `_forge_loopback_door_port`
// rule of `env-source.sh`) ⇒ step 14 skipped by name; anything else ⇒ warmed, as before. Each rule below is one
// way that decision can quietly stop meaning what it says: a local bench that still warms, a deployed or
// promoted box that stops warming, a `--warm` that is ignored, two contradictory flags where one silently
// wins, a plan that says one reason and a run that gives another, or a second copy of "what is loopback".
//
// ★ THE PLAN IS RUN FOR REAL, over a copy of what `--plan` reads with a `.env` written beside it — the REAL
// `env-source.sh` included, because the rule is lifted out of it at runtime and a stub would grade nothing.

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8');
const STAG = readFileSync(join(ROOT, 'deploy/stag.env'), 'utf8');

/** A copy of what `--plan` reads, so a `.env` can be written beside it without touching this checkout's. */
function boxUpPlan(envText, args = []) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'bench-no-warm-')));
  try {
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'seed'));
    for (const f of ['bin/box-up.sh', 'bin/box-tenants.mjs', 'bin/roteiro.mjs', 'bin/require-node.sh', 'forge.lock', 'seed/box.json', 'env-source.sh']) {
      cpSync(join(ROOT, f), join(dir, f));
    }
    if (envText !== null) writeFileSync(join(dir, '.env'), envText);
    const r = spawnSync('bash', [join(dir, 'bin/box-up.sh'), '--plan', ...args], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const skips14 = (out) => /⏭\s+14\s.*WILL BE SKIPPED/.test(out);
const runs14 = (out) => /→\s+14\s/.test(out);
const LOCAL_WHY = /why: step 14 skipped: a local bench, not warmed by default — `--warm` or `--warm-only` if you need it/;

// ── 1 · the default, by where the box is ───────────────────────────────────────────────────────────────────

const LOCAL = {
  'the default bench (.env.example)': 'FORGE_PUBLIC_ORIGIN=http://localhost:8200\n',
  'a second bench by port block, origin not yet written': 'FORGE_BENCH_PORT_BLOCK=86\n',
  'a quoted 127.0.0.1 origin': "FORGE_PUBLIC_ORIGIN='http://127.0.0.1:8300'\n",
};
const WARMS = {
  'a remote box (deploy/stag.env)': STAG,
  'a bench promoted to its tailnet': 'FORGE_BENCH_PORT_BLOCK=86\nFORGE_PUBLIC_ORIGIN=https://bench.tailnet-example.ts.net\n',
  'a bench promoted to a hostname': 'FORGE_PUBLIC_ORIGIN=https://demo.example.test\n',
  'a checkout with no .env at all (the birth refuses it; the plan keeps the old default)': null,
};

test('★ anti-vacuum — the rule this guard grades is really lifted from env-source.sh, and box-up has no copy', () => {
  // A box-up whose lift found nothing falls back to "never local", which would make every WARMS case below
  // green over a rule that no longer exists — so the source of the rule is asserted first.
  assert.match(readFileSync(join(ROOT, 'env-source.sh'), 'utf8'), /\n_forge_loopback_door_port\(\) \{/);
  const code = SRC.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(code, /sed -n '\/\^_forge_loopback_door_port\(\) \{\/,\/\^\}\/p' "\$HERE\/env-source\.sh"/, 'box-up.sh no longer lifts the loopback rule out of env-source.sh.');
  assert.doesNotMatch(code, /^_forge_loopback_door_port\(\) \{/m, 'box-up.sh defines its own `_forge_loopback_door_port` — a second answer to "what is a bench".');
  assert.equal(STAG.match(/^FORGE_PUBLIC_ORIGIN=(.*)$/m)?.[1]?.startsWith('https://'), true, 'deploy/stag.env no longer declares an https origin — the remote case below would not be remote.');
});

for (const [name, env] of Object.entries(LOCAL)) {
  test(`★★★ local, no flag — ${name}: step 14 is SKIPPED by name, with the one sentence, and 14-bis still runs`, () => {
    const { status, out } = boxUpPlan(env);
    assert.equal(status, 0, out);
    assert.ok(skips14(out), `a local bench plans to warm:\n${out}`);
    assert.match(out, LOCAL_WHY, `the skip does not carry the local-bench sentence:\n${out}`);
    assert.match(out, /→\s+14-bis\s/, `14-bis went with it — the doors are not warmth:\n${out}`);
  });
  test(`★★★ local, --warm — ${name}: step 14 RUNS`, () => {
    const { status, out } = boxUpPlan(env, ['--warm']);
    assert.equal(status, 0, out);
    assert.ok(runs14(out) && !skips14(out), `--warm was ignored on a local bench:\n${out}`);
  });
}

for (const [name, env] of Object.entries(WARMS)) {
  test(`★★★ not local, no flag — ${name}: step 14 RUNS, as before this slice`, () => {
    const { status, out } = boxUpPlan(env);
    assert.equal(status, 0, out);
    assert.ok(runs14(out) && !skips14(out), `a box that serves people stopped warming:\n${out}`);
  });
}

test('★★ --no-warm still skips anywhere — with ITS reason, not the local one', () => {
  for (const env of [LOCAL['the default bench (.env.example)'], STAG]) {
    const { status, out } = boxUpPlan(env, ['--no-warm']);
    assert.equal(status, 0, out);
    assert.ok(skips14(out), out);
    assert.match(out, /why: asked with --no-warm/, out);
  }
});

test('★★★ --warm --no-warm is REFUSED (exit 1, nothing planned), in either order', () => {
  for (const args of [['--warm', '--no-warm'], ['--no-warm', '--warm']]) {
    const { status, out } = boxUpPlan(LOCAL['the default bench (.env.example)'], args);
    assert.equal(status, 1, `box-up --plan ${args.join(' ')} was accepted:\n${out}`);
    assert.match(out, /contradict/, out);
    assert.doesNotMatch(out, /THE ROTEIRO/, out);
  }
});

test('★★ --warm is refused where it means nothing (it is about the BIRTH)', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'bench-no-warm-')));
  try {
    for (const args of [['--warm-only', '--warm'], ['--promote', 'tailnet', '--warm'], ['--verdict-only', '--warm']]) {
      const r = spawnSync('bash', [join(ROOT, 'bin/box-up.sh'), ...args], { encoding: 'utf8', cwd: dir });
      assert.equal(r.status, 1, `box-up ${args.join(' ')} was accepted:\n${r.stdout}${r.stderr}`);
      assert.match(`${r.stderr}`, /about the BIRTH/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 2 · the plan and the run decide once, and say the same sentence ────────────────────────────────────────

test('★★ the decision is taken ONCE, before `--plan` — so the run cannot skip for a reason the plan did not give', () => {
  const code = SRC.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const planExit = code.indexOf('if [ "$PLAN_ONLY" = 1 ]; then');
  assert.ok(planExit > 0, 'no --plan block found in bin/box-up.sh');
  const assigns = [...code.matchAll(/^\s*(?:WARM|WARM_SKIP_WHY)=/gm)].map((m) => m.index);
  assert.ok(assigns.length >= 3, `found ${assigns.length} assignment(s) of WARM/WARM_SKIP_WHY — the decision did not parse.`);
  const late = assigns.filter((at) => at > planExit);
  assert.deepEqual(late, [], 'WARM or WARM_SKIP_WHY is reassigned AFTER the plan: the run can now skip (or warm) for a reason the plan never said.');
  // …and the run's skip prints that same variable (birth-roteiro.guard.mjs grades the branch; this is the link).
  assert.match(code, /^\s*skip 14 "\$WARM_SKIP_WHY"$/m);
});

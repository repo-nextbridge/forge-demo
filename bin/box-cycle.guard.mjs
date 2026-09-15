// ★★★ THE SCHEDULED CYCLE IS FOUR GESTURES IN ONE ORDER, AND THE ORDER IS THE WHOLE DECISION.
//
//   node --test bin/box-cycle.guard.mjs      (or: bash bin/test.sh)
//
// ── WHAT THIS GRADES, AND WHY IT CANNOT BE GRADED ANY OTHER WAY ───────────────────────────────────────────
//
// `bin/box-cycle.sh` tears the box down, births it, promotes it and warms it — ~90 minutes, on a machine
// with docker, against a live box. Nothing about that can run here. What CAN run here is everything that
// decides whether the run will be right:
//
//   1 · THE FOUR GESTURES AND THEIR ORDER, read from the script's own declaration and from the calls it
//       makes. A gesture removed, renamed or reordered is red — which is the point: the order is the
//       decision (`bin/reset-complete.guard.mjs` is the same sentence about the birth's own tail), and a
//       wrapper of four calls is otherwise perfectly able to lose one in silence.
//   2 · `--plan` AND `--dry-run`, RUN FOR REAL. The plan touches nothing and says what it would do; the
//       rehearsal exercises the whole mechanism — lock, log, roteiro, verdict — with every gesture printed
//       instead of executed. That is how this slice was reviewed without a box, and it is how it stays
//       reviewable.
//   3 · THE LOCK, BOTH DIRECTIONS. A live holder must REFUSE (a second run tears down the box the first is
//       seeding) and a dead holder must be TAKEN OVER (a lock that outlives its process turns one crash
//       into a box that is never reset again). Both are staged here with a real lock file.
//   4 · THE EXIT POLICY, run as a function over fabricated results. "Which non-zero is acceptable" is the
//       question the cycle exists to answer, and the answer today is "none" — so this file proves the
//       strictness AND proves the pardon mechanism works, so the first measured pardon does not have to be
//       written blind.
//   5 · THE GESTURE THE CYCLE DEPENDS ON AND DOES NOT OWN: `bash bin/box-up.sh --warm-only`. It is graded
//       here, against a fake box, because it exists FOR this cycle — the warming has to happen after the
//       promotion, and the loop that does it may not be copied into the script that schedules it.
//
// ⚠️ THE CRON ENVIRONMENT IS A TEST AND NOT A NOTE. A scheduler hands a script a PATH with neither `node`
// nor `jq`, so `env -i` is how this is asked. `bin/node-floor.guard.mjs` grades the same case for the birth;
// this one grades it for the wrapper, because the wrapper is what a scheduler actually invokes.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const CYCLE = read('bin/box-cycle.sh');
const BOX_UP = read('bin/box-up.sh');

/** The ids the cycle declares, in the order it declares them. */
function declaredGestures() {
  const block = CYCLE.match(/\nCYCLE_STEPS='([\s\S]*?)'\n/);
  assert.ok(
    block,
    "bin/box-cycle.sh no longer declares CYCLE_STEPS='…'. That list IS the cycle: it is what bin/roteiro.mjs " +
      'grades the run against, and without it a gesture that stops happening is invisible.',
  );
  return block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf('|');
      assert.ok(at > 0, `CYCLE_STEPS line ${JSON.stringify(line)} is not \`<id>|<title>\``);
      return { id: line.slice(0, at), title: line.slice(at + 1) };
    });
}

/** `bash bin/box-cycle.sh <args…>` for real, with its log directory pointed somewhere disposable.
 *
 * ⚠️ BOTH CHANNELS ARE KEPT, and that is a repair rather than a convenience: the cycle's SHORT channel — the
 * four lines a scheduler's mail carries, including where the log is — is stderr on purpose, and `execFileSync`
 * returns only stdout on success. Read that way, a run that said everything looked silent. */
function runCycle(args, { logDir, env = {} } = {}) {
  const r = spawnSync('bash', [join(ROOT, 'bin/box-cycle.sh'), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(logDir ? { FORGE_CYCLE_LOG_DIR: logDir } : {}), ...env },
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** A disposable directory, handed to the body and destroyed afterwards whatever happens. */
function withTemp(body) {
  const dir = mkdtempSync(join(tmpdir(), 'box-cycle-guard-'));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 1 · THE FOUR GESTURES, AND THE ORDER ──────────────────────────────────────────────────────────────────

test('★ the cycle declares four gestures, each with a title — anti-vacuity, first', () => {
  // ⚠️ EVERY RULE BELOW COMPARES THE DECLARATION WITH SOMETHING. Two empty lists agree perfectly, and a
  //    guard that goes green over nothing is the failure this repository has measured more than once.
  const gestures = declaredGestures();
  assert.deepEqual(
    gestures.map((g) => g.id),
    ['1', '2', '3', '4'],
    'the cycle no longer declares exactly the four gestures 1..4 in order. It is four: the box dies, it is ' +
      'born, it is promoted, it is warmed — and a fifth or a missing one is a decision, not a typo.',
  );
  for (const g of gestures) assert.ok(g.title.trim().length > 10, `gesture ${g.id} has no title worth printing at somebody at 3am.`);
});

test('★★★ the four commands are there, in the ONE order that works', () => {
  // The order IS the decision. Read as positions in the file, because that is what a reordering changes.
  const at = (needle) => {
    const i = CYCLE.indexOf(needle);
    assert.ok(i > 0, `bin/box-cycle.sh no longer contains ${JSON.stringify(needle)} — a gesture of the cycle is gone.`);
    return i;
  };
  const down = at('bin/box-down.sh"');
  const birth = at('bin/box-up.sh" --no-warm');
  const promote = at('bin/box-up.sh" --promote "$PROMOTE_TO"');
  const warm = at('bin/box-up.sh" --warm-only');
  assert.ok(down < birth, 'the box is born before it is torn down — the birth would then run against the box that is about to be destroyed.');
  assert.ok(
    birth < promote,
    'the promotion runs before the birth. A birth DE-PROMOTES the admin (the database dies and the admin ' +
      'directory comes back holding only seed/box.json\'s localhost doors), so a promotion before it is undone ' +
      'by it and the box is handed over half promoted.',
  );
  assert.ok(
    promote < warm,
    'the warming runs before the promotion. The promotion ends in `--force-recreate` of every front, so the ' +
      'route cache, the ISR entries and the image derivatives a warm run just filled are destroyed with the ' +
      'containers — ~1h10 paid for a cache deleted minutes later. And on a first promotion the address being ' +
      'warmed would not even be the one the box publishes.',
  );
});

test('★★ every gesture goes through `run_gesture`, so each one is TIMED and its status RECORDED', () => {
  // A call added beside the others without going through it would run and be invisible to both the roteiro
  // and the verdict — the box would be reset by a step no summary mentions.
  const calls = [...CYCLE.matchAll(/^run_gesture (\d) /gm)].map((m) => m[1]);
  assert.deepEqual(calls, ['1', '2', '4'], 'the gestures invoked through run_gesture are not 1, 2 and 4 (3 is inside the promotion branch).');
  assert.match(CYCLE, /run_gesture 3 /, 'gesture 3 is not run through run_gesture either.');
  assert.match(CYCLE, /RESULTS="\$RESULTS\$id=\$status=/, 'run_gesture does not RECORD each gesture\'s status; the verdict would then grade nothing.');
  assert.match(CYCLE, /RAN="\$RAN \$id"/, 'run_gesture does not stamp the gesture as having run, so the roteiro cannot account for it.');
});

test('★★ the order is JUSTIFIED in the file, pointing at the two facts that force it', () => {
  // ⛔ A GUARD THAT ONLY CHECKS POSITIONS TEACHES THE NEXT PERSON TO REORDER AND SILENCE THE GUARD. The
  //    reasons are load-bearing prose: one of them is measured in this repository (the promotion recreates
  //    every front), the other has a guard of its own about the birth's tail.
  assert.match(CYCLE, /reset-complete\.guard\.mjs/, 'the cycle does not point at the guard that already proves the birth\'s own tail is ordered.');
  assert.match(CYCLE, /force-recreate/, 'the cycle does not say why the warming comes after the promotion — the recreate is the reason, and it is measurable in bin/box-up.sh.');
  assert.match(CYCLE, /DE-PROMOTES/, 'the cycle does not say why the promotion is inside it at all.');
});

// ── 2 · `--plan`, RUN FOR REAL, AND IT TOUCHES NOTHING ────────────────────────────────────────────────────

test('★★★ `--plan` names all four gestures, labels itself a PLAN, and creates nothing', () =>
  withTemp((dir) => {
    const logDir = join(dir, 'logs');
    const { status, out } = runCycle(['--plan', '--promote', 'demo.example.com'], { logDir });
    assert.equal(status, 0, `bash bin/box-cycle.sh --plan exited ${status}:\n${out}`);
    assert.match(out, /PLAN: nothing has run yet/, `the plan does not label itself as intent:\n${out}`);
    for (const g of declaredGestures()) assert.match(out, new RegExp(`→\\s+${g.id}\\s`), `gesture ${g.id} is not in the plan:\n${out}`);
    assert.match(out, /--promote demo\.example\.com/, `the plan does not print the destination it was given:\n${out}`);
    assert.match(out, /--warm-only/, `the plan does not name the gesture that warms the box:\n${out}`);
    assert.ok(
      !existsSync(logDir),
      'the plan created its log directory. `--plan` is the one invocation that may promise "nothing was read, ' +
        'started or written", and it is how this slice is reviewed without a box.',
    );
  }));

test('★★★ "no destination" is a DECLARED mode, not an omission — and gesture 3 is skipped WITH its reason', () =>
  withTemp((dir) => {
    const { status, out } = runCycle(['--plan', '--no-promote'], { logDir: join(dir, 'logs') });
    assert.equal(status, 0, out);
    assert.match(out, /⏭\s+3\s.*WILL BE SKIPPED/, `gesture 3 is not marked skipped by a run that asked not to promote:\n${out}`);
    assert.match(out, /why: .*--no-promote/, `the skipped gesture gives no reason. "Skipped" alone is the sentence bin/roteiro.mjs exists to forbid:\n${out}`);
    assert.match(out, /localhost/i, `the reason does not say where the box is left:\n${out}`);
    // ⛔ AND THE OTHER THREE ARE NOT SKIPPED WITH IT.
    for (const id of ['1', '2', '4']) assert.match(out, new RegExp(`→\\s+${id}\\s`), `--no-promote also dropped gesture ${id}:\n${out}`);
  }));

test('★★★ a cycle told NOTHING about a destination REFUSES, and names the three ways to tell it', () =>
  withTemp((dir) => {
    const { status, out } = runCycle([], { logDir: join(dir, 'logs'), env: { FORGE_CYCLE_PROMOTE_TO: '' } });
    assert.equal(status, 2, `a cycle with no destination was accepted (exit ${status}):\n${out}`);
    assert.match(out, /--promote/, out);
    assert.match(out, /FORGE_CYCLE_PROMOTE_TO/, `the refusal does not name the environment variable:\n${out}`);
    assert.match(out, /--no-promote/, `the refusal does not name the declared way to say "there is none":\n${out}`);
    assert.match(out, /Nothing has been read, started or written/, out);
  }));

test('★★ the destination can come from the environment — a unit that would rather hold it there', () =>
  withTemp((dir) => {
    const { status, out } = runCycle(['--plan'], { logDir: join(dir, 'logs'), env: { FORGE_CYCLE_PROMOTE_TO: 'demo.example.com' } });
    assert.equal(status, 0, out);
    assert.match(out, /--promote demo\.example\.com/, `the destination in the environment did not reach the plan:\n${out}`);
  }));

test('★ `--promote` with no destination refuses rather than guessing one', () =>
  withTemp((dir) => {
    const { status, out } = runCycle(['--promote'], { logDir: join(dir, 'logs') });
    assert.equal(status, 2, `\`--promote\` with nothing after it was accepted:\n${out}`);
    assert.match(out, /needs a DESTINATION/, out);
  }));

// ── 3 · `--dry-run`: THE WHOLE MECHANISM, WITH NOTHING EXECUTED ───────────────────────────────────────────

test('★★★ the rehearsal takes a lock, writes ONE log, accounts for every gesture, and says it is a rehearsal', () =>
  withTemp((dir) => {
    const logDir = join(dir, 'logs');
    const { status, out } = runCycle(['--dry-run', '--promote', 'demo.example.com'], { logDir });
    assert.equal(status, 0, `the rehearsal exited ${status}:\n${out}`);

    // The short channel: what a scheduler's mail would carry. It must say WHERE the rest is, before and after.
    assert.match(out, /started .* log: /, `the run does not say where its log is BEFORE the work starts:\n${out}`);
    assert.match(out, /finished GREEN — log: /, `the run does not repeat the log path with its verdict:\n${out}`);

    const logs = readdirSync(logDir).filter((f) => f.endsWith('.log'));
    assert.equal(logs.length, 1, `the run wrote ${logs.length} log(s); one run is one log, with a stamp in its name.`);
    assert.match(logs[0], /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z/, `the log is not stamped: ${logs[0]}`);
    const body = readFileSync(join(logDir, logs[0]), 'utf8');

    // ⛔ THE OUTPUT IS NOT THROWN AWAY: every gesture, its command line, its status and its clock are in it.
    for (const g of declaredGestures()) {
      assert.match(body, new RegExp(`══ ${g.id} · `), `gesture ${g.id} is not in the log:\n${body}`);
      assert.match(body, new RegExp(`^   ${g.id} · .*· \\d+s$`, 'm'), `gesture ${g.id} has no verdict and no clock in the log:\n${body}`);
    }
    assert.match(body, /bin\/box-down\.sh/, `the log does not record the command each gesture ran:\n${body}`);
    assert.match(body, /RESULT: every ✓ below was stamped/, `the log carries no roteiro, so nothing accounts for the gestures:\n${body}`);

    // ⚠️ AND A REHEARSAL MAY NEVER READ AS A CYCLE. A log that says a box was reset when nothing ran is
    //    exactly the summary-from-intent this repository keeps paying for.
    assert.ok(
      (body.match(/REHEARSAL/g) ?? []).length >= 3,
      `the rehearsal does not say so loudly enough to be unmistakable in a log read months later:\n${body}`,
    );

    // The lock is released on the way out, or the next cycle refuses forever.
    assert.ok(!existsSync(join(logDir, 'cycle.lock')), 'the cycle did not release its lock — the next run would refuse, and the one after that, for ever.');
  }));

// ── 4 · THE LOCK, BOTH DIRECTIONS ─────────────────────────────────────────────────────────────────────────

test('★★★ a second cycle REFUSES while the first is alive — it does not queue, and it does not wait in silence', () =>
  withTemp((dir) => {
    const logDir = join(dir, 'logs');
    mkdirSync(logDir, { recursive: true });
    // A live holder: this test's own process. It is unquestionably running.
    writeFileSync(join(logDir, 'cycle.lock'), `pid=${process.pid}\nstarted=STAGED\nlog=/tmp/held.log\nhost=staged\n`, { flag: 'w' });
    const { status, out } = runCycle(['--dry-run', '--no-promote'], { logDir });
    assert.equal(status, 3, `a cycle started while another holds the lock (exit ${status}):\n${out}`);
    assert.match(out, /REFUSING/, out);
    assert.match(out, new RegExp(`pid ${process.pid}`), `the refusal does not name the pid that holds the lock:\n${out}`);
    assert.match(out, /\/tmp\/held\.log/, `the refusal does not point at the running cycle's own log:\n${out}`);
    assert.match(out, /Nothing was touched/, out);
    // ⛔ AND IT DOES NOT DELETE SOMEBODY ELSE'S LOCK ON ITS WAY OUT.
    assert.ok(existsSync(join(logDir, 'cycle.lock')), 'the refused run removed the lock of the run that is still going.');
  }));

test('★★★ …and a lock whose process is GONE is taken over, loudly — one crash may not stop every future cycle', () =>
  withTemp((dir) => {
    const logDir = join(dir, 'logs');
    mkdirSync(logDir, { recursive: true });
    // A pid that cannot be running. Chosen above the usual pid ceiling and checked, rather than assumed.
    let dead = 4194300;
    while (existsSync(`/proc/${dead}`)) dead += 1;
    writeFileSync(join(logDir, 'cycle.lock'), `pid=${dead}\nstarted=DIED-MID-BIRTH\nlog=/tmp/dead.log\nhost=staged\n`, { flag: 'w' });
    const { status, out } = runCycle(['--dry-run', '--no-promote'], { logDir });
    assert.equal(status, 0, `the stale lock was not taken over (exit ${status}):\n${out}`);
    assert.match(out, /STALE LOCK TAKEN OVER/, `the takeover is silent. A lock taken from a dead run is a fact the next person needs:\n${out}`);
    assert.match(out, new RegExp(`pid ${dead}`), `the takeover does not name the dead holder:\n${out}`);
    assert.match(out, /DIED-MID-BIRTH/, `the takeover does not say when the dead run started, nor point at its log:\n${out}`);
  }));

// ── 5 · THE CRON ENVIRONMENT, ASKED WITH `env -i` ────────────────────────────────────────────────────────

test('★★★ a scheduler\'s environment has no node, and the cycle refuses BEFORE it destroys anything', () =>
  withTemp((dir) => {
    // ⛔ THE ORDERING THIS PROVES IS THE EXPENSIVE ONE. Gesture 1 destroys the database. A unit that died on
    //    a missing node AFTER it would leave a box with no data and no birth — so the refusal has to come
    //    first, and `env -i` is the only honest way to ask.
    let status = 0;
    let out = '';
    try {
      out = execFileSync('env', ['-i', 'PATH=/usr/bin:/bin', `HOME=${process.env.HOME ?? '/tmp'}`, 'bash', join(ROOT, 'bin/box-cycle.sh'), '--no-promote'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      status = error.status ?? -1;
      out = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    assert.notEqual(status, 0, `a cycle with no node on PATH was allowed to start:\n${out}`);
    assert.match(out, /there is no `node` on PATH/, `the refusal does not name what is missing:\n${out}`);
    assert.match(out, /Nothing has been read, started or written/, `the refusal does not say it stopped before touching anything:\n${out}`);
    assert.ok(!existsSync(join(dir, 'logs')), 'a refused cycle created its log directory.');
  }));

test('★★ …and with the pinned node on PATH and nothing else, the same environment PLANS', () => {
  // The other direction, without which the test above proves only that `env -i` breaks things.
  const nodeDir = dirname(process.execPath);
  const out = execFileSync(
    'env',
    ['-i', `PATH=${nodeDir}:/usr/bin:/bin`, `HOME=${process.env.HOME ?? '/tmp'}`, 'bash', join(ROOT, 'bin/box-cycle.sh'), '--plan', '--no-promote'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  assert.match(out, /PLAN: nothing has run yet/, `the cycle could not even plan in a minimal environment holding the pinned node:\n${out}`);
});

// ── 6 · THE EXIT POLICY, RUN RATHER THAN READ ────────────────────────────────────────────────────────────
//
// `cycle_verdict` takes its whole subject from its argument and from `CYCLE_TOLERATED`, so it can be sourced
// out of the script and run over fabricated results — which is the only way to grade "which non-zero is
// acceptable" without a 90-minute cycle.

function verdict(results, tolerated = '') {
  // ⚠️ THE RESULTS REACH BASH THROUGH A HERE-DOC, not through a quoted literal: a `\n` inside double quotes
  //    is a backslash and an n, so the first version of this helper handed the verdict ONE line that happened
  //    to start with a zero — and every red below passed as green. Measured while writing this file.
  const script = `
set -uo pipefail
source <(sed -n '/^cycle_verdict()/,/^}/p' ${JSON.stringify(join(ROOT, 'bin/box-cycle.sh'))})
CYCLE_TOLERATED=${JSON.stringify(tolerated)}
cycle_verdict "$(cat <<'GUARD_RESULTS'
${results}
GUARD_RESULTS
)"
`;
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('★★ a cycle whose four gestures all exited 0 is green — the control, without which the reds prove nothing', () => {
  const { status } = verdict('1=0=12\n2=0=1100\n3=0=40\n4=0=900');
  assert.equal(status, 0, 'a clean cycle was graded red.');
});

test('★★★ ANY non-zero is red today, and the verdict NAMES the gesture', () => {
  // ⛔ THE LIST OF PARDONS IS EMPTY ON PURPOSE. A pardon written in advance is the disease bin/verify-config.mjs
  //    already names ("the obvious answer is a checklist, and the checklist is the disease"): it would be
  //    forgiving a red nobody has measured, for a reason nobody will remember.
  for (const [id, results] of [
    ['1', '1=1=3\n2=0=1100\n4=0=900'],
    ['2', '1=0=12\n2=1=1100\n4=0=900'],
    ['4', '1=0=12\n2=0=1100\n4=3=900'],
  ]) {
    const { status, out } = verdict(results);
    assert.equal(status, 1, `gesture ${id} failed and the cycle was graded green:\n${out}`);
    assert.match(out, new RegExp(`gesture ${id} exited`), `the verdict does not name the gesture that failed:\n${out}`);
  }
});

test('★★★ the pardon mechanism works and is NARROW — it forgives one status of one gesture, with its reason', () => {
  // The first real run of this cycle is expected to produce a candidate (a birth that comes back half
  // promoted, repaired by the promotion that follows it). This proves the mechanism that will carry it, in
  // both directions, so that entry can be written from a measurement instead of from hope.
  const tolerated = '2=1|staged by the guard: this is the mechanism, not a real pardon';
  const forgiven = verdict('2=1=1100', tolerated);
  assert.equal(forgiven.status, 0, `a tolerated status was still red:\n${forgiven.out}`);
  assert.match(forgiven.out, /TOLERATES it: staged by the guard/, `a pardon is applied without printing the reason for it:\n${forgiven.out}`);

  const otherStatus = verdict('2=2=1100', tolerated);
  assert.equal(otherStatus.status, 1, `a pardon for exit 1 also forgave exit 2:\n${otherStatus.out}`);
  const otherGesture = verdict('4=1=900', tolerated);
  assert.equal(otherGesture.status, 1, `a pardon for gesture 2 also forgave gesture 4:\n${otherGesture.out}`);
});

test('★★★ every pardon this file really carries names a MEASUREMENT — an entry with no reason is red here', () => {
  // ⚠️ THIS IS THE RULE THAT SURVIVES THIS SLICE. The list is empty today; the day somebody adds to it, the
  //    entry has to say what was measured. A pardon with an empty reason is a silenced red.
  const declared = CYCLE.match(/\nCYCLE_TOLERATED='([\s\S]*?)'\n/);
  assert.ok(declared, 'bin/box-cycle.sh no longer declares CYCLE_TOLERATED — the exit policy has no list, declared or otherwise.');
  for (const line of declared[1].split('\n').map((l) => l.trim()).filter(Boolean)) {
    assert.match(line, /^[^=]+=\d+\|.+/, `the pardon ${JSON.stringify(line)} is not \`<gesture>=<status>|<the measurement that justifies it>\`.`);
    assert.ok(line.split('|').slice(1).join('|').trim().length > 20, `the pardon ${JSON.stringify(line)} carries no reason worth reading.`);
  }
});

// ── 7 · THE GESTURE THE CYCLE DEPENDS ON: `bash bin/box-up.sh --warm-only`, AGAINST A FAKE BOX ───────────
//
// Gesture 4 exists because the warming has to happen AFTER the promotion, and the loop that warms may not be
// copied into this wrapper: it is once per tenant with that tenant's own token, and the rule for the name of
// a tenant's secret already has two authors. So `--warm-only` drives the very loop step 14 drives, and what
// is graded here is that mode's behaviour — extracted and RUN, with the warmer stubbed, so that the four
// statuses it has to tell apart are tested rather than read.

function runWarmOnly({ tenants, statuses }) {
  // The mode block and the loop, lifted out of the script and given a fake box: a `host_node` that answers
  // the status this test wants for each tenant, and no network anywhere.
  const script = `
set -uo pipefail
HERE=/nowhere
TENANTS=${JSON.stringify(tenants.join(' '))}
FORGE_PUBLIC_ORIGIN='http://fake.invalid'
MODE=warm
say() { printf '== %s\\n' "$*" >&2; }
note() { printf '   %s\\n' "$*" >&2; }
die() { printf 'DIE %s\\n' "$*" >&2; exit 9; }
secret_name_for() { printf 'forge-operator-token-%s' "$1"; }
host_node() {
  local t='' prev='' arg status_var
  for arg in "$@"; do [ "$prev" = '--tenant' ] && t="$arg"; prev="$arg"; done
  printf 'warmer ran for %s with token %s\\n' "$t" "\${FORGE_OPERATOR_TOKEN:-<none>}" >&2
  status_var="STATUS_$t"
  return "\${!status_var}"
}
${tenants.map((t) => `export FORGE_OPERATOR_TOKEN_${t.toUpperCase()}='tok-${t}'\nSTATUS_${t}=${statuses[t]}`).join('\n')}
source <(sed -n '/^warm_every_tenant()/,/^}/p' ${JSON.stringify(join(ROOT, 'bin/box-up.sh'))})
source <(sed -n '/^if \\[ "\\$MODE" = warm \\]; then/,/^fi$/p' ${JSON.stringify(join(ROOT, 'bin/box-up.sh'))})
`;
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('★★★ `--warm-only` warms EVERY tenant, each with its OWN token — one token cannot speak for two brands', () => {
  const { status, out } = runWarmOnly({ tenants: ['forgeco', 'forgecafe'], statuses: { forgeco: 0, forgecafe: 0 } });
  assert.equal(status, 0, `a re-warm where every tenant came back warm exited ${status}:\n${out}`);
  assert.match(out, /warmer ran for forgeco with token tok-forgeco/, `the first tenant was not warmed with its own token:\n${out}`);
  assert.match(out, /warmer ran for forgecafe with token tok-forgecafe/, `the second tenant was not warmed with its own token:\n${out}`);
});

test('★★★ warmth is a REPORT here too — a tenant that did not come out warm does NOT fail the gesture', () => {
  // The same decision the birth made and for the same measured reasons (see step 14 of bin/box-up.sh): a
  // step that is red on every run is a step people learn to skip. A cycle that went red every night on
  // warmth would train its operator to ignore the one night it mattered.
  const { status, out } = runWarmOnly({ tenants: ['forgeco'], statuses: { forgeco: 1 } });
  assert.equal(status, 0, `a cold tenant failed the re-warm:\n${out}`);
  assert.match(out, /REPORT/, `the cold tenant was not reported at all:\n${out}`);
  assert.match(out, /forgeco/, `the report does not name the tenant it is about:\n${out}`);
});

test('★★ …and "it could not be ASKED" is its own sentence, and is a report too', () => {
  const { status, out } = runWarmOnly({ tenants: ['forgeco'], statuses: { forgeco: 2 } });
  assert.equal(status, 0, `"nothing was learned" failed the re-warm:\n${out}`);
  assert.match(out, /UNKNOWN/, out);
});

test('★★★ but a store seed/box.json DECLARES and the box does not hold is STILL red — that is not warmth', () => {
  const { status, out } = runWarmOnly({ tenants: ['forgeco'], statuses: { forgeco: 3 } });
  assert.equal(status, 1, `a box missing a declared store passed the re-warm:\n${out}`);
  assert.match(out, /MISSING A STORE/, out);
  assert.match(out, /forgeco/, out);
});

test('★★ `--warm-only` is refused where the BIRTH\'s flags mean nothing, instead of being ignored', () => {
  for (const args of [['--warm-only', '--plan'], ['--warm-only', '--no-warm']]) {
    let status = 0;
    let out = '';
    try {
      out = execFileSync('bash', [join(ROOT, 'bin/box-up.sh'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      status = error.status ?? -1;
      out = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    assert.equal(status, 1, `\`box-up.sh ${args.join(' ')}\` was accepted; --warm-only runs one step and has no step list to plan:\n${out}`);
    assert.match(out, /about the BIRTH/, `the refusal does not say why:\n${out}`);
  }
});

// ── 8 · THE DOCUMENT, AND THE PROMISE THAT USED TO BE A LIE ──────────────────────────────────────────────

test('★★★ the cycle has a page that says what it destroys, what it keeps, and how it is scheduled', () => {
  const doc = read('docs/operations/reset-cycle.md');
  for (const needle of ['bin/box-cycle.sh', 'bin/box-down.sh', '--no-warm', '--promote', '--warm-only']) {
    assert.ok(doc.includes(needle), `docs/operations/reset-cycle.md never mentions ${needle} — it is the page about the cycle those make up.`);
  }
  assert.match(doc, /crontab|systemd/i, 'the page gives no example of the schedule entry, which is the one thing an operator copies out of it.');
  assert.match(doc, /cycle-logs/, 'the page does not say where the log of a run is.');
  // The runbook is the document an operator opens first; a page nothing points at is a page nobody finds.
  assert.match(read('docs/operations/runbook-demo.md'), /reset-cycle\.md/, 'docs/operations/runbook-demo.md does not point at the cycle page.');
});

test('★★★ nothing in this repository still promises a cron that warms the box later — it did not exist', () => {
  // ⛔ THE DEFECT THIS CLOSES. Three comments in bin/box-up.sh and one line of the README described a
  //    schedule that had never been written: "a cron warms later", "born at 03:00 and warmed by a cron at
  //    04:00". An operator reading them would have assumed a box was being warmed by something. Worse, the
  //    arrangement they described is the one this cycle exists to reject: a clock is not a dependency.
  for (const file of ['bin/box-up.sh', 'README.md']) {
    const body = read(file);
    const claims = [...body.matchAll(/a cron warms|warmed by a cron|cron at \d|overnight cron/gi)].map((m) => m[0]);
    assert.deepEqual(
      claims,
      [],
      `${file} still promises a cron that warms this box: ${claims.join(', ')}. The schedule is one entry ` +
        'calling bin/box-cycle.sh, whose fourth gesture warms — and this repository installs no schedule at all.',
    );
  }
  // ★ And the page is explicit that installing it is not this repository's gesture, so nobody goes looking
  //   for an entry that was never added.
  assert.match(read('docs/operations/reset-cycle.md'), /não instala|not installed|nenhum agendamento/i, 'the page does not say that no schedule is installed by this repository.');
});

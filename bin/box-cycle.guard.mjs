// ★★★ THE SCHEDULED CYCLE IS FIVE GESTURES IN ONE ORDER, AND THE ORDER IS THE WHOLE DECISION.
//
//   node --test bin/box-cycle.guard.mjs      (or: bash bin/test.sh)
//
// ── WHAT THIS GRADES, AND WHY IT CANNOT BE GRADED ANY OTHER WAY ───────────────────────────────────────────
//
// `bin/box-cycle.sh` tears the box down, births it, promotes it, warms it and JUDGES it — ~90 minutes, on a
// machine with docker, against a live box. Nothing about that can run here. What CAN run here is everything
// that decides whether the run will be right:
//
//   1 · THE FIVE GESTURES AND THEIR ORDER, read from the script's own declaration and from the calls it
//       makes. A gesture removed, renamed or reordered is red — which is the point: the order is the
//       decision (`bin/reset-complete.guard.mjs` is the same sentence about the birth's own tail), and a
//       wrapper of five calls is otherwise perfectly able to lose one in silence.
//   2 · `--plan` AND `--dry-run`, RUN FOR REAL. The plan touches nothing and says what it would do; the
//       rehearsal exercises the whole mechanism — lock, log, roteiro, verdict — with every gesture printed
//       instead of executed. That is how this slice was reviewed without a box, and it is how it stays
//       reviewable.
//   3 · THE LOCK, BOTH DIRECTIONS. A live holder must REFUSE (a second run tears down the box the first is
//       seeding) and a dead holder must be TAKEN OVER (a lock that outlives its process turns one crash
//       into a box that is never reset again). Both are staged here with a real lock file.
//   4 · ★★★ THE EXIT POLICY, run as functions over fabricated results — and it is graded by REASON, never by
//       gesture. "Which non-zero is acceptable" is the question the cycle exists to answer, and the answer
//       is: one that a LATER gesture asked again and answered ✓. So this file proves that a re-asked reason
//       is forgiven, that a reason nobody re-asks is not, that a pardon dies when its re-asker comes back
//       red, and that a non-zero naming no reason at all is red. ⛔ Plus the pin that makes it honest: the
//       eight red families are DERIVED OUT OF `bin/box-up.sh` and compared with the table in the cycle, in
//       both directions, so a sentence that changes there or a family added there is red here.
//   5 · THE TWO GESTURES THE CYCLE DEPENDS ON AND DOES NOT OWN: `bash bin/box-up.sh --warm-only` and
//       `--verdict-only`. Both are graded here, against a fake box, because both exist FOR this cycle — and
//       the loops they drive may not be copied into the script that schedules it.
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

test('★ the cycle declares five gestures, each with a title — anti-vacuity, first', () => {
  // ⚠️ EVERY RULE BELOW COMPARES THE DECLARATION WITH SOMETHING. Two empty lists agree perfectly, and a
  //    guard that goes green over nothing is the failure this repository has measured more than once.
  const gestures = declaredGestures();
  assert.deepEqual(
    gestures.map((g) => g.id),
    ['1', '2', '3', '4', '5'],
    'the cycle no longer declares exactly the five gestures 1..5 in order. It is five: the box dies, it is ' +
      'born, it is promoted, it is warmed, and then it is JUDGED — and a missing one is a decision, not a typo.',
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
  const verdict = at('bin/box-up.sh" --verdict-only');
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
  assert.ok(
    warm < verdict,
    'the verdict is taken before the box is finished. It is LAST on purpose: it is the gesture that answers ' +
      'the questions gesture 2 asked too early, and a verdict taken before the state it grades is finished ' +
      'is not a verdict — which is the measurement (2026-09-15) that put it in this file.',
  );
  assert.ok(promote < verdict, 'the verdict runs before the promotion, so it would grade the same half-promoted box gesture 2 did.');
});

test('★★ every gesture goes through `run_gesture`, so each one is TIMED and its status RECORDED', () => {
  // A call added beside the others without going through it would run and be invisible to both the roteiro
  // and the verdict — the box would be reset by a step no summary mentions.
  const calls = [...CYCLE.matchAll(/^run_gesture (\d) /gm)].map((m) => m[1]);
  assert.deepEqual(calls, ['1', '2', '4', '5'], 'the gestures invoked through run_gesture are not 1, 2, 4 and 5 (3 is inside the promotion branch).');
  assert.match(CYCLE, /run_gesture 3 /, 'gesture 3 is not run through run_gesture either.');
  assert.match(
    CYCLE,
    /reasons="\$\(reasons_named_in "\$out"\)"/,
    'run_gesture no longer reads back WHICH reasons the gesture named. The verdict grades reasons, so without ' +
      'this every non-zero becomes an unrecognised one and the cycle is red every night again.',
  );
  assert.match(CYCLE, /RESULTS="\$RESULTS\$id=\$status=\$\(\(ended - began\)\)=\$reasons/, 'run_gesture does not RECORD each gesture\'s status and reasons; the verdict would then grade nothing.');
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

// ── 6 · THE EXIT POLICY, RUN RATHER THAN READ — AND IT IS GRADED BY REASON, NEVER BY GESTURE ─────────────
//
// The whole policy is between two markers in `bin/box-cycle.sh` and takes its subject from its arguments and
// from `CYCLE_REASONS`, so it can be sourced out of the script and run over fabricated results — which is
// the only way to grade "which non-zero is acceptable" without a 90-minute cycle.

/** The table as the cycle declares it: token → { sentence, asker, why }. */
function declaredReasons() {
  const block = CYCLE.match(/\nCYCLE_REASONS='([\s\S]*?)'\n/);
  assert.ok(
    block,
    "bin/box-cycle.sh no longer declares CYCLE_REASONS='…'. That table IS the exit policy: without it every " +
      'non-zero is an unrecognised one, the cycle is red on every run, and a red that always fires is a red ' +
      'people learn to skip.',
  );
  const rows = block[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [token, sentence, asker, ...why] = line.split('|');
      return { token, sentence, asker, why: why.join('|') };
    });
  assert.ok(rows.length > 0, 'CYCLE_REASONS is declared and empty — a table nobody can match is the same as no table.');
  return rows;
}

/** The red families `bin/box-up.sh` really has, DERIVED from its own closing block.
 *
 * ⛔ THIS IS THE HALF THAT KEEPS READING PROSE HONEST. The cycle tells two reasons apart by the sentence the
 * birth prints, and the prose of this repository changes. So the families are read out of `bin/box-up.sh`
 * here — every `if [ -n "$VAR" ]` block of its closing section that prints a ⛔ — and compared with the
 * table, in both directions. A sentence edited there, a family added there, a row deleted here: all red. */
function redFamiliesOfTheBirth() {
  const mark = '⛔ LAST LINE, AND IT IS NON-ZERO ON PURPOSE';
  const at = BOX_UP.indexOf(mark);
  assert.ok(at > 0, `bin/box-up.sh no longer carries its closing block (${JSON.stringify(mark)}), so the reasons cannot be derived from it.`);
  const tail = BOX_UP.slice(at);
  const families = [];
  for (const block of tail.matchAll(/^if \[ -n "\$\{?([A-Z_]+)(?::-\}|")[\s\S]*?\n^fi$/gm)) {
    if (!block[0].includes("printf '[box-up] ⛔")) continue; // the reports say ⚠️; the final conjunction prints nothing
    families.push({ name: block[1], block: block[0] });
  }
  assert.ok(families.length >= 6, `only ${families.length} red families were derived from bin/box-up.sh — the parse is broken, and a table compared against nothing is green over nothing.`);
  return families;
}

test('★★★ every red family bin/box-up.sh has is NAMED in the cycle table, and no row invents one', () => {
  const declared = declaredReasons().map((r) => r.token).sort();
  const real = redFamiliesOfTheBirth().map((f) => f.name).sort();
  assert.deepEqual(
    declared,
    real,
    'the cycle table and the reasons bin/box-up.sh can really give have drifted. A family the birth has and ' +
      'the table does not is read as an UNRECOGNISED non-zero — red, but saying nothing at 3am; a row the ' +
      'birth does not have is a pardon for something that cannot happen.',
  );
});

test('★★★ every sentence in the table is one bin/box-up.sh really PRINTS — the pin that pays for reading prose', () => {
  const families = Object.fromEntries(redFamiliesOfTheBirth().map((f) => [f.name, f.block]));
  for (const { token, sentence } of declaredReasons()) {
    assert.ok(sentence.trim().length > 15, `the sentence for ${token} is too short to identify one reason among eight.`);
    assert.ok(
      families[token]?.includes(sentence),
      `bin/box-up.sh no longer prints ${JSON.stringify(sentence)} for ${token}. The cycle matches that string to ` +
        'tell this reason from the other seven, so an edit to the sentence there silently turns this reason ' +
        'into an unrecognised non-zero here. Update the row with the new sentence.',
    );
  }
});

test('★★★ a pardon names a LATER gesture and a measurement — and a reason nobody re-asks carries neither', () => {
  const ids = declaredGestures().map((g) => g.id);
  for (const { token, asker, why } of declaredReasons()) {
    assert.ok(why.trim().length > 40, `the row for ${token} carries no reason worth reading. A pardon nobody can read is a silenced red; a red with no reason is one people learn to skip.`);
    if (!asker) continue;
    assert.ok(ids.includes(asker), `${token} says gesture ${asker} asks it again, and this cycle has no gesture ${asker}.`);
    assert.ok(
      /gesture \d|asked again|asks it again|re-asked|same question|same doors|same verify-config/i.test(why),
      `the pardon for ${token} does not say which later asking answers it.`,
    );
  }
  // ⛔ ANTI-VACUITY, BOTH WAYS. A table where nothing is ever pardoned is a cycle red every night; a table
  //    where everything is pardoned is no policy at all.
  const rows = declaredReasons();
  const pardonable = rows.filter((r) => r.asker);
  assert.ok(pardonable.length > 0, 'no reason in the table has a re-asker, so the cycle is red on every run — which is the state this slice exists to end.');
  assert.ok(pardonable.length < rows.length, 'EVERY reason in the table is pardonable, which is a blanket pardon wearing a table for a hat.');
});

test('★★★ the blanket pardon is GONE and may not come back — a pardon is a reason, never a gesture', () => {
  // ⛔ THE SHAPE THIS FORBIDS. `CYCLE_TOLERATED='2=1|…'` forgave a gesture by its exit status, and
  //    bin/box-up.sh exits 1 for eight reasons: that one line would also forgive a shop nobody can sign in
  //    to, a tenant holding another brand's catalogue and a run that cannot account for its own steps.
  assert.ok(
    !/\bCYCLE_TOLERATED\b/.test(CYCLE),
    'bin/box-cycle.sh declares CYCLE_TOLERATED again — a pardon by <gesture>=<status>. That is not a looser ' +
      'rule, it is a different one: it stops reading the reason. Pardons belong in CYCLE_REASONS, one per ' +
      'reason, each naming the later gesture that asks the same question.',
  );
});

/** `cycle_verdict` with the real table, or with a fabricated one, over fabricated results. */
function verdict(results, reasonTable = null) {
  // ⚠️ THE RESULTS REACH BASH THROUGH A HERE-DOC, not through a quoted literal: a `\n` inside double quotes
  //    is a backslash and an n, so the first version of this helper handed the verdict ONE line that happened
  //    to start with a zero — and every red below passed as green. Measured while writing this file.
  const script = `
set -uo pipefail
source <(sed -n '/^# >>> THE EXIT POLICY/,/^# <<< THE EXIT POLICY/p' ${JSON.stringify(join(ROOT, 'bin/box-cycle.sh'))})
${reasonTable === null ? '' : `CYCLE_REASONS=${JSON.stringify(reasonTable)}`}
cycle_verdict "$(cat <<'GUARD_RESULTS'
${results}
GUARD_RESULTS
)"
`;
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const CLEAN = '1=0=12=\n2=0=1100=\n3=0=40=\n4=0=900=\n5=0=120=';

test('★★ a cycle whose five gestures all exited 0 is green — the control, without which the reds prove nothing', () => {
  const { status } = verdict(CLEAN);
  assert.equal(status, 0, 'a clean cycle was graded red.');
});

test('★★★ THE MEASURED CASE: gesture 2 came back SHUT + MISCONFIGURED and gesture 5 answered both — green', () => {
  // ⛔ THIS IS NOT A FABRICATION: these are the two reasons the first real run of this cycle produced
  //    (2026-09-15), and the verdict over them is the whole point of the slice. Both were true of the box
  //    between gesture 2 and gesture 3, and neither was true of the box that was handed over.
  const { status, out } = verdict('1=0=14=\n2=1=1273=SHUT MISCONFIGURED\n3=0=37=\n4=0=2409=\n5=0=120=');
  assert.equal(status, 0, `the two reasons a later gesture answered ✓ were still graded red:\n${out}`);
  assert.match(out, /gesture 2 · SHUT — PARDONED: gesture 5/, `SHUT was not forgiven by the gesture that re-asked it:\n${out}`);
  assert.match(out, /gesture 2 · MISCONFIGURED — PARDONED: gesture 5/, `MISCONFIGURED was not forgiven by the gesture that re-asked it:\n${out}`);
  // ⚠️ AND THE PARDON IS NEVER SILENT. A forgiveness nobody can read in the log is a red deleted.
  assert.match(out, /2026-09-15/, `the pardon does not carry the measurement that justifies it:\n${out}`);
});

test('★★★ a reason NOBODY asks again is red, even in a cycle whose every later gesture is green', () => {
  // This is the line between this policy and a blanket pardon, and it is the one that has to hold: gesture 2
  // exits 1 either way, and only the reason tells a box that will be repaired from one that will not.
  for (const token of ['UNSETTLED', 'MISSING_STORE', 'ONLINE_ONLY_FAILED', 'ROTEIRO_INCOMPLETE', 'UNSETTLED_EXTRA']) {
    const { status, out } = verdict(`1=0=12=\n2=1=1100=${token}\n3=0=40=\n4=0=900=\n5=0=120=`);
    assert.equal(status, 1, `${token} was forgiven, and nothing in this cycle asks it again:\n${out}`);
    assert.match(out, new RegExp(`${token} — NOBODY ASKS THIS AGAIN`), `the verdict does not say why ${token} stays red:\n${out}`);
  }
});

test('★★★ a pardon DIES when its re-asker comes back red — and when its re-asker never ran', () => {
  const red = verdict('1=0=12=\n2=1=1100=MISCONFIGURED\n3=0=40=\n4=0=900=\n5=1=120=MISCONFIGURED');
  assert.equal(red.status, 1, `gesture 5 said the same thing again and gesture 2 was still forgiven:\n${red.out}`);
  assert.match(red.out, /gesture 5 was to ask it again and came back 1/, red.out);
  // ⛔ AND ITS OWN REASON IS NOT FORGIVABLE: nothing comes after the gesture that asks last.
  assert.match(red.out, /gesture 5 · MISCONFIGURED — this IS the gesture that asks it again/, `gesture 5 forgave itself:\n${red.out}`);

  const absent = verdict('1=0=12=\n2=1=1100=SHUT');
  assert.equal(absent.status, 1, `a reason was forgiven by a gesture that never ran:\n${absent.out}`);
  assert.match(absent.out, /gesture 5 was to ask it again and never ran/, absent.out);
});

test('★★★ a non-zero that names NO reason is red — a die() mid-birth is not "not yet"', () => {
  const { status, out } = verdict('1=0=12=\n2=1=40=\n3=0=40=\n4=0=900=\n5=0=120=');
  assert.equal(status, 1, `a gesture that failed for a reason this cycle cannot name was forgiven:\n${out}`);
  assert.match(out, /named NO reason this cycle knows how to re-ask/, out);
  // The other gestures too: a teardown or a promotion that fails names none of the birth's reasons.
  for (const line of ['1=1=3=', '3=2=40=']) {
    const r = verdict(`${line}\n5=0=120=`);
    assert.equal(r.status, 1, `${line} was forgiven:\n${r.out}`);
  }
});

test('★★ the pardon is per REASON, not per gesture — one forgiven reason does not carry the other', () => {
  const { status, out } = verdict('2=1=1100=MISCONFIGURED UNSETTLED\n3=0=40=\n4=0=900=\n5=0=120=');
  assert.equal(status, 1, `one pardonable reason carried an unpardonable one through:\n${out}`);
  assert.match(out, /MISCONFIGURED — PARDONED/, out);
  assert.match(out, /UNSETTLED — NOBODY ASKS THIS AGAIN/, out);
});

test('★★ the mechanism itself, over a fabricated table — both directions, so the real table proves a rule', () => {
  const table = 'FAKE_A|A SENTENCE|5|staged by the guard: the measurement would go here\nFAKE_B|ANOTHER SENTENCE||staged by the guard: nothing asks this again';
  assert.equal(verdict('2=1=10=FAKE_A\n5=0=1=', table).status, 0, 'a re-asked reason was red with a fabricated table too.');
  assert.equal(verdict('2=1=10=FAKE_B\n5=0=1=', table).status, 1, 'a reason with no re-asker was forgiven with a fabricated table.');
});

test('★★★ the reasons are read from the birth\'s SHOUTED sentence, not from a step\'s running commentary', () => {
  // ⛔ THE FAILURE THIS FORBIDS. `bin/box-up.sh` narrates each step too — "⛔ forgecafe has SHUT doors",
  //    "⛔ forgeco did NOT settle" — and those lines are printed by steps that DO NOT decide the exit code.
  //    Reading them as the run's answer would name reasons for a birth that ended green.
  const script = `
set -uo pipefail
source <(sed -n '/^# >>> THE EXIT POLICY/,/^# <<< THE EXIT POLICY/p' ${JSON.stringify(join(ROOT, 'bin/box-cycle.sh'))})
printf '%s\\n' '   ⛔ forgecafe has SHUT doors — the ✗ lines above name the store and the path.' '   ⛔ forgeco did NOT settle — the ✗ lines above say which check.' > "$1"
printf 'commentary:[%s]\\n' "$(reasons_named_in "$1")"
printf '[box-up] ⛔ THE BOX IS UP AND forgecafe HAS DOORS A SHOPPER CANNOT OPEN. Step 14-bis names it.\\n' >> "$1"
printf 'verdict:[%s]\\n' "$(reasons_named_in "$1")"
`;
  const dir = mkdtempSync(join(tmpdir(), 'box-cycle-reasons-'));
  try {
    const r = spawnSync('bash', ['-c', script, 'bash', join(dir, 'out')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.match(out, /commentary:\[\]/, `a step's own commentary was read as the run's reason:\n${out}`);
    assert.match(out, /verdict:\[SHUT\]/, `the sentence the birth's closing block prints was NOT read as a reason:\n${out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★★ END TO END, with a fake box: a gesture that exits 1 printing the birth’s sentences is graded on them', () => {
  // ⛔ THE GAP THIS CLOSES. Every test above hands `cycle_verdict` a ledger somebody typed. The step nobody
  //    was grading is the one BETWEEN: `run_gesture` has to capture what the gesture printed, read the
  //    reasons out of it, and stamp them into the ledger — and a rehearsal (`--dry-run`) executes no gesture,
  //    so it can never exercise that. So the two are run together here, over a fake `bin/box-up.sh` that
  //    prints the real sentences and exits 1.
  const script = `
set -uo pipefail
TAG='[cycle]'
MODE=run
say() { printf '== %s\\n' "$*"; }
note() { printf '   %s\\n' "$*"; }
GESTURE_DIR="$1"
RAN=''
RESULTS=''
source <(sed -n '/^# >>> THE EXIT POLICY/,/^# <<< THE EXIT POLICY/p' ${JSON.stringify(join(ROOT, 'bin/box-cycle.sh'))})
source <(sed -n '/^run_gesture()/,/^}/p' ${JSON.stringify(join(ROOT, 'bin/box-cycle.sh'))})

fake_birth() {
  printf '   14-bis · opening every door of every store\\n'
  printf '   ⛔ forgecafe has SHUT doors — the ✗ lines above name the store and the path.\\n'
  printf '[box-up] ⛔ THE BOX IS UP AND forgecafe HAS DOORS A SHOPPER CANNOT OPEN. Step 14-bis names it.\\n' >&2
  printf '[box-up] ⛔ THE CONFIGURATION IS NOT WHAT THIS BOX DECLARES. Step 15 names the face.\\n' >&2
  return 1
}
fake_ok() { printf '   everything answered\\n'; return 0; }

run_gesture 2 'the fake birth' fake_birth || true
run_gesture 5 'the fake verdict' fake_ok || true
printf 'LEDGER<%s>\\n' "$RESULTS"
cycle_verdict "$RESULTS" && printf 'GREEN\\n' || printf 'RED\\n'
`;
  const dir = mkdtempSync(join(tmpdir(), 'box-cycle-e2e-'));
  try {
    const r = spawnSync('bash', ['-c', script, 'bash', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    // ⛔ THE SENTENCES GO TO stderr AND THE STEP COMMENTARY TO stdout: a capture that took only one of them
    //    would read half the birth. Both have to land in the gesture's own file.
    assert.match(out, /LEDGER<2=1=\d+=SHUT MISCONFIGURED\n5=0=\d+=\n>/, `run_gesture did not stamp the reasons the gesture named into the ledger:\n${out}`);
    assert.match(out, /2 · exit 1 · \d+s · reason\(s\): SHUT MISCONFIGURED/, `the log line for the failing gesture does not name its reasons:\n${out}`);
    assert.match(out, /GREEN/, `a birth whose two reasons the last gesture answered ✓ was graded red end to end:\n${out}`);
    // ⛔ AND NOTHING IS SWALLOWED: the bytes still reach the stream the log is made of.
    assert.match(out, /14-bis · opening every door/, `the gesture's own output stopped reaching the log:\n${out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
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

// ── 7b · GESTURE 5 ITSELF: `bash bin/box-up.sh --verdict-only`, AGAINST A FAKE BOX ──────────────────────
//
// It exists because a birth takes its two verdicts over a state that has not finished existing — measured on
// the first real cycle, 2026-09-15 — and the repair is a LATER ASKING rather than a softer step. Same method
// as the re-warm above: the mode block and the loop are lifted out of the script and given a fake box, so
// the three answers it has to tell apart are tested rather than read.

function runVerdictOnly({ tenants, doors, config }) {
  const script = `
set -uo pipefail
HERE=/nowhere
TENANTS=${JSON.stringify(tenants.join(' '))}
FORGE_PUBLIC_ORIGIN='http://fake.invalid'
MODE=verdict
say() { printf '== %s\\n' "$*" >&2; }
note() { printf '   %s\\n' "$*" >&2; }
die() { printf 'DIE %s\\n' "$*" >&2; exit 9; }
secret_name_for() { printf 'forge-operator-token-%s' "$1"; }
host_node() {
  local t='' prev='' arg script_var
  for arg in "$@"; do [ "$prev" = '--tenant' ] && t="$arg"; prev="$arg"; done
  case "$*" in
    *verify-config.mjs*)
      printf 'verify-config ran against %s\\n' "$FORGE_PUBLIC_ORIGIN" >&2
      return ${config} ;;
  esac
  printf 'doors opened for %s with token %s\\n' "$t" "\${FORGE_OPERATOR_TOKEN:-<none>}" >&2
  script_var="DOORS_$t"
  return "\${!script_var}"
}
${tenants.map((t) => `export FORGE_OPERATOR_TOKEN_${t.toUpperCase()}='tok-${t}'\nDOORS_${t}=${doors[t]}`).join('\n')}
source <(sed -n '/^prove_every_tenant()/,/^}/p' ${JSON.stringify(join(ROOT, 'bin/box-up.sh'))})
source <(sed -n '/^if \\[ "\\$MODE" = verdict \\]; then/,/^fi$/p' ${JSON.stringify(join(ROOT, 'bin/box-up.sh'))})
`;
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('★★★ `--verdict-only` asks BOTH questions, once per tenant with that tenant\'s OWN token', () => {
  const { status, out } = runVerdictOnly({ tenants: ['forgeco', 'forgecafe'], doors: { forgeco: 0, forgecafe: 0 }, config: 0 });
  assert.equal(status, 0, `a box whose doors open and whose configuration settles was graded red:\n${out}`);
  assert.match(out, /doors opened for forgeco with token tok-forgeco/, `the first tenant's doors were not opened with its own token:\n${out}`);
  assert.match(out, /doors opened for forgecafe with token tok-forgecafe/, `the second tenant's doors were not opened with its own token:\n${out}`);
  assert.match(out, /verify-config ran/, `the configuration was not graded again — half a verdict is not a verdict:\n${out}`);
  // ⛔ AND IT DOES NOT PRETEND TO BE A BIRTH: nothing is built, warmed or moved here.
  assert.match(out, /nothing is built, nothing is warmed, no address is moved/, out);
});

test('★★★ …and each of its two questions makes it red ALONE, in the sentence the cycle reads', () => {
  const shut = runVerdictOnly({ tenants: ['forgecafe'], doors: { forgecafe: 1 }, config: 0 });
  assert.equal(shut.status, 1, `a shut door passed the verdict:\n${shut.out}`);
  assert.match(shut.out, /HAS DOORS A SHOPPER CANNOT OPEN/, `the verdict does not print the sentence bin/box-cycle.sh matches on:\n${shut.out}`);

  const unknown = runVerdictOnly({ tenants: ['forgecafe'], doors: { forgecafe: 2 }, config: 0 });
  assert.equal(unknown.status, 1, `"nothing was learned" passed the verdict — it is UNPROVEN, never proven-open:\n${unknown.out}`);
  assert.match(unknown.out, /NOTHING WAS LEARNED ABOUT/, unknown.out);

  const misconfigured = runVerdictOnly({ tenants: ['forgeco'], doors: { forgeco: 0 }, config: 1 });
  assert.equal(misconfigured.status, 1, `a box that is not what it declares passed the verdict:\n${misconfigured.out}`);
  assert.match(misconfigured.out, /THE CONFIGURATION IS NOT WHAT THIS BOX DECLARES/, misconfigured.out);
});

test('★★ the doors loop has ONE author: step 14-bis and `--verdict-only` drive the same function', () => {
  // ⛔ A SECOND COPY WOULD DRIFT ON THE DAY A TENANT IS ADDED TO seed/box.json — which is the same reason
  //    the warming loop has one copy. The rule for the name of a tenant's secret already has two authors.
  assert.equal(
    (BOX_UP.match(/^prove_every_tenant\(\) \{$/gm) ?? []).length,
    1,
    'bin/box-up.sh defines prove_every_tenant more than once, or not at all.',
  );
  assert.equal(
    (BOX_UP.match(/^\s*prove_every_tenant$/gm) ?? []).length,
    2,
    'prove_every_tenant no longer has exactly two callers (step 14-bis and the --verdict-only block). A third ' +
      'copy of the loop, or a caller lost, and the two stop asking the same question.',
  );
  assert.match(BOX_UP, /prove-doors\.mjs/, 'bin/box-up.sh no longer opens the doors at all.');
});

test('★★ `--verdict-only` is refused where the BIRTH\'s flags mean nothing, instead of being ignored', () => {
  for (const args of [['--verdict-only', '--plan'], ['--verdict-only', '--no-warm']]) {
    let status = 0;
    let out = '';
    try {
      out = execFileSync('bash', [join(ROOT, 'bin/box-up.sh'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      status = error.status ?? -1;
      out = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    assert.equal(status, 1, `\`box-up.sh ${args.join(' ')}\` was accepted; --verdict-only runs two steps and has no step list to plan:\n${out}`);
    assert.match(out, /about the BIRTH/, `the refusal does not say why:\n${out}`);
  }
});

// ── 8 · THE DOCUMENT, AND THE PROMISE THAT USED TO BE A LIE ──────────────────────────────────────────────

test('★★★ the cycle has a page that says what it destroys, what it keeps, and how it is scheduled', () => {
  const doc = read('docs/operations/reset-cycle.md');
  for (const needle of ['bin/box-cycle.sh', 'bin/box-down.sh', '--no-warm', '--promote', '--warm-only', '--verdict-only']) {
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

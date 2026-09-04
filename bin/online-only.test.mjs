// ★★ WHAT ONLY EXISTS ONLINE MAY NOT BE A STEP THAT SAYS NOTHING.
//
// Renan, 04/09: *"ele precisaria também garantir que ligue tudo que só tem online, exemplo cdn se tiver na
// demo… ou qualquer coisa assim que morre no reset."* On the bench there is no CDN and no bucket, so both
// facilities are no-ops — and a no-op that prints nothing is indistinguishable from work done. What is
// graded here is therefore the SPEECH as much as the behaviour.
//
//   node --test bin/online-only.test.mjs      (or: bash bin/test.sh)

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEP = join(ROOT, 'bin/online-only.mjs');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));
const run_ = promisify(execFile);

async function runStep({ phase = 'after-birth', env = {} } = {}) {
  try {
    const { stdout, stderr } = await run_('node', [STEP, '--phase', phase], {
      encoding: 'utf8',
      // ⚠️ The parent's own environment is NOT inherited: a `FORGE_EDGE_PURGE_DRIVER` exported by whoever ran
      // the suite would silently decide the outcome of every test below.
      env: { PATH: process.env.PATH, ...env },
    });
    return { stdout: `${stdout}${stderr}`, status: 0 };
  } catch (error) {
    return { stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`, status: error.code ?? -1 };
  }
}

test('★★★ every facility this box declares gets a line — none of them can be silently absent', async () => {
  const declared = (BOX.online_only ?? []).filter((f) => f.moment === 'after-birth');
  assert.ok(declared.length >= 2, 'seed/box.json declares fewer than two after-birth facilities');
  const { stdout, status } = await runStep();
  assert.equal(status, 0, stdout);
  for (const facility of declared) {
    assert.match(
      stdout,
      new RegExp(facility.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `the facility "${facility.id}" is declared and the run never mentions it:\n${stdout}`,
    );
  }
  // …and the count is stated, so a facility silently dropped from the loop is visible as a number.
  assert.match(stdout, new RegExp(`${declared.length} facilit`), `the run does not say how many it answered for:\n${stdout}`);
});

test('★★★ a facility with no driver is a NO-OP THAT ANNOUNCES ITSELF, with the declared reason', async () => {
  const { stdout, status } = await runStep();
  assert.equal(status, 0, stdout);
  for (const facility of (BOX.online_only ?? []).filter((f) => f.moment === 'after-birth')) {
    const line = stdout.split('\n').find((l) => l.includes(facility.id));
    assert.ok(line, `no line for ${facility.id}`);
    assert.match(line, /no-op/i, `${facility.id} does not say it did nothing: ${line}`);
    assert.match(line, /none/, `${facility.id} does not name the driver it resolved to: ${line}`);
  }
  // The REASON is the declaration's, never one this step invented — the operator has to be able to tell
  // "nothing to do here" from "this box forgot".
  const bench = BOX.online_only[0].bench_why.split(/[\s,.:]+/).filter((w) => w.length > 7)[0];
  assert.ok(stdout.includes(bench), `the declared bench reason ("${bench}") is not printed:\n${stdout}`);
});

test('★★ the ORDER is stated where it is read, because purging BEFORE the rebirth is the intuitive wrong one', async () => {
  const { stdout } = await runStep();
  // A CDN purged first refills from the dying origin during the ~17 minutes the birth takes. The step runs
  // after, and says so — the sequence is the whole content of the decision.
  assert.match(stdout, /after the (re)?birth|reborn/i, `the run never states when it runs:\n${stdout}`);
});

test('★★★ a driver this repository does not implement REFUSES — it never no-ops on the box where it matters', async () => {
  const facility = BOX.online_only.find((f) => f.moment === 'after-birth');
  const { stdout, status } = await runStep({ env: { [facility.driver_env]: 'cloudflare' } });
  assert.equal(
    status,
    1,
    `a box configured with an unimplemented driver came out green — which is exactly the silent skip this ` +
      `step exists against:\n${stdout}`,
  );
  assert.match(stdout, /cloudflare/, stdout);
  assert.match(stdout, new RegExp(facility.driver_env), `the refusal does not name the variable:\n${stdout}`);
});

test('★ a phase nothing is declared for answers honestly rather than printing a green nobody earned', async () => {
  const { stdout, status } = await runStep({ phase: 'before-birth' });
  assert.equal(status, 0, stdout);
  assert.match(stdout, /0 facilit/, `an empty phase does not say it was empty:\n${stdout}`);
  for (const facility of BOX.online_only ?? []) {
    if (facility.moment === 'before-birth') continue;
    assert.ok(
      !stdout.includes(`· ${facility.id}`),
      `${facility.id} is declared for "${facility.moment}" and ran in "before-birth":\n${stdout}`,
    );
  }
});

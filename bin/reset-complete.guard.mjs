// ★★ THE RESET ENDS WARM, MEASURED AND GRADED — and the three steps that do it are wired in ONE order.
//
// `bin/warm-box.mjs`, `bin/online-only.mjs` and `bin/verify-config.mjs` have suites of their own that run
// them against fake boxes. What none of those can see is whether `bin/box-up.sh` CALLS them, in the right
// order, and turns their failure into an exit code — which is exactly the class of defect this repository
// has paid for four times (the totem announced without starting, two doors announced with one claimed, a ✓
// printed without a row read, a promotion green on an empty box).
//
// A real birth costs ~17 minutes, so what runs here is the TAIL of the script rather than the whole of it:
// the exit block is extracted and executed for real, with the variables set, and its status is graded. The
// order and the wiring are read from the source, and that trade is stated rather than hidden.
//
//   node --test bin/reset-complete.guard.mjs      (or: bash bin/test.sh)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8');
const DOWN = readFileSync(join(ROOT, 'bin/box-down.sh'), 'utf8');

/** Where a step's `say` line begins, so the order of the tail can be compared as positions in one file. */
const at = (needle) => {
  const i = SRC.indexOf(needle);
  assert.ok(i > 0, `bin/box-up.sh no longer contains ${JSON.stringify(needle)}`);
  return i;
};

test('★★★ the reset REBORNS, then purges, then warms, then grades — and that order is the whole decision', () => {
  const verdictData = at("say '12 · the verdict");
  const online = at("say '13 ·");
  const warm = at("say '14 ·");
  const verdictConfig = at("say '15 ·");
  // ⚠️ PURGING BEFORE THE REBIRTH IS THE INTUITIVE ORDER AND IT IS THE WRONG ONE: an edge purged first
  // refills itself from the origin being destroyed during the ~17 minutes the birth takes, and comes out of
  // the reset holding exactly what the purge was for.
  assert.ok(verdictData < online, 'the online-only step runs before the box has finished being born');
  assert.ok(online < warm, 'the box is warmed BEFORE the edge is purged — the purge would then throw the warmth away');
  assert.ok(warm < verdictConfig, 'the configuration is graded before the box is warm, so the verdict cannot see a cold box');
  assert.ok(verdictConfig < at("say 'the bench'"), 'the summary is printed before the last two steps have run');
});

test('★★ each of the three is actually CALLED, through host_node, from the birth', () => {
  for (const script of ['online-only.mjs', 'warm-box.mjs', 'verify-config.mjs']) {
    assert.match(
      SRC,
      new RegExp(`host_node "\\$HERE/bin/${script.replace('.', '\\.')}"`),
      `bin/box-up.sh never runs bin/${script} — a step nobody invokes is decoration`,
    );
  }
});

test('★★ warming is once per tenant, with that tenant\'s own token — the read face resolves it from the credential', () => {
  const block = SRC.slice(at("say '14 ·"), at("say '15 ·"));
  assert.match(block, /for t in \$TENANTS/, 'the warming step does not loop over the tenants');
  assert.match(
    block,
    /FORGE_SEED_TOKEN="\$tokval"/,
    'the warming step does not hand each tenant its own token — one token cannot speak for two tenants',
  );
  assert.match(block, /--api "\$FORGE_PUBLIC_ORIGIN"/, 'the warming step does not warm the address the box publishes itself at');
});

test("★★ the tear-down does NOT purge the edge — the order lives in box-up, and having it in both is having it wrong", () => {
  assert.ok(
    !/online-only|purge/i.test(DOWN),
    'bin/box-down.sh purges something. Purging at teardown is the ordering defect this slice exists to avoid: ' +
      'the CDN refills from the dying origin during the birth that follows.',
  );
});

// ── ★ THE EXIT BLOCK, RUN RATHER THAN READ ───────────────────────────────────────────────────────────────
//
// The three states below all mean "the box is standing and is not finished", and every wrapper reads the
// status before it reads the prose. Extracting the block and executing it is the one part of the tail that
// can be measured without a 17-minute birth.

/** The last block of `bin/box-up.sh`: everything from the closing summary's blank line to the end. */
function runExitBlock(vars) {
  const start = SRC.indexOf("# ⛔ LAST LINE, AND IT IS NON-ZERO ON PURPOSE.");
  assert.ok(start > 0, 'the exit block is gone — this guard is about a block that must exist');
  const block = SRC.slice(start);
  const assigns = Object.entries(vars)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n');
  try {
    const stdout = execFileSync('bash', ['-c', `set -uo pipefail\n${assigns}\n${block}\n`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out: stdout };
  } catch (error) {
    return { status: error.status ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

const CLEAN = { UNSETTLED: '', UNSETTLED_EXTRA: '', COLD: '', MISCONFIGURED: '', ONLINE_ONLY_FAILED: '' };

test('★★ a birth with nothing wrong exits 0 — the control, without which every red below proves nothing', () => {
  const { status } = runExitBlock(CLEAN);
  assert.equal(status, 0, 'the exit block is red on a clean birth');
});

test('★★★ a tenant that came out COLD makes the birth exit 1, and says so in its own words', () => {
  const { status, out } = runExitBlock({ ...CLEAN, COLD: ' forgecafe' });
  assert.equal(status, 1, `a cold box exited 0:\n${out}`);
  assert.match(out, /COLD/, out);
  assert.match(out, /forgecafe/, out);
});

test('★★★ a configuration that is not what the box declares makes the birth exit 1', () => {
  const { status, out } = runExitBlock({ ...CLEAN, MISCONFIGURED: '1' });
  assert.equal(status, 1, `a misconfigured box exited 0:\n${out}`);
  assert.match(out, /CONFIGURATION/, out);
});

test('★★ an online-only facility that was configured and could not run makes the birth exit 1', () => {
  const { status, out } = runExitBlock({ ...CLEAN, ONLINE_ONLY_FAILED: '1' });
  assert.equal(status, 1, `a facility that refused exited 0:\n${out}`);
  assert.match(out, /ONLY EXISTS ONLINE/, out);
});

test('★★★ a cold tenant found AFTER an unsettled one still reaches the screen — the old block exited where it printed', () => {
  // The two pre-existing exits print and leave. A reason added below them would be computed and never seen,
  // which is the same shape as a ⚠️ four hundred lines above the line that says the opposite.
  const { status, out } = runExitBlock({ ...CLEAN, UNSETTLED: ' forgeco', COLD: ' forgecafe' });
  assert.equal(status, 1, out);
  assert.match(out, /DID NOT SETTLE/, out);
  assert.match(out, /CAME OUT COLD/, `the cold tenant was computed and never printed:\n${out}`);
});

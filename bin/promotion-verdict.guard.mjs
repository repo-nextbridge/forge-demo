// ★★★ THE PROMOTION'S VERDICT, BOTH DIRECTIONS — and the point of this file is that they are NOT the same rule.
//
// ⛔ THE DEFECT, MEASURED ON THE DEMO BOX 09/09. `bash bin/box-up.sh --promote localhost` — the documented way
// BACK — exited non-zero on its first pass with:
//
//     [box-up] the promotion is INCOMPLETE: 0 of 0 admin door(s) claimed. See the REFUSED line(s) above.
//
// and the second pass exited 0 without writing anything. The obvious reading — «zero is being graded as
// incomplete» — is wrong, and proving that is what this guard starts from: on the way back `$claimed` and
// `$expected` are STRUCTURALLY zero, because the loop that fills them is inside `if [ "$PROMOTE_DIR" = out ]`.
// So that sentence was a fixed string with two zeroes in it, printed over a failure in the SHOP'S ADDRESS check
// — the only branch that can redden that direction — and it told the operator to read REFUSED lines that were
// never printed.
//
// ⇒ The rigor is not what changes. What changes is where the expectation comes from:
//     · the way OUT owes a claim per tenant per spelling, and claiming fewer STAYS RED;
//     · the way BACK owes none, so a claim count is not an expectation there and may not appear in a verdict;
//     · the shop's address is graded on BOTH, because both directions move it.
//
// ⚠️ AND A VERDICT THAT CANNOT BE GIVEN IS NOT A GREEN. Facts that do not describe a promotion exit 2 — the
// same split `verify-seed`, `verify-config`, `store-host` and `warm-box` all make.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'bin/promotion-verdict.mjs');
const BOX_UP = readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8');

/** The verdict, run as the REAL PROGRAM `bin/box-up.sh` runs it. */
function run({ direction, claimed = 0, expected = 0, unreachable = 0, address = 'claimed', raw }) {
  const args =
    raw ??
    [
      '--direction', String(direction),
      '--doors-claimed', String(claimed),
      '--doors-expected', String(expected),
      '--doors-unreachable', String(unreachable),
      '--address', String(address),
    ];
  // ⚠️ BOTH STREAMS, ON BOTH PATHS — which is why this is `spawnSync` and not `execFileSync`. The verdict speaks
  // on STDERR (it is an operator's sentence, not a value a caller parses), and a harness that read stdout only
  // would compare every GREEN against an empty string and pass whatever it was told.
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// ── 1 · THE WAY BACK — ZERO IS THE RIGHT NUMBER, AND IT IS NOT A NUMBER THE VERDICT PRINTS ───────────────

test('★★★ the way back with its address claimed is COMPLETE on the FIRST pass', () => {
  // THE 09/09 RUN, with the one thing that really failed having worked. It must exit 0 — and it must not have
  // mentioned an admin-door count at all, because on this direction there is none to mention.
  const r = run({ direction: 'back', address: 'claimed' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /COMPLETE/, r.out);
  assert.doesNotMatch(r.out, /0 of 0/, `the way back must never print a claim count:\n${r.out}`);
  assert.doesNotMatch(r.out, /INCOMPLETE/, r.out);
});

test('★★★ the way back still REDS when the shop\'s address is not in the directory — and says THAT', () => {
  // ⛔ The half that makes this a repair and not a whitewash: the failure the 09/09 run really had is still a
  // failure, and now it is named. An operator who reads this sentence looks at `[store-host]`, not at doors.
  const r = run({ direction: 'back', address: 'absent' });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /INCOMPLETE/, r.out);
  assert.match(r.out, /read\.store\.by_host/, r.out);
  assert.doesNotMatch(r.out, /admin door\(s\) claimed/, `it must not blame doors for this:\n${r.out}`);
});

test("★★ the way back told it owes doors REFUSES to grade — that is a script that lost its direction", () => {
  // Not a verdict about the box. If these numbers are ever non-zero on the way back, the claim loop ran on the
  // wrong branch — and calling that "complete" or "incomplete" would both be inventions.
  const r = run({ direction: 'back', claimed: 1, expected: 2 });
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /COULD NOT BE GIVEN/, r.out);
  assert.match(r.out, /way back claims NO admin door/, r.out);
});

// ── 2 · THE WAY OUT — THE RIGOR IS UNTOUCHED ─────────────────────────────────────────────────────────────

test('★★★ the way out is COMPLETE only when it claimed every door it owed', () => {
  assert.equal(run({ direction: 'out', claimed: 2, expected: 2 }).status, 0);
  const short = run({ direction: 'out', claimed: 1, expected: 2 });
  assert.equal(short.status, 1, short.out);
  assert.match(short.out, /1 of 2 claimed/, short.out);
  assert.match(short.out, /unknown_admin_host/, short.out);
});

test('★★ the way out that owed NO door cannot be complete — `0 of 0` is the 09/09 sentence', () => {
  // ⛔ The trap the other direction's repair could have opened. Outwards, `expected = 0` means the doors were
  // never derived from `seed/box.json`; grading that as success is exactly the green this whole slice is about.
  const r = run({ direction: 'out', claimed: 0, expected: 0 });
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /owed no admin door at all/, r.out);
});

test('★★ a door nothing publishes is INCOMPLETE on top of the claims, and it is counted apart', () => {
  const r = run({ direction: 'out', claimed: 2, expected: 2, unreachable: 3 });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /3 address\(es\)/, r.out);
  // Both reasons when both are true — a verdict that printed only the first would hide the second.
  const both = run({ direction: 'out', claimed: 1, expected: 2, unreachable: 1, address: 'absent' });
  assert.equal(both.status, 1, both.out);
  assert.match(both.out, /1 of 2 claimed/, both.out);
  assert.match(both.out, /1 address\(es\)/, both.out);
  assert.match(both.out, /read\.store\.by_host/, both.out);
});

// ── 3 · "COULD NOT ASK" IS NOT "IT IS BROKEN", AND GARBAGE IS NOT GREEN ──────────────────────────────────

test('★ an address nobody could ASK about does not change the status, and the verdict says so', () => {
  const r = run({ direction: 'back', address: 'unasked' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /NOT asked about/, r.out);
});

test('★★ ANTI-VACUUM · a count that was not given is REFUSED, never read as zero', () => {
  // ⛔ Zero is a MEASUREMENT in this file. A caller that forgets a flag must not get a verdict — the whole
  // defect was a sentence confidently reporting numbers nobody had filled in.
  for (const flag of ['--doors-claimed', '--doors-expected', '--doors-unreachable']) {
    const args = [
      '--direction', 'out',
      '--doors-claimed', '2',
      '--doors-expected', '2',
      '--doors-unreachable', '0',
      '--address', 'claimed',
    ];
    const at = args.indexOf(flag);
    const r = run({ raw: [...args.slice(0, at), ...args.slice(at + 2)] });
    assert.equal(r.status, 2, `${flag} missing must refuse to grade:\n${r.out}`);
    assert.match(r.out, new RegExp(flag), r.out);
  }
  assert.equal(run({ direction: 'sideways' }).status, 2);
  assert.equal(run({ direction: 'out', expected: 1, claimed: 1, address: 'maybe' }).status, 2);
  assert.equal(run({ direction: 'out', expected: 1, claimed: 1, raw: undefined, unreachable: '-1' }).status, 2);
});

// ── 4 · AND `bin/box-up.sh` REALLY USES IT ───────────────────────────────────────────────────────────────

test('★★★ the promotion block derives its verdict from this module and keeps no flag of its own', () => {
  // ⚠️ A module nobody calls is decoration, and the old sentence coming back is the regression that matters:
  // both halves are graded from the script's own text, because proving them needs a real promotion otherwise.
  assert.match(
    BOX_UP,
    /node "\$HERE\/bin\/promotion-verdict\.mjs"/,
    'bin/box-up.sh no longer calls bin/promotion-verdict.mjs — the closing verdict is derived somewhere else again.',
  );
  assert.ok(
    !BOX_UP.includes('promotion_status'),
    'bin/box-up.sh carries a `promotion_status` flag again. That flag IS the defect: its sentence lived four ' +
      'hundred lines from the checks that set it, so the way back reported an admin-door count the direction ' +
      'never filled.',
  );
  // ⚠️ The REGRESSION is the `printf` that PRINTED that sentence, not the comment that records it: this file's
  // own header quotes it, and so does the block in box-up.sh that explains why it is gone.
  assert.ok(
    !/printf [^\n]*admin door\(s\) claimed/.test(BOX_UP),
    'bin/box-up.sh prints a `N of M admin door(s) claimed` verdict again — the sentence that blamed admin ' +
      'doors for a failure in the shop-address check, with two numbers the way back never fills.',
  );
  // The four facts are what the module grades; a call that stopped passing one would be a silent exit 2.
  for (const flag of ['--direction', '--doors-claimed', '--doors-expected', '--doors-unreachable', '--address']) {
    assert.ok(BOX_UP.includes(flag), `bin/box-up.sh no longer passes ${flag} to the verdict.`);
  }
  // And each fact has exactly one author in the script.
  assert.match(BOX_UP, /\n  unreachable_count=0\n/, 'the unreachable-door count is no longer initialised');
  assert.match(BOX_UP, /\n  address_state=unasked\n/, 'the address state is no longer initialised to `unasked`');
});

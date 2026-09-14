#!/usr/bin/env node
// ★★★ THE PROMOTION'S CLOSING VERDICT — what was owed, what answered, and WHICH CHECK decided the status.
//
//   node bin/promotion-verdict.mjs --direction <out|back> \
//        --doors-claimed N --doors-expected M --doors-unreachable N \
//        --address <claimed|absent|unasked>
//
// ── ⛔ THE DEFECT THIS FILE IS THE ANSWER TO, MEASURED 09/09 ON THE DEMO BOX ──────────────────────────────
//
// `bash bin/box-up.sh --promote localhost` — the way BACK, which §0b documents as the undo — exited non-zero
// on the first pass with exactly this:
//
//     [box-up] the promotion is INCOMPLETE: 0 of 0 admin door(s) claimed. See the REFUSED line(s) above.
//
// ★★ AND `0 of 0` WAS NOT THE REASON. It could not be: on the way back `claimed` and `expected` are both
// STRUCTURALLY zero, because the loop that increments them is gated on `PROMOTE_DIR = out` — the way back
// claims no admin door, it RELEASES the ones the way out claimed. So that sentence is a fixed string with two
// zeroes in it, printed over whatever really went wrong. The only check that can redden the way back is the
// shop's ADDRESS in the kernel's directory — a completely different question, about a completely different
// register — and the run blamed admin doors for it, told the operator to read REFUSED lines that did not
// exist, and left the reader concluding that zero was being read as incomplete.
//
// ⇒ It is the leva's own thread in its last costume: A SIGNAL THAT CANNOT SAY WHAT IS NOT WELL. The exit code
//   was right; the sentence was about another check.
//
// ── ★★ SO THE EXPECTATION IS DERIVED FROM THE DESTINATION, AND THE RIGOR IS NOT TOUCHED ──────────────────
//
// «Measure how many doors each destination SHOULD claim before choosing the rule» — and the answer is not the
// same number twice:
//
//   out   (a tenant × every spelling of the hostname) — each one claimed through `dist/admin-host.js set`.
//         A run that claims fewer than it owes leaves one brand's admin answering `unknown_admin_host` to a
//         login, so `claimed < expected` is INCOMPLETE and stays incomplete. ⛔ `expected = 0` is not success
//         there either: a promotion outwards that owed nothing never read `seed/box.json`, and calling that
//         complete is the exact sentence above.
//   back  ZERO. `localhost`'s doors are written at BIRTH, from `seed/box.json`; the way back only releases the
//         promoted spellings. Zero is the right number, not a failure — and a claim count is therefore not an
//         expectation on this direction, so the verdict may not print one. ⛔ Being TOLD it owes doors is a
//         script that lost track of which way it is going: that is exit 2, not a verdict.
//
// What is graded on BOTH directions is the shop's address, because both directions move it.
//
// ── ★ AND "COULD NOT ASK" IS NOT "IT IS BROKEN" ──────────────────────────────────────────────────────────
// `--address unasked` is a run with no credential in its environment: it learned nothing about the directory.
// It is SAID, and it does not change the status — the split `bin/verify-seed.mjs`, `bin/verify-config.mjs`,
// `bin/store-host.mjs` and `bin/warm-box.mjs` all make, for the reason written in each of them.
//
// ── EXIT CODES ───────────────────────────────────────────────────────────────────────────────────────────
//   0  settled — every check that ran is complete
//   1  INCOMPLETE — and every line says which check, in its own words
//   2  THIS VERDICT could not be given: the facts handed to it do not describe a promotion. Never a claim
//      about the box. (A caller that passes garbage must not be able to publish a green.)
//
// It takes its whole subject from its arguments — no file reading, no environment — which is what lets
// `bin/promotion-verdict.guard.mjs` prove every branch in milliseconds instead of from a real promotion.

const DIRECTIONS = ['out', 'back'];
const ADDRESS_STATES = ['claimed', 'absent', 'unasked'];

const argOf = (argv, name) => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : undefined;
};

class CannotGrade extends Error {}

/** A whole non-negative number, or a refusal naming the flag. A missing count is never read as zero: zero is a
 *  measurement here, and inventing one is how this sentence came to carry two of them. */
function count(argv, name) {
  const raw = argOf(argv, name);
  if (raw === undefined) {
    throw new CannotGrade(`${name} was not given, and this verdict may not assume a number for it.`);
  }
  if (!/^\d+$/.test(raw)) {
    throw new CannotGrade(`${name} must be a whole non-negative number, got "${raw}".`);
  }
  return Number(raw);
}

/**
 * ★★ THE RULE. Takes the facts, answers `{ status, lines }` — `lines` is what the operator reads and every one
 * of them names the check it came from.
 */
export function verdict(facts) {
  const { direction, claimed, expected, unreachable, address } = facts;
  if (!DIRECTIONS.includes(direction)) {
    throw new CannotGrade(`--direction is ${DIRECTIONS.join(' or ')}, got "${direction}".`);
  }
  if (!ADDRESS_STATES.includes(address)) {
    throw new CannotGrade(`--address is ${ADDRESS_STATES.join(' / ')}, got "${address}".`);
  }
  if (direction === 'back' && (expected > 0 || claimed > 0)) {
    throw new CannotGrade(
      'the way back claims NO admin door (localhost\'s doors are written at birth from seed/box.json; this ' +
        `direction only releases the promoted spellings) — and it was handed ${claimed} of ${expected}. ` +
        'Either the claim loop ran on the wrong direction, or these numbers came from the wrong variables.',
    );
  }
  if (direction === 'out' && expected === 0) {
    throw new CannotGrade(
      'a promotion OUTWARDS owed no admin door at all, so there was nothing to claim and nothing to grade. ' +
        'That is not a complete promotion: `seed/box.json` declares a tenant per admin door, so zero means ' +
        'the doors were never derived. (This is the 09/09 sentence: `0 of 0` is not a success.)',
    );
  }

  const lines = [];
  // ── the admin doors — graded ONLY where the destination has any to claim ──
  if (direction === 'out' && claimed < expected) {
    lines.push(
      `the admin doors: ${claimed} of ${expected} claimed — every door not claimed answers ` +
        '`unknown_admin_host` to a login that saw a normal page. The REFUSED line(s) above name them.',
    );
  }
  if (unreachable > 0) {
    lines.push(
      `the published doors: ${unreachable} address(es) in the list above are plain http off \`localhost\` on ` +
        'a host that publishes nothing there — a door nothing answers at is worse than a short list.',
    );
  }
  // ── the shop's address — graded on BOTH directions, because both move it ──
  if (address === 'absent') {
    lines.push(
      "the shop's address: `read.store.by_host` does not answer this origin, so the box routes only through " +
        "the fronts' FORGE_STORE_HOSTS override. The [store-host] line(s) above say why.",
    );
  }

  if (lines.length > 0) return { status: 1, lines: ['the promotion is INCOMPLETE:', ...lines] };

  // ── settled — and it says WHAT it graded, because a bare "ok" is the green that proves the least ──
  const graded = [];
  if (direction === 'out') graded.push(`${claimed} of ${expected} admin door(s) claimed`);
  else graded.push('no admin door to claim on the way back (they are written at birth), so none was owed');
  graded.push(
    address === 'claimed'
      ? "the shop's address is in the kernel's directory"
      : "the shop's address was NOT asked about (no credential in this run's environment) — that is a fact " +
          'about this run, not about the box',
  );
  return { status: 0, lines: [`the promotion is COMPLETE: ${graded.join(' · ')}.`] };
}

function main(argv) {
  let out;
  try {
    out = verdict({
      direction: argOf(argv, '--direction') ?? '',
      claimed: count(argv, '--doors-claimed'),
      expected: count(argv, '--doors-expected'),
      unreachable: count(argv, '--doors-unreachable'),
      address: argOf(argv, '--address') ?? '',
    });
  } catch (error) {
    if (!(error instanceof CannotGrade)) throw error;
    process.stderr.write(
      `\n[box-up] ⚑ THE PROMOTION'S VERDICT COULD NOT BE GIVEN, and that is about this run and not about the\n` +
        `         box: ${error.message}\n` +
        '         Nothing above is a claim that the promotion worked or that it did not.\n\n',
    );
    return 2;
  }
  process.stderr.write(`\n${out.lines.map((line) => `[box-up] ${line}`).join('\n')}\n\n`);
  return out.status;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));

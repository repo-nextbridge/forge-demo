#!/usr/bin/env node
// ★★ WHAT ONLY EXISTS ONLINE — RUN WHERE IT EXISTS, ANNOUNCED WHERE IT DOES NOT.
//
//   node bin/online-only.mjs --phase after-birth
//
// ── THE QUESTION THIS ANSWERS, AND THE ANSWER IT REFUSES TO BE ───────────────────────────────────────────
//
// A RESET MUST TURN BACK ON EVERYTHING THAT ONLY EXISTS ONLINE — a CDN in front of the demo, and anything
// else of that species, which the reset destroys and no local step recreates.
//
// ⛔ THE WRONG ANSWER IS A LIST OF THINGS TO TURN BACK ON. A list ages in silence: somebody makes an
// adjustment on the live box, forgets to add it, and the next reset erases it with nothing saying so — the
// disease this whole arc has been chasing. So the facilities are DECLARED in `seed/box.json`, this step
// answers for EVERY declared one, and a facility with nothing to do says "no-op" and why. In a list the
// forgotten item is invisible; here it is the line that is missing from the answer.
//
// ── THE TWO FACILITIES THIS BOX DECLARES, AND WHY NEITHER RUNS ON THE BENCH ──────────────────────────────
//
// `edge-cache` — purge the CDN in front of the box.
//   ⚠️ AFTER THE REBIRTH, WHICH IS THE COUNTER-INTUITIVE HALF AND THE ENTIRE POINT. Purge FIRST and the CDN
//   spends the ~17 minutes of the birth refilling itself from the origin that is being destroyed, so it
//   comes out of the reset holding precisely what the purge was for. The sequence is reborn → purge → warm
//   → verdict, and the warming step immediately after is what refills it with the NEW box's answers.
//   On the bench there is no CDN: caddy is the edge and it caches nothing.
//
// `media-store` — drop the object prefix the previous birth wrote.
//   On the bench the media is a docker VOLUME and `bin/box-down.sh` destroys it by name, so there is
//   genuinely nothing left to sweep. ONLINE a bucket is not a volume: the rebirth uploads ~18 500 objects
//   under fresh keys and last week's stay, paid for and pointed at by nothing. Nothing breaks — it only
//   grows, which is why it needs a step rather than a person noticing.
//
// ── ★★ AND AN UNIMPLEMENTED DRIVER REFUSES RATHER THAN NO-OPS ────────────────────────────────────────────
//
// Each facility names the environment variable that SELECTS its driver. Unset (or `none`) is the bench, and
// it is announced. Any other value is a box that was told to do this for real — and this repository ships no
// driver, so it REFUSES BY NAME. A step that quietly did nothing when configured would fail exactly on the
// box the configuration exists for, which is the failure mode that made this file necessary.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const phase = argOf('--phase') ?? 'after-birth';

/**
 * ★ THE DRIVERS THIS REPOSITORY REALLY HAS, and today the honest answer is "only the empty one".
 *
 * A name in this map is a promise that something happens. Keeping it empty rather than stubbing a
 * `cloudflare` that logs and returns is the difference between a box that says it cannot do this yet and a
 * box that says it did.
 */
const DRIVERS = new Map();

const out = [];
const say = (line = '') => out.push(line);
let refused = 0;

const facilities = (BOX.online_only ?? []).filter((f) => f.moment === phase);
say(`ONLINE-ONLY · ${facilities.length} facilit${facilities.length === 1 ? 'y' : 'ies'} declared for "${phase}"`);
say('   they run AFTER the box is reborn: an edge purged before it would refill itself from the dying origin');
say();

for (const facility of facilities) {
  const chosen = (process.env[facility.driver_env] ?? '').trim() || 'none';
  if (chosen === 'none') {
    // ⚠️ THE DECLARED REASON, NOT ONE WRITTEN HERE. An operator has to be able to tell "there is nothing of
    // this kind in front of this box" from "this box forgot", and only the declaration knows which.
    say(`  ↷ ${facility.id} · driver "none" (${facility.driver_env} unset) — NO-OP`);
    say(`      ${facility.what}`);
    say(`      why nothing to do here: ${facility.bench_why}`);
    continue;
  }
  const driver = DRIVERS.get(chosen);
  if (!driver) {
    refused += 1;
    say(`  ✗ ${facility.id} · ${facility.driver_env}="${chosen}" — NO SUCH DRIVER in this repository.`);
    say(`      ${facility.what}`);
    say(
      '      This box was configured to do it for real and nothing here can. Refusing rather than skipping: ' +
        'a silent no-op would fail on exactly the box the setting exists for. Implement the driver, or unset ' +
        `${facility.driver_env}.`,
    );
    continue;
  }
  const result = await driver(facility);
  say(`  ✓ ${facility.id} · driver "${chosen}" — ${result}`);
}

say();
say(
  refused === 0
    ? `VERDICT: every declared online-only facility of "${phase}" has an answer above.`
    : `VERDICT: ${refused} facilit${refused === 1 ? 'y' : 'ies'} of "${phase}" ${refused === 1 ? 'was' : 'were'} configured and could NOT be run. Read the ✗ line(s).`,
);
process.stdout.write(`${out.join('\n')}\n`);
process.exit(refused === 0 ? 0 : 1);

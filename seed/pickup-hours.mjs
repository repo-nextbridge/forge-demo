// THE PICKUP WEEK, AS ONE RULE — because this repository declares pickup points in TWO files and only one of
// them was ever graded.
//
// ⛔ THE DEFECT THIS FILE IS THE ANSWER TO, reported from the screen with a screenshot: the counter's
// pickup card listed the seven days as «Fechado» and its today-line said «Fechado hoje». Measured against the
// source: `seed/totem.json` → `pickup.location` carried `name`, `addr_line1`, `district`, `city`, `uf`,
// `postal_code` and `instructions` — and no `hours` key at all, while each of the four points of
// `seed/logistics.json` writes all seven days.
//
// ★ AND THE ABSENCE WAS INDISTINGUISHABLE FROM A DECISION, which is the half worth fixing. `pickupHoursSchema`
// is `.strict()` over `mon..sun`, and an OMITTED day means closed exactly like a `null` one
// (packages/core/src/shipping/pickup.ts) — so a point with no `hours` is accepted, stored, and rendered as a
// shop that never opens. Nothing anywhere could tell "this counter is shut" from "nobody wrote the week".
// `pickupWeekProblem` is what refuses to leave the two spellings meaning the same thing HERE: on the box the
// kernel's rule stands, in the dataset a week has to be written out.
//
// A MODULE AND NOT MORE LINES IN A TEST, for the reason every module beside it states: the rule has three
// readers now — `seed/logistics.test.mjs`, this file's own test, and `bin/verify-seed.mjs`, which asks it of
// the LIVE box — and a rule copied into three readers is three rules that drift.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));
const load = (file) => JSON.parse(readFileSync(join(SEED, file), 'utf8'));

/** The kernel's own week, in the kernel's own order. `pickupHoursSchema` is `.strict()` over exactly these
 *  keys, so `segunda` is a REFUSAL and not a shop closed on Mondays. */
export const PICKUP_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** `HH:MM`, 24h, zero-padded — the kernel's `timeOfDay`. A wall-clock fact about a door: no date, no zone. */
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/**
 * ⛔ WHAT IS WRONG WITH ONE POINT'S WEEK — a sentence, or `null` when nothing is.
 *
 * ★ IT NAMES THE POINT, ALWAYS. The failure this rule exists for is silent by construction: the kernel accepts
 * every shape below except the last two, and the storefront renders all of them as a shop nobody can collect
 * from. A verdict that said "a pickup point has no hours" over five declared points would send the reader
 * looking through two files.
 *
 * The five ways a week goes wrong, and only two of them are loud at the kernel:
 *   · no `hours` at all — ACCEPTED, and it is the reported defect;
 *   · a foreign day name (`seg`) — REFUSED by `.strict()`, and the refusal is why the schema is strict;
 *   · a missing day — ACCEPTED as closed, which is right for the kernel and ambiguous for a dataset;
 *   · a day that closes before it opens — REFUSED (`open < close`), so an overnight shift needs two days;
 *   · all seven `null` — ACCEPTED, and it is exactly the screen that was photographed.
 */
export function pickupWeekProblem(point) {
  const name = point?.name ?? '(a point with no name)';
  const at = `pickup point "${name}"`;
  const hours = point?.hours;

  if (hours === undefined || hours === null) {
    return (
      `${at}: no \`hours\` at all. The kernel reads an omitted week as CLOSED EVERY DAY and the checkout ` +
      'prints seven «Fechado» — write the seven days, with `null` on the ones the door really is shut.'
    );
  }
  if (typeof hours !== 'object' || Array.isArray(hours)) {
    return `${at}: \`hours\` is ${Array.isArray(hours) ? 'an array' : typeof hours}, not a week of ${PICKUP_WEEKDAYS.join(', ')}.`;
  }

  const keys = Object.keys(hours);
  const foreign = keys.filter((k) => !PICKUP_WEEKDAYS.includes(k));
  if (foreign.length > 0) {
    return (
      `${at}: writes ${foreign.join(', ')}. \`pickupHoursSchema\` is \`.strict()\` over ` +
      `${PICKUP_WEEKDAYS.join(', ')} and REFUSES anything else — which is the point of it being strict.`
    );
  }
  const missing = PICKUP_WEEKDAYS.filter((k) => !keys.includes(k));
  if (missing.length > 0) {
    return (
      `${at}: does not write ${missing.join(', ')}. An omitted day is stored as closed, so the file cannot ` +
      'say whether the door is shut then or whether somebody forgot — write `null` to mean shut.'
    );
  }

  for (const day of PICKUP_WEEKDAYS) {
    const h = hours[day];
    if (h === null) continue;
    if (typeof h !== 'object' || h === null || !HHMM.test(String(h.open)) || !HHMM.test(String(h.close))) {
      return `${at} ${day}: expected {open, close} as zero-padded HH:MM, or \`null\` for closed. Got ${JSON.stringify(h)}.`;
    }
    if (!(h.open < h.close)) {
      return (
        `${at} ${day}: ${h.open}–${h.close}. The kernel refuses a day that closes before it opens, and an ` +
        'overnight shift needs a second day rather than one interval — it would read as a lie on the checkout.'
      );
    }
  }

  if (PICKUP_WEEKDAYS.every((day) => hours[day] === null)) {
    return (
      `${at}: all seven days are \`null\`. The kernel accepts it, and it is the exact screen this rule exists ` +
      'for — a point the shopper is invited to collect from and can never reach.'
    );
  }
  return null;
}

/** How many days of the week the door is open. The counter's defect was this number being zero. */
export function openDayCount(point) {
  const hours = point?.hours;
  if (!hours || typeof hours !== 'object') return 0;
  return PICKUP_WEEKDAYS.filter((day) => hours[day] != null).length;
}

/**
 * ★ EVERY PICKUP POINT THIS REPOSITORY DECLARES, with the store handle whose presence on a tenant is what
 * makes `bin/seed.mjs` write it — so a caller can ask "on THIS tenant, which points must exist?" without
 * keeping a second list that goes stale.
 *
 * `bin/seed.mjs` guards both steps by handle: `if (here('forge'))` runs `seedLogistics`, `if (here('cafe'))`
 * runs `seedTotem`, whose pickup step creates the counter's point. The handle recorded here is the one whose
 * SHOP the point belongs to on a screen — `balcao` for the counter — because that is what a reader of a
 * verdict is looking for.
 *
 * ⛔ AND IT ACCUSES THE VACUUM. A collector that quietly returns an empty list turns every guard downstream
 * green: nothing to check is not the same as nothing wrong, and a `hours` rule proved over zero points is the
 * failure the rule was written against, wearing a ✓.
 */
export function collectPickupPoints({ logistics, totem }) {
  const from = (source, store, points) => {
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error(
        `${source} declares NO pickup point. Every check over this list would go green having graded ` +
          'nothing — which is the failure, not the absence of one.',
      );
    }
    return points.map((point) => ({ source, store, point }));
  };
  const counter = totem?.pickup?.location;
  return [
    ...from('seed/logistics.json', 'forge', logistics?.pickup_points),
    ...from('seed/totem.json', 'balcao', counter ? [counter] : []),
  ];
}

/** The same list, read off disk. */
export function declaredPickupPoints() {
  return collectPickupPoints({ logistics: load('logistics.json'), totem: load('totem.json') });
}

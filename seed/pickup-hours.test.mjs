// ★★ THE PICKUP WEEK, OVER EVERY POINT THE DATASET DECLARES — and that "every" is the whole slice.
//
// ⛔ THE DEFECT, reported by the owner on 05/09 with a screenshot: the counter's pickup card listed the seven
// days as «Fechado» and its today-line said «Fechado hoje». `seed/totem.json` → `pickup.location` had no
// `hours` key, and an OMITTED day is closed to the kernel exactly like a `null` one — so the box was correct,
// the render was correct, and the shop was shut forever.
//
// ⇒ AND A GUARD ALREADY EXISTED FOR THIS, POINTED AT THE OTHER FILE. `seed/logistics.test.mjs` asserted the
//   week of the four shoe-brand points and had done since A22; the counter's single point, declared in
//   another file, was never in any list. So the rule was not missing — its REACH was. That is why the check
//   here starts from a COLLECTOR over both files and counts what it found, rather than from a literal.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PICKUP_WEEKDAYS,
  collectPickupPoints,
  declaredPickupPoints,
  openDayCount,
  pickupWeekProblem,
} from './pickup-hours.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const readSeed = (name) => JSON.parse(readFileSync(join(SEED, name), 'utf8'));
const LOGISTICS = readSeed('logistics.json');
const TOTEM = readSeed('totem.json');

/** A week somebody could collect in, as a starting point for the sabotages below. */
const aWeek = () =>
  Object.fromEntries(PICKUP_WEEKDAYS.map((day) => [day, { open: '09:00', close: '18:00' }]));
const aPoint = (hours) => ({ name: 'Balcão de Prova', hours });

test('★★ every pickup point THIS REPOSITORY declares writes a week, and the verdict names the point', () => {
  for (const { source, point } of declaredPickupPoints()) {
    assert.equal(
      pickupWeekProblem(point),
      null,
      `${source} declares a point whose week is wrong — the checkout would print «Fechado» for it`,
    );
  }
});

test('★★ …and the collector COUNTS, so a rule proved over nothing cannot pass for a rule', () => {
  // The number is derived from the two files, never typed: five today — the shoe brand's four and the
  // counter's one. What is asserted is that BOTH SOURCES ARE IN IT, which is the property that was false
  // before this slice: the counter's point existed and no guard's list contained it.
  const found = declaredPickupPoints();
  assert.equal(found.length, LOGISTICS.pickup_points.length + 1, 'the collector lost a declared point');
  assert.ok(found.length >= 2, 'a single-source collector is the reach defect, back again');
  assert.deepEqual(
    [...new Set(found.map((d) => d.source))].sort(),
    ['seed/logistics.json', 'seed/totem.json'],
    'both files that declare pickup points have to be in the list, or the reach is back to one',
  );
  assert.ok(
    found.some((d) => d.point.name === TOTEM.pickup.location.name && d.store === 'balcao'),
    "the COUNTER's point — the one the owner found shut all week — is not in the collector's list",
  );
});

test('⛔ THE VACUUM ACCUSES ITSELF — a collector that finds nothing says so instead of going green', () => {
  // A guard pointed at an empty list is the failure it was written against, wearing a ✓. Both sources are
  // emptied one at a time, because a collector that only checks the first would still be half blind.
  assert.throws(
    () => collectPickupPoints({ logistics: { pickup_points: [] }, totem: TOTEM }),
    /seed\/logistics\.json declares NO pickup point/,
  );
  assert.throws(
    () => collectPickupPoints({ logistics: LOGISTICS, totem: { pickup: {} } }),
    /seed\/totem\.json declares NO pickup point/,
  );
  assert.throws(() => collectPickupPoints({}), /declares NO pickup point/);
});

test('⛔ SABOTAGE — a point with NO `hours` is accused, and the accusation carries its name', () => {
  // The reported defect itself, staged. Nothing about it is loud at the kernel: `pickup_location.create`
  // accepts this point and the checkout renders it as a door that never opens.
  const problem = pickupWeekProblem({ name: 'Balcão · Forge Café' });
  assert.match(problem, /no `hours` at all/);
  assert.match(problem, /Balcão · Forge Café/, 'a verdict without the point name sends the reader hunting');
  assert.match(problem, /CLOSED EVERY DAY/);
  // `null` is the same absence, said differently — and the kernel treats the two spellings alike.
  assert.match(pickupWeekProblem({ name: 'X', hours: null }), /no `hours` at all/);
});

test('⛔ SABOTAGE — ONE day deleted is accused, by the name of the point AND of the day', () => {
  // The dangerous one: six days written reads as a file somebody maintained, and the seventh silently means
  // closed. The message has to say which day, or the reader diffs a week by eye.
  for (const day of PICKUP_WEEKDAYS) {
    const hours = aWeek();
    delete hours[day];
    const problem = pickupWeekProblem(aPoint(hours));
    assert.match(problem, new RegExp(`does not write ${day}`), `a missing ${day} went unnoticed`);
    assert.match(problem, /Balcão de Prova/);
  }
});

test('⛔ SABOTAGE — all seven days deleted does NOT come out green, and neither do all seven `null`', () => {
  // The vacuum again, one level down: an empty week is a week-shaped object, and a check that only compared
  // day names would have been satisfied by `{}` being a subset of nothing.
  const empty = pickupWeekProblem(aPoint({}));
  assert.match(empty, /does not write mon, tue, wed, thu, fri, sat, sun/);
  assert.match(empty, /Balcão de Prova/);

  const shut = pickupWeekProblem(aPoint(Object.fromEntries(PICKUP_WEEKDAYS.map((d) => [d, null]))));
  assert.match(shut, /all seven days are `null`/);
  assert.match(shut, /Balcão de Prova/);
  assert.equal(openDayCount(aPoint(Object.fromEntries(PICKUP_WEEKDAYS.map((d) => [d, null])))), 0);
});

test('⛔ SABOTAGE — the two shapes the KERNEL itself refuses are refused here first, with the file in hand', () => {
  // `.strict()` over `mon..sun`: `seg` is a 400 on the box, and the reason the schema is strict is that the
  // alternative was a bag the storefront renders as "closed every day".
  const foreign = pickupWeekProblem(aPoint({ ...aWeek(), seg: { open: '09:00', close: '18:00' } }));
  assert.match(foreign, /writes seg/);
  assert.match(foreign, /`\.strict\(\)`/);

  // `open < close`: a shift across midnight needs a second day, and that is the kernel's deliberate cut.
  const overnight = pickupWeekProblem(aPoint({ ...aWeek(), fri: { open: '23:00', close: '06:00' } }));
  assert.match(overnight, /fri: 23:00–06:00/);
  assert.match(overnight, /closes before it opens/);
  assert.match(pickupWeekProblem(aPoint({ ...aWeek(), sat: { open: '10:00', close: '10:00' } })), /sat: 10:00–10:00/);

  // …and the clock is the kernel's own `HH:MM`, zero-padded, 24h.
  assert.match(pickupWeekProblem(aPoint({ ...aWeek(), mon: { open: '9:00', close: '18:00' } })), /HH:MM/);
  assert.match(pickupWeekProblem(aPoint({ ...aWeek(), mon: { open: '08:00', close: '24:00' } })), /HH:MM/);
  assert.match(pickupWeekProblem(aPoint({ ...aWeek(), mon: 'aberto' })), /HH:MM/);
});

test('★★ THE COUNTER — the point the owner photographed — is open on days a person can actually go there', () => {
  // The regression, named. A week that parses is not the fix; a week nobody can collect in is the defect.
  const counter = TOTEM.pickup.location;
  assert.equal(pickupWeekProblem(counter), null);
  assert.equal(openDayCount(counter), 7, 'a neighbourhood café that shuts for a whole day would need a reason');
  // ⚠️ NOT ONE VALUE COPIED SEVEN TIMES. The owner's ruler for this dataset is fidelity — *"pede fidelidade,
  // pois senão os agents fazem a função e deixa tudo feio ali"* — and a café that opens and closes at the
  // same minute all week is the shape a function writes, not a shop.
  const shapes = new Set(PICKUP_WEEKDAYS.map((d) => `${counter.hours[d]?.open}-${counter.hours[d]?.close}`));
  assert.ok(shapes.size >= 3, `the counter's week has ${shapes.size} distinct shape(s) — that is a placeholder`);
  // The `why` of the file has to carry the reasoning, because the next person to edit these hours reads it.
  assert.match(TOTEM.pickup.why.join(' '), /vila madalena/i);
});

test('the week this file checks is the week the KERNEL checks', () => {
  assert.deepEqual(PICKUP_WEEKDAYS, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
});

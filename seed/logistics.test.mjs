// A22 — THE LOGISTICS REGISTRIES. What is worth testing is not "there are four carriers"; it is the two
// declarations that would be accepted here and REFUSED (or worse, accepted wrongly) on the box:
//   · a tracking template without the `{code}` placeholder — the kernel refuses it, and a template with the
//     placeholder MISSING would link every parcel in the shop to the carrier's home page, which looks fine;
//   · a week written in the wrong vocabulary — `pickupHoursSchema` is `.strict()` over `mon..sun`, so a file
//     that wrote `seg` would be refused rather than stored as a shop closed every day.
// …plus the one decision this slice deliberately did NOT take, which is a boundary and not a gap.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TRACKING_PLACEHOLDER, missingByName, trackingTemplateProblem } from './logistics.mjs';
import { pickupWeekProblem } from './pickup-hours.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(SEED, 'logistics.json'), 'utf8'));


test('★★ every declared tracking template passes the check the KERNEL will make', () => {
  for (const carrier of DATA.carriers) {
    assert.equal(
      trackingTemplateProblem(carrier),
      null,
      `carrier "${carrier.name}" would be refused by shipping.carrier.create`,
    );
  }
});

test('⛔ …and the check is capable of RED, in the three ways a template goes wrong', () => {
  // A guard nobody has seen fail is a guard nobody knows the shape of. All three are the SAME symptom on a
  // shop — a link that goes to the wrong page — and only one of them is loud at the kernel.
  assert.match(
    trackingTemplateProblem({ name: 'X', tracking_url_template: 'https://x.example/track' }),
    /exactly once \(found 0\)/,
  );
  assert.match(
    trackingTemplateProblem({
      name: 'X',
      tracking_url_template: `https://x.example/{code}/{code}`,
    }),
    /exactly once \(found 2\)/,
  );
  assert.match(trackingTemplateProblem({ name: 'X', tracking_url_template: '   ' }), /empty/);
});

test('★ a carrier that publishes NO tracking page is legal, and one row proves it', () => {
  // `tracking_url_template` is nullable on create and on update, and a parcel the buyer fetches has nothing
  // to track. Without a row like this the screen would suggest a carrier without a link is misregistered.
  assert.equal(trackingTemplateProblem({ name: 'X', tracking_url_template: null }), null);
  assert.ok(
    DATA.carriers.some((c) => c.tracking_url_template === null),
    'no declared carrier exercises the null template — the nullability is then only an opinion',
  );
});

test('the placeholder this file checks for is the one the kernel checks for', () => {
  assert.equal(TRACKING_PLACEHOLDER, '{code}');
});

test('★★ every pickup point writes the KERNEL’s week — the rule now lives where BOTH files can reach it', () => {
  // ⇒ THE RULE MOVED, AND THE MOVE IS THE POINT. It used to be written out here, over this file's four
  // points, and it was right about all four for a year — while the counter's point in `seed/totem.json`, one
  // tenant away, had no `hours` at all and nobody's list contained it. `seed/pickup-hours.mjs` holds the
  // check now, `seed/pickup-hours.test.mjs` runs it over EVERY point the dataset declares, and this test
  // stays so that a shoe-brand point that rots is still red in the file that declares it.
  for (const point of DATA.pickup_points) {
    assert.equal(
      pickupWeekProblem(point),
      null,
      `pickup point "${point.name}" would be shown to a shopper as a door that never opens`,
    );
  }
});

test('★ every pickup point carries what the address requires, and nothing invented', () => {
  for (const point of DATA.pickup_points) {
    for (const field of ['name', 'addr_line1', 'city', 'uf', 'postal_code']) {
      assert.ok(point[field], `pickup point "${point.name}" has no ${field}, which create demands`);
    }
    // ⛔ NO COORDINATES. They are data a merchant pastes from a map service; inventing plausible ones for
    // real streets would be inventing facts. A point with none simply never sorts by proximity.
    assert.equal(point.lat, undefined, `"${point.name}" carries a latitude nobody measured`);
    assert.equal(point.lng, undefined, `"${point.name}" carries a longitude nobody measured`);
  }
});

test('⛔ this slice creates NO pickup METHOD, and the file says why', () => {
  // The boundary, asserted so that "the points are unreachable from the checkout" is a decision somebody can
  // find rather than a hole somebody rediscovers. Adding the method would put a «Retirar na loja» option into
  // two funnels and FLIP both live proof orders from delivery to pickup — `seed/commerce.mjs` prefers a
  // usable pickup option over a delivery one, by intention.
  assert.equal(DATA.methods, undefined, 'a `methods` key appeared — see the readme and SEED-PICKUP-SO-METADE');
  assert.match(DATA._readme.join(' '), /SEED-PICKUP-SO-METADE/);
});

test('the names are unique — the name is the idempotence key in both registries', () => {
  for (const family of ['carriers', 'pickup_points']) {
    const names = DATA[family].map((row) => row.name);
    assert.equal(new Set(names).size, names.length, `two rows share a name in ${family}`);
  }
});

test('★ a second run creates nothing — `missingByName` is what makes the name a key', () => {
  assert.deepEqual(missingByName(DATA.carriers, DATA.carriers.map((c) => c.name)), []);
  assert.deepEqual(
    missingByName(DATA.pickup_points, []).map((p) => p.name),
    DATA.pickup_points.map((p) => p.name),
  );
});

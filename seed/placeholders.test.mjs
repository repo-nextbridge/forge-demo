// THE PLACEHOLDER GENERATOR'S TESTS — `node --test 'seed/**/*.test.mjs'`.
//
// WHAT IS WORTH TESTING HERE, and it is not "the picture looks right" (a human opens one and sees). It is
// the three properties that decide whether this mechanism HELPS or becomes landfill, each of which fails in
// silence:
//
//   · it never draws over curated art — the failure is destroying the thing it exists to protect;
//   · the caption names the slot, the store and the size — without it the curation is a hunt through
//     identical grey rectangles, and the whole point was to make it a list;
//   · the invocation is byte-stable — without it every seed run uploads nine new objects, forever, and the
//     Asset Library grows without anybody deciding it should.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  captionFor,
  colourFor,
  fileNameFor,
  magickArgs,
  PLACEHOLDER_DIR,
  PLACEHOLDER_PREFIX,
  planPlaceholders,
  SLOTS,
} from '../bin/make-placeholders.mjs';

test('★★ a slot that already has curated art is NOT planned', () => {
  // The destructive failure. The outlet's campaign art and the counter's photographs are somebody's work;
  // a generator that painted over them would be worse than one that did nothing.
  const curated = new Set(['outlet:home.hero']);
  const plan = planPlaceholders(['outlet'], curated);
  assert.equal(
    plan.some((p) => p.slot.label === 'home.hero'),
    false,
    'it planned a placeholder over art that already exists',
  );
  // …and the slots that ARE empty still get theirs — "skip everything" is not the same fix.
  assert.ok(plan.length > 0);
});

test('★ the caption names the slot, the store and the size — in that order', () => {
  // The order is the decision: the curator is looking for a SLOT, so the slot is what they read first.
  const caption = captionFor('cafe', SLOTS[0]);
  assert.match(caption, /^home\.hero · cafe · 1504x560$/);
});

test('the file name carries the prefix, the store and the dimension', () => {
  // One search for the prefix in the Asset Library has to return the whole set, and each row has to say
  // which slot it is without being opened.
  const name = fileNameFor('cafe', SLOTS[0]);
  assert.ok(name.startsWith(PLACEHOLDER_PREFIX));
  assert.match(name, /placeholder-cafe-home-hero-1504x560\.png/);
});

test('★★ the invocation pins the flags that make the bytes stable', () => {
  // ⚠️ A PNG carries a creation time by default. Without these two flags the same picture generated twice is
  // two different files, the seed's "same name, same bytes?" check misses, and every run adds nine objects
  // to the bucket and nine rows to a library nobody curated — the exact defect `bin/seed.mjs` documents
  // about `media.request_upload` minting a new key per call.
  const args = magickArgs('cafe', SLOTS[0], '/tmp/x.png');
  assert.ok(args.includes('-strip'), 'no -strip: metadata would vary between runs');
  const define = args.indexOf('-define');
  assert.notEqual(define, -1, 'no -define: the PNG time chunk would vary between runs');
  assert.equal(args[define + 1], 'png:exclude-chunk=time');
});

test('the size comes from the slot, never from the caller', () => {
  const args = magickArgs('cafe', SLOTS[0], '/tmp/x.png');
  assert.equal(args[args.indexOf('-size') + 1], '1504x560');
});

test('a shop always gets the same colour, and two shops differ', () => {
  assert.equal(colourFor('cafe'), colourFor('cafe'));
  assert.notEqual(colourFor('cafe'), colourFor('forge'));
});

test('★ no slot is declared for the counter — the totem has no hero to fill', () => {
  // The archetype rule reaching this file: a totem is four bands and no banner. Generating a hero for it
  // because the generator knows how is exactly the absurd data the whole archetype mechanism refuses.
  assert.equal(
    SLOTS.some((s) => s.label.includes('balcao') || s.slot.includes('totem')),
    false,
  );
});

test('the mobile hero is its own frame, not a crop of the desktop one', () => {
  // Measured from the incumbent art: the desktop hero is 1504x560 and the mobile one is SQUARE. One file
  // for both would put a wide strip on a phone.
  const desktop = SLOTS.find((s) => s.label === 'home.hero');
  const mobile = SLOTS.find((s) => s.label === 'home.hero (mobile)');
  assert.ok(desktop && mobile);
  assert.notEqual(`${desktop.width}x${desktop.height}`, `${mobile.width}x${mobile.height}`);
  assert.equal(mobile.width, mobile.height);
});

test('every planned placeholder is on disk — the generator was run and its output committed', () => {
  // A generator whose output is not committed is a bench that comes up with empty slots on a clone.
  for (const item of planPlaceholders(['forge', 'outlet', 'cafe'], new Set())) {
    assert.ok(existsSync(join(PLACEHOLDER_DIR, item.file)), `missing ${item.file}`);
  }
});

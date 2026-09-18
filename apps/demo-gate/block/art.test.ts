// ⛔⛔ THE TEST THAT WAS MISSING, AND THE DEFECT IT WOULD HAVE CAUGHT.
//
// The v2 screen shipped its art as a path built at render time — `` `./art/card-${face.store ?? 'store'}.webp` ``
// — and every test in this app stayed green while two things were wrong at once: the bundler never emitted a
// single one of the six files (a template literal is text, not an import), and two of the four cards named a
// file that does not exist, because the store handles are `forge|outlet|cafe|balcao` and the art is named for
// what each shop IS — `store|outlet|cafe|totem`. Measured by grepping the baked `.next` of all four fronts:
// zero art in all four.
//
// ★ SO THE RULE HERE IS THE ONE THE OLD SHAPE COULD NOT HAVE: the relationship between a face and its picture
// is DECLARED (`./art.ts`), and it is held against the box's own declaration IN BOTH DIRECTIONS. A face the
// box publishes with no art is red BY NAME; art left behind by a face that went away is red BY NAME. Neither
// is a thing a reader would notice, and both are a thing a bake happily ships.
//
// ⚠️ AND THE FILE IS ASSERTED TO BE ON DISK, not merely named in the map. The import is what makes the
// bundler emit the asset, and an import of a missing file is a BUILD error rather than a test failure — which
// sounds like enough until you remember where that build runs: inside the oven, minutes in, on a machine
// nobody is watching. This suite is the loop everybody already runs.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { GATE_TENANTS } from '../faces.generated';
import { ADMIN_ART, CARD_ART } from './art';

const shops = GATE_TENANTS.flatMap((t) => t.faces.filter((f) => f.kind === 'shop'));
const ART_DIR = join(__dirname, 'art');

test('★★★ every SHOP the box declares has a picture, and no picture outlives its shop', () => {
  const declared = shops.map((f) => f.key).sort();
  expect(
    declared.filter((key) => !CARD_ART[key]),
    'a shop this box publishes has no art: its card draws a blank where the design puts the photograph',
  ).toEqual([]);
  expect(
    Object.keys(CARD_ART).filter((key) => !declared.includes(key)).sort(),
    'art is declared for a face this box does not publish — a picture nothing draws, carried into every image',
  ).toEqual([]);
});

test('★★★ every TENANT has its admin screenshot, and no screenshot outlives its tenant', () => {
  const ids = GATE_TENANTS.map((t) => t.id).sort();
  expect(
    ids.filter((id) => !ADMIN_ART[id]),
    'a tenant has no screenshot: its admin window draws an empty screen',
  ).toEqual([]);
  expect(
    Object.keys(ADMIN_ART).filter((id) => !ids.includes(id)).sort(),
    'a screenshot is declared for a tenant this box does not have',
  ).toEqual([]);
});

test('⛔ every picture the map names is a FILE IN THIS TREE — the import is a promise the disk keeps', () => {
  // The values are what the bundler produced, so in this environment `.src` is the module path rather than the
  // emitted URL. What is asserted is therefore the FILE, by the name the import used — which is the thing that
  // was wrong before (`card-forge.webp`, `card-balcao.webp`: neither has ever existed).
  const named = [
    ...Object.entries(CARD_ART).map(([key, a]) => [key, a] as const),
    ...Object.entries(ADMIN_ART).map(([key, a]) => [key, a] as const),
  ];
  const missing = named
    .map(([key, a]) => [key, (a.src ?? '').split('/').pop() ?? ''] as const)
    .filter(([, file]) => file !== '' && !existsSync(join(ART_DIR, file)))
    .map(([key, file]) => `${key} → block/art/${file}`);
  expect(missing, 'the map names a picture that is not in block/art/').toEqual([]);
});

test('⛔ ANTI-VACUUM — the two maps are not empty, and the box really declares faces to hold them against', () => {
  // Every assertion above is satisfied by two empty maps and a box with no faces. That is not a hypothetical
  // state: `faces.generated.ts` is GENERATED, and a generator that produced an empty declaration would turn
  // this whole file green while the screen drew nothing at all.
  expect(shops.length, 'the box declares no shop — every rule above compared two empty lists').toBeGreaterThan(1);
  expect(GATE_TENANTS.length, 'the box declares no tenant').toBeGreaterThan(1);
  expect(Object.keys(CARD_ART).length, 'no card art is declared').toBeGreaterThan(1);
  expect(Object.keys(ADMIN_ART).length, 'no admin art is declared').toBeGreaterThan(1);
});

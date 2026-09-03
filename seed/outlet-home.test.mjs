// THE OUTLET HOME'S RECONCILIATION — `node --test seed/outlet-home.test.mjs` (or: `bash bin/test.sh`).
//
// WHY THIS FILE EXISTS AT ALL. Until 02/09 the home was four blocks in four different slots, and "is there a
// placement of this app+component in this slot?" identified each one exactly. He then asked for an order the
// template can only express as `position` inside ONE slot, and the moment two `banners/banner` blocks share a
// slot that question identifies NOTHING — it matches the mosaic and the kids banner equally.
//
// A reconciler that gets that wrong fails in the two ways that are hardest to see on a bench:
//   · it DUPLICATES — the page grows a second mosaic on every run, and each run still reports success;
//   · it LEAVES THE OLD PAGE — every box that ran the previous version has the mosaic in `home.hero` and the
//     two shelves in `home.banner_strip` / `home.below_shelf`, i.e. drawn ABOVE «Compre por categoria», which
//     is the one thing he asked to change. A seed that only appends is green and wrong.
//
// So the pairing is tested against the two states that actually exist in the world — the previous version's
// page, and a box that has only ever run `extension.install` — and not against an empty database, which is
// the state nothing is ever in.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { planHome } from './outlet.mjs';

const data = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'outlet.json'), 'utf8'));

const GOVERNED = { apps: new Set(['banners', 'shelves']), slot: /^storefront:(home|list)\./ };
const SLOT = 'storefront:home.below_categories';

/** The four blocks `outlet.json` declares, reduced to what the pairing actually reads. */
const WANTED = [
  { extension_id: 'banners', component: 'banner', slot: SLOT, position: 0, what: 'mosaic' },
  { extension_id: 'shelves', component: 'shelf', slot: SLOT, position: 1, what: 'quase' },
  { extension_id: 'shelves', component: 'shelf', slot: SLOT, position: 2, what: 'acabando' },
  { extension_id: 'banners', component: 'banner', slot: SLOT, position: 3, what: 'kids' },
];

const row = (placement_id, extension_id, component, target, position, config = {}) => ({
  placement_id,
  extension_id,
  component,
  target,
  position,
  config,
});

/** The page every box that ran the PREVIOUS version of the seed is showing right now. */
const previousPage = () => [
  row('hp_band', 'banners', 'announcement', 'storefront:header.announcement', 0, { text: 'x' }),
  row('hp_mosaic', 'banners', 'banner', 'storefront:home.hero', 0, { style: 'mosaic' }),
  row('hp_quase', 'shelves', 'shelf', 'storefront:home.banner_strip', 0, { title: 'Quase de graça' }),
  row('hp_acabando', 'shelves', 'shelf', 'storefront:home.below_shelf', 0, { title: 'Acabando!' }),
  row('hp_plp', 'shelves', 'shelf', 'storefront:list.below_shelf', 0),
];

const named = (plan) => plan.ops.map((op) => [op.block.what, op.reuse?.placement_id ?? null]);

test('★★ the previous page is REUSED, not appended to — nothing is placed twice', () => {
  // THE DEFECT THIS WHOLE REWRITE IS FOR. Four blocks exist in three wrong slots; the plan must move them,
  // not add four more beside them.
  const plan = planHome(previousPage(), WANTED, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['acabando', 'hp_acabando'],
    ['kids', null], // the only genuinely new block on this home
  ]);
});

test('★ the PLP instance is surplus and goes — he asked for a page with nothing on it', () => {
  // `extension.install` of `shelves` places one empty instance in `list.below_shelf` in EVERY store of the
  // tenant. It renders nothing, so leaving it is invisible on the storefront and wrong in Compose.
  const plan = planHome(previousPage(), WANTED, GOVERNED);
  assert.deepEqual(
    plan.remove.map((r) => r.row.placement_id),
    ['hp_plp'],
  );
});

test('★ the announcement band is NOT governed — a `header.` slot is not this page', () => {
  // It is a `single` block with its own upsert. A plan that swallowed it would either remove it as surplus or
  // pair the mosaic with it, and both are silent on the storefront until the band disappears.
  const plan = planHome(previousPage(), WANTED, GOVERNED);
  const touched = [...plan.remove.map((r) => r.row.placement_id), ...plan.ops.map((o) => o.reuse?.placement_id)];
  assert.ok(!touched.includes('hp_band'));
});

test('a box that has only ever installed the apps: the two install defaults host two of the shelves', () => {
  // `banners` declares no hooks, so it places nothing; `shelves` declares two. Both are empty-config
  // instances and both are legitimate hosts — which is why the plan reuses them instead of removing two and
  // placing two.
  const fresh = [
    row('hp_d1', 'shelves', 'shelf', 'storefront:home.below_shelf', 0),
    row('hp_d2', 'shelves', 'shelf', 'storefront:list.below_shelf', 0),
  ];
  const plan = planHome(fresh, WANTED, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', null],
    ['quase', 'hp_d1'],
    ['acabando', 'hp_d2'],
    ['kids', null],
  ]);
  assert.deepEqual(plan.remove, []);
});

test('★★ a second run changes NOTHING — the pairing is stable once the page is right', () => {
  // The property that makes this safe to run on a bench somebody is testing on. Fed its own output's end
  // state, the plan must pair each block with itself and find no surplus.
  const settled = [
    row('hp_band', 'banners', 'announcement', 'storefront:header.announcement', 0, { text: 'x' }),
    row('hp_mosaic', 'banners', 'banner', SLOT, 0),
    row('hp_quase', 'shelves', 'shelf', SLOT, 1),
    row('hp_acabando', 'shelves', 'shelf', SLOT, 2),
    row('hp_kids', 'banners', 'banner', SLOT, 3),
  ];
  const plan = planHome(settled, WANTED, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['acabando', 'hp_acabando'],
    ['kids', 'hp_kids'],
  ]);
  assert.deepEqual(plan.remove, []);
});

test('★ two `banners/banner` in ONE slot are told apart by their order, never by their config', () => {
  // ⚠️ THE WHOLE REASON THE PAIRING IS POSITIONAL. Both blocks are the same app and the same component, and
  // `hook_placement` has nowhere to write "this one is the mosaic" — the config is validated strictly against
  // the block's schema, so there is no field to hide a name in. If this ever pairs by config, a human's edit
  // in Compose stops being recognised and the seed duplicates the block it failed to find.
  const edited = [
    row('hp_mosaic', 'banners', 'banner', SLOT, 0, { style: 'carousel' }), // somebody changed it in Compose
    row('hp_kids', 'banners', 'banner', SLOT, 3, { style: 'mosaic' }),
  ];
  const plan = planHome(edited, WANTED, GOVERNED);
  assert.deepEqual(named(plan).filter(([what]) => what === 'mosaic' || what === 'kids'), [
    ['mosaic', 'hp_mosaic'],
    ['kids', 'hp_kids'],
  ]);
});

test('a block of ANOTHER app in a governed slot is left alone', () => {
  // The reconciler owns two apps' blocks on this page, not the page. `recommendations` or a future app
  // dropping something here is not surplus, and removing it would be this seed deleting somebody else's work.
  const withStranger = [
    ...previousPage(),
    row('hp_other', 'recommendations', 'related', SLOT, 1),
  ];
  const plan = planHome(withStranger, WANTED, GOVERNED);
  assert.ok(!plan.remove.some((r) => r.row.placement_id === 'hp_other'));
});

test('the ops come out in ASCENDING position, whatever order they were declared in', () => {
  // ⚠️ NOT COSMETIC. `composition.place`/`move` with an explicit position SHIFT every instance at or after it
  // in that slot, so the blocks have to land 0,1,2,3 in that order or they renumber each other.
  const shuffled = [WANTED[3], WANTED[1], WANTED[0], WANTED[2]];
  const plan = planHome([], shuffled, GOVERNED);
  assert.deepEqual(
    plan.ops.map((op) => op.block.position),
    [0, 1, 2, 3],
  );
});

// ── 03/09 (pk5) — THE HOME LOSES «ACABANDO!» AND THE SHELVES SHIFT UNDER THE PAIRING ────────────────────
//
// s2-8 gave the «Outlet Kids» banner a body: an "Outlet Kids" shelf, appended at position 4, sourcing the
// collection the banner points at. pk5 then removed «Acabando!» from the home on his own instruction — the
// collection stays, the ROW goes — so the declaration is FOUR blocks again: mosaic, «Quase de graça», the
// kids banner, the kids shelf.
//
// ★ AND THAT IS THE WORLD STATE THIS FILE EXISTS FOR. Two benches are running right now: one on the 02/09
// page (four blocks, «Acabando!» among them) and one on the 03/09 page (five). Both must converge on the
// same four, and because the pairing is BY ORDER within an app+component group, «Acabando!»'s instance is not
// deleted — it is REUSED, by the shelf that now sits where it sat. What gets removed is the LAST shelf of the
// pool, not the one whose title matches. That is a property worth a test precisely because it reads wrong:
// the audit trail of the row that used to say «Acabando!» becomes the audit trail of «Outlet Kids».

/** What `outlet.json` declares SINCE pk5 — the 02/09 four with «Acabando!» replaced by the kids shelf. */
const WANTED_NOW = [
  { extension_id: 'banners', component: 'banner', slot: SLOT, position: 0, what: 'mosaic' },
  { extension_id: 'shelves', component: 'shelf', slot: SLOT, position: 1, what: 'quase' },
  { extension_id: 'banners', component: 'banner', slot: SLOT, position: 2, what: 'kids' },
  { extension_id: 'shelves', component: 'shelf', slot: SLOT, position: 3, what: 'kids-shelf' },
];

/** The page a box that ran the 02/09 seed is showing right now. */
const pageOf0209 = () => [
  row('hp_band', 'banners', 'announcement', 'storefront:header.announcement', 0, { text: 'x' }),
  row('hp_mosaic', 'banners', 'banner', SLOT, 0),
  row('hp_quase', 'shelves', 'shelf', SLOT, 1),
  row('hp_acabando', 'shelves', 'shelf', SLOT, 2),
  row('hp_kids', 'banners', 'banner', SLOT, 3),
];

/** The page a box that ran the 03/09 seed is showing — the same four plus the kids shelf at 4. */
const pageOf0309 = () => [...pageOf0209(), row('hp_kids_shelf', 'shelves', 'shelf', SLOT, 4)];

test('★★ the 02/09 page keeps both its shelf instances — «Acabando!»\'s hosts the kids shelf', () => {
  const plan = planHome(pageOf0209(), WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids', 'hp_kids'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(plan.remove, []);
});

test('★★ the 03/09 page loses ONE shelf, and it is the surplus of the pool — not the one titled «Acabando!»', () => {
  // ⚠️ THE COUNTER-INTUITIVE HALF. Three shelf instances are held and two are wanted, so the plan pairs the
  // first two in read order and removes the third. `hp_acabando` survives as the kids shelf's host and
  // `hp_kids_shelf` — placed yesterday — is the row that goes. Any pairing that matched on the config would
  // do the opposite and be just as green.
  const plan = planHome(pageOf0309(), WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids', 'hp_kids'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(
    plan.remove.map((r) => r.row.placement_id),
    ['hp_kids_shelf'],
  );
});

test('★ and the run after THAT one changes nothing', () => {
  const settled = [
    row('hp_band', 'banners', 'announcement', 'storefront:header.announcement', 0, { text: 'x' }),
    row('hp_mosaic', 'banners', 'banner', SLOT, 0),
    row('hp_quase', 'shelves', 'shelf', SLOT, 1),
    row('hp_kids', 'banners', 'banner', SLOT, 2),
    row('hp_acabando', 'shelves', 'shelf', SLOT, 3),
  ];
  const plan = planHome(settled, WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids', 'hp_kids'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(plan.remove, []);
});

test('★ the PLP default is STILL surplus with two shelves wanted — it is not the kids shelf\'s host', () => {
  // ⚠️ THE TRAP. `extension.install` leaves an empty `shelves/shelf` in `list.below_shelf`, and it IS in the
  // governed set. A pairing that ordered the pool badly would hand the PLP instance to the kids shelf and
  // MOVE it onto the home — leaving the PLP clean by accident and the home built out of the wrong row. The
  // read sorts by target then position, so `home.*` comes before `list.*` and the leftover is the PLP's.
  const withPlpDefault = [...pageOf0209(), row('hp_plp', 'shelves', 'shelf', 'storefront:list.below_shelf', 0)];
  const plan = planHome(withPlpDefault, WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids', 'hp_kids'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(
    plan.remove.map((r) => r.row.placement_id),
    ['hp_plp'],
  );
});

test('★★ THE DECLARED SHAPE IS THE ONE THE PLAN IS FED — the fixtures above are not a second source', () => {
  // The fixtures in this file are hand-written on purpose: they describe world STATES, and a state derived
  // from the file under test proves nothing. What must NOT drift is the OTHER half — what `outlet.json`
  // declares. So this one reads it and checks the shape the fixtures assume: one slot, four blocks,
  // positions 0..3, two `banners/banner` and two `shelves/shelf`.
  const declared = [
    { app: 'banners', component: 'banner', slot: data.mosaic.slot, position: data.mosaic.position },
    ...data.shelves.map((s) => ({ app: 'shelves', component: 'shelf', slot: s.slot, position: s.position })),
    { app: 'banners', component: 'banner', slot: data.kidsBanner.slot, position: data.kidsBanner.position },
  ];
  assert.equal(declared.length, WANTED_NOW.length, 'outlet.json no longer declares the number of blocks these fixtures model');
  assert.deepEqual(new Set(declared.map((b) => b.slot)), new Set([SLOT]), 'a block left the single slot');
  assert.deepEqual(
    declared.map((b) => b.position).sort((a, b) => a - b),
    [0, 1, 2, 3],
    'the positions are no longer 0..3 — the shifting `place`/`move` semantics assume a dense run',
  );
  const count = (app) => declared.filter((b) => b.app === app).length;
  assert.equal(count('banners'), 2, 'the number of banner blocks changed — the positional pairing is what tells them apart');
  assert.equal(count('shelves'), 2, 'the number of shelf blocks changed — see the PLP-default test above');
});

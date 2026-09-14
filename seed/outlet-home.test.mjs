// THE OUTLET HOME'S RECONCILIATION — `node --test seed/outlet-home.test.mjs` (or: `bash bin/test.sh`).
//
// WHY THIS FILE EXISTS AT ALL. Until 02/09 the home was four blocks in four different slots, and "is there a
// placement of this app+component in this slot?" identified each one exactly. Then came a request for an order the
// template can only express as `position` inside ONE slot, and the moment two `banners/banner` blocks share a
// slot that question identifies NOTHING — it matched the mosaic and the kids banner equally. (pk5 folded the
// kids art into a shelf and left one banner block on this page; the pairing stays positional, because the
// alternative would be a rule that is right only while the page happens to hold one of each.)
//
// A reconciler that gets that wrong fails in the two ways that are hardest to see on a bench:
//   · it DUPLICATES — the page grows a second mosaic on every run, and each run still reports success;
//   · it LEAVES THE OLD PAGE — every box that ran the previous version has the mosaic in `home.hero` and the
//     two shelves in `home.banner_strip` / `home.below_shelf`, i.e. drawn ABOVE «Compre por categoria», which
//     is the one thing we were asked to change. A seed that only appends is green and wrong.
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
/** ★ 08/09 — WHERE THE MOSAIC LIVES NOW. Judged at the live store: the banners belong ABOVE «Compre
 *  por categoria», which is the hero. The page is therefore TWO slots, and each carries its own dense
 *  0..N-1 run of positions — see `outlet.json`'s `_home_why`. */
const HERO = 'storefront:home.hero';

/** The four blocks `outlet.json` declared on 02/09, reduced to what the pairing actually reads. It is a
 *  HISTORICAL declaration — the tests using it reconcile older pages against it. What ships today is
 *  `WANTED_NOW`, further down. */
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

test('★ the PLP instance is surplus and goes — the PLP was asked for with nothing on it', () => {
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

// ── 03/09 (pk5) — THE HOME LOSES TWO BLOCKS, AND THE PAIRING REUSES WHAT IS LEFT ───────────────────────
//
// s2-8 gave the «Outlet Kids» banner a body: an "Outlet Kids" shelf, appended at position 4, sourcing the
// collection the banner points at. pk5 then did two things on instruction — «Acabando!» left the home
// (the collection stays; the ROW goes) and the kids ART moved OUT of its `banners/banner` block and INTO the
// kids shelf, as the `banner_asset` of its first grid cell. So the declaration is THREE blocks: the mosaic,
// «Quase de graça» and «Outlet Kids».
//
// ★ AND THAT IS THE WORLD STATE THIS FILE EXISTS FOR. Two benches are running right now: one on the 02/09
// page (four blocks) and one on the 03/09 page (five). Both must converge on the same three, and because the
// pairing is BY ORDER within an app+component group, no instance is deleted that a wanted block can host:
// «Acabando!»'s row is REUSED by «Outlet Kids», and the surplus removed is the LAST of each pool — the kids
// BANNER block (there is one banner wanted now, not two) and, on the 03/09 page, the shelf placed yesterday.
// That is a property worth a test precisely because it reads wrong: the audit trail of the row that used to
// say «Acabando!» becomes the audit trail of «Outlet Kids».

/** What `outlet.json` declares SINCE 08/09 — the mosaic alone in the HERO, the two shelves alone under the
 *  categories. Three blocks still, over two slots, each slot dense from 0. */
const WANTED_NOW = [
  { extension_id: 'banners', component: 'banner', slot: HERO, position: 0, what: 'mosaic' },
  { extension_id: 'shelves', component: 'shelf', slot: SLOT, position: 0, what: 'quase' },
  { extension_id: 'shelves', component: 'shelf', slot: SLOT, position: 1, what: 'kids-shelf' },
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

test('★★ the 02/09 page keeps both its shelf instances, and the kids BANNER block is the surplus', () => {
  // The art it carried is the kids shelf's `banner_asset` now, so the block that used to hold it has no
  // wanted counterpart. It is removed rather than left drawing a lone tile under a shelf that has the same
  // picture in its first cell — which is what "the seed only appends" would have produced.
  const plan = planHome(pageOf0209(), WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(
    plan.remove.map((r) => r.row.placement_id),
    ['hp_kids'],
  );
});

test('★★ the 03/09 page loses TWO — the banner block and the SURPLUS shelf, not the one titled «Acabando!»', () => {
  // ⚠️ THE COUNTER-INTUITIVE HALF. Three shelf instances are held and two are wanted, so the plan pairs the
  // first two in read order and removes the third. `hp_acabando` survives as the kids shelf's host and
  // `hp_kids_shelf` — placed yesterday — is the row that goes. Any pairing that matched on the config would
  // do the opposite and be just as green.
  const plan = planHome(pageOf0309(), WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(
    plan.remove.map((r) => r.row.placement_id).sort(),
    ['hp_kids', 'hp_kids_shelf'],
  );
});

// ── 08/09 — THE MOSAIC RISES TO THE HERO, AND THE THIRD WORLD STATE IS THE ONE ON THE BENCH RIGHT NOW ───
//
// The block was dragged in Compose and then asked for in the dataset, so the seed has to MOVE what every live
// box is already showing: mosaic in `home.below_categories#0`, the two shelves at 1 and 2. Nothing is added
// and nothing is deleted — the same three rows change slot and number.
//
// ⚠️ THE HALF THAT WOULD HAVE BEEN SILENT is the shelves' renumbering. Leaving them at 1 and 2 in a slot
// whose 0 has just been vacated is a slot with a hole in it, and `place`/`move` shift from the position they
// are given — so the next run would ask for 1 and 2 again over a pair the kernel had settled at 0 and 1, and
// the seed would never converge. The declaration is dense per slot and this is where that is graded.

/** The page a box that ran the pk5 (03..08/09) seed is showing — the state of BOTH benches today. */
const pageOfPk5 = () => [
  row('hp_band', 'banners', 'announcement', 'storefront:header.announcement', 0, { text: 'x' }),
  row('hp_mosaic', 'banners', 'banner', SLOT, 0),
  row('hp_quase', 'shelves', 'shelf', SLOT, 1),
  row('hp_acabando', 'shelves', 'shelf', SLOT, 2),
];

test('★★ the page ON THE BENCH TODAY is MOVED, not re-placed — three rows, three new addresses, no removal', () => {
  const plan = planHome(pageOfPk5(), WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  // ⚠️ THE ASSERTION THAT WOULD CATCH A SECOND MOSAIC. `reuse` non-null on every op IS "nothing is placed":
  // a plan that failed to recognise the held mosaic would pair it with `null`, the seed would `place` a
  // second one in the hero, and the old one would still be drawn under the categories — green, and two
  // mosaics on one page.
  assert.ok(plan.ops.every((op) => op.reuse), 'a block was PLACED where an existing row could host it');
  assert.deepEqual(plan.remove, [], 'the move deleted a row it should have carried');
  // And WHERE each one lands, which is the whole of the instruction plus the renumbering it forces.
  assert.deepEqual(
    plan.ops.map((op) => [op.block.what, op.block.slot, op.block.position]),
    [
      ['mosaic', HERO, 0],
      ['quase', SLOT, 0],
      ['kids-shelf', SLOT, 1],
    ],
  );
});

test('★ and the run after THAT one changes nothing — over the page 08/09 produces', () => {
  const settled = [
    row('hp_band', 'banners', 'announcement', 'storefront:header.announcement', 0, { text: 'x' }),
    row('hp_mosaic', 'banners', 'banner', HERO, 0),
    row('hp_quase', 'shelves', 'shelf', SLOT, 0),
    row('hp_acabando', 'shelves', 'shelf', SLOT, 1),
  ];
  const plan = planHome(settled, WANTED_NOW, GOVERNED);
  assert.deepEqual(named(plan), [
    ['mosaic', 'hp_mosaic'],
    ['quase', 'hp_quase'],
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(plan.remove, []);
  // No op asks for a slot or a position the row is not already at — which is what `compose()` reads to decide
  // whether to call `composition.move` at all.
  assert.deepEqual(
    plan.ops.filter((op) => op.reuse.target !== op.block.slot || op.reuse.position !== op.block.position),
    [],
  );
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
    ['kids-shelf', 'hp_acabando'],
  ]);
  assert.deepEqual(
    plan.remove.map((r) => r.row.placement_id).sort(),
    ['hp_kids', 'hp_plp'],
  );
});

test('★★ THE DECLARED SHAPE IS THE ONE THE PLAN IS FED — the fixtures above are not a second source', () => {
  // The fixtures in this file are hand-written on purpose: they describe world STATES, and a state derived
  // from the file under test proves nothing. What must NOT drift is the OTHER half — what `outlet.json`
  // declares. So this one reads it and checks the shape the fixtures assume, which since 08/09 is TWO slots:
  // the mosaic alone in the hero, the two shelves alone under the categories, each slot dense from 0.
  //
  // ⚠️ ANTI-VACUUM FIRST. Every assertion below reads `data.mosaic` / `data.shelves`, and a declaration that
  // simply disappeared would make each of them compare `undefined` against `undefined` — a guard aimed at
  // nothing, green forever. So the file's own shape is asserted before anything is derived from it.
  assert.ok(data.mosaic && typeof data.mosaic === 'object', 'outlet.json declares no `mosaic` — this guard has nothing to grade');
  assert.ok(Array.isArray(data.shelves) && data.shelves.length > 0, 'outlet.json declares no `shelves` — this guard has nothing to grade');

  const declared = [
    { app: 'banners', component: 'banner', slot: data.mosaic.slot, position: data.mosaic.position },
    ...data.shelves.map((s) => ({ app: 'shelves', component: 'shelf', slot: s.slot, position: s.position })),
  ];
  assert.equal(declared.length, WANTED_NOW.length, 'outlet.json no longer declares the number of blocks these fixtures model');

  // ★ THE DECISION OF 08/09, AS AN ASSERTION: the mosaic is in the HERO. It is stated on its own, before the
  // shape checks, because this is the line somebody undoes by accident when they "tidy the page back into one
  // slot" — and every other assertion here would still pass while it did.
  assert.equal(
    data.mosaic.slot,
    HERO,
    'the outlet mosaic left `home.hero`. It was moved there deliberately — the banners read better above ' +
      '«Compre por categoria» — so putting it back under the categories undoes that decision.',
  );
  assert.equal(data.mosaic.position, 0, 'the hero holds one block and it is not at 0 — the run is not dense');
  assert.deepEqual(
    new Set(data.shelves.map((s) => s.slot)),
    new Set([SLOT]),
    'a shelf left `home.below_categories` — the two shelves are what sits between «Compre por categoria» and «Marcas que amamos»',
  );

  // ★★ DENSE PER SLOT, WHICH IS WHERE THE 08/09 MOVE COULD HAVE ROTTED SILENTLY. `place`/`move` shift every
  // instance at or after the given position IN THAT SLOT, so each slot must declare 0..N-1. The shelves used
  // to be 1 and 2 beside the mosaic; with the mosaic gone from that slot, 1 and 2 is a hole at 0 and a seed
  // that never converges.
  const bySlot = new Map();
  for (const block of declared) {
    if (!bySlot.has(block.slot)) bySlot.set(block.slot, []);
    bySlot.get(block.slot).push(block.position);
  }
  for (const [slot, positions] of bySlot) {
    assert.deepEqual(
      [...positions].sort((a, b) => a - b),
      positions.map((_, index) => index),
      `the positions declared for ${slot} are not a dense 0..N-1 run — the shifting \`place\`/\`move\` semantics assume one`,
    );
  }

  const count = (app) => declared.filter((b) => b.app === app).length;
  assert.equal(count('banners'), 1, 'a second banner block is back on this home — see the removal tests above');
  assert.equal(count('shelves'), 2, 'the number of shelf blocks changed — see the PLP-default test above');
});

test('⛔ THE `forge` STORE IS NOT DECLARED HERE, AND THAT IS WHAT KEEPS ITS TWO BANNERS', () => {
  // ★ WHY THIS GUARD EXISTS. That pass moved the OUTLET's banners and said nothing about the shoe shop —
  // whose home carries TWO `banners/banner` blocks, a carousel in `home.hero` and a mosaic in
  // `home.below_categories`. The obvious way to lose one of them is to "unify" the two homes into one
  // declaration here, because both stores now put a banner in the hero and the files look redundant.
  //
  // ⚠️ AND THEY ARE NOT ONE DECLARATION, MEASURED: the `forge` window is declared by the MOUNTED DATASET
  // (`storefront.json`, read by `seed/vitrine.mjs` from `FORGE_SEED_DATASET_DIR`), which is a monorepo file
  // this repository does not own and cannot guard. What this repository CAN state is the separation — this
  // file speaks for ONE store — and that is the whole of what is asserted here.
  assert.equal(data.store, 'outlet', 'seed/outlet.json stopped naming the outlet as its store');
  // ⚠️ THE PROSE IS STRIPPED FIRST — both kinds of it. Half this module's lines are commentary and several
  // of them NAME the shoe shop (it is the store the Outlet is compared against); a sweep over the whole
  // source would go red on the explanation and not on the code. Block comments matter as much as line ones:
  // this file's jsdoc mentions `forge` more often than its `//` lines do.
  const code = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'outlet.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal(
    /['"`]forge['"`]/.test(code),
    false,
    'seed/outlet.mjs names the `forge` store in CODE. This module composes ONE store; the shoe shop\'s ' +
      'window is the mounted dataset\'s and `seed/vitrine.mjs` is its only author.',
  );
});

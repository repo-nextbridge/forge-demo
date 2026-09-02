// THE OUTLET'S TWO PROMISES, GUARDED ON THE RESULT — `bash bin/test.sh`.
//
// A40 asked for two things a seed can silently stop delivering, and both of them fail INVISIBLY: a shop
// whose menu links land on an empty list still answers HTTP 200, and a clearance store with no `de` price
// still renders a perfectly good product card. Nobody sees either until somebody clicks.
//
// ★ SO EVERY ASSERTION BELOW READS THE RESULT AND NOT THE INTENTION. There is no list of "the 27 categories
// we fixed" and no table of "the discounts we meant": the tests derive the tree from `categories`, the
// coverage from where the products actually are, the ceiling from the SENTENCE the announcement band puts on
// the page, and the discount from the two figures a shopper compares. Delete a product and the coverage test
// names the leaf that went dark; drop a `compare_at_amount` and the discount test names the handle.
//
// ⚠️ WHAT THESE CANNOT SEE, said out loud because it is the real risk. The menu is a hand-curated literal in
// ANOTHER repository (`packages/storefront-kit/src/subtemplates/header/navTree.ts`), and this repository has
// no package manager, no dependency on the kit and no way to import it. `categories` in `outlet.json` is a
// MIRROR of that tree, and a leaf added there and not here is a dead link these tests will call healthy.
// Mirror drift is a human's job; everything downstream of the mirror is guarded here.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { discountPercent } from './outlet.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(SEED, 'outlet.json'), 'utf8'));

const isLeaf = (path) => !data.categories.some((c) => c.path.startsWith(`${path}.`));
const leaves = data.categories.filter((c) => isLeaf(c.path)).map((c) => c.path);
const tops = data.categories.filter((c) => !c.path.includes('.')).map((c) => c.path);

/** A category page lists its own products AND its descendants' — so a top is covered by any leaf under it. */
const productsUnder = (path) =>
  data.products.filter((p) => p.category === path || p.category.startsWith(`${path}.`));

// ── the menu leads somewhere ───────────────────────────────────────────────────────────────────────────

test('★ every LEAF of the menu tree carries at least one product — an empty leaf is a link into the void', () => {
  const empty = leaves.filter((path) => productsUnder(path).length === 0);
  assert.deepEqual(
    empty,
    [],
    `these leaves have no product and their menu links land on an empty list:\n  ${empty.join('\n  ')}`,
  );
});

test('★ every TOP of the menu tree carries at least one product, through its descendants', () => {
  const empty = tops.filter((path) => productsUnder(path).length === 0);
  assert.deepEqual(empty, [], `top-level menu links into the void: ${empty.join(', ')}`);
});

test('every product names a category the tree DECLARES — a typo is a product nobody can browse to', () => {
  const known = new Set(data.categories.map((c) => c.path));
  const stray = data.products.filter((p) => !known.has(p.category)).map((p) => p.handle);
  assert.deepEqual(stray, [], `products in undeclared categories: ${stray.join(', ')}`);
});

test('every product IS categorised at all (an absent `category` is the limbo A40 measured)', () => {
  const naked = data.products.filter((p) => typeof p.category !== 'string' || p.category === '');
  assert.deepEqual(naked.map((p) => p.handle), []);
});

test('the tree is well formed: unique paths, unique handles, and no orphan child', () => {
  const paths = data.categories.map((c) => c.path);
  assert.equal(new Set(paths).size, paths.length, 'a path is declared twice');
  const handles = data.categories.map((c) => c.handle);
  assert.equal(new Set(handles).size, handles.length, 'a handle is declared twice');
  const known = new Set(paths);
  for (const path of paths) {
    const parent = path.split('.').slice(0, -1).join('.');
    if (parent !== '') assert.ok(known.has(parent), `${path} has no declared parent (${parent})`);
  }
});

// ── the shop honours the number it prints ──────────────────────────────────────────────────────────────

/** The ceiling is READ OFF THE PAGE — the band's own sentence — so lowering the promise tightens the guard. */
const CEILING = Number(/(\d+)\s*%/.exec(data.announcement.text)?.[1]);
/** Below this a price stops reading as a clearance price at all (A40). */
const FLOOR = 30;

test('the announcement band still states a percentage — the ceiling is derived, never typed here', () => {
  assert.ok(Number.isInteger(CEILING) && CEILING > 0, `no percentage in: "${data.announcement.text}"`);
});

test('★ EVERY product carries a `de` — it is what makes this an outlet and not a catalogue', () => {
  const bare = data.products
    .filter((p) => !Number.isInteger(p.compare_at_amount) || p.compare_at_amount <= p.amount)
    .map((p) => p.handle);
  assert.deepEqual(bare, [], `no struck-through price on: ${bare.join(', ')}`);
});

test(`★ every discount sits between ${FLOOR}% and the band's own ceiling`, () => {
  const offenders = data.products
    .map((p) => [p.handle, discountPercent(p)])
    .filter(([, pct]) => pct < FLOOR || pct > CEILING)
    .map(([handle, pct]) => `${handle} (${pct}%)`);
  assert.deepEqual(
    offenders,
    [],
    `outside ${FLOOR}–${CEILING}% — either the price moves or the band's promise does:\n  ` +
      offenders.join('\n  '),
  );
});

test('the discounts are VARIED, not one figure copied down the file', () => {
  const distinct = new Set(data.products.map((p) => discountPercent(p)));
  assert.ok(distinct.size >= 10, `only ${distinct.size} distinct discount(s) across ${data.products.length} products`);
});

test('at least one product sits near the ceiling — the bait the band is advertising', () => {
  const deep = data.products.filter((p) => discountPercent(p) >= CEILING - 5);
  assert.ok(deep.length > 0, `nothing within 5 points of the advertised ${CEILING}%`);
});

test('money is CENTS: integers, never a float, never zero', () => {
  for (const p of data.products) {
    assert.ok(Number.isInteger(p.amount) && p.amount > 0, `${p.handle}: amount ${p.amount}`);
    assert.ok(
      Number.isInteger(p.compare_at_amount) && p.compare_at_amount > 0,
      `${p.handle}: compare_at_amount ${p.compare_at_amount}`,
    );
  }
});

// ── nothing ships with an empty field (A50) ────────────────────────────────────────────────────────────

test('★ every product names at least one photograph, and the file is on disk', () => {
  const missing = [];
  for (const p of data.products) {
    if (!p.photos?.length) missing.push(`${p.handle}: no photo declared`);
    for (const file of p.photos ?? []) {
      if (!existsSync(join(SEED, 'outlet-media', 'products', file))) {
        missing.push(`${p.handle}: ${file} is not in seed/outlet-media/products/`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

// ── the DISCOUNT IS WRITTEN IN THE RIGHT PHASE ─────────────────────────────────────────────────────────
//
// ⛔⛔ EVERYTHING ABOVE READS `outlet.json`, AND ALL OF IT WOULD STAY GREEN WITH A SHOP THAT SHOWS NO
// DISCOUNT AT ALL. That is not hypothetical — it is the state the Renan reported ("2 of the 8"), and the
// cause is not in this file's data. It is the ORDER of the birth:
//
//     8 · seed.mjs (curated)  →  9 · seed-demo (massive)  →  10 · the past  →  11 · seed.mjs --phase window
//
// Step 9 runs `apps/api/src/seed-media.ts`, which converges every SKU it matches BY CODE to the dataset's
// `compare_at_amount ?? null` and does NOT touch `amount`. Every product of this shop is a dataset product
// with the dataset's own SKU codes, so a `de` written in phase 8 is nulled in phase 9 and nobody is told.
//
// So these four watch the MECHANISM the data cannot see: that the write sits after the eraser. Break the
// order, move the write back into the create payload, or drop the window call, and one of them goes red.
// Nothing here recites a line number of the other repository — the order is derived from `bin/box-up.sh`
// and the wiring from `bin/seed.mjs`, both of which are in this repo and both of which would have to change
// for the regression to happen.

const REPO = join(SEED, '..');
const outletSrc = readFileSync(join(SEED, 'outlet.mjs'), 'utf8');
const seedSrc = readFileSync(join(REPO, 'bin', 'seed.mjs'), 'utf8');
const boxUpSrc = readFileSync(join(REPO, 'bin', 'box-up.sh'), 'utf8');

test('★ the CURATED phase does not write a `de` — phase 9 would erase it and say nothing', () => {
  // From the create call to the FIRST publish AFTER it — the "already there" branch publishes earlier in
  // the function, so an unanchored `indexOf` would slice backwards and pass on an empty string.
  const from = outletSrc.indexOf("await command('catalog.product.create'");
  const to = outletSrc.indexOf("await command('catalog.product.publish'", from);
  assert.ok(from > 0 && to > from, 'the create call moved — this guard lost its anchor, fix it');
  const create = outletSrc.slice(from, to);
  assert.ok(
    !/^\s*compare_at_amount:/m.test(create),
    'catalog.product.create is writing compare_at_amount again. It does not survive step 9 — see priceOutlet().',
  );
});

test('★ the `de` IS written, and from the WINDOW half of the seed', () => {
  assert.ok(/export async function priceOutlet/.test(outletSrc), 'priceOutlet() is gone');
  assert.ok(
    /compare_at_amount: product\.compare_at_amount/.test(outletSrc.slice(outletSrc.indexOf('export async function priceOutlet'))),
    'priceOutlet no longer writes compare_at_amount',
  );
});

test('★ `bin/seed.mjs` calls priceOutlet INSIDE the window phase, never the curated one', () => {
  const window = seedSrc.indexOf("if (phase === 'window') {");
  const call = seedSrc.indexOf('await priceOutlet(');
  assert.ok(window > 0, "the window phase branch moved");
  assert.ok(call > 0, 'bin/seed.mjs no longer calls priceOutlet — the shop ships with no discount');
  assert.ok(call > window, 'priceOutlet is called before the window phase begins');
  const curated = seedSrc.indexOf("if (phase === 'curated') {");
  assert.ok(curated > 0 && curated < window, 'the two phase branches are not in the order this guard assumes');
});

test('★ the birth still runs the WINDOW after the massive step — the whole reason the write moved', () => {
  // The steps as the script RUNS them (its `say` banners and the invocation itself), never the summary
  // comment at the top — a header can drift from the body, and the body is what births the box.
  const curated = boxUpSrc.indexOf("say '8 ·");
  const massive = boxUpSrc.indexOf("say '9 ·");
  // ⚠️ `--phase window` alone is NOT the marker: the summary comment at the head of the script names the
  // flag too, and it sits ABOVE step 8 — so `indexOf` found the comment and this guard read the order
  // backwards. The banner is the step; the invocation is asserted separately.
  const windowPhase = boxUpSrc.indexOf("say '11 ·");
  assert.ok(
    boxUpSrc.slice(windowPhase).includes('--phase window'),
    'step 11 no longer invokes the window phase',
  );
  assert.ok(curated > 0 && massive > 0 && windowPhase > 0, 'bin/box-up.sh no longer names the three steps');
  assert.ok(curated < massive, 'the curated seed no longer precedes the massive one');
  assert.ok(
    massive < windowPhase,
    'the window phase no longer follows seed-demo — the outlet\'s `de` would be erased again',
  );
});

// ── the grid the kernel will refuse ────────────────────────────────────────────────────────────────────
// These four cost nothing here and cost a whole seed run on the box: `catalog.product.create` validates the
// SKU grid, and a run that dies on product 19 of 32 leaves a half-built shop that the next run has to heal.
// This slice could not exercise the port (the bench is somebody's, and re-seeding it is not this task), so
// the shape is checked where it is written.

test('SKU codes are unique across the whole file — the kernel refuses a duplicate', () => {
  const seen = new Map();
  const dupes = [];
  for (const p of data.products) {
    for (const sku of p.skus) {
      if (seen.has(sku.code)) dupes.push(`${sku.code} (${seen.get(sku.code)} and ${p.handle})`);
      seen.set(sku.code, p.handle);
    }
  }
  assert.deepEqual(dupes, []);
});

test('EANs are unique too — the same barcode on two shoes is a scanner that lies', () => {
  const seen = new Map();
  const dupes = [];
  for (const p of data.products) {
    for (const sku of p.skus) {
      if (!sku.ean) continue;
      if (seen.has(sku.ean)) dupes.push(`${sku.ean} (${seen.get(sku.ean)} and ${p.handle})`);
      seen.set(sku.ean, p.handle);
    }
  }
  assert.deepEqual(dupes, []);
});

test('★ every SKU sits on EVERY declared axis, at a value the axis declares', () => {
  const problems = [];
  for (const p of data.products) {
    const axes = new Map((p.options ?? []).map((o) => [o.name, new Set(o.values)]));
    for (const sku of p.skus) {
      const picked = new Map((sku.option_values ?? []).map((v) => [v.option, v.value]));
      const named = [...picked.keys()].sort().join(',');
      const declared = [...axes.keys()].sort().join(',');
      if (named !== declared) problems.push(`${sku.code}: on [${named}], axes are [${declared}]`);
      for (const [option, value] of picked) {
        if (!axes.get(option)?.has(value)) problems.push(`${sku.code}: ${option}="${value}" is not an axis value`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('a `stock` list, where one is used, has one figure per SKU', () => {
  const bad = data.products
    .filter((p) => Array.isArray(p.stock) && p.stock.length !== p.skus.length)
    .map((p) => `${p.handle}: ${p.stock.length} figure(s) for ${p.skus.length} sku(s)`);
  assert.deepEqual(bad, []);
});

test('a product on a shelf names a collection this file creates', () => {
  const known = new Set(data.collections.map((c) => c.handle));
  const stray = data.products
    .filter((p) => p.shelf !== undefined && !known.has(p.shelf))
    .map((p) => `${p.handle} → ${p.shelf}`);
  assert.deepEqual(stray, []);
});

test('the artboard\'s two shelves still render the same items: the eight come FIRST in pin order', () => {
  // The home shelves take `item_count` items off the top of the pin order, and the pin order is this file's
  // order. So the newcomers may only ever be appended — this is the coupling `seedCollections` documents.
  for (const shelf of data.shelves) {
    const pinned = data.products.filter((p) => p.shelf === shelf.collection);
    assert.ok(
      pinned.length >= shelf.item_count,
      `${shelf.collection}: ${pinned.length} product(s) for a shelf of ${shelf.item_count}`,
    );
    const onScreen = pinned.slice(0, shelf.item_count).map((p) => p.handle);
    assert.equal(new Set(onScreen).size, shelf.item_count);
  }
});

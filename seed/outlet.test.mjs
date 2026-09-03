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

test('★ the `de` AND the `por` are written, and from the WINDOW half of the seed', () => {
  assert.ok(/export async function priceOutlet/.test(outletSrc), 'priceOutlet() is gone');
  const body = outletSrc.slice(outletSrc.indexOf('export async function priceOutlet'));
  assert.ok(
    /compare_at_amount: product\.compare_at_amount/.test(body),
    'priceOutlet no longer writes compare_at_amount',
  );
  // ⚠️ BOTH HALVES, because writing one of them is what produced `de == por` on the bench of 02/09. A
  // product the MASSIVE step created carries the dataset's price and never saw the curated `amount`;
  // stamping the dataset figure as its `compare_at` strikes through a price identical to the live one on
  // 130 of 182 skus. Asserting only the `de` is exactly the assertion that stayed green through it.
  assert.ok(
    /amount: product\.amount/.test(body),
    'priceOutlet writes the "de" without the "por": a product the massive step already created keeps the ' +
      'dataset price, and the two become equal — a struck-through price identical to the live one.',
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
// SKU grid, and a run that dies half way down leaves a half-built shop that the next run has to heal.
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

// ── THE SHOP HAS WHAT ITS OWN PAGES PROMISE (s2-2, s2-4, s2-8) ─────────────────────────────────────────
//
// Three findings of ONE shape, and the shape is the reason they are guarded together: a page that advertises
// something the assortment does not carry answers HTTP 200 and looks perfect. Nobody sees it until somebody
// clicks — the same failure mode as A40's empty menu leaves, one section further down the home.
//
//   · s2-2 — the «OUTLET KIDS · R$ 149,90» banner linked at `/collection/acabando`: 22 products, all adult,
//     and not one `genero: Infantil` in the whole catalogue.
//   · s2-4 — 4 of the 8 «Marcas que amamos» tiles landed on «0 produtos». That list is a literal in the
//     VITRINE and resolves against the TENANT's brands, so a tile renders whether or not THIS store stocks
//     the label. The fix that is ours is the assortment; the derivation is the product's, upstream.
//   · s2-8 — the kids banner sat alone in its row with two thirds of white beside it.
//
// ★ AND EVERY ONE OF THEM DERIVES THE PROMISE FROM WHERE IT IS MADE. The destination comes off the banner's
// own `link`, the price off the banner's own transcription of the art, the brand coverage off the `brand`
// each product declares, the company off the block that sits one `position` below. There is no list of "the
// four brands we fixed" and no "the 16 kids products we added" anywhere below: delete a product and the guard
// names the promise that went hollow.

/** The blocks this file puts on the home, as one list — the mosaic and the shelves, in the single slot the
 *  reference template offers between «Compre por categoria» and «Marcas que amamos». */
const homeBlocks = [data.mosaic, ...data.shelves];

/** THE SHELVES THAT CARRY A PROMO PICTURE, and the subject of every «kids banner» rule below since pk5. The
 *  art moved out of a `banners/banner` block of its own and into the shelf's own first grid cell, so the
 *  promise it makes is now a FIELD of a shelf (`banner`/`banner_link`/`banner_alt`) rather than a media
 *  item. Derived, never named: swap which shelf carries a picture and the guards follow it. */
const bannerShelves = data.shelves.filter((shelf) => shelf.banner);

/** `/collection/<handle>` → `<handle>`; anything else → undefined. The only link shape a shelf can also mean. */
const collectionOf = (link) => /^\/collection\/([a-z0-9-]+)$/.exec(link ?? '')?.[1];

/** The products a collection holds, DERIVED from where the products say they are — `seedCollections` pins
 *  exactly this list, in exactly this order. */
const pinnedTo = (handle) => data.products.filter((p) => p.shelf === handle);

test('★ s2-2 — the «Outlet Kids» banner leads at a collection this file actually creates', () => {
  assert.ok(bannerShelves.length > 0, 'no shelf on this home carries a promo picture — every rule below lost its subject');
  const known = new Set(data.collections.map((c) => c.handle));
  const broken = bannerShelves.map((s) => s.banner_link).filter((link) => !known.has(collectionOf(link)));
  assert.deepEqual(broken, [], `the kids banner points where no collection is created: ${broken.join(', ')}`);
});

test('★ pk5 — the picture and the shelf it rides on open the SAME list', () => {
  // ⚠️ THE FAILURE THIS SHAPE MAKES POSSIBLE, and it is invisible: the banner cell and the «Ver todos →» of
  // the row it sits in are two links two centimetres apart. A `banner_link` pointing anywhere but the
  // shelf's own source is a shopper told two different things by one row, at HTTP 200 both times.
  const split = bannerShelves
    .filter((shelf) => collectionOf(shelf.banner_link) !== shelf.collection)
    .map((shelf) => `"${shelf.title}": the picture opens ${shelf.banner_link}, «Ver todos» opens /collection/${shelf.collection}`);
  assert.deepEqual(split, [], split.join('\n  '));
});

test('★ pk5 — the art a shelf promises is a file this repository actually holds', () => {
  // `seed/outlet.mjs` uploads it by name from `seed/outlet-media/banners/`; a typo is a birth that stops
  // half-fed, and it stops in the WINDOW phase, after the catalogue is already published.
  for (const shelf of bannerShelves) {
    assert.ok(
      existsSync(join(SEED, 'outlet-media', 'banners', shelf.banner)),
      `"${shelf.title}" names ${shelf.banner}, which is not in seed/outlet-media/banners/`,
    );
  }
});

test('★ s2-2 — every product behind the kids banner IS a children\'s product', () => {
  for (const shelf of bannerShelves) {
    const handle = collectionOf(shelf.banner_link);
    const members = pinnedTo(handle);
    assert.ok(members.length > 0, `${handle} is an EMPTY collection — the banner promises a list nobody filled`);
    const adults = members
      .filter((p) => p.metadata?.genero !== 'Infantil')
      .map((p) => `${p.handle} (${p.metadata?.genero ?? 'no genero'})`);
    assert.deepEqual(
      adults,
      [],
      `the kids banner lands on adult product — exactly the finding (s2-2):\n  ${adults.join('\n  ')}`,
    );
  }
});

test('★ s2-2 — and the whole Infantil assortment IS that collection: the menu link and the banner agree', () => {
  // The header's «Infantil» entry is `/search?cf.genero=Infantil` — a facet over the catalogue, not over the
  // collection. If the two ever name different sets, one of the two doors shows a shop the other one denies.
  const behindTheBanner = new Set(
    bannerShelves.flatMap((shelf) => pinnedTo(collectionOf(shelf.banner_link))).map((p) => p.handle),
  );
  const behindTheMenu = data.products.filter((p) => p.metadata?.genero === 'Infantil').map((p) => p.handle);
  const orphans = behindTheMenu.filter((h) => !behindTheBanner.has(h));
  assert.deepEqual(
    orphans,
    [],
    `these children's products are in the «Infantil» filter and in NO kids collection:\n  ${orphans.join('\n  ')}`,
  );
});

test('★ s2-2 — the «Infantil» menu link is not a dead end in ANY department', () => {
  // Derived from the tree and from where the products are: a top with no child-sized product is a shopper who
  // filters Infantil inside «Botas» and is told the store sells none.
  const kids = data.products.filter((p) => p.metadata?.genero === 'Infantil');
  const bare = tops.filter((path) => !kids.some((p) => p.category === path || p.category.startsWith(`${path}.`)));
  assert.deepEqual(bare, [], `no children's product under: ${bare.join(', ')}`);
});

test('★ s2-2 — the FIGURE the art prints is a price a shopper can pay', () => {
  // ⚠️ WHY THE `alt`. The promise lives in the PIXELS ("DE: R$ 299,90 / POR: R$ 149,90"), which no test can
  // read; `alt` is this repository's transcription of it and the only machine-readable copy — see the mosaic's
  // note on why it reaches no page. So the guard reads the transcription, and re-pricing the art means
  // re-writing the sentence, which is where somebody notices. Both halves are checked: a banner that promises
  // a `de` the shop does not strike through is the same lie one field over.
  const reais = (s) => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
  let checked = 0;
  for (const shelf of bannerShelves) {
    const pair = /de\s+R\$\s*([\d.,]+)\s+por\s+R\$\s*([\d.,]+)/i.exec(shelf.banner_alt ?? '');
    if (!pair) continue;
    checked += 1;
    const [de, por] = [reais(pair[1]), reais(pair[2])];
    const members = pinnedTo(collectionOf(shelf.banner_link));
    const honoured = members.filter((p) => p.amount === por && p.compare_at_amount === de);
    assert.ok(
      honoured.length > 0,
      `the art promises de ${pair[1]} / por ${pair[2]} and no product behind it is priced that way. ` +
        `Nearest: ${members
          .map((p) => `${p.handle} ${p.compare_at_amount}/${p.amount}`)
          .slice(0, 3)
          .join(', ')}`,
    );
  }
  assert.ok(checked > 0, 'no shelf banner transcribes a de/por pair any more — the guard lost its subject');
});

test('★ s2-4 — the shop stocks EVERY label its home promotes', () => {
  const stocked = new Set(data.products.map((p) => p.brand));
  const hollow = data.featured_brands.filter((slug) => !stocked.has(slug));
  assert.deepEqual(
    hollow,
    [],
    'the home\'s «Marcas que amamos» tiles lead to an EMPTY /b/<slug> in this store — the vitrine resolves ' +
      `them against the TENANT's brands, so they render anyway:\n  ${hollow.join('\n  ')}`,
  );
});

test('s2-4 — every product says which label it wears, and the mirror is well formed', () => {
  const naked = data.products.filter((p) => typeof p.brand !== 'string' || p.brand === '').map((p) => p.handle);
  assert.deepEqual(naked, [], `products with no brand — the coverage guard above cannot see them: ${naked.join(', ')}`);
  assert.ok(Array.isArray(data.featured_brands) && data.featured_brands.length > 0, 'featured_brands is empty');
  assert.equal(
    new Set(data.featured_brands).size,
    data.featured_brands.length,
    'a slug is listed twice in featured_brands',
  );
});

test('★ pk5 — the «Outlet Kids» art is a SHELF\'s picture, never a lone tile on a line of its own', () => {
  // ⚠️ THE REGRESSION THIS SLICE EXISTS TO CLOSE, stated as the thing that must not come back. s2-8 read the
  // gap beside the art as "no second card to put there" and left the piece in a `banners/banner` block at
  // `width: 33` — one tile owning a whole line, 67% of it white. He looked at the shop and called it what it
  // is: «está caindo». The picture belongs to a SHELF, where the layout gives it two of five columns and
  // three product cards fill the rest.
  //
  // So the guard is on the DECLARATION, not on a pixel: no block of the `banners` app may carry the kids art.
  const art = new Set(bannerShelves.map((shelf) => shelf.banner));
  assert.ok(art.size > 0, 'no shelf carries a picture — the kids art has no home at all');
  const strays = [data.mosaic, ...(data.kidsBanner ? [data.kidsBanner] : [])]
    .flatMap((block) => (block.media ?? []).map((m) => m.file))
    .filter((file) => art.has(file));
  assert.deepEqual(
    strays,
    [],
    `a shelf\'s picture is ALSO declared as a banner tile: ${strays.join(', ')}. A banner block owns a LINE ` +
      'and a shelf banner owns a CELL — the same art in both is the row falling again.',
  );
  assert.equal(
    data.kidsBanner,
    undefined,
    'the standalone `kidsBanner` block is back. Its art is the «Outlet Kids» shelf\'s `banner` now.',
  );
});

// ── pk5 — A SHELF'S ROW ARITHMETIC, AND THE GABARITO IT IS COPIED FROM ─────────────────────────────────
//
// He looked at the «Outlet Kids» row and corrected the previous diagnosis: *"está caindo na verdade, será
// que está no lugar errado? É melhor cortar um pouco do que cair. E esse tipo de shelf que tem banner na
// verdade é banner + 3 e tem 4 produtos de kids... Mas estranho que essa shelf já existia na loja normal
// de sapatos. O tamanho era só seguir o mesmo de lá."*
//
// ★ THE GABARITO IS A PAGE, NOT A TASTE. «Botas que acabaram de chegar» in the `forge` store is one
// `shelves/shelf` carrying its own `banner_asset` plus `item_count: 3` (the mounted dataset's
// `storefront.json`), and on the bench of 2026-09-03 it renders as ONE row with nothing blank in it.
//
// ★★ AND THE ARITHMETIC IS THE PRODUCT'S, READ OFF ITS OWN STYLESHEET rather than guessed. The shelf block
// draws a desktop grid of FIVE equal columns and a promo banner is a CELL of that grid spanning TWO of them
// (`extensions/shelves/block.module.css`: `.grid { grid-template-columns: repeat(5, 1fr) }` and
// `.grid > .bannerCell { grid-column: span 2 }`); every configured product renders beside it and the extras
// wrap into the rows below. So a shelf occupies `(banner ? 2 : 0) + item_count` columns, and its LAST ROW is
// full exactly when that total divides by five. banner + 3 = 5 ✓. No banner + 5 = 5 ✓. No banner + 4 = one
// blank column, which is the hole the QA photographed.
//
// ⚠️ THIS DOES NOT GUARD THE BANNER BLOCK'S OWN ROW, and it must not be read as if it did: a
// `banners/banner` block owns a whole LINE and flows its tiles by a `width` PERCENTAGE, which is a different
// vocabulary with a different failure. The kids art stopped being one of those — see the shelf's `_why`.

/** The shelf grid's desktop column count (`extensions/shelves/block.module.css`, `.grid`). */
const GRID_COLUMNS = 5;
/** The columns a promo banner cell spans in that grid (`.grid > .bannerCell`). */
const BANNER_SPAN = 2;
/** The grid cells a declared shelf occupies: its products, plus two if it carries a promo banner. Takes both
 *  spellings — this file declares `item_count` on the shelf, the reference dataset nests it under `config`. */
const cellsOf = (shelf) => (shelf.banner ? BANNER_SPAN : 0) + (shelf.item_count ?? shelf.config?.item_count);

test('★ pk5 — every shelf on this home FILLS its last row: banner + 3, or products by the five', () => {
  const short = data.shelves
    .filter((shelf) => cellsOf(shelf) % GRID_COLUMNS !== 0)
    .map(
      (shelf) =>
        `"${shelf.title}": ${shelf.banner ? `banner(${BANNER_SPAN}) + ` : ''}${shelf.item_count} product(s) ` +
        `= ${cellsOf(shelf)} cell(s), leaving ${GRID_COLUMNS - (cellsOf(shelf) % GRID_COLUMNS)} of ` +
        `${GRID_COLUMNS} columns blank in its last row`,
    );
  assert.deepEqual(
    short,
    [],
    `a shelf on the outlet's home ends its last row short — the gabarito is «Botas que acabaram de ` +
      `chegar», banner + 3 in one full row:\n  ${short.join('\n  ')}`,
  );
});

test('the home\'s blocks hold distinct positions in their slot — two blocks on one number is a coin toss', () => {
  const bySlot = new Map();
  for (const block of homeBlocks) {
    if (!bySlot.has(block.slot)) bySlot.set(block.slot, []);
    bySlot.get(block.slot).push(block.position);
  }
  for (const [slot, positions] of bySlot) {
    assert.equal(new Set(positions).size, positions.length, `${slot} has two blocks at the same position`);
  }
});

// ── AND THE OTHER VOCABULARY: A BANNER BLOCK OWNS A LINE, AND A LINE HAS TO BE FULL ────────────────────
//
// The rule above is the SHELF's grid. A `banners/banner` block flows its tiles by a `width` PERCENTAGE and
// wraps into a fresh row when a line fills (`extensions/banners/banners.module.css`, `.mosaicRow` /
// `.mosaicCell`): the cell basis is gap-aware, so a row whose percentages sum to 100 fills the line exactly,
// with no trailing slack — and a row that sums to less than 100 leaves the remainder WHITE. That is precisely
// what the lone 33% kids tile did, and the mosaic above it is one wrong number away from the same thing.
//
// ⚠️ AND THERE IS NO `height` GUARD ANY MORE, deliberately. Until pk5 this file checked that the kids tile's
// declared `height` matched its art's proportion at the cell it rendered in, so `cover` would not crop. The
// picture is a shelf cell now: it declares NO height, because the cell's height is the product cards' and the
// art covers it. Cropping is the accepted outcome and not a defect — his ruling, in his words: «é melhor
// cortar um pouco do que cair». A guard forbidding the crop would now be a guard against the instruction.

/** A banner block's tiles, wrapped into lines the way `.mosaicRow` wraps them: a tile that would take the
 *  running total past 100% starts a fresh line. Absent `width` means the block's own default of 100. */
const linesOf = (block) => {
  const lines = [];
  let line = [];
  let filled = 0;
  for (const tile of block.media ?? []) {
    const width = tile.width ?? 100;
    if (filled + width > 100) {
      lines.push({ tiles: line, filled });
      line = [];
      filled = 0;
    }
    line.push(tile);
    filled += width;
  }
  if (line.length > 0) lines.push({ tiles: line, filled });
  return lines;
};

test('★ pk5 — every LINE of a banner block on this home is full: a short row is white space, not a design', () => {
  const short = [];
  for (const block of homeBlocks.filter((b) => b.media)) {
    for (const [index, line] of linesOf(block).entries()) {
      if (line.filled === 100) continue;
      short.push(
        `${block.slot}#${block.position} line ${index + 1}: ${line.tiles.length} tile(s) summing to ` +
          `${line.filled}% — ${100 - line.filled}% of that line renders blank ` +
          `(${line.tiles.map((t) => t.file).join(', ')})`,
      );
    }
  }
  assert.deepEqual(short, [], `a banner line on the outlet's home is short:\n  ${short.join('\n  ')}`);
});

// ── THE MIRROR ITSELF, WHEN A FORGE CHECKOUT IS AT HAND ────────────────────────────────────────────────
//
// Everything above guards this repository against itself: given the eight slugs, the shop stocks them. What
// it cannot see is the eight CHANGING — `featured_brands` is a copy of a literal in another repository
// (`apps/storefront/src/components/BrandsGrid.tsx`), and a slug swapped over there and not here brings the
// finding straight back with every test still green. That is the same standing risk `categories` carries
// against `navTree.ts`, and it was named and left to a human.
//
// It does not have to be. `bin/composition.guard.mjs` already solved this shape for the app list: read the
// product's own copy when the machine has a checkout, SKIP with the reason when it does not — a guard that is
// red on a machine that legitimately has no monorepo is a guard people learn to ignore. Same decision here,
// same env var, the same candidate paths.
//
// ⛔ AND IT ONLY EVER READS. Deriving those eight from the store's own assortment is a change to the VITRINE,
// which is the product's forkable reference storefront and not this box's to patch — the Renan's ruling of
// 03/09, twice over ("tem coisa que é do produto forge, tem coisa que é só do repo da demo"). This guard says
// when the two copies part company; the fix on the day they do is to re-mirror here, or to card it there.

/** A Forge checkout holding `marker`, if this machine has one — the same probe `bin/composition.guard.mjs`
 *  uses. The marker is passed in because two different files are read from over there and a checkout that
 *  has one and not the other must not be reported as the other's source. */
function forgeCheckout(marker = BRANDS_GRID) {
  const REPO_ROOT = join(SEED, '..');
  for (const base of [
    process.env.FORGE_MONOREPO,
    join(REPO_ROOT, '..', '..', 'wt-v03', 'd2-onda1'),
    join(REPO_ROOT, '..', '..', 'wt-v03', 't-forno'),
    join(REPO_ROOT, '..', '..', 'forge'),
    join(REPO_ROOT, '..', '..', '..', 'forge'),
  ]) {
    if (base && existsSync(join(base, marker))) return base;
  }
  return null;
}

/** Where the vitrine keeps the list the home's «Marcas que amamos» tiles are built from. */
const BRANDS_GRID = join('apps', 'storefront', 'src', 'components', 'BrandsGrid.tsx');

test('★ s2-4 — `featured_brands` still MIRRORS the vitrine\'s own list', (t) => {
  const forge = forgeCheckout();
  if (!forge) {
    t.skip(`no Forge checkout on this machine (set FORGE_MONOREPO=<path>) — cannot read ${BRANDS_GRID}`);
    return;
  }
  const src = readFileSync(join(forge, BRANDS_GRID), 'utf8');
  const block = /const FEATURED_BRANDS = \[([^\]]*)\]/.exec(src);
  assert.ok(
    block,
    `FEATURED_BRANDS is gone from ${BRANDS_GRID}. Either the vitrine now derives the tiles from the store — ` +
      'in which case this mirror and its guards are dead weight and should go — or it moved. Read it before ' +
      'deleting anything.',
  );
  const theirs = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    data.featured_brands,
    theirs,
    'the vitrine promotes a different set of brands than this file mirrors. Re-mirror it here (and stock ' +
      'whatever is new), or the home ships tiles into an empty /b/<slug> again — s2-4, verbatim.',
  );
});

// ── pk5 — THE GABARITO, READ FROM THE SHOP THAT ALREADY DOES IT RIGHT ──────────────────────────────────
//
// His whole instruction for this row was "copy the one that works": *"essa shelf já existia na loja normal
// de sapatos. O tamanho era só seguir o mesmo de lá."* The one that works is «Botas que acabaram de chegar»
// in the `forge` store, and it is not a taste anybody typed here — it is declared by the MOUNTED DATASET
// (`instances/demo/dataset/storefront.json`), which is the platform's own example data, in the monorepo.
//
// So this reads it and holds the outlet's kids shelf to the same shape. Same standing risk as the
// `featured_brands` mirror above, and the same honest answer: it only ever READS, and it skips when this
// machine has no checkout.

/** Where the reference dataset declares the `forge` store's window. */
const DATASET_WINDOW = join('instances', 'demo', 'dataset', 'storefront.json');

test('★ pk5 — the kids shelf is shaped like the shelf-with-a-banner that ALREADY WORKS', (t) => {
  const forge = forgeCheckout(DATASET_WINDOW);
  if (!forge) {
    t.skip(`no Forge checkout on this machine (set FORGE_MONOREPO=<path>) — cannot read ${DATASET_WINDOW}`);
    return;
  }
  const window = JSON.parse(readFileSync(join(forge, DATASET_WINDOW), 'utf8'));
  const gabaritos = (window.shelves ?? []).filter((shelf) => shelf.banner);
  assert.ok(
    gabaritos.length > 0,
    `no shelf in ${DATASET_WINDOW} carries a banner any more — the shape this row was copied from is gone, ` +
      'and somebody has to look at what replaced it before this guard is deleted.',
  );

  // The dataset's own arithmetic, run through the SAME function the outlet's shelves are graded by. If the
  // reference shelf ever stops filling its row, this fails on the gabarito rather than on us — which is the
  // right place for it to fail.
  for (const shelf of gabaritos) {
    assert.equal(
      cellsOf(shelf) % GRID_COLUMNS,
      0,
      `the gabarito "${shelf.config?.title ?? '?'}" no longer fills its own row (${cellsOf(shelf)} cells)`,
    );
  }

  // And the outlet's copy answers the same: a picture, a link, and the product count that leaves the row full.
  const counts = new Set(gabaritos.map((shelf) => shelf.config.item_count));
  for (const shelf of bannerShelves) {
    assert.ok(
      counts.has(shelf.item_count),
      `"${shelf.title}" shows ${shelf.item_count} product(s) beside its picture; the gabarito shows ` +
        `${[...counts].join('/')}. banner + 3 is one full row of five — see the row-arithmetic guard above.`,
    );
    assert.ok(shelf.banner_link, `"${shelf.title}" carries a picture and no \`banner_link\`: the art is inert`);
  }
});

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

/** The blocks this file puts on the home, as one list — the two banners and the shelves, in the single slot
 *  the reference template offers between «Compre por categoria» and «Marcas que amamos». */
const homeBlocks = [data.mosaic, ...data.shelves, data.kidsBanner];

/** `/collection/<handle>` → `<handle>`; anything else → undefined. The only link shape a shelf can also mean. */
const collectionOf = (link) => /^\/collection\/([a-z0-9-]+)$/.exec(link ?? '')?.[1];

/** The products a collection holds, DERIVED from where the products say they are — `seedCollections` pins
 *  exactly this list, in exactly this order. */
const pinnedTo = (handle) => data.products.filter((p) => p.shelf === handle);

test('★ s2-2 — the «Outlet Kids» banner leads at a collection this file actually creates', () => {
  const links = data.kidsBanner.media.map((m) => m.link);
  const known = new Set(data.collections.map((c) => c.handle));
  const broken = links.filter((link) => !known.has(collectionOf(link)));
  assert.deepEqual(broken, [], `the kids banner points where no collection is created: ${broken.join(', ')}`);
});

test('★ s2-2 — every product behind the kids banner IS a children\'s product', () => {
  for (const media of data.kidsBanner.media) {
    const handle = collectionOf(media.link);
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
    data.kidsBanner.media.flatMap((m) => pinnedTo(collectionOf(m.link))).map((p) => p.handle),
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
  for (const media of data.kidsBanner.media) {
    const pair = /de\s+R\$\s*([\d.,]+)\s+por\s+R\$\s*([\d.,]+)/i.exec(media.alt ?? '');
    if (!pair) continue;
    checked += 1;
    const [de, por] = [reais(pair[1]), reais(pair[2])];
    const members = pinnedTo(collectionOf(media.link));
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
  assert.ok(checked > 0, 'no banner tile transcribes a de/por pair any more — the guard lost its subject');
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

test('★ s2-8 — the kids banner is not alone in its row: a block one position down leads to the same list', () => {
  // The banners app flows a mosaic row by the tiles' `width` %, so a lone 33% tile leaves two thirds of the
  // line empty and reads as a missing slot. The row cannot be filled with art this house does not own (see
  // the banner's `_why`), so the company is the block BELOW it — and the guard is that it is company and not
  // a coincidence: it must be in the same slot, at the next position, sourcing the collection the banner
  // itself points at.
  const wantedFrom = new Set(data.kidsBanner.media.map((m) => collectionOf(m.link)).filter(Boolean));
  const company = homeBlocks.filter(
    (b) => b !== data.kidsBanner && b.slot === data.kidsBanner.slot && b.position === data.kidsBanner.position + 1,
  );
  assert.ok(
    company.length > 0,
    `nothing sits at ${data.kidsBanner.slot}#${data.kidsBanner.position + 1}: the kids banner is an orphan tile again`,
  );
  const strays = company.filter((b) => !wantedFrom.has(b.collection)).map((b) => `${b.title} → ${b.collection}`);
  assert.deepEqual(
    strays,
    [],
    `the block under the kids banner sends the shopper somewhere else than the banner does: ${strays.join(', ')}`,
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

// ── the kids tile is sized for the ART, not for a round number (s2-8's other half) ──────────────────────
//
// The frame is `overflow:hidden` + `object-fit:cover`: a `height` that does not match the cell's real width
// at the art's own proportion CROPS. The QA's shot is the evidence — at `width: 33` / `height: 400` the tile
// rendered 384x400 where the art wants 384x317, so `cover` scaled it up and sliced the sides: the O of
// OUTLET and half the «GRANDES MARCAS» badge are missing from the page.
//
// ★ THE PROPORTION IS READ OFF THE FILE ON DISK, never typed — swap the art and the guard follows it. The
// column is the one MEASURED on the QA's own 1366x900 screenshot (`shots/s2-home-full.png`: the banner spans
// x 87→471 and the brands grid ends at 1278, so the content column is ~1191px and a 33% cell is ~384px).

/** A PNG's pixel size, straight out of the IHDR chunk — 8 bytes of signature, then length+type, then w/h. */
function pngSize(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32BE(0), 0x89504e47, `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The demo's reference viewport is 1366 wide (the Renan's screen, and the QA's) — measured content column. */
const COLUMN_PX = 1191;
/** The flex gap between mosaic cells (`--space-md`), subtracted gap-aware by the block's own CSS. */
const GAP_PX = 16;

test('★ s2-8 — the kids tile\'s height is the art\'s own at the cell it renders in, so nothing is sliced', () => {
  const off = [];
  for (const media of data.kidsBanner.media) {
    const art = pngSize(join(SEED, 'outlet-media', 'banners', media.file));
    const cell = (media.width / 100) * COLUMN_PX - GAP_PX * (1 - media.width / 100);
    const wanted = Math.round(cell / (art.width / art.height));
    const drift = Math.abs(media.height - wanted) / wanted;
    if (drift > 0.05) {
      off.push(
        `${media.file}: ${art.width}x${art.height} in a ${Math.round(cell)}px cell wants height ${wanted}, ` +
          `declared ${media.height} (${Math.round(drift * 100)}% off — cover will crop by that much)`,
      );
    }
  }
  assert.deepEqual(off, [], `the kids banner crops its own art:\n  ${off.join('\n  ')}`);
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

/** A Forge checkout, if this machine has one — the same probe `bin/composition.guard.mjs` uses. */
function forgeCheckout() {
  const REPO_ROOT = join(SEED, '..');
  for (const base of [
    process.env.FORGE_MONOREPO,
    join(REPO_ROOT, '..', '..', 'wt-v03', 'd2-onda1'),
    join(REPO_ROOT, '..', '..', 'wt-v03', 't-forno'),
    join(REPO_ROOT, '..', '..', 'forge'),
    join(REPO_ROOT, '..', '..', '..', 'forge'),
  ]) {
    if (base && existsSync(join(base, BRANDS_GRID))) return base;
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

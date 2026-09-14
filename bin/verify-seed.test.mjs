// ★★ THE VERIFIER'S OWN QUESTIONS, GRADED — because on 03/09 the verifier was the thing that was wrong.
//
// The birth verification accused CORRECT data ("status is undefined — a draft perk charges what the page
// says it will not · scoped to the whole tenant, not to the coffee shop") and dropped `box-up` to 1, while
// the database held both perks `active` and confined to the coffee shop. Nothing was wrong with the box: the
// frozen list publishes `state`, not `status`, and it does not publish `store_id` at all. Both names read
// back `undefined`, and `undefined !== 'active'` is TRUE — so a question that HAD NO ANSWER came out as the
// loudest possible accusation.
//
// ⇒ WHAT THIS FILE PROVES, and it is a property and not an example: a name that did not come back can never
//   become a verdict about the data. It runs the real `bin/verify-seed.mjs` against a FAKE READ FACE that
//   serves exactly what the frozen reads publish, and then SABOTAGES the verifier — one comparison is
//   rewritten to ask for a name no read has — and requires it to accuse ITSELF.
//
// ⚠️ THE FAKE FACE IS NOT A MIRROR OF THE KERNEL'S TYPES, and must never become one. It answers with the key
// sets the reads of `pk6/integra` actually publish, derived from the same seed declarations the verifier
// derives its expectations from. A hand-copied echo of `/contracts` here would agree with a stale contract
// exactly the way a typed-in expectation agrees with a stale catalogue.

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

import { ADMIN_SLOT, ADMIN_WIDGETS, APP_BLOCKS } from './app-blocks.mjs';
import { COFFEE_PROMOTIONS, coffeePages, expectedCoffees } from '../seed/coffee.mjs';
import { poolProducts } from '../seed/pool.mjs';
import { outletPages } from '../seed/outlet.mjs';
import { SUBSCRIBERS } from '../seed/subscriptions.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const VERIFIER = join(HERE, 'verify-seed.mjs');
const readSeed = (name) => JSON.parse(readFileSync(join(REPO, 'seed', name), 'utf8'));

const catalog = readSeed('catalog.json');
const totem = readSeed('totem.json');
const outlet = readSeed('outlet.json');
const logistics = readSeed('logistics.json');

/** One pickup point row, with the key set `read.pickup_locations` publishes — `hours` included, because it
 *  does (packages/core/src/read/pickup-admin-capabilities.ts lists it in `COLUMNS`). Derived from the seed
 *  declaration and never typed: a fake face that invented a week would grade the verifier against a fiction,
 *  which is exactly the defect the counter's missing week was. */
const pickupRow = (id, point) => ({
  id,
  name: point.name,
  active: true,
  lat: null,
  lng: null,
  hours: point.hours,
});

const CAFE = 'sto_cafe';
const BALCAO = 'sto_balcao';
const FORGE = 'sto_forge';
const OUTLET = 'sto_outlet';

// ── the box the seed declares, as the frozen reads would answer it ───────────────────────────────────────

/** One store row, with the key set `read.stores` publishes. */
const storeRow = (id, handle, name, themeKey) => ({
  id,
  name,
  handle,
  host: null,
  theme_key: themeKey,
  masked_checkout_enabled: handle === 'cafe',
  guest_checkout_enabled: true,
  reservation_minutes: null,
  notification_sender_name: null,
  notification_reply_to: null,
  custom_fields: {},
});

/** One promotion row, with the key set `PromotionListItem` publishes — `state` and NO `store_id`. */
const promotionRow = (id, spec, state) => ({
  id,
  name: spec.name,
  label: spec.label,
  state,
  class: spec.benefit.kind === 'free_shipping' ? 'shipping' : 'item',
  benefit: spec.benefit,
  target: { kind: 'custom_field', field: 'sub_plan', value: 'monthly' },
  sku_labels: [],
  trigger: 'automatic',
  codes: [],
  starts_at: null,
  ends_at: null,
  stackable: false,
  used_count: 0,
  usage_limit: null,
});

const AUTHORS = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo'];
const STATUSES = ['approved', 'approved', 'approved', 'approved', 'pending', 'rejected'];

/**
 * The whole fake box for `forgecafe`: two shops, the six coffees exactly as `seed/coffee.mjs` declares them,
 * the counter's fifteen, the two pool products on sale nowhere, the vocabulary of both shops, six reviews
 * per coffee across the three moderation states, and the two subscriber perks — active, and confined to the
 * coffee shop. Everything the verifier grades is DERIVED here, never typed.
 */
function declaredBox() {
  const coffees = expectedCoffees().map((c, i) => ({
    product_id: `prod_cafe_${i}`,
    handle: c.handle,
    title: c.handle,
    description: null,
    status: 'active',
    metadata: c.metadata,
    content_sections: c.sections,
    meta_title: null,
    meta_description: null,
    options: [],
    media: c.photos.map((p) => ({ kind: 'image', url: `https://x/${p}`, provider_key: p })),
    skus: [
      {
        id: `sku_${i}`,
        code: `C${i}`,
        amount: 3900,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: null,
        is_default: true,
        metadata: c.subscribable ? { sub_enabled: true } : {},
        option_values: [],
        media: [],
      },
    ],
    categories: [],
  }));

  const pool = poolProducts().map((p, i) => ({
    product_id: `prod_pool_${i}`,
    handle: p.handle,
    title: p.title,
    status: 'active',
    metadata: {},
    content_sections: [],
    media: [],
    skus: [],
  }));

  const counter = totem.products.map((p, i) => ({
    product_id: `prod_balcao_${i}`,
    handle: p.handle,
    title: p.title,
    status: 'active',
    metadata: {},
    content_sections: [],
    media: [],
    skus: [],
  }));

  const reviews = [];
  coffees.forEach((c, ci) => {
    for (let i = 0; i < 6; i++) {
      reviews.push({
        id: `rev_${ci}_${i}`,
        product_id: c.product_id,
        rating: 5,
        body: `${c.handle} · nota ${i}`,
        author: AUTHORS[i],
        verified: true,
        status: STATUSES[i],
        order_id: null,
        moderated_at: null,
      });
    }
  });

  const promotions = COFFEE_PROMOTIONS.map((spec, i) => promotionRow(`promo_${i}`, spec, 'active'));

  return {
    stores: [
      storeRow(CAFE, 'cafe', 'Forge Café', 'coffee-store'),
      storeRow(BALCAO, 'balcao', 'Forge Café · Balcão', null),
    ],
    published: {
      [CAFE]: coffees,
      // The counter publishes its own fifteen plus the six it re-sells; only the TOTAL is ever read for it.
      [BALCAO]: [...counter, ...coffees],
    },
    catalogue: [...coffees, ...pool, ...counter],
    promotions,
    // ★ THE SCOPE LIVES HERE, in the read that answers it — `promotions_admin` has no `store_id` to carry.
    promotionStores: promotions.map((p) => ({ promotion_id: p.id, store_id: CAFE })),
    shippingMethods: [
      { id: 'shm_1', name: 'Retirada no balcão', active: true, carrier_id: null, carrier_name: null, kind: 'pickup', dimensional_divisor: null, max_weight_grams: null, tariffed_zone_count: 0 },
      { id: 'shm_2', name: 'Entrega Padrão', active: true, carrier_id: null, carrier_name: null, kind: 'standard', dimensional_divisor: 6000, max_weight_grams: 30000, tariffed_zone_count: 1 },
    ],
    pickupLocations: [pickupRow('pck_1', totem.pickup.location)],
    customFields: [
      ...(catalog.custom_fields ?? []).map((f) => f.key),
      ...(totem.custom_fields ?? []).map((f) => f.key),
    ].map((key, i) => ({
      id: `cfd_${i}`,
      owner_entity: 'product',
      key,
      type: 'text',
      required: false,
      options: [],
      facetable: false,
      source: 'merchant',
      status: 'active',
      label: key,
      pii: null,
    })),
    productStores: {},
    // ★ pk31/§6 — THE APPS' BLOCKS, on both shops. Until 3e nothing here answered this read for the coffee
    // tenant at all, which is how "is `confirmation_note` placed?" became a question nobody could ask.
    composition: { [CAFE]: appBlockRows(), [BALCAO]: appBlockRows() },
    // ★ THE CAFÉ'S SEVEN, derived from the function the seed writes them with — never a second list of the
    // same slugs. It published ZERO until pk15/d1, which the section reported as a line and did not judge;
    // now it is declared, so the same line is a verdict. The COUNTER still declares none, and that store is
    // why the "report, do not judge" branch is still exercised by this very box.
    pages: coffeePages().map((spec) => pageRow(CAFE, spec)),
    assets: [
      { id: 'ast_1', kind: 'image', provider_key: 'placeholder-cafe.png', filename: 'placeholder-cafe.png', mime: 'image/png', size: 10, created_by: null, created_at: '2026-09-03T00:00:00Z' },
    ],
    reviews,
    // ★ THE SUBSCRIPTION CONTRACTS, one per declared subscriber, in the state that subscriber's row asks
    // for — derived from `seed/subscriptions.mjs` and never a second list of states.
    contracts: SUBSCRIBERS.map((s, i) => ({
      id: `sub_${i}`,
      customer_ref: `cus_${i}`,
      store_id: CAFE,
      frequency: s.plan,
      status: s.state,
      cycles_completed: 1,
      origin_order_id: `ord_${i}`,
    })),
  };
}

/** One page row, with the key set `read.internal.pages` publishes (id, store_id, slug, title, template_key,
 *  published, archived_at — `internal-capabilities.ts`'s select list). */
const pageRow = (storeId, spec, published = true) => ({
  id: `page_${storeId}_${spec.slug}`,
  store_id: storeId,
  slug: spec.slug,
  title: spec.title,
  template_key: spec.template_key,
  published,
  archived_at: null,
});

/**
 * One row of `read.extension_composition` — the ADMIN EDITOR's model, which is why `placement_id` and
 * `enabled` are here: that read also answers the manifest's own default hooks nobody ever placed
 * (`placement_id: null`) and the ones an operator switched off, and a verifier that counted those would
 * report a page no shopper can see.
 */
const compositionRow = (extension_id, component, target, position, extra = {}) => ({
  extension_id,
  component,
  declared_target: target,
  target,
  position,
  enabled: true,
  has_placement: true,
  placement_id: `hp_${extension_id}_${component}_${target.replace(/[^a-z]+/gi, '')}_${position}`,
  config: {},
  active: true,
  ...extra,
});

/** The Outlet's home, as the box would answer it when the seed has just run — DERIVED from the same
 *  declaration `seed/outlet.mjs` composes from, so the two cannot drift apart in agreement. */
const outletHomeRows = () => [
  compositionRow('banners', 'banner', outlet.mosaic.slot, outlet.mosaic.position),
  ...outlet.shelves.map((shelf) => compositionRow('shelves', 'shelf', shelf.slot, shelf.position)),
];

/**
 * ★★ THE MOUNTED DATASET, STAGED — a directory holding one `storefront.json`, which is what the verifier
 * reads to learn the shoe shop's window.
 *
 * ⚠️ IT IS HAND-WRITTEN AND MUST STAY THAT WAY. The real file is `instances/demo/dataset/storefront.json`,
 * a MONOREPO file this repository does not own and a machine running this suite may not have. What is
 * modelled here is its SHAPE and the one fact of it this slice is about: the `forge` store carries TWO
 * `banners/banner` blocks, the hero carousel and the mosaic under the categories. Deriving it from the real
 * file would make the suite pass on one developer's disk and skip on another's.
 */
const DATASET_HOME = {
  store: 'forge',
  banners: [
    { slot: 'storefront:home.hero', style: 'carousel', media: [] },
    { slot: 'storefront:home.below_categories', style: 'mosaic', media: [] },
  ],
  shelves: [{ slot: 'storefront:home.below_shelf', config: { title: 'Corra para não perder' } }],
};

/** Write `DATASET_HOME` to a throwaway directory and hand back what `FORGE_SEED_DATASET_DIR` would point at. */
function mountedDataset(declared = DATASET_HOME) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-demo-dataset-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'storefront.json'), JSON.stringify(declared));
  return { dir, close: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The `forge` store's home as a box that ran that dataset would answer it. */
const datasetHomeRows = (declared = DATASET_HOME) => [
  ...declared.banners
    .filter((b) => b.slot.startsWith('storefront:home.'))
    .map((b, i) => compositionRow('banners', 'banner', b.slot, i)),
  ...declared.shelves
    .filter((b) => b.slot.startsWith('storefront:home.'))
    .map((b, i) => compositionRow('shelves', 'shelf', b.slot, i)),
];

/** The apps' own storefront blocks — `APP_BLOCKS`, imported at the top of this file. It left this suite on
 *  2026-09-12 (pk34/D3) so that `bin/app-blocks.guard.mjs` could grade it against the manifests of the pinned
 *  release without importing a test file: it had spent a day green while asserting a slot the owner had moved.
 *  Its reasons — why it is hand-written, and why the `admin:` hooks are deliberately absent — live with it.
 *
 *  Those blocks as one store's rows. `extra` stages a block the box does NOT really show (`placement_id: null`
 *  for a hook nobody placed, `enabled: false` for one an operator switched off). */
const appBlockRows = (extra = () => ({})) =>
  APP_BLOCKS.map(([app, component, target], i) =>
    compositionRow(app, component, target, i, extra(`${app}/${component}`)),
  );

/**
 * THE FOOTWEAR TENANT, as the frozen reads would answer it — the box the institutional-page section is about.
 *
 * ★ IT IS THE MINIMUM THAT MAKES THAT TENANT SETTLE, and every number in it is derived: the Outlet's fifty-five
 * from `seed/outlet.json`, its seven pages from the very function `seed/outlet.mjs` creates them with. The
 * Forge store carries seven pages too — the mounted dataset's — and the point of the section is that those are
 * REPORTED and never graded, so they are here with slugs this repository does not declare anywhere.
 */
function footwearBox() {
  const outletProducts = outlet.products.map((p, i) => ({
    product_id: `prod_outlet_${i}`,
    handle: p.handle,
    title: p.handle,
    status: 'active',
    metadata: {},
    content_sections: [],
    media: [],
    skus: [],
  }));
  // The dataset's catalogue is not knowable from this repository; the section only asserts it is not empty.
  const datasetProducts = Array.from({ length: 2790 }, (_, i) => ({
    product_id: `prod_ds_${i}`,
    handle: `ds-${i}`,
    title: `ds-${i}`,
    status: 'active',
    metadata: {},
    content_sections: [],
    media: [],
    skus: [],
  }));
  return {
    stores: [
      storeRow(FORGE, 'forge', 'Forge', null),
      storeRow(OUTLET, 'outlet', 'Forge Outlet', 'outlet'),
    ],
    published: { [FORGE]: datasetProducts, [OUTLET]: outletProducts },
    catalogue: [...datasetProducts, ...outletProducts],
    promotions: [],
    promotionStores: [],
    shippingMethods: [],
    // ★ THE SHOE BRAND HAS FOUR, and they were absent from this fake box until 05/09 — so the footwear run
    // graded no pickup point at all. `seed/logistics.json` declares them; this derives them from it.
    pickupLocations: logistics.pickup_points.map((point, i) => pickupRow(`pck_shoe_${i}`, point)),
    // ★ `app:demo-data` is the SOURCE the verifier identifies the dataset's vocabulary by, never a list of
    // names — so the fake face carries the source and not nine typed keys.
    customFields: ['genero', 'material', 'uso'].map((key, i) => ({
      id: `cfd_ds_${i}`,
      owner_entity: 'product',
      key,
      type: 'text',
      required: false,
      options: [],
      facetable: false,
      source: 'app:demo-data',
      status: 'active',
      label: key,
      pii: null,
    })),
    productStores: {},
    // ★ 08/09 — THE SHOP WINDOWS, per store id, as `read.extension_composition` answers them.
    // ★ pk31/§6 — the apps' own blocks ride ALONGSIDE the window: 3c filters on `storefront:home.`
    // and 3e on every `storefront:` target, so one answer feeds two different questions.
    composition: {
      [OUTLET]: [...outletHomeRows(), ...appBlockRows()],
      [FORGE]: [...datasetHomeRows(), ...appBlockRows()],
    },
    pages: [
      ...outletPages().map((spec) => pageRow(OUTLET, spec)),
      // The Forge store's own seven, with the dataset's titles. Nothing here grades them.
      ...outletPages().map((spec) => pageRow(FORGE, { ...spec, title: `${spec.title} (dataset)` })),
    ],
    stock: { in_stock: 40, low: 6, partial: 5, out: 4 },
    assets: [
      { id: 'ast_1', kind: 'image', provider_key: 'placeholder-outlet.png', filename: 'placeholder-outlet.png', mime: 'image/png', size: 10, created_by: null, created_at: '2026-09-05T00:00:00Z' },
    ],
    reviews: [],
  };
}

/** Page an array the way the frozen reads do — `{items, page, limit, total}`. */
const pageOf = (all, url) => {
  const limit = Number(url.searchParams.get('limit') ?? 25);
  const page = Number(url.searchParams.get('page') ?? 1);
  return { items: all.slice((page - 1) * limit, page * limit), page, limit, total: all.length };
};

/** `read.promotions_admin` pages by `offset`, so `page` is a param it never declared and Zod strips it: the
 *  answer is always the first page, and it carries no `page` key to say so. */
const offsetOnly = (all, url) => {
  const limit = Number(url.searchParams.get('limit') ?? 25);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  return { items: all.slice(offset, offset + limit), total: all.length };
};

/**
 * A read face that answers with the DECLARED box. `drop` removes a key from every row of a named read, which
 * is how "the read stopped publishing this" is staged without touching the kernel.
 */
async function serve(box, { drop } = {}) {
  const without = (read, rows) => {
    if (!drop || drop.read !== read) return rows;
    return rows.map((row) => {
      const copy = { ...row };
      delete copy[drop.key];
      return copy;
    });
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const send = (body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (p === '/v1/read/internal/stores') return send(without('stores', box.stores));
    if (p === '/v1/read/internal/promotions_admin')
      return send(
        (box.promotionsPageByOffset ? offsetOnly : pageOf)(
          without('promotions_admin', box.promotions),
          url,
        ),
      );
    if (p === '/v1/read/internal/promotion_stores')
      return send(without('promotion_stores', box.promotionStores));
    if (p === '/v1/read/internal/shipping_methods_admin')
      return send(without('shipping_methods_admin', box.shippingMethods));
    if (p === '/v1/read/internal/pickup_locations')
      return send(without('pickup_locations', box.pickupLocations));
    if (p === '/v1/read/internal/custom_field_definitions')
      return send(without('custom_field_definitions', box.customFields));
    if (p === '/v1/read/internal/products_admin')
      return send(pageOf(without('products_admin', box.catalogue), url));
    if (p === '/v1/read/internal/extension_composition')
      return send(
        without('extension_composition', (box.composition ?? {})[url.searchParams.get('store')] ?? []),
      );
    if (p === '/v1/read/internal/extension_records') {
      // ⚠️ ONE READ NAME, N APPS × N MODELS — so the fake face has to route on the pair, exactly as the real
      // one does. Answering `box.reviews` to every caller was fine while reviews were the only reader; the
      // moment the subscriptions check landed it would have graded the contracts against the review rows.
      const model = `${url.searchParams.get('extension')}/${url.searchParams.get('model')}`;
      const table = { 'reviews/review': box.reviews, 'subscriptions/contract': box.contracts ?? [] }[model] ?? [];
      return send(pageOf(without('extension_records', table), url));
    }
    if (p === '/v1/read/internal/product_stores')
      return send(box.productStores[url.searchParams.get('product_id')] ?? []);
    if (p === '/v1/read/internal/assets') return send(without('assets', box.assets));
    // ⚠️ DELIBERATELY BLIND TO `store_id`. The real read declares that parameter and would honour it, but a
    // fake face that filters for the verifier hides the thing worth proving: the verifier narrows the answer
    // AGAIN on the `store_id` each row carries. Answering the whole tenant here is the hostile version, and
    // it is the shape that produced the defect — a shop's seven slugs read as "already there" because
    // ANOTHER shop had them.
    if (p === '/v1/read/internal/pages') return send(pageOf(without('pages', box.pages ?? []), url));
    if (p === '/v1/read/internal/stock_levels') {
      const cut = url.searchParams.get('availability');
      return send({ items: [], page: 1, limit: 1, total: box.stock?.[cut] ?? 0 });
    }
    if (p === '/v1/read/products') {
      const store = url.searchParams.get('store');
      const rows = box.published[store];
      if (!rows) {
        res.writeHead(404, { 'content-type': 'application/json' });
        return res.end('{"error":"not_found"}');
      }
      return send(pageOf(without('products', rows), url));
    }
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(`{"error":"the verifier asked for a read this fake face does not serve: ${p}"}`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { api: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** Run a verifier (the real one, or a sabotaged copy) against a fake face. Never throws on a red exit. */
async function verify(script, api, tenant = 'forgecafe', env = {}) {
  try {
    const { stdout } = await run(process.execPath, [script, '--api', api, '--tenant', tenant], {
      // ⚠️ `FORGE_SEED_DATASET_DIR` IS CLEARED UNLESS A TEST SETS IT. The verifier reads the mounted
      // dataset's own `storefront.json` to grade the shoe shop's window; a developer who happens to export
      // that variable would otherwise have every run of this suite graded against the dataset on THEIR disk.
      env: { ...process.env, FORGE_SEED_DATASET_DIR: '', FORGE_SEED_TOKEN: 'tok_fake', ...env },
      maxBuffer: 8 * 1024 * 1024,
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

/**
 * A copy of the verifier with one substring rewritten — the sabotage, run as a REAL PROGRAM.
 *
 * ⚠️ IT LIVES BESIDE THE ORIGINAL, not in a temp directory, and that is not a detail: the verifier resolves
 * `seed/` from its OWN path, so a copy anywhere else fails at import and prints NOTHING — which reads
 * exactly like a passing sabotage while proving nothing at all. Measured while writing this file.
 */
function sabotaged(from, to) {
  const source = readFileSync(VERIFIER, 'utf8');
  assert.ok(source.includes(from), `the sabotage target \`${from}\` is not in bin/verify-seed.mjs any more`);
  const path = join(HERE, `.verify-seed.sabotage.${process.pid}.${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(path, source.replaceAll(from, to));
  return path;
}

// ── the tests ────────────────────────────────────────────────────────────────────────────────────────────

test('the box exactly as the seed declares it — the verifier settles, and asks nothing it cannot ask', async () => {
  const face = await serve(declaredBox());
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.equal(code, 0, `expected a settled run, got:\n${stdout}`);
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.ok(stdout.includes('VERDICT: settled'), stdout);
  } finally {
    face.close();
  }
});

test('★★ SABOTAGE — a comparison asks for a name no read publishes, and the verifier accuses ITSELF', async () => {
  // `state` is the name the frozen list really publishes; `status` is the name that produced the false
  // accusation of 03/09. The DATA below is correct in every respect — only the QUESTION is wrong.
  const script = sabotaged("'state'", "'status'");
  const face = await serve(declaredBox());
  try {
    const { code, stdout } = await verify(script, face.api);
    assert.ok(
      stdout.includes('does not publish `status`'),
      `the verifier had to name its own wrong question:\n${stdout}`,
    );
    assert.ok(stdout.includes('The question is wrong, not the data'), stdout);
    // ⛔ THE HALF THAT MATTERS. Not one ✗ about a perk: a name that did not come back may not become a
    // verdict about the box. This is the exact line the birth log printed on 03/09.
    assert.ok(
      !/✗ the perk/.test(stdout),
      `a missing key became an accusation against correct data:\n${stdout}`,
    );
    assert.ok(!stdout.includes('is undefined'), stdout);
    assert.equal(code, 2, `a wrong question is not a measurement, so the exit is its own:\n${stdout}`);
  } finally {
    face.close();
    rmSync(script, { force: true });
  }
});

test('★ a read that stops publishing a key is the same defect, found from the other side', async () => {
  // Nothing is rewritten here: the FACE drops `state`, exactly as a contract change would. The question the
  // verifier asks is right today and wrong tomorrow, and it has to say which.
  const face = await serve(declaredBox(), { drop: { read: 'promotions_admin', key: 'state' } });
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.ok(stdout.includes('does not publish `state`'), stdout);
    assert.ok(!/✗ the perk/.test(stdout), stdout);
    assert.equal(code, 2, stdout);
  } finally {
    face.close();
  }
});

test('★ CONTROL POSITIVE — a perk that really IS a draft is still the DATA failing, not the question', async () => {
  const box = declaredBox();
  box.promotions[0].state = 'draft';
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.ok(/✗ the perk "Assinante 10% OFF"/.test(stdout), stdout);
    assert.ok(stdout.includes('state is draft'), stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test("★★ the counter's free-shipping negative is answered by read.promotion_stores — `store_id` is not on the list", async () => {
  // ⛔ THE FALSE GREEN THIS SLICE FOUND. Section 2 filtered `p.store_id === store.id` over `promotions_admin`
  // rows, and that read does not publish `store_id` — so the filter matched NOTHING, always, and the counter
  // was declared free of free-shipping promotions without a single row ever being looked at. The mirror of
  // the false red: the same wrong question, silent instead of loud.
  const box = declaredBox();
  const offender = promotionRow('promo_bad', COFFEE_PROMOTIONS[1], 'active');
  box.promotions.push(offender);
  box.promotionStores.push({ promotion_id: offender.id, store_id: BALCAO });
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.ok(
      /✗ balcao — 1 free-shipping promotion/.test(stdout),
      `the counter carries a free-shipping promotion and the verifier had to see it:\n${stdout}`,
    );
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ a TENANT-WIDE free-shipping promotion reaches the counter too, and is refused there', async () => {
  // `store_id: null` is not "no scope", it is EVERY store — the counter included. A check that only looked
  // for promotions confined to the counter would call this box clean.
  const box = declaredBox();
  const offender = promotionRow('promo_wide', COFFEE_PROMOTIONS[1], 'active');
  box.promotions.push(offender);
  box.promotionStores.push({ promotion_id: offender.id, store_id: null });
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.ok(/✗ balcao — 1 free-shipping promotion/.test(stdout), stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ a read that pages by another word is refused, not walked in circles', async () => {
  // ⚠️ THE SAME WRONG QUESTION, IN THE PARAMS. `promotions_admin` declares `offset`, never `page`, and an
  // undeclared param is dropped in silence — so a walk asking for page 2 is handed page 1 again. Below a
  // hundred promotions nothing shows; above it, the enumeration would append the same rows over and over and
  // call the pile the whole set, which is precisely the "assertion about the first N rows, dressed as an
  // assertion about the shop" this walk exists to prevent.
  const box = declaredBox();
  box.promotionsPageByOffset = true;
  const filler = COFFEE_PROMOTIONS[0];
  for (let i = 0; i < 120; i++) box.promotions.push(promotionRow(`promo_fill_${i}`, filler, 'active'));
  const face = await serve(box);
  try {
    const { code, stdout, stderr } = await verify(VERIFIER, face.api);
    assert.ok(
      /does not page by `page`/.test(stderr),
      `the walk had to refuse instead of believing page 1 twice:\n${stderr}\n${stdout}`,
    );
    assert.equal(code, 2, stderr);
  } finally {
    face.close();
  }
});

// ── ★★ THE INSTITUTIONAL PAGES (pk12/d1) ─────────────────────────────────────────────────────────────────
//
// The defect these grade is the one that had NO CHECK AT ALL: the Outlet published zero institutional pages
// while the Forge store beside it published seven, in the same tenant, for as long as the bench existed.
// Nothing was wrong with the kernel and nothing was red — the count was simply never taken, and the bench
// inventory printed a "Páginas institucionais" heading under one shop and no heading under the other, which
// reads as "this shop has none" and not as "nobody looked".

test('★★ the footwear tenant with all seven Outlet pages published — the verifier settles', async () => {
  const face = await serve(footwearBox());
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.match(stdout, /✓ outlet — all 7 institutional page\(s\) published/, stdout);
    assert.equal(code, 0, `expected a settled run, got:\n${stdout}`);
  } finally {
    face.close();
  }
});

test('★★ SABOTAGE — one page deleted from the dataset never reaches the box, and the verifier names the SLUG', async () => {
  // The sabotage the brief asks for, staged where it really happens: `seed/outlet.json` loses an entry, so
  // `seed/outlet.mjs` never creates it and the box comes out with six. What must NOT happen is the verifier
  // shrinking its expectation along with the dataset and going green over a shop with a dead link in its
  // sidebar — so the BOX here is built from the shortened list while the SLUG is asserted by name.
  const box = footwearBox();
  const gone = 'trocas-e-devolucoes';
  box.pages = box.pages.filter((p) => !(p.store_id === OUTLET && p.slug === gone));
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.match(stdout, /✗ outlet — MISSING, by name: trocas-e-devolucoes \(1 of 7\)/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★★ a page card that exists as a DRAFT is a 404 to every shopper, and counting rows would miss it', async () => {
  const box = footwearBox();
  for (const row of box.pages) if (row.store_id === OUTLET && row.slug === 'faq') row.published = false;
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.match(stdout, /✗ outlet — MISSING, by name: faq \(1 of 7\)/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test("★★ ANOTHER store's seven do not answer for this one — the row's `store_id` is the filter", async () => {
  // ⛔ THE DANGEROUS DIRECTION, and it is silent. `read.internal.pages` answers the whole tenant unless it is
  // asked with `store_id`, and the Forge store already holds these exact seven slugs. A count taken over the
  // unfiltered answer says seven for a shop that has none.
  const box = footwearBox();
  box.pages = box.pages.filter((p) => p.store_id !== OUTLET);
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.match(stdout, /✗ outlet — MISSING, by name: .*\(7 of 7\)/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ a shop this repository declares no page for gets a LINE, not silence and not an accusation', async () => {
  // `forge`'s seven are the mounted dataset's, which this repository cannot read — so its number is printed
  // and never graded. The COUNTER is the other one: it is the totem's store, no browser reaches it, and it
  // publishes nothing. Both must produce a LINE.
  //
  // ⚠️ THE CAFÉ USED TO BE THE SECOND EXAMPLE HERE AND IS NOW A GRADED SHOP (pk15/d1 declared its seven), so
  // the branch is exercised by `balcao` instead. That substitution is the point of keeping this test: a
  // repository that declares a page set for every shop would leave the "report, do not judge" path dead, and
  // the next shop born without one would meet an untested branch.
  const footwear = await serve(footwearBox());
  try {
    const { stdout } = await verify(VERIFIER, footwear.api, 'forgeco');
    assert.match(stdout, /· forge — 7 page\(s\), 7 published\. This repository declares none/, stdout);
  } finally {
    footwear.close();
  }
  const coffee = await serve(declaredBox());
  try {
    const { code, stdout } = await verify(VERIFIER, coffee.api);
    assert.match(stdout, /· balcao — 0 page\(s\), 0 published\. This repository declares none/, stdout);
    assert.equal(code, 0, `a shop with no declared page is not a failure:\n${stdout}`);
  } finally {
    coffee.close();
  }
});

test('★★ the café is now GRADED, and a missing card of its own is named', async () => {
  // The other half of the substitution above: `cafe` moved from "reported" to "judged", and a section that
  // judges has to be able to fail. Without this, declaring the seven would be a claim nothing tests.
  const box = declaredBox();
  const gone = 'sobre';
  box.pages = box.pages.filter((p) => p.slug !== gone);
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✗ cafe — MISSING, by name: sobre/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ a read that stops publishing `published` is the verifier\'s wrong question, never the box\'s defect', async () => {
  const face = await serve(footwearBox(), { drop: { read: 'pages', key: 'published' } });
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.ok(stdout.includes('does not publish `published`'), stdout);
    assert.ok(!/✗ outlet — MISSING/.test(stdout), `a missing key became an accusation about the data:\n${stdout}`);
    assert.equal(code, 2, stdout);
  } finally {
    face.close();
  }
});


// ── ★★ THE PICKUP WEEK (pk14/d1) ─────────────────────────────────────────────────────────────────────────
//
// The defect these grade is the one section 2 was GREEN about: it asserted the counter's pickup point exists,
// and `points.length >= 1` is true of a point whose week nobody wrote. The owner photographed the result —
// seven «Fechado» on the pickup card — and the box was correct in every respect: `pickup_location.create`
// accepts a point with no `hours`, and an omitted day is closed exactly like a `null` one.
//
// ⚠️ AND THE SEED CANNOT REPAIR AN EXISTING BOX. Both pickup steps are idempotent BY NAME, so a bench born
// before 05/09 keeps its weekless point through every re-run. That is precisely why the check has to be able
// to go red against a LIVE box, and why these tests stage the box and not the JSON.

test('★★ both tenants, with the week the seed declares — the verifier settles and PRINTS the count', async () => {
  const coffee = await serve(declaredBox());
  try {
    const { code, stdout } = await verify(VERIFIER, coffee.api);
    assert.match(stdout, /✓ pickup point "Balcão · Forge Café" — open 7 of 7 days/, stdout);
    assert.match(stdout, /✓ the week — 1 of 1 declared point\(s\) publish a week/, stdout);
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.equal(code, 0, stdout);
  } finally {
    coffee.close();
  }
  // ⇒ AND THE SHOE BRAND'S FOUR ARE GRADED TOO, which is the reach half of this slice: the rule existed for
  // them in a test over the JSON and had never once been asked of a box.
  const footwear = await serve(footwearBox());
  try {
    const { code, stdout } = await verify(VERIFIER, footwear.api, 'forgeco');
    assert.match(stdout, /✓ the week — 4 of 4 declared point\(s\) publish a week/, stdout);
    assert.match(stdout, /✓ pickup point "Forge Loja Oscar Freire" — open 6 of 7 days/, stdout);
    assert.ok(!stdout.includes('⚑'), stdout);
    assert.equal(code, 0, stdout);
  } finally {
    footwear.close();
  }
});

test('★★ SABOTAGE — the point the owner found: it exists, and its week is EMPTY. Accused, by name', async () => {
  // ★ THE REPORTED BOX, STAGED FROM A MEASUREMENT AND NOT FROM AN IDEA OF ONE. On the bench of 05/09,
  //     select name, hours from <coffee schema>.pickup_location
  //   answered `Balcão · Forge Café | {}` while the shoe brand's four each answered a full week — the create
  //   handler stores `input.hours ?? {}`, so a file with no key becomes an EMPTY week and not a null one, and
  //   the two are the same shop. The point is there, section 2's `points.length >= 1` is still true, and the
  //   only thing wrong is a week nobody wrote.
  const box = declaredBox();
  for (const row of box.pickupLocations) row.hours = {};
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✗ pickup point "Balcão · Forge Café"/, stdout);
    assert.match(stdout, /does not write mon, tue, wed, thu, fri, sat, sun/, stdout);
    // ⛔ THE HALF THAT WOULD HAVE HIDDEN IT: section 2 stays green about the same point, because "it exists"
    // and "somebody can collect from it" are different questions and only one of them was ever asked.
    assert.match(stdout, /✓ pickup point — Balcão · Forge Café/, stdout);
    assert.match(stdout, /· 0 of 1 declared point\(s\) publish a week/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★★ SABOTAGE — ONE day dropped from one shoe-brand point, and the verdict names the point and the day', async () => {
  // The dangerous shape: six days written reads as a week somebody maintained, and the seventh silently
  // means closed. And it is one point of four, so the count has to move from 4 to 3.
  const box = footwearBox();
  const victim = box.pickupLocations[1];
  const hours = { ...victim.hours };
  delete hours.thu;
  victim.hours = hours;
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.match(stdout, new RegExp(`✗ pickup point "${victim.name}"`), stdout);
    assert.match(stdout, /does not write thu/, stdout);
    assert.match(stdout, /· 3 of 4 declared point\(s\) publish a week/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ SABOTAGE — a point shut all seven days is a valid week and still a door nobody opens', async () => {
  // `null` on all seven is accepted by the kernel and is the exact screen the owner photographed. A rule that
  // only compared day names would have called this box clean.
  const box = declaredBox();
  for (const row of box.pickupLocations) {
    row.hours = Object.fromEntries(Object.keys(row.hours).map((day) => [day, null]));
  }
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✗ pickup point "Balcão · Forge Café"/, stdout);
    assert.match(stdout, /all seven days are `null`/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ SABOTAGE — a point the dataset declares and the box does not have is MISSING, not silent', async () => {
  const box = declaredBox();
  box.pickupLocations = [];
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✗ pickup point "Balcão · Forge Café" — seed\/totem\.json declares it/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test("★ a read that stops publishing `hours` is the verifier's wrong question, never the box's defect", async () => {
  const face = await serve(declaredBox(), { drop: { read: 'pickup_locations', key: 'hours' } });
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.ok(stdout.includes('does not publish `hours`'), stdout);
    assert.ok(
      !/✗ pickup point/.test(stdout),
      `a missing key became an accusation about correct data:\n${stdout}`,
    );
    assert.equal(code, 2, stdout);
  } finally {
    face.close();
  }
});

// ── ★★ THE SHOP WINDOW (pk25/d3) ─────────────────────────────────────────────────────────────────────────
//
// On 08/09 he dragged the Outlet's banner mosaic from `home.below_categories` into `home.hero` and asked for
// it in the dataset — «arrastei os banners para o slot hero e ficou melhor. Então deixa assim no dataset».
// The seed is RESET + SEED by definition, so a dataset that did not learn it puts the page back the next
// time anybody re-seeds, and until this section nothing in this repository read `hook_placement` at all: the
// one thing a person looks at first was measured by nobody.

test('★★ the two windows, each graded against the file that DECLARES it — the verifier settles', async () => {
  const mount = mountedDataset();
  const face = await serve(footwearBox());
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✓ outlet's home — banners\/banner@home\.hero#0/, stdout);
    assert.match(stdout, /✓ forge's home — .*\(from the mounted dataset\)/, stdout);
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.equal(code, 0, `expected a settled run, got:\n${stdout}`);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★ SABOTAGE — the Outlet mosaic goes back under the categories, and the verifier names the slot', async () => {
  // The re-seed that undoes his call: the box comes back up with the mosaic where it used to be. Every other
  // check in this file is green about that box — the catalogue, the pages, the promotions are all untouched —
  // which is exactly why the window needed a check of its own.
  const box = footwearBox();
  box.composition[OUTLET] = [
    compositionRow('banners', 'banner', 'storefront:home.below_categories', 0),
    ...outlet.shelves.map((shelf, i) => compositionRow('shelves', 'shelf', shelf.slot, i + 1)),
  ];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ outlet's home/, stdout);
    assert.match(stdout, /banners\/banner@home\.below_categories#0/, stdout);
    assert.match(stdout, /belongs in `home\.hero` since 08\/09/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★ SABOTAGE — the `forge` store loses ONE of its two banner blocks, and it is the DATASET that accuses', async () => {
  // ⛔ THE NEIGHBOURING DAMAGE. The shoe shop carries two `banners/banner` blocks and he asked for nothing to
  // change there; the way to lose one is to "unify" two homes that now both put a banner in the hero. No file
  // of THIS repository declares that shop's window, so the expectation is read off the MOUNTED dataset — the
  // same file `seed/vitrine.mjs` composes from — and the accusation is therefore not an invention.
  const box = footwearBox();
  box.composition[FORGE] = datasetHomeRows().filter(
    (r) => r.target !== 'storefront:home.below_categories',
  );
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forge's home/, stdout);
    assert.match(stdout, /the mounted dataset declares .*banners\/banner@home\.below_categories/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★ with NO dataset mounted the shoe shop is REPORTED, never invented — and the Outlet is still graded', async () => {
  // ⚠️ THE HALF THAT KEEPS THIS HONEST. A verifier that typed the dataset's slots in would disagree with a
  // file it cannot see the day that file changes — the failure section 1 and section 3b already refuse by
  // name. Absent mount ⇒ a line that says so and names the variable, and no verdict either way.
  const face = await serve(footwearBox());
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco');
    assert.match(stdout, /· forge — 3 block\(s\) on the home/, stdout);
    assert.match(stdout, /no FORGE_SEED_DATASET_DIR is set, so the dataset/, stdout);
    assert.match(stdout, /✓ outlet's home — banners\/banner@home\.hero#0/, stdout);
    assert.equal(code, 0, stdout);
  } finally {
    face.close();
  }
});

test('⛔ a manifest default nobody placed, and a block an operator SWITCHED OFF, are not the page', async () => {
  // `read.extension_composition` is the admin editor's model: it answers unplaced hooks (`placement_id:
  // null`) and disabled ones so the operator can manage them. Counting either would report a window no
  // shopper can see — and here they would make the Outlet's home look like FIVE blocks instead of three.
  const box = footwearBox();
  box.composition[OUTLET] = [
    ...outletHomeRows(),
    compositionRow('recommendations', 'related', 'storefront:home.hero', 9, {
      placement_id: null,
      has_placement: false,
      active: false,
    }),
    compositionRow('banners', 'banner', 'storefront:home.below_shelf', 9, { enabled: false, active: false }),
  ];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✓ outlet's home — banners\/banner@home\.hero#0/, stdout);
    assert.equal(code, 0, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

// ── ★★ THE SUBSCRIPTIONS (pk25/d3) ───────────────────────────────────────────────────────────────────────
//
// ⛔ MEASURED ON THE LIVE BENCH, 08/09: zero rows in the app's `contract` table, in both schemas, on a box
// that had been offering subscriptions for days. Every existing check was green about that shop, because
// every one of them grades the OFFER — the five marked coffees, the two perks, the plan picker. The
// operator's half was a blank card and nothing anywhere said so.

test('★★ the café with its three signed subscriptions — the verifier settles and prints the mix', async () => {
  const face = await serve(declaredBox());
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✓ the subscriptions — 3 contract\(s\): /, stdout);
    assert.match(stdout, /active=1/, stdout);
    assert.match(stdout, /paused=1/, stdout);
    assert.match(stdout, /canceled=1/, stdout);
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.equal(code, 0, `expected a settled run, got:\n${stdout}`);
  } finally {
    face.close();
  }
});

test('★★★ SABOTAGE — ZERO subscriptions, and the verifier names the widget that comes up empty', async () => {
  // The state the bench was really in. What must NOT happen is a green run: the coffee section stays ✓ on
  // every other line, so a verifier that did not ask this question reports a settled box with a blank card.
  const box = declaredBox();
  box.contracts = [];
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✗ the subscriptions — NO contract in this tenant/, stdout);
    assert.match(stdout, /latest_subscriptions/, stdout);
    // ⛔ AND THE HALF THAT PROVES IT WAS INVISIBLE: the offer is still perfect on the same box.
    assert.match(stdout, /sku\(s\) subscribable/, stdout);
    assert.match(stdout, /✓ the perk "Assinante 10% OFF"/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★★ SABOTAGE — three contracts, all ACTIVE: the card renders and the ficha has one word', async () => {
  // ⚠️ THE ONE THAT LOOKS FINE. A count check would go green here — there ARE subscriptions — and the demo
  // would show a status filter with one value in it, where «pausada» and «cancelada» are indistinguishable
  // from "not implemented".
  const box = declaredBox();
  for (const row of box.contracts) row.status = 'active';
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /✗ the subscriptions — active=3 — the seed declares /, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
  }
});

test('★ a read that stops publishing `status` is the verifier\'s wrong question, never the box\'s defect', async () => {
  // The species this whole file exists for: a name that did not come back must not become an accusation.
  const face = await serve(declaredBox(), { drop: { read: 'extension_records', key: 'status' } });
  try {
    const { code, stdout } = await verify(VERIFIER, face.api);
    assert.match(stdout, /⚑ WRONG QUESTION — read\.extension_records does not publish `status`/, stdout);
    assert.equal(code, 2, stdout);
  } finally {
    face.close();
  }
});

test('★ a dataset dir that holds no storefront.json says "I could not look", not "nothing is declared"', async () => {
  // ⚠️ `bin/box-up.sh` remaps this variable for host processes (`host_node` / CONTAINER_PATH_VARS) because
  // `FORGE_SEED_DATASET_DIR` is the CONTAINER's path. A hand-run that exports the container path gets a
  // directory with nothing in it, and the two states — unset, and set-but-unreadable — are different facts.
  const mount = mkdtempSync(join(tmpdir(), 'forge-demo-empty-'));
  const face = await serve(footwearBox());
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', { FORGE_SEED_DATASET_DIR: mount });
    assert.match(stdout, /holds no readable storefront\.json/, stdout);
    assert.match(stdout, /✓ outlet's home — banners\/banner@home\.hero#0/, stdout);
    assert.equal(code, 0, stdout);
  } finally {
    face.close();
    rmSync(mount, { recursive: true, force: true });
  }
});

// ── ★★★ THE ADMIN HOME'S WIDGET ORDER (pk30/§11) ─────────────────────────────────────────────────────────
//
// ⛔ THE DEFECT, from his screen on 10/09: *"o bloco de últimas assinaturas na demo ainda está vindo no topo, o
// admin de café está certo mas o de sapato está errado."* Measured on the live box, the two boards came back in
// DIFFERENT orders because installing an app auto-places its widgets at the END of the slot — so a widget's
// position IS the order its app was installed in, and `forgeco` happened to install `subscriptions` first.
//
// ★★ SO EVERY TEST HERE IS ABOUT ONE TENANT AT A TIME, and the red has to NAME it. "Does some tenant look
// right?" is green on the box of 10/09 and proves nothing — which is the whole reason the check lives in this
// per-tenant verifier and not in the one-shot that only ever visits the dataset's own tenant.

/** The seven the board opens on and the slot it fills are `ADMIN_WIDGETS` / `ADMIN_SLOT`, imported at the top
 *  of this file. ★ pk35/D6: they left this suite the way `APP_BLOCKS` did on 2026-09-12, so that
 *  `bin/app-blocks.guard.mjs` can grade them against the PINNED release without importing a test file —
 *  ★ pk36/D2: against the release's own instance dataset when it declares `admin_widgets` (which is what THIS
 *  suite stages as the mounted dataset), and against the manifests when it does not. They used to be typed here under a sentence — "the seven the dataset declares, in the order he
 *  left them" — that nothing could check: seven names about a screen declared in another repository, in a
 *  file that never opens it. Their reasons live with them now.
 *
 *  A board, spelled as `<app>/<component>` names in the order it is placed in. */
const boardRows = (names) =>
  names.map((name, i) => compositionRow(name.split('/')[0], name.split('/')[1], ADMIN_SLOT, i));
/** A dataset that declares the seven AND the shop window the other section grades. */
const datasetWithWidgets = () => ({ ...DATASET_HOME, admin_widgets: ADMIN_WIDGETS });

test('★★ the widget order the dataset declares, found on the board — the verifier settles and NAMES the tenant', async () => {
  const box = footwearBox();
  box.composition[FORGE] = [
    ...datasetHomeRows(),
    ...boardRows([...ADMIN_WIDGETS, 'subscriptions/latest_subscriptions']),
  ];
  const mount = mountedDataset(datasetWithWidgets());
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✓ forgeco's admin home opens with — admin-dashboard\/revenue/, stdout);
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.equal(code, 0, `expected a settled run, got:\n${stdout}`);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★★ SABOTAGE — ONE tenant\'s board is broken and the red NAMES that tenant and the widget on top', async () => {
  // THE BOX OF 10/09, exactly: `subscriptions` first because its app was installed first. Every other check in
  // this file is green about that box, which is why this needed a check of its own.
  const box = footwearBox();
  box.composition[FORGE] = [
    ...datasetHomeRows(),
    ...boardRows(['subscriptions/latest_subscriptions', ...ADMIN_WIDGETS]),
  ];
  const mount = mountedDataset(datasetWithWidgets());
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forgeco's admin home/, stdout);
    assert.match(stdout, /subscriptions\/latest_subscriptions/, stdout);
    assert.match(stdout, /never applied to this tenant/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★★ ANTI-VACUUM — a board with NO widget is a RED that names the tenant, never "nothing to compare"', async () => {
  // ⛔ The failure this house keeps paying for: a check that passes because it found nothing. A declaration of
  // seven widgets over an empty slot has to accuse, and it has to say WHOSE cockpit is empty.
  const box = footwearBox();
  box.composition[FORGE] = datasetHomeRows();
  const mount = mountedDataset(datasetWithWidgets());
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forgeco's admin home — carries NO placed widget/, stdout);
    assert.match(stdout, /admin:admin\.home\.widgets/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('⛔ a widget hook nobody PLACED is not on the board — it cannot fill the declaration', async () => {
  // `read.extension_composition` answers a manifest's declared hooks with `placement_id: null`, and
  // `composition.reorder` writes positions BY PLACEMENT ID: one of those would update no row and report
  // success. A verifier that counted them would call a half-applied order settled.
  const box = footwearBox();
  box.composition[FORGE] = [
    ...datasetHomeRows(),
    ...boardRows(ADMIN_WIDGETS).map((row, i) =>
      i === 0 ? { ...row, placement_id: null, has_placement: false } : row,
    ),
  ];
  const mount = mountedDataset(datasetWithWidgets());
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forgeco's admin home/, stdout);
    assert.match(stdout, /admin-dashboard\/revenue/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★ a dataset that declares no admin_widgets is REPORTED, never judged', async () => {
  // The one case where silence is a decision: the board keeps whatever order the installs left it in, and
  // saying so is different from saying it is correct.
  const box = footwearBox();
  box.composition[FORGE] = [...datasetHomeRows(), ...boardRows(ADMIN_WIDGETS)];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /declares no admin_widgets/, stdout);
    assert.equal(code, 0, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

// ── ★★ THE APPS' OWN BLOCKS (pk31/§6) ────────────────────────────────────────────────────────────────────
//
// ⛔ THE DEFECT THESE EXIST FOR IS A WRONG ANSWER THIS HOUSE GAVE, not a wrong box. pk31/§6 reported that the
// `subscriptions` app's `confirmation_note` — the sentence a shopper who just signed a subscription reads on
// the receipt — *"está publicado e chega VAZIO na demo"*, derived by counting: five declared blocks, four
// rows, so the missing one is that one.
//
// ★ MEASURED ON THE LIVE BOX (2026-09-11, `hook_placement` in both tenant schemas): `confirmation_note` was
// placed and ENABLED on all four stores, and `read.extensions` publishes it at
// `storefront:checkout.confirmation` position 2 for the `forge` store. The fifth block is
// `latest_subscriptions`, an `admin:` hook seeded ONCE PER TENANT with a null store — so four plus one IS
// five. The count was right and the subtraction was wrong.
//
// ⇒ WHAT WAS ACTUALLY MISSING WAS THE QUESTION. Nothing in this verifier had ever read an app's declared
//   blocks, because they are the KERNEL's work (`extension.install` → `seedDefaultPlacements`) and every other
//   section grades what a seed of this repository writes. These four tests are that question, and the rule is
//   derived from the same read that declares it — never from a list of block names, which would go stale the
//   day an app ships a sixth.

test("★★ every block the tenant's apps declare is live in at least one store — the verifier settles", async () => {
  const box = footwearBox();
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✓ forgeco's apps — 10 declared block\(s\), each live in at least one store/, stdout);
    // ★ THE ONE THE SLICE WAS ABOUT, named in the settled line rather than merely counted.
    assert.match(stdout, /subscriptions\/confirmation_note\(2\)/, stdout);
    assert.ok(!stdout.includes('⚑'), `no question should have been wrong:\n${stdout}`);
    assert.equal(code, 0, `expected a settled run, got:\n${stdout}`);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★★ SABOTAGE — the block pk31/§6 thought was missing really IS placed nowhere, and the red NAMES it', async () => {
  // The box the brief described, staged for the first time: the hook is declared (the app is installed, so the
  // editor's model answers it) and no store has a placement for it. ⚠️ Counting rows per store cannot see this
  // — `read.extension_composition` answers the unplaced hook too, which is why the filter is on
  // `placement_id`, and why the old count of four-out-of-five could be arithmetically right and still wrong.
  const dark = (name) =>
    name === 'subscriptions/confirmation_note' ? { placement_id: null, has_placement: false, active: false } : {};
  const box = footwearBox();
  box.composition[FORGE] = [...datasetHomeRows(), ...appBlockRows(dark)];
  box.composition[OUTLET] = [...outletHomeRows(), ...appBlockRows(dark)];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forgeco's apps/, stdout);
    assert.match(stdout, /1 declared block\(s\) live in NO store/, stdout);
    assert.match(stdout, /subscriptions\/confirmation_note @ checkout\.confirmation/, stdout);
    assert.ok(!stdout.includes('⚑'), `nothing was wrong with the question:\n${stdout}`);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★ SABOTAGE — a block SWITCHED OFF in every store is the same silence as one never placed', async () => {
  // The other way a capability goes dark, and the reason the filter asks two things instead of one: an
  // operator who disabled the block left a placement id behind. On the page the two are indistinguishable.
  const off = (name) => (name === 'reviews/reviews' ? { enabled: false, active: false } : {});
  const box = footwearBox();
  box.composition[FORGE] = [...datasetHomeRows(), ...appBlockRows(off)];
  box.composition[OUTLET] = [...outletHomeRows(), ...appBlockRows(off)];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forgeco's apps/, stdout);
    assert.match(stdout, /reviews\/reviews @ pdp\.below_gallery/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test("⛔ a block live in ONE store and absent from the other SETTLES — that is the Outlet's own decision", async () => {
  // ★ WHY THE VERDICT IS PER TENANT AND NOT PER STORE, and it is not a softening. `seed/outlet.mjs` REMOVES
  // the `shelves/shelf` instance `extension.install` drops into `storefront:list.*` — he asked for a PLP with
  // nothing on it (that file's own comment: *"Nothing is placed in `list.*`"*). A per-store rule would accuse
  // that decision and would then need an exception list typed here to shut up, which is the failure mode this
  // house keeps paying for. "Live somewhere" needs none, and a block placed NOWHERE still cannot hide.
  const box = footwearBox();
  box.composition[OUTLET] = [
    ...outletHomeRows(),
    ...appBlockRows((name) =>
      name === 'reviews/order_review' ? { placement_id: null, has_placement: false, active: false } : {},
    ),
  ];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✓ forgeco's apps/, stdout);
    assert.match(stdout, /reviews\/order_review\(1\)/, stdout);
    assert.equal(code, 0, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★★★ ANTI-VACUUM — a tenant whose apps name NO storefront block is a RED, never a green silence', async () => {
  // ⛔ The shape of every cheap guard in this house: it passes because it found nothing. An empty answer here
  // means either that not one app is installed — no reviews, no shelves, no payment options, which is not a
  // demo — or that this check graded zero blocks while printing a tick. Both are unsettled.
  const box = footwearBox();
  box.composition[FORGE] = datasetHomeRows().filter((r) => !r.target.startsWith('storefront:'));
  box.composition[OUTLET] = [];
  const mount = mountedDataset();
  const face = await serve(box);
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /✗ forgeco's apps — read\.extension_composition named NO storefront block/, stdout);
    assert.equal(code, 1, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

test('★ a read that stops publishing `enabled` is the verifier\'s wrong question, never the box\'s defect', async () => {
  // The species this whole file exists for: `enabled` is the name 3e compares, and a read that stopped
  // publishing it must produce a ⚑ about the question — never a ✗ about a box whose blocks are all placed.
  const box = footwearBox();
  const mount = mountedDataset();
  const face = await serve(box, { drop: { read: 'extension_composition', key: 'enabled' } });
  try {
    const { code, stdout } = await verify(VERIFIER, face.api, 'forgeco', {
      FORGE_SEED_DATASET_DIR: mount.dir,
    });
    assert.match(stdout, /⚑ WRONG QUESTION — read\.extension_composition does not publish `enabled`/, stdout);
    assert.equal(code, 2, stdout);
  } finally {
    face.close();
    mount.close();
  }
});

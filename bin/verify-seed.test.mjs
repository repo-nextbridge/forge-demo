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
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

import { COFFEE_PROMOTIONS, coffeePages, expectedCoffees } from '../seed/coffee.mjs';
import { poolProducts } from '../seed/pool.mjs';
import { outletPages } from '../seed/outlet.mjs';

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
    // ★ THE CAFÉ'S SEVEN, derived from the function the seed writes them with — never a second list of the
    // same slugs. It published ZERO until pk15/d1, which the section reported as a line and did not judge;
    // now it is declared, so the same line is a verdict. The COUNTER still declares none, and that store is
    // why the "report, do not judge" branch is still exercised by this very box.
    pages: coffeePages().map((spec) => pageRow(CAFE, spec)),
    assets: [
      { id: 'ast_1', kind: 'image', provider_key: 'placeholder-cafe.png', filename: 'placeholder-cafe.png', mime: 'image/png', size: 10, created_by: null, created_at: '2026-09-03T00:00:00Z' },
    ],
    reviews,
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
    if (p === '/v1/read/internal/extension_records')
      return send(pageOf(without('extension_records', box.reviews), url));
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
async function verify(script, api, tenant = 'forgecafe') {
  try {
    const { stdout } = await run(process.execPath, [script, '--api', api, '--tenant', tenant], {
      env: { ...process.env, FORGE_SEED_TOKEN: 'tok_fake' },
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

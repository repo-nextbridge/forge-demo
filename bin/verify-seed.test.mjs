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

import { COFFEE_PROMOTIONS, expectedCoffees } from '../seed/coffee.mjs';
import { poolProducts } from '../seed/pool.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const VERIFIER = join(HERE, 'verify-seed.mjs');
const readSeed = (name) => JSON.parse(readFileSync(join(REPO, 'seed', name), 'utf8'));

const catalog = readSeed('catalog.json');
const totem = readSeed('totem.json');

const CAFE = 'sto_cafe';
const BALCAO = 'sto_balcao';

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
    pickupLocations: [{ id: 'pck_1', name: 'Balcão Forge Café', active: true, lat: null, lng: null }],
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
    assets: [
      { id: 'ast_1', kind: 'image', provider_key: 'placeholder-cafe.png', filename: 'placeholder-cafe.png', mime: 'image/png', size: 10, created_by: null, created_at: '2026-09-03T00:00:00Z' },
    ],
    reviews,
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
async function verify(script, api) {
  try {
    const { stdout } = await run(process.execPath, [script, '--api', api, '--tenant', 'forgecafe'], {
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

// ⛔⛔ THE STOCK POOL'S GUARD — D5, and the thing it protects has no symptom on the shop window.
//
// ── WHAT WAS WRONG, MEASURED ────────────────────────────────────────────────────────────────────────────
//
// `seed-history` REFUSES to write this brand's 180-day past, by name:
//
//     history plan: the stock pool has 11 product(s) and the three alert states need 13. Widen it (it must
//     also stay disjoint from what the stores sell).
//
// So the coffee tenant — the one the demo opens on — has no dashboard series, no order queue and no revenue.
// The refusal is right and it is the kernel's; what was wrong is on this side, in the dataset.
//
// ── WHAT THIS FILE MEASURES, AND WHY IT IS NOT A TAUTOLOGY ──────────────────────────────────────────────
//
// `stockPoolOf` is a re-implementation of the kernel's own selection (`resolveCatalogs`,
// `apps/api/src/seed-history.ts:446`) over the dataset — the 40-SKU-per-store sample included, because the
// sample is the whole reason the pool was ever accidental. It is not "what the dataset declares as a pool";
// it is "what the generator will actually be handed", which is a different number and was the surprise.
//
// ⚠️ IT IS VALIDATED AGAINST THE BENCH, which is what stops it from being a model of itself. Run on the box
// of 2026-09-03 (`select … from sku where product_id not in (the two 40-SKU samples)`), the kernel's real
// query returned 11 products / 22 SKUs, and this derivation over the dataset MINUS the declared pool returns
// exactly those 11 handles. The test below asserts that agreement.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CATALOG_PER_STORE,
  POOL_MULTI_SKU_NEEDED,
  POOL_PRODUCTS_NEEDED,
  poolPhotoNames,
  poolProducts,
  stockPoolOf,
  tenantCatalogue,
} from './pool.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
const totem = JSON.parse(readFileSync(join(SEED, 'totem.json'), 'utf8'));

/** What the kernel's own pool query returned on the bench of 2026-09-03, BEFORE this slice — the 11 products
 *  that fell out of the counter's 40-SKU sample. Sorted, because the SQL was `order by p.handle`. */
const ELEVEN_ON_THE_BENCH = [
  'bolo-do-dia',
  'caneca-esmaltada',
  'chai-cremoso-gelado',
  'cold-brew',
  'cookie-forge',
  'croissant',
  'frappe-caramelo-salgado',
  'frappe-forge-chocolate',
  'frappe-morango-chocolate-branco',
  'mocha',
  'pao-de-queijo',
];

test('★★ D5 — the pool the history will be handed is big enough for the three alert states', () => {
  const pool = stockPoolOf();
  assert.ok(
    pool.length >= POOL_PRODUCTS_NEEDED,
    `history plan would refuse: the stock pool has ${pool.length} product(s) and the three alert states ` +
      `need ${POOL_PRODUCTS_NEEDED}. Widen it in seed/catalog.json → stock_pool.`,
  );
  const multi = pool.filter((p) => p.skus > 1);
  assert.ok(
    multi.length >= POOL_MULTI_SKU_NEEDED,
    `"partial" needs ${POOL_MULTI_SKU_NEEDED} multi-SKU products in the pool and it has ${multi.length}. ` +
      'That state is only expressible on a product with siblings.',
  );
});

test('★★ THE DERIVATION AGREES WITH THE BENCH — take the declared pool away and the 11 come back', () => {
  // ⛔ THIS IS WHAT MAKES THE TEST ABOVE A MEASUREMENT. Without it, `stockPoolOf` would be a function
  // grading its own arithmetic; with it, the arithmetic has been checked against the kernel's real query on
  // a real box. If a future slice changes the counter's menu, this line goes red — correctly: the number it
  // was calibrated against no longer describes the box.
  const declared = new Set(poolProducts().map((p) => p.handle));
  const withoutTheDeclaredPool = stockPoolOf(tenantCatalogue().filter((r) => !declared.has(r.handle)));
  assert.deepEqual(withoutTheDeclaredPool.map((p) => p.handle).sort(), ELEVEN_ON_THE_BENCH);
});

test('⛔ D5 — the pool is 2 DECLARED products and 11 the LIMIT leaked, and the difference is named', () => {
  // ⚠️ THE FINDING THIS SLICE LEAVES OPEN, written as an assertion so nobody has to trust prose for it.
  // Every pool member that is not declared IS published by a store — it is in the pool only because the
  // counter publishes 63 sellable SKUs and the history samples 40. Those 11 are what a catalogue edit, a
  // re-price or a re-order of this file can take away without a word, and they are also products the
  // generator will drive to low/partial/zero while the counter goes on selling them.
  const declared = new Set(poolProducts().map((p) => p.handle));
  const byHandle = new Map(tenantCatalogue().map((r) => [r.handle, r]));
  const counterSkus = tenantCatalogue()
    .filter((r) => r.stores.includes(totem.store.handle))
    .reduce((n, r) => n + r.skus, 0);
  assert.ok(
    counterSkus > CATALOG_PER_STORE,
    `the counter now publishes ${counterSkus} sellable sku(s), inside the ${CATALOG_PER_STORE} the history ` +
      'samples — so the accidental pool is gone and the declared pool is all there is, which is ' +
      `${poolProducts().length} of the ${POOL_PRODUCTS_NEEDED} needed`,
  );
  assert.ok(poolProducts().length > 0, 'seed/catalog.json declares no stock_pool at all');
  const leaked = stockPoolOf().filter((p) => !declared.has(p.handle));
  for (const product of leaked) {
    assert.notDeepEqual(
      byHandle.get(product.handle).stores,
      [],
      `${product.handle} is in the pool AND sold by nobody — then declare it in stock_pool, with its reason`,
    );
  }
});

test('⛔ D5 — no declared pool product is on any assortment, in either direction', () => {
  // Publishing one is the whole mistake: the generator ZEROES the pool's stock, so a pool product on a
  // shelf is an out-of-stock line on the shop window plus a run ordering goods it just took away.
  const declared = new Set(poolProducts().map((p) => p.handle));
  for (const handle of catalog.products.map((p) => p.handle)) {
    assert.equal(declared.has(handle), false, `${handle} is both a coffee of the shop and a pool product`);
  }
  for (const handle of totem.products.map((p) => p.handle)) {
    assert.equal(declared.has(handle), false, `${handle} is both on the counter's menu and a pool product`);
  }
  for (const handle of totem.publish_also.handles) {
    assert.equal(declared.has(handle), false, `${handle} is re-sold by the counter and a pool product`);
  }
  for (const row of tenantCatalogue()) {
    if (!declared.has(row.handle)) continue;
    assert.deepEqual(row.stores, [], `${row.handle} is published to ${row.stores.join(', ')}`);
  }
});

test('⛔ the seeding path holds NO publish call — the guard on the code, not only on the data', () => {
  // A dataset that says "nobody sells these" and a module that publishes them anyway is one edit away, and
  // it would be silent: the pool would simply shrink and the past would start refusing again.
  const source = readFileSync(join(SEED, 'pool.mjs'), 'utf8');
  const calls = source.match(/command\('([a-z_.]+)'/g) ?? [];
  assert.deepEqual(
    [...new Set(calls)].sort(),
    ["command('catalog.product.create'", "command('inventory.adjust'"],
    'seed/pool.mjs drives a command it did not before — if it is a publish, the pool is over',
  );
});

test('★ every pool product names a photograph that is really on disk — no stand-in for these', () => {
  // The six coffees fall back to a generated stand-in for the story frames the merchant has not produced.
  // These two arrived WITH their picture, declare one each and no story, so a missing file here is a
  // dataset error rather than a hole waiting to be filled.
  for (const product of poolProducts()) {
    assert.ok(product.photo, `pool product ${product.handle} declares no photograph`);
    assert.equal(product.photos, undefined, 'a product no shopper can reach has no page to tell a story on');
    assert.ok(
      existsSync(join(SEED, 'photos', product.photo)),
      `seed/photos/${product.photo} does not exist`,
    );
  }
  assert.equal(new Set(poolPhotoNames()).size, poolProducts().length, 'two pool products share a picture');
});

test('★ a pool product is priced and sellable-shaped — the pool query only takes ACTIVE skus', () => {
  // `where s.status = 'active'` (apps/api/src/seed-history.ts:479). A product created as a draft, or with
  // no sku, is not in the pool at all — it is simply invisible, which is the failure mode with no message.
  for (const product of poolProducts()) {
    assert.equal(Number.isInteger(product.amount), true, `${product.handle} has no integer price in cents`);
    assert.ok(product.amount > 0, `${product.handle} is priced at ${product.amount}`);
    assert.ok(product.title && product.description, `${product.handle} is missing its shop copy`);
  }
});

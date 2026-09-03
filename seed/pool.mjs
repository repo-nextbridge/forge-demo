// ⛔⛔ THE STOCK POOL — the products of this brand that NO store sells, and the derivation that measures them.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, for the same reason `seed/coffee.mjs` and `seed/outlet.mjs`
// are ones. It receives the port the seed already built and knows nothing about transport.
//
// ── WHY A POOL, IN ONE PARAGRAPH ────────────────────────────────────────────────────────────────────────
//
// The 180-day past of this box is written by `demo-data` inside the kernel, and part of it is the three
// states the admin's stock screen shows: `out`, `partial`, `low`. The generator MAKES those states by
// zeroing stock, so it may only touch products nothing is selling — otherwise the same run would empty a
// shelf and then order from it. It needs THIRTEEN such products, at least four of them multi-SKU, and it
// REFUSES rather than under-delivering. `seed/catalog.json` → `_stock_pool_why` carries the whole account,
// including the measurement that says why the pool is declared here instead of being left to chance.
//
// ── THE ONE RULE OF THIS FILE ───────────────────────────────────────────────────────────────────────────
//
// ⛔ IT NEVER PUBLISHES. `bin/seed.mjs`'s `publish()` puts every product of `catalog.products` on sale in
// the coffee shop; these live under a DIFFERENT key precisely so that loop cannot reach them, and there is
// no code path here that calls `catalog.product.publish` or `catalog.product.publish_bulk`. A pool product
// on a shelf is not a bigger pool — it is a pool of twelve, and the next past to be seeded says so.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
const totem = JSON.parse(readFileSync(join(SEED, 'totem.json'), 'utf8'));

// ── ★ THE KERNEL'S OWN NUMBERS, quoted with their addresses ─────────────────────────────────────────────
// They are repeated here and NOT imported because they live in another repository, inside an image this box
// only pins. A guard that re-derived them from nothing would be measuring itself.

/** How many sellable SKUs of a store the history samples, ordered by id. `apps/api/src/seed-history.ts:141`. */
export const CATALOG_PER_STORE = 40;

/** `out` 3 + `partial` 4 + `low` 6. `extensions/demo-data/history/plan.ts:488-490`. */
export const POOL_PRODUCTS_NEEDED = 13;

/** Only a product with siblings can have SOME sku at zero and not all. Same file, `STOCK_PARTIAL_PRODUCTS`. */
export const POOL_MULTI_SKU_NEEDED = 4;

/** The declared pool, as the dataset writes it. */
export const poolProducts = () => catalog.stock_pool.products;

/** Every photograph the pool names — one per product, and each one real (no stand-in: see the dataset). */
export const poolPhotoNames = () => poolProducts().map((p) => p.photo);

/**
 * ★★ THE WHOLE CATALOGUE OF THIS BRAND, IN THE ORDER THE SEED CREATES IT, with the stores each product is
 * published to. This is the input of `stockPoolOf` below, and the ORDER is load-bearing: the history samples
 * `order by s.id limit 40`, ULIDs are minted in creation order, and this repository's own bench confirms the
 * two are the same sequence (measured 2026-09-03: `select … from sku order by id` came back in exactly the
 * order `bin/seed.mjs` and `seed/totem.mjs` write them, 63 rows, no exception).
 *
 * The three groups are the three moments of `bin/seed.mjs`'s curated phase, in the order it runs them:
 * the six coffees, then this pool, then the counter's menu.
 */
export function tenantCatalogue() {
  const soldAtTheCounter = new Set(totem.publish_also.handles);
  const counter = totem.store.handle;
  const shop = catalog.products_store;
  return [
    ...catalog.products.map((p) => ({
      handle: p.handle,
      skus: p.skus.length,
      stores: [shop, ...(soldAtTheCounter.has(p.handle) ? [counter] : [])],
    })),
    // ⛔ `stores: []` IS THE DECLARATION. Everything else in this function derives; this does not.
    ...poolProducts().map((p) => ({ handle: p.handle, skus: 1, stores: [] })),
    ...totem.products.map((p) => ({ handle: p.handle, skus: p.skus.length, stores: [counter] })),
  ];
}

/**
 * ★★ THE POOL, DERIVED WITH THE KERNEL'S OWN RULE — `resolveCatalogs`, `apps/api/src/seed-history.ts:450`.
 *
 * For each store: its sellable SKUs, in id order, capped at `CATALOG_PER_STORE`. The pool is every product
 * NONE of those SKUs belongs to — excluded BY PRODUCT and not by SKU, which is what makes `partial`
 * reachable and what makes the cap leak: a store with more than 40 SKUs has products that fall out of its
 * own sample and land in the pool without anybody deciding it.
 */
export function stockPoolOf(rows = tenantCatalogue()) {
  const stores = [...new Set(rows.flatMap((r) => r.stores))];
  const selling = new Set();
  for (const store of stores) {
    let sampled = 0;
    for (const row of rows) {
      if (!row.stores.includes(store)) continue;
      for (let i = 0; i < row.skus && sampled < CATALOG_PER_STORE; i += 1) {
        selling.add(row.handle);
        sampled += 1;
      }
      if (sampled >= CATALOG_PER_STORE) break;
    }
  }
  return rows.filter((r) => !selling.has(r.handle));
}

/**
 * @param port {{ command: Function, read: Function, readAll: Function, upload: Function, log: Function,
 *                fail: Function, minted: object }}
 */
export async function seedStockPool({ command, readAll, upload, log, fail, minted }) {
  const declared = poolProducts();
  if (declared.length === 0) fail('seed/catalog.json declares an empty `stock_pool`.');

  // `products_admin` and not `products`: the tenant's WHOLE catalogue, with no store to scope by — which is
  // exactly the question "did I already make this?" for a product that is published nowhere and never will
  // be. The store's list would answer "not there" for every one of them, for ever.
  const existing = new Map((await readAll('products_admin')).map((p) => [p.handle, p]));
  const onHand = catalog.stock_pool.default_on_hand;
  let created = 0;

  for (const product of declared) {
    if (existing.has(product.handle)) {
      log(`pool — ${product.handle} already in the catalogue`);
      continue;
    }
    const providerKey = await upload(product.photo);
    const out = await command('catalog.product.create', {
      handle: product.handle,
      title: product.title,
      description: product.description,
      status: 'active',
      // No `options`: a single SKU has no axis to sit on, and the kernel takes `options` as optional.
      skus: [{ code: product.handle, amount: product.amount, is_default: true }],
      media: [
        { provider_key: providerKey, kind: 'image', role: 'cover', position: 0, alt: product.title },
      ],
    });
    const productId = out.product_id ?? out.id;
    const skuId = out.sku_ids?.[0];
    if (!skuId) fail(`pool — catalog.product.create(${product.handle}) returned no sku id.`);
    // WHOEVER WRITES REGISTERS — `seed/minted.mjs`. Nothing downstream merges into these bags today, and the
    // day something does it must not have to ask a projection about a row this run just made.
    minted?.rememberProduct(product.handle, productId, {});
    minted?.rememberSkusOf(product.handle, [{ code: product.handle, id: skuId, metadata: {} }]);

    // Stocked, so the product is a normal catalogue row until the history decides otherwise. ABSOLUTE and
    // not a delta, like every other stock write in this repository: a re-run leaves the same number.
    await command('inventory.adjust', {
      sku_id: skuId,
      on_hand: onHand,
      reason: 'correction',
      note: 'demo birth data — stock pool',
    });
    created += 1;
    log(`pool — ${product.handle} created (${productId}), stocked at ${onHand}, PUBLISHED NOWHERE`);
  }

  const pool = stockPoolOf();
  log(
    `pool — ${created} of ${declared.length} declared product(s) created. The tenant's stock pool is ` +
      `${pool.length} product(s) (${pool.filter((p) => p.skus > 1).length} multi-SKU); the history needs ` +
      `${POOL_PRODUCTS_NEEDED} and ${POOL_MULTI_SKU_NEEDED} multi-SKU.`,
  );
}

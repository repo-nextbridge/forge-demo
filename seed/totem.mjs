// THE COUNTER'S BIRTH DATA — the store the totem serves, driven through the port.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, for the reason its two siblings already are ones: three
// slices filling three stores in three worktrees, and one file between them is a conflict with a stopwatch
// on it. Like them it receives the port the seed already built and knows nothing about transport.
//
// IT RUNS AFTER `seedCoffee`, AND THAT IS A DEPENDENCY AND NOT A PREFERENCE. Six of the twenty-one things
// the counter sells are the e-commerce's own coffees; this file publishes them into a second store and
// files them under a band of the menu. It creates none of them, and `bin/seed.mjs` fails loudly here if
// they are missing rather than inventing a seventh coffee.
//
// ── WHAT THIS FILE IS FOR, IN ONE SENTENCE PER MECHANISM ────────────────────────────────────────────────
//
//   1. THE STORE. A second store of the SAME tenant, with no theme: the totem is an app of its own and
//      resolves no theme, so a `theme_key` here would be a promise nothing keeps.
//
//   2. THE FOUR BANDS OF THE MENU, AS KERNEL CATEGORIES. Not a field of `seed/totem.json`, because a field
//      would be a menu only the totem can read. As categories the menu is `read.products?category=…` — the
//      same door a PLP, a sitemap and a marketplace export already come through.
//      ⚠️ A CATEGORY IS TENANT-WIDE (`catalog.category.create` takes no store). What answers "which of
//      these does the COUNTER fill?" is `read.category_paths?store=<balcao>`, never the category list.
//
//   3. THE FIFTEEN NEW PRODUCTS, with their axes as ordinary variants and the delta between sizes as a
//      PRICE PER SKU. There is no arithmetic anywhere in this file: a cappuccino G with oat milk is a row
//      with a number in `seed/totem.json`, so the shop is re-priced by a person editing a file.
//
//   4. THE MULTISTORE ACT. The six coffees are PUBLISHED here, never re-created — so the price the counter
//      prints is the same SKU the e-commerce sells, live from the kernel. That is the one thing a second
//      catalogue could not fake.
//
//   5. THE PICKUP POINT AND ITS METHOD, because `checkout.place_order` demands a shipping method from every
//      order and a counter delivers nothing. See `seed/totem.json`'s `pickup.why` for the measurement.
//
//   6. THE COUPON AND THE COMBO — a promotion scoped to this store, and a promotion conditioned on what the
//      cart contains. The second one is created LAST because its condition names product ids.
//
// IDEMPOTENT BY CONSTRUCTION, like its siblings: everything is keyed by something this file chooses, the
// read that answers the question is asked first, and what is already there is skipped. Re-running converges
// and never deletes.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planRepoint } from './media.mjs';
import { planStock } from './stock.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
export const MEDIA_DIR = join(SEED, 'totem-media');
const data = JSON.parse(readFileSync(join(SEED, 'totem.json'), 'utf8'));

/** Exported for `seed/totem.test.mjs`, which asks questions of the data without a network. */
export const totem = data;

// ── the pure half — the decisions, as functions, so they can be tested without a box ────────────────────

/**
 * The slug of one option value, and it is the SAME transliteration `bin/seed.mjs` uses for the coffees.
 *
 * ⚠️ IT MATTERS THAT IT IS THE SAME. A sku code is what a human reads on an order line and what `stock()`
 * matches on, so two spellings of "Porção c/ 3" would be a stock pass that silently sets nothing.
 */
export const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * The code of one SKU: the product handle, then its point on the option grid.
 *
 * ★ THE NO-AXIS CASE IS THE ONE THIS FUNCTION EXISTS FOR. `bin/seed.mjs` builds the same string inline as
 * `${handle}-${values.map(slug).join('-')}`, which is right for six coffees that all have two axes and
 * wrong for the enamel mug, which has none: it yields `caneca-esmaltada-`, a trailing dash on a code a
 * merchant reads and `stock()` matches. A product without variants is a normal product, so the handle
 * alone is its code.
 */
export function skuCode(handle, values) {
  const suffix = values.map((v) => slug(v)).join('-');
  return suffix ? `${handle}-${suffix}` : handle;
}

/**
 * The SKU rows of one product, expanded from the axes the catalogue declares.
 *
 * `option_values` is what ties a SKU to its point on the grid; the axis it belongs to is read by POSITION
 * from `product.options`, which is why a sku's `options` array must be as long as the axis list. A sku that
 * names fewer values than the product has axes is a catalogue bug that would otherwise reach the kernel as
 * a variant nobody can select, so it is refused here, by name.
 */
export function expandSkus(product) {
  const axes = product.options ?? [];
  return (product.skus ?? []).map((sku, index) => {
    const values = sku.options ?? [];
    if (values.length !== axes.length) {
      throw new Error(
        `totem — product "${product.handle}" declares ${axes.length} axis/axes and a sku with ` +
          `${values.length} value(s): [${values.join(', ')}]. Every sku names one value per axis.`,
      );
    }
    for (const [axis, value] of values.entries()) {
      if (!axes[axis].values.includes(value)) {
        throw new Error(
          `totem — product "${product.handle}" has a sku on "${axes[axis].name}" = "${value}", which is ` +
            `not one of that axis's values (${axes[axis].values.join(' · ')}).`,
        );
      }
    }
    return {
      code: skuCode(product.handle, values),
      amount: sku.amount,
      // The first row is the star: it is what the totem's card prices and what the modal opens on.
      is_default: index === 0,
      ...(values.length > 0
        ? { option_values: values.map((value, axis) => ({ option: axes[axis].name, value })) }
        : {}),
    };
  });
}

/** The metadata bag a NEW product is born with: its declared custom fields plus the counter's seal. */
export function productMetadata(product) {
  return { ...(product.custom_fields ?? {}), ...(product.tag ? { tag_balcao: product.tag } : {}) };
}

/**
 * ★★ THE MERGE, AND IT IS A FUNCTION BECAUSE GETTING IT WRONG IS SILENT.
 *
 * The six coffees of the e-commerce must carry the counter's seal, and writing it means editing a product
 * this slice did not create. `catalog.product.update` REPLACES `metadata` WHOLESALE — it validates the bag
 * and then coalesces the column, so sending `{tag_balcao: 'blend'}` to the Alvorada would leave that
 * product with a seal and with NO `regiao`, `processo`, `torra` or `notas`. The coffee shop's product page
 * would go blank, this script would report success, and nobody would know until somebody looked.
 *
 * So the desired bag is computed HERE, from what the product already carries, and the caller never sends a
 * literal. `seed/totem.test.mjs` breaks it on purpose and names the field that goes missing.
 *
 * It returns `null` when there is nothing to do — a bag that already says this is a command not spent and
 * an audit row not written, which is the difference between idempotent in EFFECT and idempotent in ACT.
 */
export function mergeMetadata(current, additions) {
  const bag = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  const changed = Object.entries(additions).filter(([key, value]) => bag[key] !== value);
  if (changed.length === 0) return null;
  return { ...bag, ...Object.fromEntries(changed) };
}

/** Every photograph the catalogue names, so the coherence check and the upload loop read one list. */
export function photoNames(catalogue = data) {
  return catalogue.products.map((p) => p.photo);
}

// ── the driven half ─────────────────────────────────────────────────────────────────────────────────────

/**
 * @param port {{ command: Function, read: Function, readAll: Function, publicReadAll: Function,
 *                rows: Function, log: Function, fail: Function, uploadAsset: Function }}
 */
export async function seedTotem(port) {
  const { log } = port;

  const store = await theStore(port);
  await customFields(port);
  const categories = await theCategories(port);
  const products = await theProducts(port);
  await publish(port, store, products);
  await categorize(port, store, categories, products);
  await stock(port);
  await pickup(port);
  await promotions(port, store, products);

  log('totem — done. Re-running this is a no-op.');
}

// ── 1. the store ────────────────────────────────────────────────────────────────────────────────────────
async function theStore({ command, read, rows, log }) {
  const wanted = data.store;
  // By HANDLE here and by ID everywhere after: `store` in a command is the id (`sto_…`), and passing a
  // handle is a 404 that names the store rather than the mistake.
  const found = rows(await read('stores')).find((s) => s.handle === wanted.handle);
  if (found) {
    log(`totem — store ${found.handle} (${found.id}) already there`);
    return found;
  }
  // No `theme_key`, deliberately: see seed/totem.json.
  const out = await command('tenant.store.create', { handle: wanted.handle, name: wanted.name });
  const id = out.store_id ?? out.id;
  log(`totem — store ${wanted.handle} created (${id})`);
  return { id, handle: wanted.handle, name: wanted.name };
}

// ── 2. the custom fields ────────────────────────────────────────────────────────────────────────────────
// DECLARED BEFORE ANY PRODUCT WRITES ONE, for the reason `bin/seed.mjs` states about its own: an undeclared
// key is accepted silently and is then invisible to everything that reads declarations.
async function customFields({ command, read, rows, log }) {
  const declared = new Set(
    rows(await read('custom_field_definitions')).map((d) => `${d.owner_entity}:${d.key}`),
  );
  let created = 0;
  for (const field of data.custom_fields) {
    if (declared.has(`product:${field.key}`)) continue;
    await command('custom_field.define', {
      owner_entity: 'product',
      key: field.key,
      type: field.type,
      label: field.label,
      facetable: field.facetable,
    });
    created += 1;
  }
  log(
    created === 0
      ? `totem — all ${data.custom_fields.length} custom field(s) already declared`
      : `totem — ${created} custom field(s) declared`,
  );
}

// ── 3. the four bands ───────────────────────────────────────────────────────────────────────────────────
/** @returns Map<path, category_id> */
async function theCategories({ command, readAll, log }) {
  // `categories_admin` answers a bare array and ignores paging — `readAll` knows, and returns it whole.
  const existing = new Map();
  for (const row of await readAll('categories_admin')) {
    existing.set(row.path, row.id ?? row.category_id);
  }
  const byPath = new Map();
  let created = 0;
  for (const category of data.categories) {
    const already = existing.get(category.path);
    if (already) {
      byPath.set(category.path, already);
      continue;
    }
    const out = await command('catalog.category.create', {
      path: category.path,
      name: category.name,
      handle: category.handle,
      status: 'active',
    });
    byPath.set(category.path, out.category_id ?? out.id);
    created += 1;
  }
  log(
    created === 0
      ? `totem — all ${data.categories.length} menu band(s) already there`
      : `totem — ${created} menu band(s) created`,
  );
  return byPath;
}

// ── 4. the fifteen products ─────────────────────────────────────────────────────────────────────────────
/**
 * @returns Map<handle, {id, metadata}> for every product of the counter — the fifteen new ones and the six
 *          this file only publishes. Everything downstream needs the ids, and reading them once is cheaper
 *          and more honest than four reads that could disagree.
 */
async function theProducts(port) {
  const { command, readAll, log, fail, uploadAsset } = port;
  const files = new Set(readdirSync(MEDIA_DIR));

  const known = new Map();
  for (const row of await readAll('products_admin')) {
    known.set(row.handle, { id: row.product_id ?? row.id, metadata: row.metadata ?? {} });
  }

  let created = 0;
  let repointed = 0;
  for (const product of data.products) {
    if (!files.has(product.photo)) {
      fail(`totem — product ${product.handle} names photo "${product.photo}", which seed/totem-media/ does not have.`);
    }
    const file = join(MEDIA_DIR, product.photo);
    const existing = known.get(product.handle);

    if (existing) {
      // ★ ALREADY THERE IS NOT THE SAME AS UNCHANGED — the lesson `bin/seed.mjs` paid for when the six
      // coffee photographs were re-cut and re-running the seed changed nothing. Same mechanism, reused:
      // `uploadAsset` resolves the file to the key its BYTES already have (or a new one), and `planRepoint`
      // decides what to attach and what to detach, attach-first so an interrupted run never leaves a
      // product with no picture at all.
      if (await repointMedia(port, existing.id, product, file)) repointed += 1;
      continue;
    }

    const providerKey = await uploadAsset(file);
    const out = await command('catalog.product.create', {
      handle: product.handle,
      title: product.title,
      description: product.description,
      status: 'active',
      ...(product.options?.length ? { options: product.options } : {}),
      skus: expandSkus(product),
      metadata: productMetadata(product),
      media: [{ provider_key: providerKey, kind: 'image', position: 0, alt: product.title }],
    });
    const id = out.product_id ?? out.id;
    known.set(product.handle, { id, metadata: productMetadata(product) });
    created += 1;
  }
  log(
    `totem — products: ${created} created, ${data.products.length - created} already there ` +
      `(${repointed} photo(s) re-pointed)`,
  );

  // The six the counter sells and does not own. Their absence is a run-order bug, not a data one: this
  // module runs after the catalogue step and after seedCoffee precisely so they are here.
  const missing = data.publish_also.handles.filter((handle) => !known.has(handle));
  if (missing.length > 0) {
    fail(
      `totem — these products are supposed to already exist and do not: ${missing.join(', ')}.\n` +
        '  They are seed/catalog.json\'s, created by the catalogue step of bin/seed.mjs — this module runs\n' +
        '  AFTER it and after seedCoffee, never before. It does not create a coffee.',
    );
  }
  await sealTheCoffees(port, known);

  return known;
}

/** @returns true when a command was spent re-pointing. */
async function repointMedia({ command, read, rows, log, uploadAsset }, productId, product, file) {
  const want = await uploadAsset(file);
  const plan = planRepoint(rows(await read('product_media', { product_id: productId })), want);
  if (!plan.attach && plan.detach.length === 0) return false;
  if (plan.attach) {
    await command('catalog.media.attach', {
      owner_type: 'product',
      owner_id: productId,
      provider_key: want,
      kind: 'image',
      position: 0,
      alt: product.title,
    });
  }
  // ⚠️ `detach` IS NOT `delete`: it drops the reference and leaves the bytes, because this script cannot
  // know who else points at them.
  for (const mediaId of plan.detach) await command('catalog.media.detach', { media_id: mediaId });
  log(`totem — product ${product.handle} photo RE-POINTED (${plan.detach.length} old reference(s) dropped)`);
  return true;
}

/**
 * ★ THE SEAL ON THE SIX COFFEES — the one write in this file that edits a product of another slice.
 *
 * It is an ADDITION and it is merged, never sent whole: see `mergeMetadata` above for what a literal here
 * would have erased. It is also idempotent BY VALUE — a coffee that already carries its seal costs no
 * command — so a second run of this seed writes nothing and leaves no audit row.
 */
async function sealTheCoffees({ command, log }, known) {
  let sealed = 0;
  for (const [handle, tag] of Object.entries(data.publish_also.tags ?? {})) {
    const product = known.get(handle);
    if (!product) continue; // already reported by the caller's `missing` check
    const merged = mergeMetadata(product.metadata, { tag_balcao: tag });
    if (!merged) continue;
    await command('catalog.product.update', { product_id: product.id, metadata: merged });
    product.metadata = merged;
    sealed += 1;
  }
  log(
    sealed === 0
      ? 'totem — the six coffees already carry their counter seal'
      : `totem — ${sealed} coffee(s) given their counter seal (metadata MERGED, never replaced)`,
  );
}

// ── 5. publishing — the multistore act ──────────────────────────────────────────────────────────────────
/**
 * ★★ THE IDEMPOTENCE CHECK IS `read.internal.product_stores`, AND IT IS NEITHER OF THE TWO READS THAT WERE
 * OBVIOUS. Both of those are wrong here, in opposite directions, and each was measured:
 *
 *   · `read.internal.products?store=<id>` — the trap `bin/seed.mjs` documents: it answers 200 with the
 *     WHOLE TENANT catalogue and IGNORES `store`. Believing it reads "all twenty-one already on sale" for
 *     a shop showing nothing, and publishes zero while reporting success.
 *
 *   · `read.products?store=<id>` (the PUBLIC face) — what `publish()` in `bin/seed.mjs` rightly uses for a
 *     store that has existed for a while, and what this function used first. ⚠️ IT 404s FOR A STORE THIS
 *     RUN JUST CREATED. The public face resolves store→tenant through `forge_control.store_directory`,
 *     which is filled by an event CONSUMER (`read.store_directory`, packages/core/src/read/
 *     store-directory-consumer.ts) — so a brand-new store is not resolvable there until the relay catches
 *     up. Measured on this bench: `read.products?store=<balcao>` → HTTP 404 immediately after
 *     `tenant.store.create` (with fifteen product creations and their photograph uploads in between), and
 *     200 a little later. A first-ever run of this seed died exactly there.
 *
 * `product_stores` is the question itself — "which stores is this product published to?" — and it reads
 * `product_store` inside this tenant's schema, synchronously, with no projection and no relay between the
 * write and the answer. It costs one read per product, which at twenty-one products is nothing, and it is
 * honest on the run that just created the store as well as on every run after.
 */
async function publish({ command, read, log }, store, products) {
  const wanted = [...data.products.map((p) => p.handle), ...data.publish_also.handles];
  const todo = [];
  for (const handle of wanted) {
    const id = products.get(handle).id;
    const stores = await read('product_stores', { product_id: id });
    if (!(Array.isArray(stores) ? stores : []).includes(store.id)) todo.push(id);
  }
  if (todo.length === 0) {
    log(`totem — publish: all ${wanted.length} already on sale at the counter`);
    return;
  }
  await command('catalog.product.publish_bulk', { product_ids: todo, store_id: store.id });
  log(
    `totem — publish: ${todo.length} of ${wanted.length} put on sale at the counter ` +
      `(${data.publish_also.handles.length} of them the e-commerce's own products, NOT re-created)`,
  );
}

// ── 6. the menu bands, filled ───────────────────────────────────────────────────────────────────────────
/**
 * Idempotent against `products_admin`, which carries each product's `categories` — the only read here that
 * answers for a product whatever its publication state, so the check is honest on a half-finished run.
 */
async function categorize({ command, readAll, log, fail }, _store, categories, products) {
  const wanted = new Map(data.products.map((p) => [p.handle, p.category]));
  for (const handle of data.publish_also.handles) wanted.set(handle, data.publish_also.category);

  const current = new Map();
  for (const row of await readAll('products_admin')) {
    current.set(
      row.handle,
      new Set((row.categories ?? []).map((c) => c.category_id ?? c.id ?? c)),
    );
  }

  let filed = 0;
  for (const [handle, path] of wanted) {
    const categoryId = categories.get(path);
    if (!categoryId) fail(`totem — product ${handle} names the band "${path}", which is not one of the four.`);
    if (current.get(handle)?.has(categoryId)) continue;
    // `is_primary` is left alone: a coffee's canonical category is the e-commerce's business, and the
    // kernel refuses a second primary anyway ("product already has a primary category").
    await command('catalog.product.categorize', {
      product_id: products.get(handle).id,
      category_id: categoryId,
    });
    filed += 1;
  }
  log(
    filed === 0
      ? `totem — all ${wanted.size} product(s) already filed in their menu band`
      : `totem — ${filed} product(s) filed in their menu band`,
  );
}

// ── 7. stock ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Absolute and never a delta — running it twice leaves the same number, where two deltas would double it.
 * A sku already at or above the declared figure is skipped, so a re-run does not undo stock somebody moved
 * by hand on the bench.
 *
 * ⚠️ THE DRINKS' FIGURE IS A NUMBER AND NOT A POLICY, and `seed/totem.json`'s `_stock_why` is where the
 * measurement lives: "keep selling" is `oversell_policy: 'allow'` on the WAREHOUSE, it is not scoped to
 * what that warehouse stocks, and switching it on would let the e-commerce's coffees oversell too.
 */
async function stock({ command, readAll, log, fail }) {
  const want = new Map();
  for (const product of data.products) {
    for (const sku of expandSkus(product)) {
      want.set(sku.code, product.on_hand ?? data.default_on_hand);
    }
  }

  // ★ THE SAME `planStock` `bin/seed.mjs` USES, AND DELIBERATELY NOT A SECOND COPY OF THE TECHNIQUE.
  // The blind version of this loop — walking `stock_levels` alone — cannot stock a product that has never
  // been stocked, because that read's SQL ends in `having present_count > 0`. Cloning the good version
  // here while leaving the shared step blind would be the worst of both: two mechanisms, one broken, and
  // the broken one is the one that runs for every store. `seed/stock.mjs` holds the reasoning and the
  // measurement; it takes both reads because taking only one is the bug.
  const { adjustments, missing } = planStock(
    want,
    await readAll('products_admin'),
    await readAll('stock_levels', { limit: '200' }),
  );
  if (missing.length > 0) {
    fail(
      `totem — seed/totem.json declares sku code(s) no product answers to: ${missing.join(', ')}.\n` +
        '  Either a product was never created, or an option value was renamed after it was.',
    );
  }
  for (const adjustment of adjustments) {
    await command('inventory.adjust', {
      sku_id: adjustment.sku_id,
      on_hand: adjustment.on_hand,
      reason: 'correction',
      note: 'counter birth data',
    });
  }
  log(
    adjustments.length === 0
      ? `totem — every one of the ${want.size} counter sku(s) already stocked`
      : `totem — ${adjustments.length} of ${want.size} counter sku(s) stocked`,
  );
}

// ── 8. the pickup point, and the method that reaches it ─────────────────────────────────────────────────
/**
 * ★ WHY A SHIPPING METHOD AT ALL, FOR A SHOP THAT SHIPS NOTHING: `checkout.place_order` refuses a cart with
 * no `shipping_method`, and it is right to — every order has to say how it reaches its buyer. A counter's
 * honest answer is RETRIEVAL, which the kernel spells as a method of kind `pickup` plus a point to collect
 * from. The order then freezes the point's name, address and instructions, which is the "retire no balcão
 * quando chamarmos" of the design, said in the kernel's own words.
 *
 * ⚠️ ALL THREE OBJECTS ARE TENANT-WIDE — no `store_id` on any of these commands — so this option appears in
 * the other stores' checkouts too. That is written up in `seed/totem.json`'s `pickup.why`, together with
 * the measurement that this tenant had NO shipping configuration at all before this step.
 *
 * Idempotent by NAME, which is what makes the name a key here: two points called "Balcão · Forge Café"
 * would be an ambiguity a shopper resolves by guessing.
 */
async function pickup({ command, read, readAll, rows, log }) {
  const wanted = data.pickup;

  const point =
    rows(await read('pickup_locations')).find((p) => p.name === wanted.location.name) ??
    (await (async () => {
      const out = await command('pickup_location.create', { ...wanted.location, active: true });
      log(`totem — pickup point "${wanted.location.name}" created (${out.pickup_location_id})`);
      return { id: out.pickup_location_id, name: wanted.location.name };
    })());

  const method =
    (await readAll('shipping_methods_admin')).find((m) => m.name === wanted.method.name) ??
    (await (async () => {
      const out = await command('shipping.method.create', {
        name: wanted.method.name,
        kind: 'pickup',
        // A retrieval is never measured or weighed — the shopper carries it. The divisor is the industry's
        // usual 6000 so the field says something true rather than something invented, and no limit is set:
        // a limit here would be the counter refusing to hand over a heavy bag of coffee beans.
        dimensional_divisor: 6000,
        active: true,
      });
      log(`totem — shipping method "${wanted.method.name}" created, kind pickup (${out.method_id})`);
      return { id: out.method_id, name: wanted.method.name };
    })());

  const zone =
    rows(await read('shipping_zones')).find((z) => z.name === wanted.zone.name) ??
    (await (async () => {
      const out = await command('shipping.zone.create', wanted.zone);
      log(`totem — shipping zone "${wanted.zone.name}" created (${out.zone_id})`);
      return { id: out.zone_id, name: wanted.zone.name };
    })());

  const methodId = method.id ?? method.method_id;
  const zoneId = zone.id ?? zone.zone_id;
  // `shipping.rate.set` is an UPSERT on (method, zone, bracket) — so this is idempotent at the kernel and
  // the check below only saves the command, not the correctness.
  const rated = rows(await read('shipping_rates')).some(
    (r) => (r.method_id ?? r.shipping_method_id) === methodId && r.zone_id === zoneId,
  );
  if (!rated) {
    await command('shipping.rate.set', {
      method_id: methodId,
      zone_id: zoneId,
      // One bracket, wide enough that no basket of coffee and pastry misses it — a cart that matches no
      // bracket is quoted nothing, and "no shipping option" at a totem is a journey that cannot end.
      weight_bracket_max_grams: 100_000,
      price: 0,
      delivery_min_days: 0,
      delivery_max_days: 0,
    });
    log('totem — pickup rate set: free, same day, every postal code');
  } else {
    // A step that says nothing when it has nothing to do is a step a reader cannot tell ran.
    log(`totem — pickup already configured: "${wanted.location.name}" via "${wanted.method.name}"`);
  }
  return { point, method, zone };
}

// ── 9. the promotions ───────────────────────────────────────────────────────────────────────────────────
/**
 * Both are scoped to this store by `store_id`, and both are born ACTIVE — deliberately, and unlike the
 * command's own default, for the reason `seed/coffee.mjs` states: a draft discount is a shop that promises
 * a price on the screen and charges another one at the till.
 *
 * ⚠️ THE ORDER IS NOT COSMETIC. The combo's condition names PRODUCT IDS, so it can only be written once the
 * espresso and the pão de queijo exist. The coupon has no such dependency and is written beside it because
 * the two are one subject.
 */
async function promotions({ command, readAll, log, fail }, store, products) {
  const existing = new Map((await readAll('promotions_admin')).map((p) => [p.name, p]));

  const coupon = data.promotions.coupon;
  if (existing.has(coupon.name)) {
    log(`totem — promotion "${coupon.name}" already there (${existing.get(coupon.name).id})`);
  } else {
    const out = await command('promotion.create', {
      name: coupon.name,
      label: coupon.label,
      store_id: store.id,
      benefit: { kind: 'percentage', percent_bp: coupon.percent_bp, scope: 'each_item' },
      target: { kind: 'all' },
      status: 'active',
      // A coupon is TYPED, so it is not automatic: `trigger` says the shopper has to present it.
      trigger: 'coupon',
      stackable: true,
    });
    // ⚠️ The CODE is a second command, and the promotion is inert without it — a coupon promotion with no
    // code is a discount nobody can reach. It is tolerated as already-taken so a run that died between the
    // two commands converges instead of dying on the kernel being right.
    const added = await command(
      'promotion.code.add',
      { promotion_id: out.promotion_id, code: coupon.code },
      { tolerate: ['code_taken'] },
    );
    if (added.refused) {
      fail(
        `totem — the code ${coupon.code} already belongs to another promotion ` +
          `(${added.error?.details?.promotion_id ?? 'unknown'}). A code is unique tenant-wide; this seed\n` +
          '  will not steal one. Remove it there, or rename the counter\'s coupon in seed/totem.json.',
      );
    }
    log(`totem — promotion "${coupon.name}" created with code ${coupon.code}, ${coupon.percent_bp / 100}% off`);
  }

  const combo = data.promotions.combo;
  if (existing.has(combo.name)) {
    log(`totem — promotion "${combo.name}" already there (${existing.get(combo.name).id})`);
    return;
  }
  const contains = combo.contains.map((handle) => {
    const product = products.get(handle);
    if (!product) fail(`totem — the combo names "${handle}", which is not a product of this catalogue.`);
    return product.id;
  });
  await command('promotion.create', {
    name: combo.name,
    label: combo.label,
    store_id: store.id,
    benefit: { kind: 'fixed_amount', amount: combo.amount },
    target: { kind: 'all' },
    // ★ "THE CART CONTAINS", in the kernel's own words: EVERY product listed must be in the cart. That is
    // what a combo means — "any of" is what a target already expresses, and the kernel keeps the two apart.
    conditions: [{ kind: 'cart_contains', product_ids: contains }],
    status: 'active',
    trigger: 'automatic',
    stackable: true,
  });
  log(`totem — promotion "${combo.name}" created — R$ ${(combo.amount / 100).toFixed(2)} off when the cart holds ${combo.contains.join(' + ')}`);
}

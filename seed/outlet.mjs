// THE OUTLET STORE, DRIVEN THROUGH THE PORT — the D2 slice's half of this instance's birth data.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, on purpose: this store and the coffee store were filled
// by two slices at the same time, in two worktrees, and two of those in one file is a conflict with a
// stopwatch on it. One store, one file, and the seed keeps deciding the order. It hands this function the
// port it already built (the command caller, the internal read, its logger); nothing here is transport.
//
// EVERYTHING THIS SLICE PROMISED IS IN HERE, AND NONE OF IT IS CODE THE PRODUCT SHIPS:
//   · the apps the composition needs, INSTALLED (`banners`, `shelves`);
//   · the custom fields the products' technical sheets are written in, DECLARED before any of them
//     is written — an undeclared key is accepted in silence and then invisible to every reader (the same
//     order, and the same reason, as the coffee catalogue's);
//   · the 33 CATEGORIES the vanilla's hand-curated header menu links to, created if nobody made them yet
//     (A40 — a store served by the vanilla either carries that tree or ships 33 links into the void);
//   · the photographs and the campaign art, through the media door;
//   · the products, PUBLISHED into the outlet store, CATEGORISED and given their stock;
//   · and, in the WINDOW phase rather than this one, the `compare_at_amount` of every SKU — the "de" the
//     whole archetype rests on. It cannot be written here; `priceOutlet()` at the foot says why.
//   · the three collections the three shelves are sourced from;
//   · the six Compose placements that ARE the home: the announcement band, and — all five in the SINGLE
//     slot between «Compre por categoria» and «Marcas que amamos», ordered by `position` — the five-tile
//     banner mosaic, the "Quase de graça" shelf, the "Acabando!" shelf, the «Outlet Kids» banner and the
//     "Outlet Kids" shelf that gives that banner a body (s2-8).
//
// ⚠️ CONFINED TO THE OUTLET STORE — with one measured asterisk. Everything store-scoped below names
// `data.store` and nothing else. Two steps are not store-scoped because the kernel models them per TENANT
// and offers no narrower door: the custom-field declaration (a field nobody fills is a row in a table) and
// the app INSTALL. That second one reaches further than it looks: `extension.install` also PLACES every
// hook the app's manifest declares, in EVERY store of the tenant. Installing `shelves` here dropped an
// empty shelf into the vanilla control store and into the coffee store as well — measured. It is harmless
// today, because an empty config renders nothing (the control store's home is byte-identical either way),
// but "installing an app touches only my store" is not true, and the slice report says so out loud.
//
// IDEMPOTENT BY CONSTRUCTION, like its sibling: everything is keyed by a name this file chooses, the read
// face is asked first, and what is already there is skipped. Re-running converges.
//
// ⚠️ WITH ONE EXCEPTION SINCE 02/09, AND IT IS DELIBERATE: `compose()` GOVERNS the home's slots rather than
// appending to them, so a block in them that this file does not declare is REMOVED. Everything else here
// still only ever adds — no product, photograph, collection or custom field is deleted by re-running. The
// reason the home is different is written at `compose()`; the short version is that the previous version of
// this file put the same three blocks in three OTHER slots, and a seed that only appends would leave that
// page drawn above the new one and report success.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// ⚠️ THE MIME COMES FROM THE FILE, and it did not used to. `upload()` announced `image/jpeg` for every byte
// it sent, which was true of the six JPEGs this store shipped with and false the moment a PNG arrived — and
// the media door VALIDATES the declared mime against the extension (`plan-upload.ts`), so it would have been
// a refusal at the edge, not a picture that looked wrong. Same function, same reason and the same tests as
// `bin/seed.mjs` and `seed/forge.mjs`: one answer to "what is this file", not three.
import { mimeOf } from './forge.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(SEED, 'outlet-media');

/** The one file that decides anything. This module knows how to drive the port; it knows no prices. */
const data = JSON.parse(readFileSync(join(SEED, 'outlet.json'), 'utf8'));

/**
 * @param port {{ api: string, token: string, command: Function, read: Function, rows: Function,
 *                log: Function, fail: Function }}
 */
/**
 * @param port {{ api: string, token: string, tenant: string, command: Function, read: Function,
 *                rows: Function, log: Function, fail: Function }}
 */
export async function seedOutlet(port) {
  const { read, rows, log, fail } = port;

  // ── the store ─────────────────────────────────────────────────────────────────────────────────────
  // By HANDLE here and by ID everywhere after: `store` in a command is the id (`sto_…`), and passing a
  // handle is a 404 that names the store rather than the mistake.
  const store = rows(await read('stores')).find((s) => s.handle === data.store);
  if (!store) {
    fail(
      `the store "${data.store}" does not exist yet. It is the bootstrap store — run the one-shot that\n` +
        '  provisions this instance first, then this seed.',
    );
  }
  log(`outlet — store ${store.handle} (${store.id}), theme "${store.theme_key ?? 'vanilla'}"`);

  await installApps(port);
  await declareFields(port);
  const categories = await seedCategories(port);
  const assets = await uploadMedia(port);
  const products = await seedProducts(port, store, assets, categories);
  await seedCollections(port, products);
  await compose(port, store, assets);

  log('outlet — done. Re-running this is a no-op.');
}

// ── 1. the apps ─────────────────────────────────────────────────────────────────────────────────────
// A block cannot be placed by an app that is not installed, and installing is the operator's own gesture
// — the same two clicks in the admin, spelled as a command so a clone of this repo comes up the same way.
async function installApps({ command, read, rows, log }) {
  const installed = new Set(rows(await read('installed_extensions')).map((e) => e.extension_id ?? e.id));
  for (const id of data.apps) {
    if (installed.has(id)) {
      log(`app ${id} — already installed`);
      continue;
    }
    await command('extension.install', { extension_id: id });
    log(`app ${id} — installed`);
  }
}

// ── 2. the custom fields ────────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ THIS STEP NO LONGER DECLARES ANYTHING, AND THE REASON IS A COLLISION THAT IS UNAVOIDABLE BY
// CONSTRUCTION — read this before adding a key back.
//
// THE SHOE VOCABULARY BELONGS TO THE DATASET. `genero`, `material`, `uso`, `solado`, `fechamento`, `cano`,
// `peso_g`, `amortecimento`, `impermeavel` are declared in the dataset's `custom-fields.json`, and the
// demo-data install MATERIALIZES them (SEED-DATASET emptied the manifest's own `customFields` precisely
// because the vocabulary moved to the dataset). Measured key by key: all NINE this file used to declare are
// in that list, and the coffee vocabulary of `bin/seed.mjs` and the counter's two overlap it by ZERO — so the
// collision was entirely this file's, and so is the fix.
//
// ★ WHY TWO DECLARATIONS OF ONE KEY CANNOT COEXIST. The unique index is
// `custom_field_definition (owner_entity, key, store) nulls not distinct where status = 'active'`
// (tenant/0021) and it does NOT include `source`. But `materializeAppCustomFields`
// (packages/core/src/commands/custom-fields.ts) looks for the existing row `... and source = $3`. So the
// idempotence check is NARROWER than the constraint: a key declared by this seed (`source: merchant`) is
// invisible to the app's check (`source: app:demo-data`), which therefore INSERTS and hits the index. Two
// sources declaring one key collide ALWAYS. That is a kernel defect, it is carded, and it is not ours to fix
// in this wave — what is ours is to stop being the second source.
//
// ⚠️ AND THE ORDER DOES NOT MATTER, which is the thing that makes this safe. The old comment here said an
// undeclared key is "stored and then invisible to faceting" — true, and NOT permanent. Measured on the
// bench: `subtitle` is written into every coffee's metadata by `bin/seed.mjs` and declared NOWHERE, and the
// public face serves it today. The projection copies `metadata` verbatim (projection/build-doc.ts) and the
// facet axes are resolved PER REQUEST (`loadFacetableKeys`, read/catalog-filters.ts; the values come from
// `jsonb_each_text(doc->'metadata')` in read/facets.ts). So a key declared LATER lights its facet up for
// products already written, with nothing re-written. Proved live: the cafe store's facet axes are exactly
// the four declarations with `facetable: true`, while `notas`, `sca`, `tag_balcao` and `subtitle` sit in the
// same metadata and are simply not axes.
//
// So this store's products keep writing their nine keys, and the install declares them whenever it runs.
async function declareFields({ command, read, rows, log }) {
  const declared = new Set(
    rows(await read('custom_field_definitions')).map((d) => `${d.owner_entity}:${d.key}`),
  );
  /** The keys the DATASET owns — declared by the demo-data install, never here. */
  const datasetOwned = new Set(data.custom_fields.map((f) => f.key));
  let deferred = 0;
  for (const field of data.custom_fields) {
    if (datasetOwned.has(field.key)) {
      deferred += 1;
      continue;
    }
    if (declared.has(`product:${field.key}`)) {
      log(`cf ${field.key} — already declared`);
      continue;
    }
    await command('custom_field.define', {
      owner_entity: 'product',
      key: field.key,
      type: field.type,
      label: field.label,
      facetable: field.facetable,
      ...(field.options ? { options: field.options } : {}),
    });
    log(`cf ${field.key} — declared${field.facetable ? ' (facetable)' : ''}`);
  }
  if (deferred > 0) {
    log(
      `outlet — ${deferred} shoe field(s) NOT declared here: they are the dataset's, and the demo-data ` +
        'install materializes them. Two sources declaring one key collide on the unique index — see the ' +
        'header. The products still write the values; the facet lights up when the install runs.',
    );
  }

  // ⚠️⚠️ THE LEFTOVER FROM A BOX THIS FILE ALREADY RAN ON, and saying it here is the difference between a
  // one-line instruction and an afternoon.
  //
  // An EARLIER version of this step declared those nine keys itself, with `source: merchant`. Those rows do
  // not disappear because this file stopped writing them — and the demo-data install will still collide with
  // them, because its idempotence check looks for `source: app:demo-data` and finds nothing, then inserts and
  // meets the unique index (which ignores `source`). The failure surfaces inside the one-shot, far from here,
  // as an install that dies on a key nobody is looking at.
  //
  // ★ IT IS NOT ARCHIVED AUTOMATICALLY, and that is deliberate. `custom_field.archive` is a STRUCTURE change
  // on a merchant-owned declaration, and this script cannot tell a row IT wrote from one a merchant typed —
  // "it looks like mine" is not consent to retire somebody's field. So it is named, loudly, with the exact
  // command, and a human decides. Archiving frees the key: the unique index is `where status = 'active'`.
  const owned = data.custom_fields
    .map((f) => f.key)
    .filter((key) => declared.has(`product:${key}`));
  if (owned.length > 0) {
    log(
      [
        `⚠️ outlet — ${owned.length} of the dataset's key(s) are ALREADY declared on this tenant, and this`,
        `  seed is no longer their author: ${owned.join(', ')}.`,
        '  If they carry `source: merchant` they are leftovers from an earlier run of THIS file, and the',
        '  demo-data install WILL collide with them (its check is by source; the unique index is not).',
        '  Retire each one, ONCE, and then run the one-shot:',
        '    curl -X POST "$FORGE_PUBLIC_ORIGIN/v1/commands/custom_field.archive" \\',
        '      -H "authorization: Bearer $FORGE_SEED_TOKEN" -H "x-forge-tenant: <tenant>" \\',
        '      -H "content-type: application/json" -d \'{"owner_entity":"product","key":"<key>"}\'',
        '  A box that never ran the older version has nothing to do here.',
      ].join('\n'),
    );
  }
}

// ── 2b. the categories ──────────────────────────────────────────────────────────────────────────────
// A40, the Renan on 2026-09-02: the vanilla vitrine's header menu is a hand-curated literal in the kit
// (`storefront-kit/.../header/navTree.ts`) — 5 tops, 28 leaves, 33 links — and EVERY store the vanilla
// serves wears it whole. So the assortment either covers that tree or the shop ships links to an empty
// list. His ruling was to populate the demo, not to teach the shared storefront a new trick. This step is
// the first half of that: the tree has to EXIST before a product can name a node of it.
//
// ⚠️ THIS SEED IS NOT THE ONLY AUTHOR OF THESE 33, AND THAT IS FINE BY CONSTRUCTION. `seed/forge.mjs`
// creates the same tree from the mounted dataset, and on this bench it runs SECOND (measured: the outlet's
// commands at 00:31:44, the dataset's `catalog.category.create` at 00:32:01). Both look a category up BY
// PATH before creating it, so whichever runs first wins the create and the other reuses the row — which is
// exactly why `outlet.json` copies the dataset's path, name and handle verbatim rather than inventing a
// vocabulary. A box with no dataset mounted at all gets the tree from here and nothing is missing.
//
// PARENTS FIRST: `path` is an ltree and a child written before its parent is a child of nothing.
async function seedCategories({ command, readAll, log }) {
  const existing = new Map(
    (await readAll('categories_admin')).map((c) => [c.path ?? c.handle, c.category_id ?? c.id]),
  );
  const byPath = new Map();
  let created = 0;
  const byDepth = [...data.categories].sort((a, b) => {
    const depth = a.path.split('.').length - b.path.split('.').length;
    return depth !== 0 ? depth : a.path.localeCompare(b.path);
  });
  for (const category of byDepth) {
    let id = existing.get(category.path);
    if (!id) {
      const out = await command('catalog.category.create', {
        path: category.path,
        name: category.name,
        handle: category.handle,
        status: 'active',
      });
      id = out.category_id ?? out.id;
      created += 1;
    }
    byPath.set(category.path, id);
  }
  log(
    `categories — ${data.categories.length} in the menu's tree: ${created} created, ` +
      `${data.categories.length - created} already there`,
  );
  return byPath;
}

// ── 3. the bytes ────────────────────────────────────────────────────────────────────────────────────
// THE PHOTOS COME BEFORE THE PRODUCTS. `catalog.product.create` takes media references, so a byte failure
// discovered afterwards has already published a catalogue of refs pointing at nothing.
//
// Three steps, all through the door: `media.request_upload` validates the mime and size and NAMES the key
// (it writes nothing and returns no bytes), the connector edge mints the URL, and the PUT carries the
// bytes straight there — they never pass through the command port.
//
// The banner tiles need the asset's ID and not only its key: a `banner` block's media list references the
// asset LIBRARY (`type: 'id'`), and the kernel resolves it to a url at read time exactly as it does for a
// product photo. So this returns both, keyed by file name.
async function uploadMedia(port) {
  const { command, readAll, log } = port;
  const wanted = [
    ...data.mosaic.media.map((m) => m.file),
    ...data.kidsBanner.media.map((m) => m.file),
    ...data.products.flatMap((p) => p.photos),
  ];

  const known = new Map();
  for (const asset of await readAll('assets')) {
    if (asset.filename) known.set(asset.filename, asset);
  }

  const assets = new Map();
  let uploaded = 0;
  for (const filename of wanted) {
    const found = known.get(filename);
    if (found) {
      assets.set(filename, { id: found.id, provider_key: found.provider_key });
      continue;
    }
    assets.set(filename, await upload(port, filename));
    uploaded += 1;
  }
  log(`media — ${wanted.length} file(s): ${uploaded} uploaded, ${wanted.length - uploaded} already there`);
  return assets;
}

async function upload({ api, token, tenant, command, fail }, filename) {
  const bytes = readFileSync(join(MEDIA, subdirOf(filename), filename));
  const mime = mimeOf(filename);
  if (!mime) fail(`upload(${filename}): this seed does not know the mime of that extension.`);
  // The media face wants the tenant spelled out too (`403 forbidden: "tenant required"` without it,
  // measured) — it is its own adapter, not the command one, so the wrapper above does not reach it.
  const plan = await fetch(`${api}/v1/media/commands/media.request_upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-forge-tenant': tenant,
    },
    body: JSON.stringify({ filename, mime, kind: 'image', size: bytes.byteLength }),
  });
  if (!plan.ok) fail(`media.request_upload(${filename}) → HTTP ${plan.status}\n  ${await plan.text()}`);
  const body = await plan.json();
  const key = body.provider_key ?? body.value?.provider_key;
  const url = body.upload_url ?? body.value?.upload_url;
  if (!key) fail(`media.request_upload(${filename}) returned no provider_key: ${JSON.stringify(body)}`);
  if (!url) {
    fail(
      `media.request_upload(${filename}) returned no upload_url. That is what a driver with no egress\n` +
        '  looks like. This script only knows how to place bytes through a signed URL; with a bucket\n' +
        "  driver, upload them with that provider's own tool first.",
    );
  }

  const put = await fetch(url.startsWith('http') ? url : `${api}${url}`, {
    method: 'PUT',
    headers: { 'content-type': mime },
    body: bytes,
  });
  if (!put.ok) fail(`PUT ${filename} → HTTP ${put.status}`);

  const created = await command('asset.create', {
    provider_key: key,
    filename,
    mime,
    kind: 'image',
    size: bytes.byteLength,
  });
  return { id: created.asset_id, provider_key: key };
}

/** Campaign art and product photography are two different jobs and live in two folders; the file name is
 *  what the data references, so the folder is derived rather than repeated in every entry. */
const subdirOf = (filename) => (filename.startsWith('banner-') ? 'banners' : 'products');

// ── 4. the products ─────────────────────────────────────────────────────────────────────────────────
// Create, PUBLISH, then stock — in that order and per product, never in three passes. A product that
// exists and is published can be found again by handle on the next run; one created and left unpublished
// can not (the internal product read takes an id, and the store-scoped list only sees publications), so
// the window where a crash leaves an orphan is one HTTP call wide instead of eight.
//
// ⚠️ AND "ALREADY THERE" IS NOT "ALREADY IN THIS SHOP", which is the trap A40 walked into. The read below
// answers the whole TENANT (see the ★ note), so a product `seed/forge.mjs` created from the dataset is
// "already there" while being published in the `forge` store and NOWHERE ELSE. Every product this file
// names IS a dataset product — that is deliberate, it is what gives them a real photograph and a real size
// grid — so the two seeds meet on every handle below, and which one runs first is an ordering this file must
// not depend on. Hence: an existing product is still PUBLISHED and CATEGORISED here. Both commands are
// idempotent at the kernel (`product_store` inserts `on conflict do nothing`; `product_category` upserts by
// the pair), so the second run of either seed is a no-op and neither can leave the shop half-built.
async function seedProducts({ command, readAll, log }, store, assets, categories) {
  // ★ S1 — MEASURED, AND IT WAS ONE PAGE AWAY FROM KILLING THE RE-RUN. This read is NOT store-scoped: asked
  // for the outlet, it answers the whole TENANT catalogue (measured on this bench: `?store=<cafe>` returned
  // all 14 products, `total: 14`). While the tenant held 14 products the single page of 100 was everything,
  // so `existing` was complete and the re-run was a no-op. With the sports store's 2790 products in the same
  // tenant, a first page that does not happen to contain these eight makes `existing` empty — and this
  // function's next move is `catalog.product.create`, which the kernel refuses with 409 on the unique handle.
  // A seed that cannot be run twice. So it pages.
  const existing = new Map(
    (await readAll('products', { store: store.id })).map((p) => [p.handle, p.product_id ?? p.id]),
  );

  const ids = new Map();
  for (const product of data.products) {
    const already = existing.get(product.handle);
    if (already) {
      await command('catalog.product.publish', { product_id: already, store_id: store.id });
      await categorize({ command }, already, product, categories);
      ids.set(product.handle, already);
      log(`product ${product.handle} — already there; publication and category re-asserted`);
      continue;
    }

    const out = await command('catalog.product.create', {
      handle: product.handle,
      title: product.title,
      description: product.description,
      status: 'active',
      // A single-SKU product declares NO option axis, and sending `options: undefined` is not the same as
      // omitting the key — measured on the dataset: 5 of the 24 A40 added (a boot, a chelsea, a slipper, a
      // bag, a cap) come with one SKU and no grid at all.
      ...(product.options?.length ? { options: product.options } : {}),
      // ONE PRICE ACROSS THE SIZE GRID, which is what the artboard draws: a card shows one figure struck
      // through and one to pay.
      //
      // ⛔⛔ AND THE `compare_at_amount` IS **NOT** WRITTEN HERE. It used to be, and it did not survive the
      // birth — this is the defect the Renan saw as "2 of the 8 have a discount". See `priceOutlet()` at the
      // foot of this file for the whole story; the short version is that a LATER step of the birth converges
      // every dataset SKU's `compare_at` to the dataset's own figure, and every product this file names is a
      // dataset product. Written here it is erased minutes later, in silence.
      skus: product.skus.map((sku, index) => ({
        ...sku,
        amount: product.amount,
        is_default: index === 0,
      })),
      metadata: product.metadata,
      ...(product.content_sections?.length ? { content_sections: product.content_sections } : {}),
      ...(product.meta_title ? { meta_title: product.meta_title } : {}),
      ...(product.meta_description ? { meta_description: product.meta_description } : {}),
      media: product.photos.map((file, index) => ({
        provider_key: assets.get(file).provider_key,
        kind: 'image',
        role: index === 0 ? 'cover' : 'gallery',
        position: index,
        alt: product.title,
      })),
    });

    await command('catalog.product.publish', { product_id: out.product_id, store_id: store.id });
    await categorize({ command }, out.product_id, product, categories);
    await setStock({ command }, product, out.sku_ids);
    ids.set(product.handle, out.product_id);
    log(
      `product ${product.handle} — created, published in ${product.category}, ` +
        `${out.sku_ids.length} sku(s) stocked at ${(product.amount / 100).toFixed(2)} ` +
        '(the "de" is the window phase\'s — see priceOutlet)',
    );
  }
  return ids;
}

/**
 * The product's node in the menu's tree, as its CANONICAL one.
 *
 * ⚠️ `is_primary: true` IS A CLAIM THAT CAN BE REFUSED, and only in one way: the kernel rejects a SECOND
 * primary on a product that already has a different one (`product already has a primary category; switch it
 * explicitly`). Re-writing the SAME pair is an upsert and always succeeds. So this is safe precisely because
 * `outlet.json` names the dataset's own `categoryPath` for every product — the two seeds write one row, not
 * two claims. Point a product at a different node here and the second seed to run is the one that fails.
 */
async function categorize({ command }, productId, product, categories) {
  const categoryId = categories.get(product.category);
  if (!categoryId) {
    throw new Error(
      `product ${product.handle} names category "${product.category}", which outlet.json does not declare.`,
    );
  }
  await command('catalog.product.categorize', {
    product_id: productId,
    category_id: categoryId,
    is_primary: true,
  });
}

/** The figure the shopper's discount tag will read, from the pair — never a number stored beside them. */
export function discountPercent(product) {
  return Math.round(100 * (1 - product.amount / product.compare_at_amount));
}

/** `stock` is a number (every SKU alike) or a list in SKU order — which is how a shoe ends up with two
 *  units in one size and none in the next, and how the second shelf earns the name "Acabando!". */
async function setStock({ command }, product, skuIds) {
  for (const [index, skuId] of skuIds.entries()) {
    const onHand = Array.isArray(product.stock) ? (product.stock[index] ?? 0) : product.stock;
    await command('inventory.set_level', { sku_id: skuId, on_hand: onHand, reason: 'goods_received' });
  }
}

// ── 4b. THE WINDOW'S HALF — the "de", written LAST because a step between the two phases erases it ────
//
// ⛔⛔ THIS IS NOT TIDINESS. THE DISCOUNT DOES NOT SURVIVE THE CURATED PHASE, AND IT IS NOBODY'S BUG.
//
// The birth is ordered (`bin/box-up.sh`): 8 · the CURATED seed (this file's `seedOutlet`) → 9 · `seed-demo`,
// the MASSIVE one-shot → 10 · the past → 11 · the WINDOW (`bin/seed.mjs --phase window`, which calls this).
//
// Step 9 runs `apps/api/src/seed-media.ts`, whose contract is written at its head: "IDEMPOTENT BY
// CONSTRUCTION: the desired state is the dataset ... A product OUTSIDE the dataset is never touched." For
// every SKU it can match BY CODE it converges four fields to the dataset's declaration —
// `compare_at_amount`, `ref`, `ean`, `is_default` — and the wanted value is `sku.compare_at_amount ?? null`.
// The dataset declares a `compare_at` on almost none of these shoes, so `null` is what it writes.
//
// ★ AND EVERY PRODUCT THIS FILE NAMES IS A DATASET PRODUCT — deliberately, because that is what gives them a
// real photograph, a real size grid and a real "de". Same handles, SAME SKU CODES. So they sit squarely
// inside that step's jurisdiction and it does exactly what it promises to them.
//
// ⚠️ IT DOES NOT TOUCH `amount` — measured, that field is not in its diff. So the failure is the nastiest
// shape there is: the "por" survives and the "de" vanishes, leaving a clearance store with low prices and no
// visible discount anywhere. That is precisely what the Renan reported ("2 of the 8 have a discount") and
// what the audit shows: 52 `catalog.sku.update` at 00:45:06, right after the massive step finished.
//
// SO THE WRITE MOVES TO THE PHASE DESIGNED FOR IT. The window exists because "the window promotes products
// of the MASSIVE catalogue, so it must follow 9" — the same reason, and it is the LAST word on this tenant.
// Creation, publication, categorisation and stock stay in the curated phase, where they belong; only the
// figure another author converges is written after that author has spoken.
//
// ⚠️ AND IT WRITES WITHOUT ASKING FIRST, WHICH IS A DELIBERATE EXCEPTION TO THIS FILE'S "re-running is a
// no-op". A diff would have to trust `products_admin`, a PROJECTION, about a column a competing writer just
// changed — and the direction that hurts is the silent one: a doc still showing this file's old figure while
// the table holds `null` makes the diff say "already right" and the shop ships with no discount. 182 SKU
// updates is a cheap price for a guarantee that does not depend on projection lag (the same tenant already
// spends 44 427 `inventory.adjust` in one birth). The read below is for the sku IDS and for the EVIDENCE the
// log prints — how many had actually been cleared — never for deciding whether to write.
export async function priceOutlet({ read, readAll, rows, command, log, fail }) {
  const store = rows(await read('stores')).find((s) => s.handle === data.store);
  if (!store) fail(`the store "${data.store}" does not exist; the curated phase has not run.`);

  const wanted = new Map(data.products.map((p) => [p.handle, p]));
  const catalogue = await readAll('products_admin');

  let written = 0;
  let hadBeenCleared = 0;
  const missing = [];
  for (const [handle, product] of wanted) {
    const doc = catalogue.find((p) => p.handle === handle);
    if (!doc) {
      missing.push(handle);
      continue;
    }
    for (const sku of doc.skus ?? []) {
      const id = sku.id ?? sku.sku_id;
      if (!id) continue;
      if (sku.compare_at_amount !== product.compare_at_amount) hadBeenCleared += 1;
      // ⚠️ BOTH HALVES OF THE PRICE, AND THE SECOND ONE WAS MEASURED MISSING ON THE BENCH OF 02/09.
      // Writing only the "de" is right for a product THIS file created — the create already carried the
      // "por". It is wrong for the 24 the MASSIVE step had already made from the same dataset: those carry
      // the dataset's own price, the curated `amount` never reached them, and stamping the dataset figure as
      // `compare_at` on top of it produced `de == por` — a struck-through price identical to the live one,
      // on 130 of the 182 skus. That reads as broken rather than as full price, so it is worse than writing
      // nothing. `catalog.sku.update` is partial, so naming both is the whole fix, and it is the same pair
      // the create path writes (every sku of an outlet product shares `product.amount`).
      await command('catalog.sku.update', {
        sku_id: id,
        amount: product.amount,
        compare_at_amount: product.compare_at_amount,
      });
      written += 1;
    }
  }

  if (missing.length > 0) {
    fail(
      `the window cannot price ${missing.length} product(s) the curated phase should have created:\n  ` +
        `${missing.join('\n  ')}\n` +
        '  Run `bin/seed.mjs` (the curated phase) for this tenant before the window.',
    );
  }
  log(
    `outlet — the "de" written on ${written} sku(s) of ${wanted.size} product(s); ` +
      `${hadBeenCleared} of them did not carry it (that is the massive step's convergence, undone here)`,
  );
}

// ── 5. the collections ──────────────────────────────────────────────────────────────────────────────
// The shelves are sourced from COLLECTIONS rather than from a curated handle list, and the reason is
// one link: a shelf over a collection carries "Ver todos →" to `/collection/<handle>`, which the artboard
// draws on both section headers, and a manual shelf has no single listing to point at.
//
// `sort: manual` + a pinned position per product: the artboard's order is a merchandising decision, not
// an alphabet.
async function seedCollections({ command, read, log }, products) {
  const listed = await read('collections_admin', { limit: '50' });
  const existing = new Map((listed.items ?? []).map((c) => [c.handle, c.collection_id ?? c.id]));

  for (const collection of data.collections) {
    let id = existing.get(collection.handle);
    if (id) {
      log(`collection ${collection.handle} — already there`);
    } else {
      const out = await command('catalog.collection.create', {
        handle: collection.handle,
        name: collection.name,
        sort: 'manual',
        visibility: 'public',
      });
      id = out.collection_id ?? out.id;
      log(`collection ${collection.handle} — created`);
    }

    // Pinning is idempotent by the command's own contract, so the order is re-asserted on every run —
    // which is what makes the artboard's order a fact of this file rather than of the first run.
    //
    // ★ AND THE ARTBOARD'S EIGHT STAY ON THE HOME BECAUSE THEY COME FIRST IN THE FILE. A40 added 24 more
    // products to the artboard's two collections (its rule: the deepest cuts are `quase-de-graca`, the rest
    // `acabando`), which fills the two `/collection/<handle>` pages the shelf headers link to. The HOME is
    // untouched by that: each shelf renders `item_count` items — 5 and 3, the artboard's — from the top of
    // the pin order, and the newcomers are appended after position 4 and 2 because `data.products` lists
    // them after. Move one of the eight down this list and the home's shelf changes; that is the coupling.
    const members = data.products.filter((p) => p.shelf === collection.handle);
    for (const [position, product] of members.entries()) {
      await command('catalog.collection.pin', {
        collection_id: id,
        product_id: products.get(product.handle),
        position,
      });
    }
    log(`collection ${collection.handle} — ${members.length} product(s) pinned, in the artboard's order`);
  }
}

// ── 6. the home ─────────────────────────────────────────────────────────────────────────────────────
// THE BLOCKS OF ONE SLOT ARE THE WHOLE PAGE, and that is still the thesis of this slice: the Outlet's home
// is the reference vitrine with five rows of configuration in it, and not one line of front-end code.
//
// ★★ 02/09 — WHY THEY ARE ALL IN ONE SLOT NOW. He asked for «Compre por categoria» FIRST, then the mosaic,
// the two shelves and the kids banner, then «Marcas que amamos». Those two headings are FIXED SECTIONS of the
// reference home (theme chrome over core reads, not slots), and between them the template declares exactly
// ONE slot — `home.below_categories`. So the order he asked for is not a choice of slots, it is `position`
// 0..4 inside that one (03/09: the "Outlet Kids" shelf appended at 4, after the banner he named last —
// nothing he named moved). `home.hero`, `home.banner_strip`, `home.below_shelf` and `home.below_brands` are
// empty ON PURPOSE, and so is the PLP. See `outlet.json`'s `_home_why`.
//
// ⚠️ AND THAT IS WHY THIS FUNCTION GOVERNS RATHER THAN APPENDS — the change is not cosmetic, so read it.
//
// The old rule was "is there a placement of this app+component in this slot? then configure it, else place
// it". With TWO `banners/banner` blocks in one slot that question stops identifying anything: it matches the
// mosaic and the kids banner equally, so one of them would overwrite the other forever.
//
// Worse, appending is now WRONG in a way nothing would report. Every box that ran the previous version has
// the mosaic in `home.hero`, "Quase de graça" in `home.banner_strip` and "Acabando!" in `home.below_shelf`.
// A seed that only adds would leave that whole page drawn ABOVE the new one and call it success — the exact
// order he asked us to change, still there, twice.
//
// So within the slots this file OWNS (`storefront:home.*` and `storefront:list.*`, for `banners` and
// `shelves` only) what this file says is there IS what is there: existing instances are REUSED — moved and
// reconfigured, keeping their ids and their audit trail — and a surplus one is removed. Two deliberate
// consequences, said out loud because the sibling seeds promise the opposite:
//   · IT DELETES. `seed/vitrine.mjs` never does, on the grounds that an extra block in a slot is a human's.
//     That is right for the `forge` store, whose window is curated by hand. It is wrong here: this home has a
//     declared shape and a block nobody declared is what a half-migrated box looks like.
//   · IT CLEANS THE PLP. `extension.install` of `shelves` places an empty instance in `list.below_shelf` in
//     EVERY store of the tenant; he asked for a PLP with nothing on it, so the outlet's copy is reused as the
//     host of a shelf that IS wanted, or removed. Nothing is placed in `list.*`.
//
// The announcement band is NOT governed here: it lives in `header.announcement`, it is a `single` block, and
// the old upsert identifies it perfectly.
async function compose({ command, read, rows, log }, store, assets) {
  // The slots whose contents this file decides, and the two apps whose blocks it decides them for. A block
  // some other app puts on this home is not this function's business and is left alone.
  const GOVERNED_SLOT = /^storefront:(home|list)\./;
  const GOVERNED_APPS = new Set(['banners', 'shelves']);

  const placements = rows(await read('extension_composition', { store: store.id }));

  // ── the store's own mark: one block, one slot, upsert ─────────────────────────────────────────────
  // ⚠️ NOT GOVERNED BY `planHome` BELOW, and deliberately: that function owns `home.*`/`list.*` for the two
  // apps that draw the page, so a mark in `header.brand` is outside its jurisdiction and survives it. Same
  // upsert shape as the band next door — placed once, reconfigured when the words change, never doubled
  // (the block is `single`, so a second placement would be the kernel's refusal rather than two marks).
  const mark = {
    extension_id: 'chrome',
    component: 'brand',
    slot: data.brand.slot,
    config: { text: data.brand.text, tail: data.brand.tail },
    what: "the store's mark",
  };
  const existingMark = placements.find(
    (row) =>
      row.extension_id === mark.extension_id &&
      row.component === mark.component &&
      row.target === mark.slot,
  );
  if (!existingMark) {
    await command('composition.place', {
      store: store.id,
      extension_id: mark.extension_id,
      component: mark.component,
      slot: mark.slot,
      config: mark.config,
    });
    log(`compose ${mark.slot} — placed ${mark.what}`);
  } else if (sameConfig(existingMark.config, mark.config)) {
    log(`compose ${mark.slot} — ${mark.what} is already configured`);
  } else {
    await command('composition.update_config', { placement_id: existingMark.id, config: mark.config });
    log(`compose ${mark.slot} — ${mark.what} reconfigured`);
  }

  // ── the announcement band: one block, one slot, upsert ────────────────────────────────────────────
  const band = {
    extension_id: 'banners',
    component: 'announcement',
    slot: data.announcement.slot,
    config: { text: data.announcement.text },
    what: 'the announcement band',
  };
  const existingBand = placements.find(
    (row) =>
      row.extension_id === band.extension_id &&
      row.component === band.component &&
      row.target === band.slot,
  );
  if (!existingBand) {
    await command('composition.place', {
      store: store.id,
      extension_id: band.extension_id,
      component: band.component,
      slot: band.slot,
      config: band.config,
    });
    log(`compose ${band.slot} — placed ${band.what}`);
  } else if (sameConfig(existingBand.config, band.config)) {
    log(`compose ${band.slot} — ${band.what} is already configured`);
  } else {
    await command('composition.update_config', {
      store: store.id,
      placement_id: existingBand.placement_id,
      config: band.config,
    });
    log(`compose ${band.slot} — configured ${band.what}`);
  }

  // ── the home: five blocks, one slot, ordered by position ──────────────────────────────────────────
  const mediaConfig = (items) =>
    items.map((m) => ({
      asset_id: assets.get(m.file).id,
      // Widths are PERCENTAGES and the block flows the tiles by them: 50 + 25 + 25 fills the first row, the
      // following 50 + 50 wraps to a second. Heights are PIXELS, derived from the art (see `outlet.json`).
      // ⚠️ `alt` is NOT sent: the block's item schema has no such field and the config is validated STRICTLY,
      // so passing it is a refusal. It stays in the data as documentation — see `outlet.json`.
      width: m.width,
      height: m.height,
      ...(m.link ? { link: m.link } : {}),
    }));

  const wanted = [
    {
      extension_id: 'banners',
      component: 'banner',
      slot: data.mosaic.slot,
      position: data.mosaic.position,
      config: { style: data.mosaic.style, media: mediaConfig(data.mosaic.media) },
      what: `the ${data.mosaic.media.length}-tile mosaic`,
    },
    ...data.shelves.map((shelf) => ({
      extension_id: 'shelves',
      component: 'shelf',
      slot: shelf.slot,
      position: shelf.position,
      config: {
        title: shelf.title,
        layout: shelf.layout,
        source: 'collection',
        source_collection: shelf.collection,
        item_count: shelf.item_count,
      },
      what: `the "${shelf.title}" shelf`,
    })),
    {
      extension_id: 'banners',
      component: 'banner',
      slot: data.kidsBanner.slot,
      position: data.kidsBanner.position,
      config: { style: data.kidsBanner.style, media: mediaConfig(data.kidsBanner.media) },
      what: 'the «Outlet Kids» banner',
    },
  ];

  const plan = planHome(placements, wanted, { apps: GOVERNED_APPS, slot: GOVERNED_SLOT });

  // ⚠️ SURPLUS FIRST. `composition.place`/`move` with an explicit position SHIFT everything at or after it in
  // that slot, so removing afterwards would renumber a slot this function had just ordered.
  for (const { row, kind } of plan.remove) {
    await command('composition.remove', { store: store.id, placement_id: row.placement_id });
    log(
      `compose ${row.target} — removed a surplus ${kind} block` +
        `${Object.keys(row.config ?? {}).length === 0 ? " (an install's empty default)" : ''}`,
    );
  }

  for (const { block, reuse: row } of plan.ops) {
    if (!row) {
      await command('composition.place', {
        store: store.id,
        extension_id: block.extension_id,
        component: block.component,
        slot: block.slot,
        position: block.position,
        config: block.config,
      });
      log(`compose ${block.slot}#${block.position} — placed ${block.what}`);
      continue;
    }
    if (row.target !== block.slot || row.position !== block.position) {
      await command('composition.move', {
        store: store.id,
        placement_id: row.placement_id,
        slot: block.slot,
        position: block.position,
      });
      log(`compose ${block.slot}#${block.position} — moved ${block.what} here from ${row.target}#${row.position}`);
    }
    if (sameConfig(row.config, block.config)) {
      log(`compose ${block.slot}#${block.position} — ${block.what} is already configured`);
      continue;
    }
    await command('composition.update_config', {
      store: store.id,
      placement_id: row.placement_id,
      config: block.config,
    });
    log(
      `compose ${block.slot}#${block.position} — configured ${block.what}` +
        `${Object.keys(row.config ?? {}).length === 0 ? " (the install's empty default)" : ''}`,
    );
  }
}

/**
 * ★ THE HOME'S PLAN — pure, so the reconciliation is MEASURED and not merely read. Given what the store holds
 * and what `outlet.json` declares, it answers "which instance does each wanted block reuse, and what is
 * surplus". Exported for `seed/outlet-home.test.mjs`; `compose()` above only drives the port from it.
 *
 * ⚠️ THE PAIRING IS BY ORDER WITHIN AN APP+COMPONENT GROUP, and there is no better key available. A wanted
 * block has no identity the kernel stores: `hook_placement` carries the app, the component, the slot, the
 * position and a config validated STRICTLY against the block's schema — there is nowhere to write "this is
 * the mosaic". Matching on the config would mean a block that a human edited in Compose is not recognised
 * and gets duplicated, which is the worse failure. So: the first `banners/banner` on this home is the mosaic
 * and the second is the kids banner, in the read's own order (it sorts by target, then position).
 *
 * @param placements {Array} the store's resolved composition (read `extension_composition`)
 * @param wanted {Array} the blocks this file declares, each with extension_id/component/slot/position
 * @param governed {{ apps: Set<string>, slot: RegExp }} whose blocks, in which slots, this file decides
 */
export function planHome(placements, wanted, governed) {
  const held = new Map();
  for (const row of placements) {
    if (!governed.apps.has(row.extension_id)) continue;
    if (!governed.slot.test(row.target)) continue;
    const key = `${row.extension_id}:${row.component}`;
    if (!held.has(key)) held.set(key, []);
    held.get(key).push(row);
  }

  const taken = new Map();
  const ops = [];
  for (const block of wanted) {
    const key = `${block.extension_id}:${block.component}`;
    const index = taken.get(key) ?? 0;
    taken.set(key, index + 1);
    ops.push({ block, reuse: (held.get(key) ?? [])[index] });
  }

  const remove = [];
  for (const [key, pool] of held) {
    for (const row of pool.slice(taken.get(key) ?? 0)) {
      remove.push({ row, kind: key.replace(':', '/') });
    }
  }

  // ASCENDING position: each `place`/`move` shifts what is at or after it, so filling 0,1,2,3 in that order
  // lands every block on the number it asked for.
  ops.sort((a, b) => a.block.position - b.block.position);
  return { remove, ops };
}

/** Config equality, by value and independent of key order — the kernel echoes back what it stored, and a
 *  seed that re-wrote every placement on every run would churn the audit log for nothing. */
function sameConfig(a, b) {
  const norm = (v) =>
    JSON.stringify(v, (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)))
        : value,
    );
  return norm(a ?? {}) === norm(b);
}

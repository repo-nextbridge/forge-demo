// THE OUTLET STORE, DRIVEN THROUGH THE PORT — the D2 slice's half of this instance's birth data.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, on purpose: this store and the coffee store were filled
// by two slices at the same time, in two worktrees, and two of those in one file is a conflict with a
// stopwatch on it. One store, one file, and the seed keeps deciding the order. It hands this function the
// port it already built (the command caller, the internal read, its logger); nothing here is transport.
//
// EVERYTHING THIS SLICE PROMISED IS IN HERE, AND NONE OF IT IS CODE THE PRODUCT SHIPS:
//   · the apps the composition needs, INSTALLED (`banners`, `shelves`);
//   · the custom fields the eight products' technical sheets are written in, DECLARED before any of them
//     is written — an undeclared key is accepted in silence and then invisible to every reader (the same
//     order, and the same reason, as the coffee catalogue's);
//   · the photographs and the campaign art, through the media door;
//   · the eight products, PUBLISHED into the outlet store and given their stock;
//   · the two collections the two shelves are sourced from;
//   · the four Compose placements that ARE the home: the announcement band, the five-tile banner mosaic
//     and the two shelves.
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
// face is asked first, and what is already there is skipped. Re-running converges and never deletes.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const assets = await uploadMedia(port);
  const products = await seedProducts(port, store, assets);
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
    ...data.shelves.flatMap((s) => (s.banner ? [s.banner] : [])),
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
  // The media face wants the tenant spelled out too (`403 forbidden: "tenant required"` without it,
  // measured) — it is its own adapter, not the command one, so the wrapper above does not reach it.
  const plan = await fetch(`${api}/v1/media/commands/media.request_upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-forge-tenant': tenant,
    },
    body: JSON.stringify({ filename, mime: 'image/jpeg', kind: 'image', size: bytes.byteLength }),
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
    headers: { 'content-type': 'image/jpeg' },
    body: bytes,
  });
  if (!put.ok) fail(`PUT ${filename} → HTTP ${put.status}`);

  const created = await command('asset.create', {
    provider_key: key,
    filename,
    mime: 'image/jpeg',
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
async function seedProducts({ command, readAll, log }, store, assets) {
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
      ids.set(product.handle, already);
      log(`product ${product.handle} — already there`);
      continue;
    }

    const out = await command('catalog.product.create', {
      handle: product.handle,
      title: product.title,
      description: product.description,
      status: 'active',
      options: product.options,
      // ONE PRICE ACROSS THE SIZE GRID, which is what the artboard draws: a card shows one figure struck
      // through and one to pay. The de/por is `compare_at_amount` on the SKU — the operator's own number,
      // not a promotion rule — and the theme's discount tag derives its percentage from the pair.
      skus: product.skus.map((sku, index) => ({
        ...sku,
        amount: product.amount,
        compare_at_amount: product.compare_at_amount,
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
    await setStock({ command }, product, out.sku_ids);
    ids.set(product.handle, out.product_id);
    log(
      `product ${product.handle} — created, published, ${out.sku_ids.length} sku(s) stocked ` +
        `(${(product.compare_at_amount / 100).toFixed(2)} → ${(product.amount / 100).toFixed(2)})`,
    );
  }
  return ids;
}

/** `stock` is a number (every SKU alike) or a list in SKU order — which is how a shoe ends up with two
 *  units in one size and none in the next, and how the second shelf earns the name "Acabando!". */
async function setStock({ command }, product, skuIds) {
  for (const [index, skuId] of skuIds.entries()) {
    const onHand = Array.isArray(product.stock) ? (product.stock[index] ?? 0) : product.stock;
    await command('inventory.set_level', { sku_id: skuId, on_hand: onHand, reason: 'goods_received' });
  }
}

// ── 5. the collections ──────────────────────────────────────────────────────────────────────────────
// The two shelves are sourced from COLLECTIONS rather than from a curated handle list, and the reason is
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
// FOUR PLACEMENTS ARE THE WHOLE PAGE, and that is the thesis of this slice: the Outlet's home is the
// reference vitrine with four rows of configuration in it, and not one line of front-end code.
//
// The slots are the theme's declared ones, in the artboard's order:
//   header.announcement → the band  ·  home.hero → the mosaic  ·  home.banner_strip → "Quase de graça"
//   home.below_shelf → "Acabando!"
// The two sections the reference home draws BELOW these ("Compre por categoria", "Marcas que amamos") are
// theme chrome over core reads, not slots — they render nothing here because this store has neither, and
// that absence is what lets the page end where the artboard ends. See `outlet.json`.
async function compose({ command, read, rows, log }, store, assets) {
  // ⚠️ INSTALLING AN APP ALREADY PLACES ITS DECLARED HOOKS, and the first run of this file learned it the
  // hard way: `extension.install` of `shelves` creates two placements of its own — one per `hooks` entry
  // in its manifest (`home.below_shelf`, `list.below_shelf`) — each with an EMPTY config. So "is there a
  // placement in this slot?" is the wrong question: the answer was yes before the operator did anything,
  // and skipping on it left the "Acabando!" shelf sitting in the page configured with nothing, rendering
  // nothing, with the seed reporting success.
  //
  // The right question is whether the config in that slot is the one this file describes. Absent → place;
  // present and different (an empty default, or an edit to `outlet.json`) → update it; already equal →
  // leave it alone. That is also the operator's own gesture: an app drops its block in and a human then
  // fills the drawer.
  const existing = new Map(
    rows(await read('extension_composition', { store: store.id })).map((row) => [
      `${row.extension_id}:${row.component}:${row.target}`,
      row,
    ]),
  );

  const wanted = [
    {
      extension_id: 'banners',
      component: 'announcement',
      slot: data.announcement.slot,
      config: { text: data.announcement.text },
      what: 'the announcement band',
    },
    {
      extension_id: 'banners',
      component: 'banner',
      slot: data.mosaic.slot,
      config: {
        style: data.mosaic.style,
        // Widths are PERCENTAGES and the block flows the tiles by them: 50 + 25 + 25 fills the first row,
        // the following 50 + 50 wraps to a second. That is the artboard's grid — one tile spanning two of
        // four columns at 300px tall, two single columns beside it, then two half-width tiles at 220 —
        // expressed in the block's own vocabulary instead of in CSS somebody would have had to write.
        media: data.mosaic.media.map((m) => ({
          asset_id: assets.get(m.file).id,
          width: m.width,
          height: m.height,
          ...(m.link ? { link: m.link } : {}),
        })),
      },
      what: `the ${data.mosaic.media.length}-tile mosaic`,
    },
    ...data.shelves.map((shelf) => ({
      extension_id: 'shelves',
      component: 'shelf',
      slot: shelf.slot,
      config: {
        title: shelf.title,
        layout: shelf.layout,
        source: 'collection',
        source_collection: shelf.collection,
        item_count: shelf.item_count,
        ...(shelf.banner ? { banner_asset: assets.get(shelf.banner).id } : {}),
        ...(shelf.banner_link ? { banner_link: shelf.banner_link } : {}),
      },
      what: `the "${shelf.title}" shelf`,
    })),
  ];

  for (const block of wanted) {
    const found = existing.get(`${block.extension_id}:${block.component}:${block.slot}`);
    if (!found) {
      await command('composition.place', {
        store: store.id,
        extension_id: block.extension_id,
        component: block.component,
        slot: block.slot,
        config: block.config,
      });
      log(`compose ${block.slot} — placed ${block.what}`);
      continue;
    }
    if (sameConfig(found.config, block.config)) {
      log(`compose ${block.slot} — ${block.what} is already configured`);
      continue;
    }
    await command('composition.update_config', {
      store: store.id,
      placement_id: found.placement_id,
      config: block.config,
    });
    log(
      `compose ${block.slot} — configured ${block.what}` +
        `${Object.keys(found.config ?? {}).length === 0 ? " (the install's empty default)" : ''}`,
    );
  }
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

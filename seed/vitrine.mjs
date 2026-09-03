// THE FORGE STORE'S SHOP WINDOW — the half the catalogue is not.
//
// S1 filled this store with 2790 products, 33 categories, 351 brands and their photographs, and its home page
// stayed almost empty: `200 · 67.164 B`, zero `<h1>`, two `<h2>` — "Compre por categoria" and "Marcas que
// amamos" — and five images, which are the category icons. Those two sections are THEME CHROME over core reads
// (`read.categories` / `read.brands`), not composition: the storefront's home template draws them whatever the
// merchant did. Everything that makes a home look like a shop is a Compose SLOT, and all five of this store's
// were empty (measured: 7 placements, every one of them the `{}` default an install drops).
//
// So the catalogue arrived and the window did not. This module is the window.
//
// ★ THE CONTENT IS THE DATASET'S, NOT THIS FILE'S — the same rule seed/forge.json writes for the catalogue.
// `storefront.json` declares which banner sits in which slot with which link, which shelf reads which source,
// and the seven institutional pages; `promotions.json` declares the pricing scenarios. This file RESOLVES what
// they name (a banner name to a library asset id, a product handle to a product id) and drives the commands. If
// you find yourself typing a title, a link or a slug in here, you are writing content into the instance's code.
// The two decisions that ARE this instance's — which apps to install, which promotions a SHOP may carry — live
// in `seed/vitrine.json`, declared, with the reasoning next to them.
//
// EVERY WRITE GOES THROUGH THE DOOR. `extension.install`, `media.request_upload` + `asset.create`,
// `composition.place` / `composition.update_config`, `extension.config.set`, `content.page.create`,
// `promotion.create`. No table name, no database credential.
//
// ⚠️ ADDITIVE, AND THE PLATFORM'S OWN SEEDER IS NOT. `placeDemoShelves` (apps/api/src/seed-storefront.ts)
// removes every shelf instance before placing the curated set, so a wipe-and-reseed produces a pristine board
// — right for the box that is rebuilt from zero on a cron. This one runs against a box somebody is testing on,
// so it CONVERGES: it fills the install's empty defaults, appends what is missing, and never removes a row. An
// extra block in a slot is a human's, and deleting a human's block to make a count match is the one thing a
// seed may not do.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogArtDir, DATASET_DIR_ENV, datasetDir } from './forge.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));

/** The instance's own two decisions. It holds no window — see its `_readme`. */
const data = JSON.parse(readFileSync(join(SEED, 'vitrine.json'), 'utf8'));

/**
 * @param port {{ api: string, token: string, tenant: string, command: Function, read: Function,
 *                readAll: Function, publicRead: Function, rows: Function, log: Function, fail: Function,
 *                uploadAsset: Function, resolveMedia: Function }}
 */
export async function seedVitrine(port) {
  const { read, rows, log, fail } = port;

  // The same absence rule seedForge writes, and for the same reason: an instance that mounts no example data
  // has no window to compose and is not misconfigured. Unset is a no-op, never a failure.
  const dir = datasetDir();
  if (!dir) {
    log(`vitrine — no ${DATASET_DIR_ENV}; the sports store's home stays as it is. Legitimate state.`);
    return;
  }
  const pointerPath = join(dir, 'forge-seed-dataset.json');
  if (!existsSync(pointerPath)) fail(`${DATASET_DIR_ENV}=${dir} holds no forge-seed-dataset.json.`);
  const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
  if (pointer.id !== data.dataset) {
    fail(`the mounted dataset is "${pointer.id}" and seed/vitrine.json expects "${data.dataset}".`);
  }

  const windowPath = join(dir, 'storefront.json');
  if (!existsSync(windowPath)) {
    log('vitrine — the dataset declares no storefront.json; nothing to compose.');
    return;
  }
  const declared = JSON.parse(readFileSync(windowPath, 'utf8'));
  const artDir = catalogArtDir(dir);
  const manifestPath = join(artDir, 'catalog-manifest.json');
  if (!existsSync(manifestPath)) fail(`the dataset names no photo manifest at ${manifestPath}.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const store = rows(await read('stores')).find((s) => s.handle === data.store);
  if (!store) fail(`the store "${data.store}" does not exist — it is created by bin/seed.mjs's stores().`);
  log(`vitrine — store ${store.handle} (${store.id}); window from ${windowPath}`);

  const resolve = (key) =>
    port.resolveMedia(key, { namespace: pointer.id, manifest, artDir, photoDir: artDir });

  await installApps(port);
  const assets = await placeBanners(port, declared, resolve);
  await compose(port, store, declared, assets);
  await configureApps(port, store, declared);
  await seedPages(port, store, declared);
  await seedPromotions(port, store, dir);
  await announce(port, store);
  await progressBars(port, store);
  await revalidate(port, store);

  log('vitrine — done. Re-running this is a no-op.');
}

// ── 1. the apps ────────────────────────────────────────────────────────────────────────────────────────
// A block cannot be placed by an app that is not installed, and installing is the operator's own gesture.
//
// ⚠️⚠️ AN INSTALL IS TENANT-WIDE AND ITS DEFAULT PLACEMENTS FAN OUT TO EVERY STORE, which is why this list is
// SHORT and why `recommendations` is not on it. `seedDefaultPlacements` (packages/core/src/commands/
// extension.ts:527) writes one `hook_placement` row per store for each storefront hook the manifest declares,
// so installing an app to fill one store's page also drops its blocks into the two beside it. `banners`
// declares NO hooks and is therefore the safe kind; the whole reasoning, and what is being held back because
// of it, is in seed/vitrine.json's `_apps_why` / `_apps_held`.
async function installApps({ command, read, rows, log }) {
  const installed = new Set(rows(await read('installed_extensions')).map((e) => e.extension_id ?? e.id));
  for (const id of data.apps) {
    if (installed.has(id)) {
      log(`vitrine — app ${id} already installed`);
      continue;
    }
    await command('extension.install', { extension_id: id });
    log(`vitrine — app ${id} installed`);
  }
}

// ── 2. the art ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * The library assets the window's banners reference, by the dataset's own NAME for each.
 *
 * A banner block's media row is an asset REF (`type: 'id'`) — the kernel resolves it to a url at read time
 * exactly as it does a product photo — so this has to hand back asset IDS, and a product photo's bare
 * provider_key is not one. These are the one class of image in this dataset that IS curated inventory a
 * merchant sees in the admin's library, which is why they are `library: true` uploads and the 18582
 * catalogue photographs are not.
 *
 * ★ MEASURED, AND IT IS WHY THIS COSTS ALMOST NOTHING: six of the seven banners this dataset declares are
 * ALREADY in the tenant's library, put there by the Outlet's seed (seed/outlet-media/banners/), and their
 * bytes are identical to the dataset's — sha256, compared file by file. Assets are TENANT-scoped, so this
 * store reuses those rows rather than minting a second copy of the same JPEG under the same name. The reuse
 * is `bin/seed.mjs`'s content index doing its job (same filename + same bytes reuse the key it already has),
 * not a special case written here.
 */
async function placeBanners(port, declared, resolve) {
  const { uploadAsset, readAll, log, fail } = port;

  // Every banner NAME the window references, from both places that reference one.
  const names = [
    ...declared.banners.flatMap((block) => block.media.map((tile) => tile.banner)),
    ...declared.shelves.flatMap((shelf) => (shelf.banner ? [shelf.banner] : [])),
  ];
  const wanted = new Map(); // name -> { desktop: <file>, mobile?: <file> }
  for (const name of names) {
    if (wanted.has(name)) continue;
    const desktop = resolve(`${data.dataset}/banner-${name}.jpg`);
    if (!desktop) {
      fail(
        `the window references a banner named "${name}", which the dataset's photo manifest does not place.\n` +
          '  Refusing rather than composing a tile whose asset ref points at nothing.',
      );
    }
    // Absent is the block's own contract, not an error: a blank `asset_id_mobile` means the desktop art is
    // used at narrow widths. Three of this dataset's seven banners ship no `-M`.
    wanted.set(name, { desktop, mobile: resolve(`${data.dataset}/banner-${name}-M.jpg`) });
  }

  const byFilename = (list) => new Map(list.filter((a) => a.filename).map((a) => [a.filename, a]));
  let library = byFilename(await readAll('assets'));
  const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);

  let uploaded = 0;
  let files = 0;
  for (const banner of wanted.values()) {
    for (const file of [banner.desktop, banner.mobile]) {
      if (!file) continue;
      files += 1;
      if (library.has(nameOf(file))) continue;
      await uploadAsset(file);
      uploaded += 1;
    }
  }
  // ONE re-read, and only when something was actually put there: `upload()` hands back the provider_key it
  // minted, and a banner tile needs the asset ROW's id. Asking the library again is the honest way to learn
  // it, and it costs one read for a run that uploaded nothing at all.
  if (uploaded > 0) library = byFilename(await readAll('assets'));

  const assets = new Map();
  for (const [name, banner] of wanted) {
    const idOf = (file) => {
      if (!file) return undefined;
      const found = library.get(nameOf(file));
      if (!found) fail(`banner "${name}": ${nameOf(file)} was uploaded and the library does not list it.`);
      return found.id;
    };
    assets.set(name, { id: idOf(banner.desktop), mobileId: idOf(banner.mobile) });
  }
  log(`vitrine — ${wanted.size} banner(s), ${files} file(s): ${uploaded} uploaded, ${files - uploaded} already in the library`);
  return assets;
}

// ── 3. the home ────────────────────────────────────────────────────────────────────────────────────────
// The slots, in the order the home template draws them (apps/storefront/src/templates/home/template.tsx):
//   home.hero -> the carousel · home.banner_strip -> NOTHING (see below) · home.below_shelf -> two shelves ·
//   [Compre por categoria] · home.below_categories -> the mosaic · [Marcas que amamos] · home.below_brands ->
//   one shelf. Plus `list.below_shelf`, which is the PLP's, not the home's.
//
// ⚠️ `home.banner_strip` STAYS EMPTY AND THAT IS THE DATASET, NOT A BUG. `storefront.json` declares nothing
// for it. The three `banner-strip-*-1200x150.jpg` files sitting in the dataset's banner folder are listed in
// the manifest as `categoryBanners` — they are the wide strips a CATEGORY page carries, and S1 already placed
// them on `acessorios`, `sandalias` and `tenis`. Putting one in the home's strip would be this file inventing
// content. It is named in the slice report instead, which is what the brief asked for.
async function compose(port, store, declared, assets) {
  const { command, read, rows, log } = port;
  const existing = rows(await read('extension_composition', { store: store.id }));

  const tile = (media) => {
    const art = assets.get(media.banner);
    return {
      asset_id: art.id,
      ...(art.mobileId ? { asset_id_mobile: art.mobileId } : {}),
      ...(media.width === undefined ? {} : { width: media.width }),
      ...(media.height === undefined ? {} : { height: media.height }),
      ...(media.duration === undefined ? {} : { duration: media.duration }),
      ...(media.link === undefined ? {} : { link: media.link }),
    };
  };

  const wanted = [
    ...declared.banners.map((block) => ({
      extension_id: 'banners',
      component: 'banner',
      slot: block.slot,
      config: { style: block.style, media: block.media.map(tile) },
      what: `the ${block.style} of ${block.media.length}`,
    })),
    ...declared.shelves.map((shelf) => ({
      extension_id: 'shelves',
      component: 'shelf',
      slot: shelf.slot,
      // The shelf's config is the app's OWN vocabulary and travels untouched — the platform does not read an
      // app's config and neither does this file. Only the promo banner is resolved, because a name is not an id.
      config: {
        ...shelf.config,
        ...(shelf.banner ? { banner_asset: assets.get(shelf.banner).id } : {}),
      },
      what: `the "${shelf.config.title}" shelf`,
    })),
  ];

  let placed = 0;
  let configured = 0;
  for (const step of planPlacements(wanted, existing)) {
    const { block } = step;
    if (step.action === 'skip') {
      log(`vitrine — ${block.slot}: ${block.what} is already configured`);
      continue;
    }
    if (step.action === 'place') {
      // NO `position`. Absent means APPEND after the slot's current instances; an explicit one SHIFTS every
      // instance at or below it down by one (packages/core/src/commands/composition.ts, `openPosition`), which
      // would renumber a human's blocks to say what this file already means by ordering its own list.
      await command('composition.place', {
        store: store.id,
        extension_id: block.extension_id,
        component: block.component,
        slot: block.slot,
        config: block.config,
      });
      placed += 1;
      log(`vitrine — ${block.slot}: placed ${block.what}`);
      continue;
    }
    await command('composition.update_config', {
      store: store.id,
      placement_id: step.placement_id,
      config: block.config,
    });
    configured += 1;
    log(
      `vitrine — ${block.slot}: configured ${block.what}` +
        (step.wasEmpty ? " (the install's empty default)" : ''),
    );
  }
  log(`vitrine — home: ${placed} block(s) placed, ${configured} configured, ${wanted.length} total`);
}

/**
 * Which command each wanted block needs, given what the store already carries.
 *
 * ★★ THE MATCH IS POSITIONAL WITHIN A SLOT, AND THAT IS THE WHOLE DESIGN. seed/outlet.mjs indexes what is
 * already placed by `${extension_id}:${component}:${target}`, and it is correct there because the Outlet's
 * four blocks happen to sit in four different slots. This dataset puts TWO shelves in
 * `storefront:home.below_shelf` — under that key the second one finds the first one's row, reads it as "there,
 * but configured differently", and overwrites it. One shelf, and a seed reporting success.
 *
 * So a slot holds a LIST: the Nth wanted block in a slot pairs with the Nth existing instance in it, ordered
 * by `position` (the read does not promise that order, and pairing by arrival would make two shelves swap
 * configs with each other on every re-run). Beyond the Nth, there is nothing to pair with and the block is
 * placed — appended, which is exactly where the declaration says it goes.
 *
 * Rows the wanted list does not reach are LEFT ALONE. They are a human's.
 */
export function planPlacements(wanted, existing) {
  const key = (extensionId, component, slot) => `${extensionId} ${component} ${slot}`;
  const bySlot = new Map();
  for (const row of existing) {
    const k = key(row.extension_id, row.component, row.target);
    if (!bySlot.has(k)) bySlot.set(k, []);
    bySlot.get(k).push(row);
  }
  for (const list of bySlot.values()) list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const taken = new Map();
  return wanted.map((block) => {
    const k = key(block.extension_id, block.component, block.slot);
    const index = taken.get(k) ?? 0;
    taken.set(k, index + 1);
    const found = bySlot.get(k)?.[index];
    if (!found) return { action: 'place', block };
    if (sameConfig(found.config, block.config)) return { action: 'skip', block };
    return {
      action: 'update',
      block,
      placement_id: found.placement_id,
      wasEmpty: Object.keys(found.config ?? {}).length === 0,
    };
  });
}

/**
 * Config equality by VALUE, at every depth, with list ORDER preserved.
 *
 * Key order is the kernel's echo and means nothing; order inside `media` is the carousel's slide order and
 * means everything. A comparison that normalises only the outer object rewrites every banner on every run
 * (one audit row per run, forever) or misses a re-pointed asset — the two failures are the same bug read from
 * either side.
 *
 * ⚠️ A NEAR-COPY OF `sameConfig` IN seed/outlet.mjs, and deliberately not a shared import. That one is not
 * exported and the Outlet's window is not this slice's to touch; eight lines duplicated is cheaper than a
 * refactor of a store somebody is testing. If a third store needs it, that is when it moves.
 */
export function sameConfig(a, b) {
  const norm = (value) =>
    JSON.stringify(value, (_key, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)))
        : v,
    );
  return norm(a ?? {}) === norm(b ?? {});
}

// ── 4. the apps' own settings ──────────────────────────────────────────────────────────────────────────
// Two numbers the dataset declares that live in an app's config rather than in a placement: how many products
// a shelf shows (and its ceiling), and how many the PDP's "related" block does. `extension.config.set` is the
// one command that owns an app's legible config; the related count is a PLACEMENT config instead, because that
// block is repeatable and each instance carries its own.
async function configureApps(port, store, declared) {
  const { command, read, rows, log } = port;
  const counts = declared.shelf_settings;
  if (counts) {
    await command('extension.config.set', {
      extension_id: 'shelves',
      values: { item_count_default: counts.item_count_default, item_count_max: counts.item_count_max },
    });
    log(`vitrine — shelves: ${counts.item_count_default} products per shelf (max ${counts.item_count_max})`);
  }
  if (declared.related_item_count === undefined) return;
  // `recommendations` auto-places an EMPTY `related` instance on install; this is what would fill it.
  //
  // ⚠️ THE READ IS SCOPED TO THIS STORE AND IT IS NOT OPTIONAL — `read.internal.extension_composition` REFUSES
  // a call without one (`invalid_params: expected string, received undefined`, measured on the first run of
  // this file). A composition is a store's, and there is no tenant-wide answer to ask it for.
  //
  // Absent — which is the state this bench is in, because the app is deliberately held out of `apps` (see
  // seed/vitrine.json's `_apps_held`) — is SAID in a line. A dataset number that goes unapplied has to be
  // visible; a silent skip is how it stays unapplied for three slices.
  const related = rows(await read('extension_composition', { store: store.id })).find(
    (row) => row.extension_id === 'recommendations' && row.component === 'related',
  );
  if (!related) {
    log(
      `vitrine — the dataset asks for ${declared.related_item_count} related products on the PDP and this ` +
        'store has no `recommendations:related` instance. NOT APPLIED — see seed/vitrine.json `_apps_held`.',
    );
    return;
  }
  const config = { source: 'category', item_count: declared.related_item_count };
  if (sameConfig(related.config, config)) {
    log(`vitrine — related: already ${declared.related_item_count} products`);
    return;
  }
  await command('composition.update_config', {
    store: store.id,
    placement_id: related.placement_id,
    config,
  });
  log(`vitrine — related: ${declared.related_item_count} products on the PDP`);
}

// ── 5. the institutional pages ─────────────────────────────────────────────────────────────────────────
// Seven of them plus the QA draft, and the store had ZERO — every footer link pointed at nothing (measured:
// `read.internal.pages` answered `total: 0`).
//
// ⚠️ THE DATASET DECLARES A TITLE AND A TEMPLATE, NEVER A BODY. The text comes from the storefront's own
// template for that `template_key`; there is no prose in `storefront.json` and none is invented here. That is
// a real limit of the dataset and it is named in the slice report.
async function seedPages(port, store, declared) {
  const { command, readAll, log } = port;
  const pages = [
    ...(declared.pages ?? []),
    ...(declared.qa_draft_page ? [declared.qa_draft_page] : []),
  ];
  if (pages.length === 0) return;
  // ⚠️⚠️ THE `store` PARAM IS IGNORED BY THIS READ AND THE ROWS PROVE IT — measured on this bench, `read.
  // internal.pages?store=<cafe>` answered 200 with EIGHT pages, every one of them carrying
  // `store_id: <forge>`. It is the exact twin of the defect bin/seed.mjs's `publicRead` was written for
  // (`read.internal.products?store=` answering the whole tenant), and the same shape: a read that answers a
  // DIFFERENT question than the one asked, silently, with no way for the caller to tell.
  //
  // So the filter is done HERE, on the `store_id` the row carries. Trusting the param would be safe on this
  // box only by luck — no other store has a page — and would stop being safe the first time the coffee shop
  // gets a `sobre`: this seed would then read "already there" and never create the sports store's.
  const have = new Set(
    (await readAll('pages', { store: store.id }))
      .filter((page) => page.store_id === store.id)
      .map((page) => page.slug),
  );
  let created = 0;
  for (const page of pages) {
    if (have.has(page.slug)) continue;
    await command('content.page.create', {
      store_id: store.id,
      slug: page.slug,
      title: page.title,
      template_key: page.template_key,
      published: page.published ?? true,
    });
    created += 1;
  }
  log(`vitrine — pages: ${created} created, ${pages.length - created} already there`);
}

// ── 6. the promotions ──────────────────────────────────────────────────────────────────────────────────
/**
 * The merchandising subset of the dataset's pricing bench — see `seed/vitrine.json`, which names both the four
 * that are applied and the twelve that are not, with why.
 *
 * ⚠️⚠️ EVERY ONE IS SCOPED TO THIS STORE, and forgetting that is not a small mistake on this box.
 * `promotion.create` takes a NULLABLE `store_id`, and null means the whole tenant: a 15%-off-with-Pix created
 * without it would discount the coffee shop and the Outlet, which never asked for it. The platform's own bench
 * runner (apps/api/scripts/seed-promotions.ts) omits `store_id` — right for the single-store instance it was
 * written against, wrong for this one's three. seed/coffee.mjs passes it, and this follows that precedent.
 *
 * IDEMPOTENT BY NAME, the same key the platform's runner uses, and the lookup is tenant-wide because
 * `promotions_admin` is: two stores may not carry the same promotion NAME, which is what makes the name a key.
 */
async function seedPromotions(port, store, dir) {
  const { command, readAll, publicRead, log, fail } = port;
  const path = join(dir, 'promotions.json');
  if (!existsSync(path)) {
    log('vitrine — the dataset declares no promotions.json; nothing priced.');
    return;
  }
  const chosen = selectPromotions(JSON.parse(readFileSync(path, 'utf8')), data.promotions.apply, fail);

  const products = new Map();
  const productOf = async (handle) => {
    if (products.has(handle)) return products.get(handle);
    // The PUBLIC read, on purpose: it is the only one that answers "is this on sale in THIS store?", and a
    // promotion on something nobody can buy is a promotion that never fires. Same reasoning as forge.mjs's
    // publish check, which learned it the hard way.
    const doc = await publicRead('product.by_handle', { store: store.id, handle });
    if (!doc?.product_id) {
      fail(`promotion target "${handle}" is not published in this store — cannot promote what nobody can buy.`);
    }
    products.set(handle, doc);
    return doc;
  };

  const existing = new Map((await readAll('promotions_admin')).map((p) => [p.name, p]));
  let created = 0;
  let already = 0;
  for (const scenario of chosen) {
    const found = existing.get(scenario.name);
    if (found) {
      // Left ALONE, not updated. The platform's bench runner re-asserts the declared shape on every run
      // because the bench is its own; here the promotion may have been paused or edited from the admin by
      // whoever is testing, and re-writing it would undo their move under them.
      log(`vitrine — promotion "${scenario.name}" already there (${found.id})`);
      already += 1;
      continue;
    }

    // The gift is the one benefit an instance cannot declare completely: `sku_id` is minted by the store being
    // seeded, so the dataset names a product HANDLE and this resolves it.
    let benefit = scenario.benefit;
    if (benefit.kind === 'gift') {
      const items = [];
      for (const item of benefit.items) {
        const doc = await productOf(item.handle);
        const sku = doc.skus?.find((s) => s.status === 'active') ?? doc.skus?.[0];
        if (!sku) fail(`gift product "${item.handle}" has no sellable SKU.`);
        items.push({ sku_id: sku.id, qty: item.qty ?? 1 });
      }
      benefit = { ...benefit, items };
    }

    let target = { kind: 'all' };
    if (scenario.product) {
      target = { kind: 'products', product_ids: [(await productOf(scenario.product)).product_id] };
    } else if (scenario.category) {
      const category = await publicRead('category.by_path', { store: store.id, path: scenario.category });
      if (!category?.category_id) fail(`promotion category "${scenario.category}" is not in this store.`);
      target = { kind: 'categories', category_ids: [category.category_id] };
    }

    // Born ACTIVE, like seed/coffee.mjs's and unlike the command's own default: a draft promotion is a shop
    // that prints a discount on the product page and charges full price at the till.
    await command('promotion.create', {
      name: scenario.name,
      label: scenario.label,
      store_id: store.id,
      benefit,
      target,
      conditions: scenario.conditions ?? [],
      stackable: scenario.stackable ?? false,
      trigger: scenario.trigger ?? 'automatic',
      show_progress: scenario.show_progress ?? false,
      status: 'active',
    });
    created += 1;
    log(`vitrine — promotion "${scenario.name}" created — ${scenario.label}`);
  }
  log(
    `vitrine — promotions: ${created} created, ${already} already there, ` +
      `${Object.keys(data.promotions._excluded).length} of the bench left out by name (seed/vitrine.json)`,
  );
}

/**
 * The scenarios this shop carries, in the DATASET's order, and a LOUD failure for a name the dataset no longer
 * has.
 *
 * ⚠️ THAT GUARD IS THE POINT OF THE FUNCTION. An allow-list of names is correct the day it is written and has
 * no moment at which it stops being correct: rename a scenario upstream and a plain `filter` selects one fewer
 * promotion — the shop silently loses a discount and every exit code stays 0.
 */
export function selectPromotions(declared, allow, fail) {
  const known = new Set(declared.map((p) => p.name));
  const gone = allow.filter((name) => !known.has(name));
  if (gone.length > 0) {
    fail(
      `seed/vitrine.json names promotion(s) the dataset no longer declares: ${gone.join(', ')}.\n` +
        '  Refusing to silently seed a shorter list — an allow-list of names rots, and this is that moment.',
    );
  }
  const wanted = new Set(allow);
  return declared.filter((p) => wanted.has(p.name));
}

// ── 6b. the announcement band ──────────────────────────────────────────────────────────────────────────
/**
 * ★★ THE FIRST LINE OF THE SHOP, AND THE NUMBER IN IT IS READ OFF THE PROMOTION.
 *
 * His instruction was one clause: *"no storefront sapato coloca uma frase: Frete grátis para compras acima
 * de… SÓ CONFERE SE EXISTE ALGUMA PROMO DE FRETE GRÁTIS."* The whole slice is in the second half. A band is
 * a promise on the first line of every page; if the kernel does not keep it, it is advertising that passes
 * every green test in the repository, because nothing anywhere compares a sentence to a price.
 *
 * ⇒ SO NOTHING HERE IS TYPED AND NOTHING HERE IS POLICED. `seed/vitrine.json` holds the SENTENCE with a
 * `{floor}` in it; this reads the floor off the promotion that actually zeroes the freight; and a store with
 * no such promotion GETS NO BAND. That is the honest failure mode: silence, rather than a promise nobody
 * keeps.
 *
 * ⛔ THE GUARD THAT WOULD CHECK THE SENTENCE AGAINST THE PROMOTIONS WAS PROPOSED AND REFUSED (02/09): *"esse
 * guard não faz muito sentido, essa barra não é um campo livre no app?"* — it is. The band is a free-text
 * field of the `banners` app, written by a merchant in Compose, and a merchant may write what they like in
 * their own shop. Validating commercial copy in the kernel is the customisation-in-the-core mistake wearing
 * a safety vest. Deriving is the answer; watching is not.
 *
 * ⚠️ IT RUNS IN THE **WINDOW** PHASE, AND THAT IS LOAD-BEARING: the promotion it reads is created by the
 * one-shot (`dist/seed-history.js`) that runs BETWEEN the two phases. In the curated phase this store has no
 * uncapped free shipping yet and the band would correctly, and uselessly, not be placed.
 */
async function announce(port, store) {
  const { command, read, rows, log } = port;
  const declared = data.announcement;
  if (!declared) {
    log('vitrine — seed/vitrine.json declares no announcement band; the header stays as it is');
    return;
  }

  const floor = await freeShippingFloorOfStore({ read, rows }, store);
  if (floor === null) {
    log(
      'vitrine — NO BAND PLACED: this store carries no active promotion that actually zeroes the freight\n' +
        '        (uncapped `free_shipping`, no method restriction, with a `min_subtotal`). A shop that\n' +
        '        cannot keep the promise does not make it.',
    );
    return;
  }

  const text = declared.free_shipping_text.replace('{floor}', brl(floor));
  const existing = rows(await read('extension_composition', { store: store.id })).find(
    (row) =>
      row.extension_id === 'banners' &&
      row.component === 'announcement' &&
      row.target === declared.slot,
  );
  if (!existing) {
    await command('composition.place', {
      store: store.id,
      extension_id: 'banners',
      component: 'announcement',
      slot: declared.slot,
      config: { text },
    });
    log(`vitrine — ${declared.slot}: placed the announcement band — "${text}"`);
    return;
  }
  if (existing.config?.text === text) {
    log(`vitrine — ${declared.slot}: the announcement band already says "${text}"`);
    return;
  }
  await command('composition.update_config', {
    store: store.id,
    placement_id: existing.placement_id,
    config: { text },
  });
  log(`vitrine — ${declared.slot}: the announcement band now says "${text}"`);
}

/**
 * ★ THE FLOOR ABOVE WHICH THE FREIGHT IS REALLY ZERO, in cents, or null.
 *
 * ⚠️ THE SELECTION IS ON THE BENEFIT AND NEVER ON A NAME, and this store is exactly why. It carries two
 * active free-shipping promotions written by two authors: `PROMO-06-FREE-SHIPPING-CAPPED` (floor R$ 300,00,
 * **covers at most R$ 10,00**) and `DEMO-HIST-01-FORGE` (floor R$ 299,00, **no cap**). Only the second is
 * free shipping in the sense a shopper means it; a sentence written off the first would be false for any
 * freight over ten reais. See seed/vitrine.json's `_why_two_freights`.
 *
 * Three conditions, and each one is a way the promise can be false:
 *   · `max_covered_amount` set  → the shopper pays the difference;
 *   · `shipping_method_ids` non-empty → free on SOME carriers, which the sentence does not say;
 *   · no `min_subtotal` → there is no "acima de" to print.
 * The LOWEST qualifying floor wins: it is the cheapest threshold the shop actually honours.
 *
 * A tenant-wide promotion (`store_id: null`) counts, because it reaches this store too.
 */
export function freeShippingFloor(promotions, storeId) {
  const floors = (promotions ?? [])
    .filter(
      (p) =>
        p?.state === 'active' &&
        p?.benefit?.kind === 'free_shipping' &&
        (p.benefit.max_covered_amount ?? null) === null &&
        (p.benefit.shipping_method_ids ?? []).length === 0 &&
        (p.store_id === storeId || p.store_id === null || p.store_id === undefined),
    )
    .map((p) => (p.conditions ?? []).find((c) => c?.kind === 'min_subtotal')?.amount)
    .filter((amount) => Number.isInteger(amount) && amount > 0);
  return floors.length === 0 ? null : Math.min(...floors);
}

/** Money is CENTS everywhere in this kernel; a shop window says reais. Centavos are printed only when there
 *  are any — "R$ 299" is what a person writes, "R$ 299,00" is what a spreadsheet writes. */
export function brl(cents) {
  const reais = Math.trunc(cents / 100);
  const rest = cents % 100;
  const thousands = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rest === 0 ? `R$ ${thousands}` : `R$ ${thousands},${String(rest).padStart(2, '0')}`;
}

/**
 * The tenant's promotions with their CONDITIONS attached.
 *
 * ⚠️ TWO READS, BECAUSE THE LIST DOES NOT CARRY THE CONDITIONS. `read.internal.promotions_admin` answers the
 * benefit, the target and the derived state — everything the operator's list column shows — and NOT
 * `conditions` (where `min_subtotal` lives), `store_id` or `show_progress`. `read.internal.promotion_admin`
 * (singular) spreads the whole row. So the list narrows the candidates by benefit and the detail is asked
 * only of those, which on this box is one or two rows rather than a fan-out.
 *
 * ⚠️ THE NARROWING IS `free_shipping` AND NOTHING MORE, and the missing clause was a defect (p1-3). It used
 * to drop the CAPPED and method-restricted rows here, because the only caller wanted the promotion that
 * zeroes the freight — and `freeShippingFloor` re-applies exactly that filter anyway. The second caller
 * (`planProgressBars`) needs the ones this shop must NOT advertise, and a read that had already thrown them
 * away could only conclude that everything was fine. Narrow at the decision, never at the read.
 *
 * ⚠️ AND IT PAGES BY `offset`, NOT BY `page`: `promotions_admin` takes `limit`/`offset` and IGNORES a `page`
 * parameter, so the shared `readAll` would ask for the same first page forever. Harmless at eight
 * promotions, silently duplicating at a hundred and one.
 */
async function freightPromotions({ read, rows }, storeId) {
  const list = [];
  for (let offset = 0; offset <= 10_000; offset += 100) {
    const payload = await read('promotions_admin', { limit: 100, offset });
    const batch = rows(payload);
    list.push(...batch);
    if (batch.length < 100) break;
    const total = Number(payload?.total);
    if (Number.isFinite(total) && list.length >= total) break;
  }
  const candidates = list.filter((p) => p?.state === 'active' && p?.benefit?.kind === 'free_shipping');
  const detailed = [];
  for (const item of candidates) {
    const detail = await read('promotion_admin', { promotion_id: item.id });
    if (detail) detailed.push({ ...item, ...detail });
  }
  return detailed;
}

async function freeShippingFloorOfStore(port, store) {
  return freeShippingFloor(await freightPromotions(port, store.id), store.id);
}

// ── 6c. WHICH FREIGHT PROMISE THE CART'S PROGRESS BAR ANNOUNCES ────────────────────────────────────────
/**
 * ⛔ p1-3, MEASURED ON THE BENCH 2026-09-03 — THE SHOP MADE TWO FREIGHT PROMISES AND THE CART ANNOUNCED THE
 * WEAKER ONE, WHICH WAS ALSO THE ONE WITH THE HIGHER FLOOR.
 *
 * The band on the first line said *"Frete grátis acima de R$ 299"* — correct, derived by `announce` above.
 * The bar in the minicart and the checkout said *"Faltam R$ 20,10 para Frete com desconto de até R$ 10,00"*,
 * closing at R$ 300,00. A shopper reading the two together is told the shop has one rule and then shown a
 * different, meaner one; and at R$ 559,80 the Entrega Padrão did come out **Grátis**, so the free shipping
 * the bar never mentioned is the rule the till actually applies.
 *
 * ★ NOBODY CHOSE THIS. The bar draws every promotion the merchant flagged with `show_progress`
 * (`packages/storefront-kit/src/components/promo/ThresholdProgress.tsx`: the engine decides which ones
 * qualify, the front only draws them, and it deliberately does not truncate). The flag arrived from the
 * DATASET's pricing bench, where `PROMO-06-FREE-SHIPPING-CAPPED` carries it — a sensible thing to demonstrate
 * on a bench with one freight rule, and a false sentence in a shop that grew a second one from the kernel's
 * own history seed (`DEMO-HIST-01-FORGE`, floor R$ 299, no cap). `seed/vitrine.json`'s `_why_two_freights`
 * saw the pair coming and left the flag where it was; this is the half it left open.
 *
 * ⇒ SO THE FLAG IS DERIVED FROM THE BENEFIT, exactly like the band's floor, and by the SAME predicate: the
 * promise a shop may put in front of a shopper is the one it actually keeps. A capped or method-restricted
 * free shipping is not free shipping in the sense the sentence means, so it may not carry the bar; the
 * uncapped one at the lowest floor must, because a threshold nobody is told they are approaching is a
 * capability the shop is paying for and hiding.
 *
 * ⛔ AND IT IS DERIVED RATHER THAN WATCHED. A guard over the bar's copy was proposed and REFUSED (02/09,
 * see `announce` above): the label is the merchant's free text and policing it in the product is the
 * customisation-in-the-core mistake. What a seed may do is set the shop's own data so the sentence that gets
 * drawn is true.
 *
 * ⚠️ IT RE-ASSERTS ON EVERY RUN, unlike `seedPromotions` (which leaves an existing promotion alone so an
 * operator's pause is not undone). The posture is `announce`'s, and the reason is the same: this is not a
 * merchant's editorial choice being overwritten but a promise being kept consistent with the price. An
 * operator who wants the capped bar back turns it on after the seed, as they would any other setting.
 *
 * ⚠️ AND IT RUNS IN THE **WINDOW** PHASE, after the one-shot that creates the uncapped promotion. In the
 * curated phase there is nothing to raise and the capped bar would be correctly left standing.
 */

/**
 * The bars this store should be drawing, against the ones it is.
 *
 * Pure: the promotions in, two lists out — `raise` (must show progress and does not) and `lower` (shows
 * progress and may not). Only FREIGHT promotions are considered: a gift-over-a-threshold bar is a different
 * promise, with nothing to contradict, and this must not touch it.
 *
 * A promotion with no `min_subtotal` has no threshold to draw and is invisible to the bar either way, so it
 * is neither raised nor lowered. A tenant-wide promotion (`store_id: null`) reaches this store and counts.
 */
export function planProgressBars(promotions, storeId) {
  const floorOf = (p) => (p.conditions ?? []).find((c) => c?.kind === 'min_subtotal')?.amount;
  const freights = (promotions ?? []).filter(
    (p) =>
      p?.state === 'active' &&
      p?.benefit?.kind === 'free_shipping' &&
      (p.store_id === storeId || p.store_id === null || p.store_id === undefined) &&
      Number.isInteger(floorOf(p)) &&
      floorOf(p) > 0,
  );
  // The same three conditions `freeShippingFloor` names, because it is the same question: is this promise
  // "frete grátis" in the sense a person reading it means?
  const keeps = freights.filter(
    (p) =>
      (p.benefit.max_covered_amount ?? null) === null &&
      (p.benefit.shipping_method_ids ?? []).length === 0,
  );
  // The cheapest threshold the shop honours — and `id` breaks a tie so two runs of this seed agree.
  const announced =
    [...keeps].sort((a, b) => floorOf(a) - floorOf(b) || String(a.id).localeCompare(String(b.id)))[0] ??
    null;

  const raise = announced && announced.show_progress !== true ? [describe(announced)] : [];
  // ★ NOTHING IS LOWERED UNTIL SOMETHING TRUER EXISTS. A capped bar is not a lie on its own — it draws the
  // promotion's OWN label ("Frete com desconto de até R$ 10,00"), which is exactly what that rule gives. What
  // was measured is a CONTRADICTION: a shop keeping a better promise elsewhere while the cart advertises the
  // weaker one. In a shop with no better promise, taking this bar away deletes the only threshold a shopper
  // is told they are approaching — a capability removed under cover of a correction.
  const lower = !announced
    ? []
    : freights.filter((p) => p.show_progress === true && p.id !== announced.id).map((p) => describe(p));
  return { raise, lower };

  function describe(p) {
    const capped = (p.benefit.max_covered_amount ?? null) !== null;
    const partial = (p.benefit.shipping_method_ids ?? []).length > 0;
    return {
      id: p.id,
      name: p.name,
      label: p.label,
      floor: floorOf(p),
      why: capped
        ? `it covers at most ${brl(p.benefit.max_covered_amount)} of the freight`
        : partial
          ? 'it is free on some shipping methods only'
          : announced && p.id !== announced.id
            ? `"${announced.label}" zeroes the freight from ${brl(floorOf(announced))}`
            : 'it is the promise this shop actually keeps',
    };
  }
}

async function progressBars(port, store) {
  const { command, read, rows, log } = port;
  const { raise, lower } = planProgressBars(await freightPromotions({ read, rows }, store.id), store.id);
  if (raise.length === 0 && lower.length === 0) {
    log("vitrine — freight progress bar: already on the promotion this shop keeps; nothing to change");
    return;
  }
  for (const p of lower) {
    await command('promotion.update', { promotion_id: p.id, show_progress: false });
    log(`vitrine — "${p.name}" no longer draws a progress bar: ${p.why}`);
  }
  for (const p of raise) {
    await command('promotion.update', { promotion_id: p.id, show_progress: true });
    log(`vitrine — "${p.name}" now draws the cart's progress bar — ${p.why}, from ${brl(p.floor)}`);
  }
}

// ── 7. the cache ───────────────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ A PLACEMENT DRIVEN THROUGH THE PORT NEEDS A CACHE BUST, and without this the proof of this whole module
 * is a render from before it ran. The admin calls the storefront's revalidation hook when an operator saves a
 * block; a script driving `composition.place` does not, so the page keeps its ISR render until the TTL. The
 * README already documents the curl; a seed that composes a home and then leaves the shop showing the old one
 * is a seed that needs a footnote to be true.
 *
 * No secret means a LINE, never a failure: the box may legitimately run without one, and the composition
 * landed either way. The human is told exactly what is now stale.
 */
async function revalidate({ api, log }, store) {
  const secret = (process.env.FORGE_REVALIDATE_SECRET ?? '').trim();
  if (secret === '') {
    log(
      'vitrine — no FORGE_REVALIDATE_SECRET: the home is composed and the STOREFRONT still serves its cached\n' +
        `        render until the TTL. Bust it with the curl in the README (tags extensions:${store.id} and store:${store.id}).`,
    );
    return;
  }
  const res = await fetch(`${api}/api/revalidate?tag=extensions:${store.id}&tag=store:${store.id}`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret },
  });
  log(
    res.ok
      ? 'vitrine — storefront cache busted; the composed home is what the next request gets'
      : `vitrine — revalidate answered HTTP ${res.status}. The composition landed; the page is stale until the TTL.`,
  );
}

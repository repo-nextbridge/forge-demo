// THE FORGE STORE — the sports shop, filled from the PLATFORM'S EXAMPLE DATASET, through the port.
//
// The sibling modules of this directory carry their own content: `seed/catalog.json` holds six coffees,
// `seed/outlet.json` holds eight outlet products, and each is small enough to read. This store is not that
// shape. Its catalogue is the demo dataset the platform curates — 33 categories, 351 brands, 2790 products,
// 44427 SKUs and 18582 photographs — and it is NOT copied into this repository.
//
// ★ WHY IT IS NOT COPIED, and the decision is deliberate (S1, 2026-09-01, measured before it was taken).
//
// The obvious alternative is "a customer's catalogue is their own data, so commit it here". Measured, that
// alternative does not deliver what it promises: `instances/demo/dataset/` is 41 MB of catalogue and shared
// art, and the 3.6 GB of per-product photographs are GIT-IGNORED in the monorepo too
// (`instances/demo/dataset/assets/catalog/.gitignore`). They live in a public bucket and are pulled on
// demand. So committing the dataset here would pay 41 MB of repository weight AND still depend on the same
// bucket for the half that actually matters — the pictures.
//
// So the dataset arrives by PATH, and the path is configuration:
//
//     FORGE_SEED_DATASET_DIR=<monorepo>/instances/demo/dataset  node bin/seed.mjs
//
// That is the same gesture `bin/build-local.sh <path to the forge monorepo>` already asks of whoever runs
// this box before the demo has content of its own, and the same variable NAME the platform's own seeder
// reads (`docker-compose.yml`'s FORGE_SEED_DATASET_DIR / FORGE_SEED_DATASET_HOST_DIR pair). One vocabulary,
// not a second one invented here.
//
// ⚠️ UNSET IS A NO-OP, NOT A FAILURE. A clone of this repository with no monorepo beside it still seeds the
// coffees and the outlet; this module writes one line saying the sports store stays empty and returns. That
// is the platform's own absence rule (`packages/seed-dataset/src/pointer.ts`), and it is the right answer:
// an instance that mounts no example data has nothing to seed and is not misconfigured.
//
// ⚠️ WHY NOT THE PLATFORM'S OWN SEEDER, which exists and does all of this in-process. Two measured reasons,
// both about THIS box and neither about the code being wrong:
//   1. it cannot be aimed. `demo-data`'s populate picks its store as `handle === 'demo-store'` ?? `stores[0]`
//      (extensions/demo-data/ledger.ts:46,56), and `stores[0]` is `order by created_at` — on this box that
//      is `outlet`. Running it here would publish 2790 products into the store somebody is testing.
//   2. aiming it means changing the app, which means rebuilding the kernel image — and `forge.lock` says the
//      running image was built from `d2/onda1@da4172de4`, behind this branch. Seeding must not move the
//      binary that is serving the box.
// Both are written up in the slice report; neither is fixed here, because fixing them is a platform slice.
//
// EVERY WRITE GOES THROUGH THE DOOR, like everything else in this directory: this file knows no table name
// and holds no database credential. It drives `catalog.category.create`, `catalog.brand.create`,
// `media.request_upload`, `catalog.product.create`, `inventory.adjust` and `catalog.product.publish_bulk`.
//
// IDEMPOTENT, AND KEYED TO THE PUBLICATION. A product that is ON SALE in the store is complete: it was
// created, stocked and published, in that order, by a previous run. So the store's published list is the
// skip set, and a second run issues no write at all. A product that exists in the tenant but is NOT
// published is a run that died halfway; it is stocked and published again, which heals it. That ordering is
// the whole of the idempotence, and it is why stock comes BEFORE publish.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));

/** The one file that decides anything here. It holds no catalogue — see its own `_readme`. */
const data = JSON.parse(readFileSync(join(SEED, 'forge.json'), 'utf8'));

export const DATASET_DIR_ENV = 'FORGE_SEED_DATASET_DIR';
export const PHOTOS_DIR_ENV = 'FORGE_SEED_PHOTOS_DIR';

/** The dataset directory this box mounts, or null when it mounts none (which is a legitimate state). */
export function datasetDir(env = process.env) {
  const value = (env[DATASET_DIR_ENV] ?? '').trim();
  return value === '' ? null : value;
}

/**
 * Where the dataset's SHARED ART and its photo MANIFEST live. Committed with the dataset, always complete
 * the moment it is mounted.
 */
export function catalogArtDir(dir) {
  return join(dir, 'assets', 'catalog');
}

/**
 * Where the PER-PRODUCT photo tree is — the gigabyte half, git-ignored and hydrated on demand.
 *
 * ⚠️ THE OVERRIDE MOVES ONLY THIS ONE, and the asymmetry is not an oversight: it is the platform's, copied
 * deliberately (`packages/seed-dataset/src/photos.ts`, whose header records the day following the opposite
 * advice broke the seed — the shared art went looking for `<override>/../categories/...` and 18 files were
 * suddenly missing). The brand logos, the category icons and the strips stay in `catalogArtDir` whatever
 * this says.
 */
export function photoTreeDir(dir, env = process.env) {
  const override = (env[PHOTOS_DIR_ENV] ?? '').trim();
  return override !== '' ? override : catalogArtDir(dir);
}

/**
 * The mime of a file the dataset names, from its extension — and it REFUSES what it does not know rather
 * than guessing.
 *
 * ⚠️ A guess here is not a small error. `bin/seed.mjs`'s own `upload()` hard-codes `image/png` because the
 * six coffee photos are PNGs; the dataset's 18582 photographs are JPEG. Sending `image/png` for a JPEG
 * gets a provider_key ending in `.png`, bytes that are not PNG behind it, and a `content-type` the
 * storefront's image optimiser reads before it sniffs — a picture that 400s at the edge instead of a
 * picture that is wrong in an obvious way.
 */
export function mimeOf(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

/**
 * The FILE a declared media key names, resolved through the manifest — never by scanning a directory.
 *
 * The dataset declares opaque keys (`<handle>-cover.jpg`, `category-tenis-icon.png`); the manifest declares
 * which file is behind each. This is the only place the two vocabularies meet, and a key it cannot place
 * returns null so the caller can refuse by NAME instead of uploading nothing and publishing a ref.
 *
 * ★ THE KEY ARRIVES WITHOUT A NAMESPACE, and it used to arrive with one. Until pk18 the catalog wrote
 * `demo/<handle>-cover.jpg` into every media field and this function's first act was to demand that prefix.
 * The platform took it out (`packages/seed-dataset/src/keys.ts` — the demo's catalog.json carried the word
 * `demo/` 52 669 times, and deriving a second dataset from it rewrote all 52 669), so the namespace is now
 * stated ONCE, by the pointer, and composed on read by whoever needs the full key. ⚠️ NOBODY IN THIS REPO
 * DOES: the key a media row here carries is the one `media.request_upload` MINTED (see seedCategories'
 * header), never the dataset's own. So the namespace is not glued back on anywhere below — this file resolves
 * a key to a FILE, and the file is all it ever wanted.
 *
 * A key that still carries a namespace is refused, by name and early, by `mediaKeyFormat` below — not here,
 * where it would only be one null among thousands and would read as "the manifest does not place it".
 *
 * @returns an absolute path, or null when the manifest does not name a file for this key.
 */
export function resolveMediaFile(key, { manifest, artDir, photoDir, hint }) {
  // A root category's bespoke icon — `category-<handle>-icon.png`, listed under `icons` by handle.
  const icon = /^category-(.+)-icon\.png$/.exec(key);
  if (icon) {
    const rel = manifest.icons?.[icon[1]];
    return rel ? join(artDir, rel) : null;
  }
  // A category's wide strip — `category-banner-<name>.jpg`, listed under `categoryBanners` by name.
  // ⚠️ IT IS TESTED BEFORE THE HOME BANNER BELOW AND THE ORDER IS LOAD-BEARING: two different species share
  // the word `banner` and the same folder on disk. This one is a CATEGORY page's strip; the next one is the
  // home's campaign art. Matching `banner-` loosely would answer a strip out of `manifest.banners`, where it
  // is not, and the seed would refuse art it is holding.
  const strip = /^category-banner-(.+)\.[a-z]+$/.exec(key);
  if (strip) {
    const rel = manifest.categoryBanners?.[strip[1]];
    return rel ? join(artDir, rel) : null;
  }
  // ★ S4 — a HOME banner: `banner-<name>.jpg` for the desktop frame, `banner-<name>-M.jpg` for the narrow one,
  // listed under `banners` by name with a `desktop` and an optional `mobile`. Shared art, so it resolves in
  // `artDir` and never follows the photo-tree override, exactly like the icons and strips above.
  //
  // ⚠️ A `-M` THE CURATOR DID NOT SHIP ANSWERS NULL, and falling back to the desktop file here would be the
  // wrong kindness. The banner block's own contract is that a BLANK mobile ref means "use the desktop art at
  // narrow widths"; handing the desktop path back under the phone's name uploads the same 1600px frame twice
  // and makes the block stop falling back and start serving the wide art deliberately. FOUR of this dataset's
  // seven banners ship no `-M` — counted in the photo manifest on 2026-09-06, where this comment and the two
  // that mirror it had all said three — so this is the ordinary case and not the edge.
  const banner = /^banner-(.+)\.[a-z]+$/.exec(key);
  if (banner) {
    const mobile = banner[1].endsWith('-M');
    const entry = manifest.banners?.[mobile ? banner[1].slice(0, -2) : banner[1]];
    const rel = mobile ? entry?.mobile : entry?.desktop;
    return rel ? join(artDir, rel) : null;
  }
  // Everything else is a PRODUCT photo: `<handle>-<file>`. The handle contains hyphens and so does the file,
  // so the split cannot be counted — it is asked of the manifest.
  //
  // ⚠️ AND THE FIRST HANDLE THAT FITS IS NOT ALWAYS THE RIGHT ONE. Measured on this dataset: 99 handles are
  // a strict prefix of another (`…-little-kid-big-kid` and `…-little-kid-big-kid-adult`; `bed-stu-aiken` and
  // `bed-stu-aiken-9554019`). A scan that returns on the first prefix match resolves the LONGER product's
  // cover against the SHORTER product's file list, does not find it, and answers null — which the caller
  // correctly turns into a refusal, for a photo that is right there on disk. It cost this slice a run.
  //
  // So when the caller knows the handle it says so (`hint`, the exact answer), and the general path KEEPS
  // LOOKING: a candidate that does not list the file is not the answer, it is the next iteration. That
  // continue — not the ordering — is what fixes this; longest-first is only a tie-break for a key two
  // handles could both place, which this dataset does not contain and a future one might.
  const place = (handle, file) => {
    const entry = manifest.products?.[handle];
    if (!entry) return null;
    const files = [entry.cover, ...(entry.gallery ?? []), ...Object.values(entry.colors ?? {}).flat()];
    return files.includes(file) ? join(photoDir, handle, file) : null;
  };
  if (hint && key.startsWith(`${hint}-`)) {
    const placed = place(hint, key.slice(hint.length + 1));
    if (placed) return placed;
  }
  const candidates = Object.keys(manifest.products ?? {})
    .filter((handle) => key.startsWith(`${handle}-`))
    .sort((a, b) => b.length - a.length);
  for (const handle of candidates) {
    const placed = place(handle, key.slice(handle.length + 1));
    if (placed) return placed;
  }
  return null;
}

/**
 * Whether a key the catalog carries still has a namespace glued on — i.e. the OLD format.
 *
 * A catalog key is namespace-free by definition and no part of one contains a slash (a handle, a colour slug
 * and a file name are all slug-shaped), so a `/` in one can only be that. This is a deliberate MIRROR of
 * `hasNamespace` in `packages/seed-dataset/src/keys.ts`, copied for the same reason `photoTreeDir` above is:
 * this repository has no package manager and cannot import from the platform. One rule, two spellings.
 */
export function hasNamespace(catalogKey) {
  return catalogKey.includes('/');
}

/**
 * Every media key a catalog DECLARES, from all four places one can appear. The order is the file's.
 *
 * ⓘ DEDUPED PER PRODUCT, because `mediaKeysOf` is (the same photo rides several SKUs). So this counts 18 590
 * on the demo dataset where the platform's own note counts 52 669 — two right answers to two questions:
 * "how many distinct files does this catalog name" against "how many times was the word `demo/` written into
 * the file". Both measured on `instances/demo/dataset/catalog.json`, 2026-09-06.
 */
export function declaredMediaKeys(catalog) {
  const keys = [];
  for (const cat of catalog.categories ?? []) {
    for (const field of ['icon_provider_key', 'banner_provider_key']) {
      if (typeof cat?.[field] !== 'string') continue;
      keys.push({ where: `categories.${cat.path ?? cat.handle}.${field}`, key: cat[field] });
    }
  }
  for (const brand of catalog.brands ?? []) {
    if (typeof brand?.logo_media !== 'string') continue;
    keys.push({ where: `brands.${brand.slug}.logo_media`, key: brand.logo_media });
  }
  for (const product of catalog.products ?? []) {
    for (const key of mediaKeysOf(product)) keys.push({ where: `products.${product.handle}`, key });
  }
  return keys;
}

/** How many media keys this catalog declares and which of them are in the OLD, namespaced format. */
export function mediaKeyFormat(catalog) {
  const declared = declaredMediaKeys(catalog);
  return { inspected: declared.length, namespaced: declared.filter((d) => hasNamespace(d.key)) };
}

/** How many offending keys a refusal spells out before it starts counting. */
const NAMED_OFFENDERS = 5;

/**
 * THE FORMAT GATE — the catalog's media keys are read once, before a single write, and the run stops here if
 * they are not the format this seed reads.
 *
 * It refuses TWO things, and the second one is the point:
 *
 *  · a key that still carries a namespace (`demo/x-cover.jpg`). The platform stopped writing one in pk18;
 *    a catalog that still does is a stale mount, and letting it through would spend 2790 refusals saying
 *    "the photo manifest does not place it" about photographs that are on disk. It is named ONCE instead,
 *    with the key the file should carry.
 *
 *  · ⚠️ A CATALOG THAT DECLARES NO MEDIA AT ALL, which is this rule refusing to pass on an empty room. Every
 *    assertion the first half makes is vacuously true of a catalog with zero keys — a truncated file, a
 *    conversion that dropped the media, a `catalog.json` from some other tool — and the run would go on to
 *    create 2790 products with no pictures and report success. A rule that cannot say what it graded has not
 *    graded anything, so it accuses itself.
 *
 * @returns null when the catalog is readable, or the refusal message.
 */
export function mediaFormatRefusal(catalog) {
  const { inspected, namespaced } = mediaKeyFormat(catalog);
  if (inspected === 0) {
    return (
      'the mounted catalog.json declares NO media key at all — not a product photo, not a category icon.\n' +
      '  This seed publishes a catalogue WITH its photographs, and every check below it is vacuously true of\n' +
      '  a catalog with none. Refusing rather than creating a picture-less store and calling it a success.'
    );
  }
  if (namespaced.length === 0) return null;
  const named = namespaced
    .slice(0, NAMED_OFFENDERS)
    .map(({ where, key }) => `    ${where}: "${key}" — write "${key.slice(key.indexOf('/') + 1)}"`)
    .join('\n');
  const more =
    namespaced.length > NAMED_OFFENDERS ? `\n    …and ${namespaced.length - NAMED_OFFENDERS} more.` : '';
  return (
    `${namespaced.length} of the catalog's ${inspected} media key(s) still carry a dataset namespace, and ` +
    'the catalog does not write one.\n' +
    "  The namespace is stated ONCE, by forge-seed-dataset.json's `id`; a key is `<handle>-cover.jpg`.\n" +
    '  This mount predates the platform change that took it out — re-pack the dataset (`pnpm pack:dataset`\n' +
    '  in the monorepo) and mount it again.\n' +
    `${named}${more}`
  );
}

/** Categories, parents before children — `path` is an ltree and a child written first is a child of nothing. */
export function categoriesByDepth(categories) {
  return [...categories].sort((a, b) => {
    const depth = a.path.split('.').length - b.path.split('.').length;
    return depth !== 0 ? depth : a.path.localeCompare(b.path);
  });
}

/** Run `fn` over `items` with at most `limit` in flight, stopping early when `stop()` says so. */
async function mapPool(items, limit, fn, stop) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !stop?.()) {
      const index = next++;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

/** How many products are built at once. Each one is ~7 uploads + 1 create + ~16 stock adjusts. */
const PRODUCT_CONCURRENCY = 6;
/** How many products ride one `publish_bulk`. Small on purpose: the batch is the unit that becomes durable. */
const PUBLISH_BATCH = 50;

/**
 * @param port {{ api: string, token: string, tenant: string, command: Function, read: Function,
 *                readAll: Function, publicReadAll: Function, rows: Function, log: Function, fail: Function,
 *                upload: Function }}
 */
export async function seedForge(port) {
  const { read, readAll, publicReadAll, rows, log, fail } = port;

  const dir = datasetDir();
  if (!dir) {
    log(
      `forge — no ${DATASET_DIR_ENV}; the sports store stays empty. That is a legitimate state (an ` +
        'instance that mounts no example data has nothing to seed), not a misconfiguration. Point it at ' +
        '<monorepo>/instances/demo/dataset to fill this store — see the README.',
    );
    return;
  }
  if (!existsSync(dir)) fail(`${DATASET_DIR_ENV}=${dir} does not exist.`);

  // THE WRONG-MOUNT NET, and it fires before the first command. A directory that declares itself to be
  // somebody else's dataset is somebody else's catalogue about to be published into this store.
  const pointerPath = join(dir, 'forge-seed-dataset.json');
  if (!existsSync(pointerPath)) {
    fail(
      `${DATASET_DIR_ENV}=${dir} holds no forge-seed-dataset.json. A directory that does not declare itself\n` +
        '  a dataset is not one — this seed refuses to guess at 2790 products.',
    );
  }
  const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
  if (pointer.id !== data.dataset) {
    fail(
      `the mounted dataset is "${pointer.id}" and seed/forge.json expects "${data.dataset}".\n` +
        '  Publishing one instance\'s catalogue into another\'s store is the accident this check exists for.',
    );
  }

  const artDir = catalogArtDir(dir);
  const photoDir = photoTreeDir(dir);
  const manifestPath = join(artDir, 'catalog-manifest.json');
  if (!existsSync(manifestPath)) fail(`the dataset names no photo manifest at ${manifestPath}.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const catalog = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8'));
  const fields = JSON.parse(readFileSync(join(dir, 'custom-fields.json'), 'utf8'));

  // The format gate, BEFORE the first write — see `mediaFormatRefusal`. A stale mount is refused by name
  // here rather than as thousands of "the manifest does not place it" a third of the way through a run.
  const refusal = mediaFormatRefusal(catalog);
  if (refusal) fail(`${join(dir, 'catalog.json')}: ${refusal}`);

  const store = rows(await read('stores')).find((s) => s.handle === data.store);
  if (!store) fail(`the store "${data.store}" does not exist — it is created by bin/seed.mjs's stores().`);
  log(
    `forge — store ${store.handle} (${store.id}); dataset "${pointer.id}" at ${dir}` +
      (photoDir === artDir ? '' : `, photos at ${photoDir}`),
  );
  log(
    `forge — ${catalog.categories.length} category(ies), ${catalog.brands.length} brand(s), ` +
      `${catalog.products.length} product(s)`,
  );

  const resolve = (key, hint) =>
    resolveMediaFile(key, { manifest, artDir, photoDir, hint });

  await declareFields(port, fields);
  const categoryIdByPath = await seedCategories(port, catalog, resolve);
  const brandIdBySlug = await seedBrands(port, catalog);
  await seedProducts(port, { catalog, store, categoryIdByPath, brandIdBySlug, resolve });

  log('forge — done. Re-running this is a no-op.');
}

// ── 1. the custom fields the technical sheets are written in ───────────────────────────────────────────
// DECLARED BEFORE ANY PRODUCT WRITES ONE, for the reason bin/seed.mjs's own customFields() records: an
// undeclared metadata key is accepted in silence and then invisible to every faceting and PDP reader. The
// eight facetable ones here are what turn the PLP's filters on.
async function declareFields({ command, read, rows, log }, fields) {
  const declared = new Set(
    rows(await read('custom_field_definitions')).map((d) => `${d.owner_entity}:${d.key}`),
  );
  let created = 0;
  for (const field of fields) {
    if (declared.has(`${field.owner_entity}:${field.key}`)) continue;
    await command('custom_field.define', {
      owner_entity: field.owner_entity,
      key: field.key,
      type: field.type,
      ...(field.label ? { label: field.label } : {}),
      ...(field.facetable === undefined ? {} : { facetable: field.facetable }),
      ...(field.options?.length ? { options: field.options } : {}),
    });
    created += 1;
  }
  log(
    created === 0
      ? `forge — all ${fields.length} custom field(s) already declared`
      : `forge — ${created} custom field(s) declared`,
  );
}

// ── 2. the categories ──────────────────────────────────────────────────────────────────────────────────
// Two commands each, because the kernel splits them: `create` takes the path/handle/name, and the RICH half
// (description, SEO, the icon and the strip) lives on `update`. The art is uploaded first and the key the
// kernel MINTED is what the update carries — never the dataset's own key, which names a FILE in the mounted
// dataset and no object on this box. (Since pk18 the dataset's key is not even namespaced any more, which
// makes the distinction easier to lose sight of and no less absolute.)
async function seedCategories({ command, readAll, log, fail, upload }, catalog, resolve) {
  // The whole row, not just the id: the art below has to know whether this category ALREADY carries a key.
  const existing = new Map(
    (await readAll('categories_admin')).map((c) => [c.path ?? c.handle, c]),
  );
  const byPath = new Map();
  let created = 0;
  let enriched = 0;
  for (const cat of categoriesByDepth(catalog.categories)) {
    const prior = existing.get(cat.path) ?? existing.get(cat.handle);
    let id = prior?.id ?? prior?.category_id;
    if (!id) {
      const out = await command('catalog.category.create', {
        path: cat.path,
        name: cat.name,
        handle: cat.handle,
        status: 'active',
      });
      id = out.category_id ?? out.id;
      created += 1;
    }
    byPath.set(cat.path, id);

    // The art + the rich fields. Re-asserted every run: `update` is idempotent by value at the kernel, and
    // a category created by a prior run that died before its update would otherwise stay bare forever.
    // ⚠️ ART IS UPLOADED ONCE AND ONLY ONCE, and the reason is that `media.request_upload` MINTS A NEW KEY
    // EVERY CALL. Its own summary calls the key "deterministic"; it is not — the kernel builds it as
    // `<schema>/<ULID>-<slug>.<ext>` (packages/core/src/media/plan-upload.ts:112), and a ULID is new each
    // time. So re-uploading the same file on every run leaves a fresh object in the bucket, re-points the
    // category at it, and abandons the previous one. Measured: a run with NOTHING to do still added 8
    // objects (5 icons + 3 strips) and rewrote 33 categories. A seed that grows the bucket every time it is
    // run is not idempotent, however unchanged the catalogue looks.
    //
    // So a category that already carries a key keeps it. Re-pointing art at a NEW file is a different
    // gesture from seeding — it is the same shape as the media re-point the platform's own seeder does as a
    // separate step, and it does not belong in a create-or-skip loop.
    const art = async (key, current) => {
      if (!key) return null;
      if (current) return null; // already placed by an earlier run — leave it alone
      const file = resolve(key);
      if (!file) fail(`category ${cat.path} declares art "${key}", which the photo manifest does not place.`);
      return upload(file);
    };
    const icon = await art(cat.icon_provider_key, prior?.icon_provider_key);
    const banner = await art(cat.banner_provider_key, prior?.banner_provider_key);
    // Idempotent BY VALUE, the way this repo's `vocabulary()` already is: `update` is a write, and
    // re-sending the same description on every run is a no-op that still spends a command and an audit row.
    const update = {
      ...(cat.description && prior?.description !== cat.description
        ? { description: cat.description }
        : {}),
      ...(cat.meta_title && prior?.meta_title !== cat.meta_title
        ? { meta_title: cat.meta_title }
        : {}),
      ...(cat.meta_description && prior?.meta_description !== cat.meta_description
        ? { meta_description: cat.meta_description }
        : {}),
      ...(icon ? { icon_provider_key: icon, icon_kind: 'image' } : {}),
      ...(banner ? { banner_provider_key: banner, banner_kind: 'image' } : {}),
    };
    if (Object.keys(update).length > 0) {
      await command('catalog.category.update', { category_id: id, ...update });
      enriched += 1;
    }
  }
  log(
    created === 0 && enriched === 0
      ? `forge — all ${catalog.categories.length} category(ies) already there and unchanged`
      : `forge — ${created} category(ies) created, ${enriched} enriched`,
  );
  return byPath;
}

// ── 3. the brands ──────────────────────────────────────────────────────────────────────────────────────
// 351 of them, and no logos: the dataset's photo manifest declares `brands: {}`, so there is no file behind
// a `brand-<slug>.png` key. Uploading nothing and writing the ref anyway is exactly the orphan-ref
// failure the platform's own seeder records from Staging — so the logos are simply not set, and the slice
// report says so rather than this file pretending otherwise.
async function seedBrands({ command, readAll, log }, catalog) {
  const existing = new Set((await readAll('brands_admin')).map((b) => b.slug));
  const byySlug = new Map();
  let created = 0;
  for (const brand of catalog.brands) {
    if (existing.has(brand.slug)) continue;
    const out = await command('catalog.brand.create', {
      slug: brand.slug,
      name: brand.name,
      status: 'active',
    });
    byySlug.set(brand.slug, out.brand_id ?? out.id);
    created += 1;
  }
  log(
    created === 0
      ? `forge — all ${catalog.brands.length} brand(s) already there`
      : `forge — ${created} brand(s) created`,
  );
  // The ids of the ones that already existed, for the products that point at them.
  const all = new Map((await readAll('brands_admin')).map((b) => [b.slug, b.id ?? b.brand_id]));
  for (const [slug, id] of byySlug) all.set(slug, id);
  return all;
}

// ── 4. the products, their photographs, their stock and their publication ──────────────────────────────
async function seedProducts(port, { catalog, store, categoryIdByPath, brandIdBySlug, resolve }) {
  const { command, read, publicReadAll, readAll, rows, log, fail, upload } = port;

  // ★★ WAIT FOR THE READ TO BE QUIET BEFORE TRUSTING IT — and this is not belt-and-braces, it is a defect
  // this module shipped once and the second run found.
  //
  // ⚠️ MEASURED. Every read this decision rests on (`products_admin`, the store's published list) is served
  // from `product_projection`, which the outbox relay fills AFTER the transaction commits. Straight after a
  // run that published 2 790 products the projection was at 2 428 of 2 804 and climbing at ~3.5 rows/s. So
  // the second run — the "run it twice" that is supposed to be a no-op — read 2 402 as the whole store,
  // decided 388 products were missing, RE-UPLOADED THEIR PHOTOGRAPHS, and then died on the kernel's own
  // guard: `catalog.product.create → 409 handle_taken`.
  //
  // The 409 is the kernel being right. The bug is upstream of it: an idempotence check keyed on an
  // EVENTUALLY CONSISTENT read is not an idempotence check, it is a race that a small catalogue always won.
  // Fourteen products always caught up before the next line executed; 2 790 do not.
  //
  // So: poll the cheapest total there is until it stops moving. Not "until it matches" — this module cannot
  // know the target, and inventing one would be a second source of truth. Quiet is the honest signal.
  await awaitQuietCatalogue(port);

  // ★ THE SKIP SET IS THE STORE'S PUBLISHED LIST, and that is the whole idempotence. A product on sale here
  // was created, stocked and published by a previous run — in that order, so being on sale proves the two
  // steps before it. A second run touches none of them and issues no write.
  const published = new Set(
    (await publicReadAll('products', { store: store.id, projection: 'feed' })).map((p) => p.handle),
  );

  // ★★ WHOSE PRODUCT IS THIS? — and getting this wrong cost the outlet its whole point, once, measured.
  //
  // ⚠️ THE DATASET AND THE OTHER STORES OVERLAP. The D2 slice built the outlet from EIGHT products of this
  // very dataset, so eight handles the catalogue below declares already existed in the tenant, owned by
  // another store. This module reused them by handle — correct, the kernel has one catalogue per tenant —
  // and then did to them what it does to a product it just made: SET THEIR STOCK to the seed figure. The
  // outlet is an outlet: `seed/outlet.json` declares sold-out sizes (`[2,1,0,3,0,1,0,0]`), and 100 units in
  // every size is not a smaller error than deleting them. It erased the store's only story.
  //
  // So a product that is ALREADY ON SALE SOMEWHERE ELSE is not this seed's to stock or to categorise. It is
  // still published into this store — one tenant catalogue, and the sports shop should list what the dataset
  // declares — but its inventory and its shelf stay with whoever set them.
  //
  // Published NOWHERE is the opposite case and is unambiguous: a product this module created on a previous
  // run that died before publishing it. Nobody else can be relying on it, so the heal path may finish it.
  const otherStores = rows(await read('stores')).filter((s) => s.id !== store.id);
  const ownedElsewhere = new Set();
  for (const other of otherStores) {
    for (const p of await publicReadAll('products', { store: other.id, projection: 'feed' })) {
      ownedElsewhere.add(p.handle);
    }
  }
  if (ownedElsewhere.size > 0) {
    log(
      `forge — ${ownedElsewhere.size} product(s) are already on sale in another store of this tenant; ` +
        'they will be listed here and NOT re-stocked or re-categorised',
    );
  }
  // ⚠️ `products_admin` and not `products`: a product created but never published is not in the store's
  // list, and asking the store would make the seed create it a second time — a 409 on the unique handle.
  //
  // ⚠️ AND IT CARRIES THE SKU IDS, because there is no way to ask for one product's. `products_admin` takes
  // `category`, `collection`, `limit`, `page`, `projection` and `status` — and NOTHING that names a handle
  // (measured against docs/reference/read.internal.products_admin.md). A per-product lookup was the obvious
  // shape and it does not exist; this walk happens once either way, so it keeps what the heal path needs.
  const tenantCatalogue = new Map(
    (await readAll('products_admin')).map((p) => [
      p.handle,
      {
        id: p.product_id ?? p.id,
        skuIds: (p.skus ?? []).map((sku) => sku.id ?? sku.sku_id).filter(Boolean),
      },
    ]),
  );
  log(
    `forge — ${published.size} of ${catalog.products.length} product(s) already on sale; ` +
      `${tenantCatalogue.size} in the tenant catalogue`,
  );

  // ★★ pk6 · M10 — THE IDLE SHELF IS SUBTRACTED HERE TOO, and forgetting it is why the shelf existed and the
  // bench did not change. The monorepo's `populate` learned to withhold these handles; this seed is the OTHER
  // author of this shop's assortment, and an author that publishes what the other withholds wins in silence —
  // the pool would stay at 2 and the dashboard's three stock states would stay empty, with nothing red
  // anywhere. `catalog.idle_shelf` is optional: a dataset without one behaves exactly as before.
  const idleShelf = new Set(catalog.idle_shelf?.handles ?? []);
  const todo = planProducts(catalog.products, {
    publishedHere: published,
    ownedElsewhere,
    idleShelf,
  });
  if (todo.length === 0) {
    log(`forge — all ${catalog.products.length} product(s) already on sale; nothing to do`);
    return;
  }

  let failure = null;
  const readyToPublish = [];
  let createdProducts = 0;
  let uploadedPhotos = 0;
  let stockedSkus = 0;
  let borrowed = 0;
  let raced = 0;
  let done = 0;

  const publishBatch = async (ids) => {
    if (ids.length === 0) return;
    await command('catalog.product.publish_bulk', { product_ids: ids, store_id: store.id });
  };

  await mapPool(
    todo,
    PRODUCT_CONCURRENCY,
    async (product) => {
      const categoryId = categoryIdByPath.get(product.categoryPath);
      if (!categoryId) {
        failure ??= `product ${product.handle} names category "${product.categoryPath}", which the dataset does not declare.`;
        return;
      }

      const known = tenantCatalogue.get(product.handle);
      let productId = known?.id;
      // A product reused from a run that died mid-way: its SKUs came with the catalogue walk above.
      let skuIds = known ? known.skuIds : null;

      if (!productId) {
        // THE BYTES COME FIRST. `catalog.product.create` takes the media refs inline, so a byte failure
        // discovered afterwards has already published a catalogue of refs pointing at nothing — the Staging
        // incident of 2026-07-14, which this repo's own upload() header already records.
        const keyOf = new Map();
        for (const declared of mediaKeysOf(product)) {
          const file = resolve(declared, product.handle);
          if (!file) {
            failure ??= `product ${product.handle} declares media "${declared}", which the photo manifest does not place.`;
            return;
          }
          const minted = await upload(file);
          keyOf.set(declared, minted);
          uploadedPhotos += 1;
        }

        const out = await command(
          'catalog.product.create',
          {
            handle: product.handle,
            title: product.title,
            description: product.description,
            status: 'active',
            ...(brandIdBySlug.get(product.brand) ? { brand_id: brandIdBySlug.get(product.brand) } : {}),
            ...(Array.isArray(product.options) && product.options.length
              ? { options: product.options }
              : {}),
            skus: product.skus.map((sku) => ({
              code: sku.code,
              amount: sku.amount,
              ...(sku.compare_at_amount ? { compare_at_amount: sku.compare_at_amount } : {}),
              ...(sku.ref ? { ref: sku.ref } : {}),
              ...(sku.ean ? { ean: sku.ean } : {}),
              ...(sku.is_default ? { is_default: true } : {}),
              ...(sku.option_values?.length ? { option_values: sku.option_values } : {}),
              ...(sku.media?.length
                ? {
                    media: sku.media.map((m) => ({
                      provider_key: keyOf.get(m.provider_key),
                      kind: 'image',
                      ...(m.role ? { role: m.role } : {}),
                      ...(m.position === undefined ? {} : { position: m.position }),
                      ...(m.alt ? { alt: m.alt } : {}),
                    })),
                  }
                : {}),
            })),
            ...(product.media?.length
              ? {
                  media: product.media.map((m) => ({
                    provider_key: keyOf.get(m.provider_key),
                    kind: 'image',
                    ...(m.role ? { role: m.role } : {}),
                    ...(m.position === undefined ? {} : { position: m.position }),
                    ...(m.alt ? { alt: m.alt } : {}),
                  })),
                }
              : {}),
            ...(product.metadata ? { metadata: product.metadata } : {}),
            ...(product.meta_title ? { meta_title: product.meta_title } : {}),
            ...(product.meta_description ? { meta_description: product.meta_description } : {}),
            ...(product.content_sections ? { content_sections: product.content_sections } : {}),
          },
          // The last word on "does this exist?" is the kernel's unique handle, not a projection this run
          // read a moment ago. A product that appeared between the two is left for the next run, which will
          // see it in a settled read — never re-created, never a dead seed.
          { tolerate: ['handle_taken'] },
        );
        if (out.refused) {
          raced += 1;
          return;
        }
        productId = out.product_id;
        skuIds = out.sku_ids;
        createdProducts += 1;
      }

      // Someone else's product keeps its shelf and its inventory; this run only adds the listing.
      const { mine } = product; // decided once, by planProducts — see its header

      if (mine) {
        await command('catalog.product.categorize', {
          product_id: productId,
          category_id: categoryId,
          is_primary: true,
        });
      }

      // STOCK, and it comes BEFORE the publication on purpose — see the header. A product reused from a run
      // that died mid-way has no sku_ids in hand; the tenant catalogue carries them.
      if (mine) {
        if (!skuIds?.length) {
          failure ??= `product ${product.handle} exists but names no SKU this seed can stock.`;
          return;
        }
        await mapPool(
          skuIds,
          8,
          async (skuId) => {
            await command('inventory.adjust', {
              sku_id: skuId,
              on_hand: data.default_on_hand,
              reason: 'correction',
              note: 'demo birth data',
            });
            stockedSkus += 1;
          },
          () => failure !== null,
        );
      } else {
        borrowed += 1;
      }

      readyToPublish.push(productId);
      done += 1;
      if (done % 100 === 0) {
        log(
          `forge — ${done}/${todo.length} product(s): ${createdProducts} created, ` +
            `${uploadedPhotos} photo(s), ${stockedSkus} sku(s) stocked`,
        );
      }
      // Publish in batches as we go: the batch is what makes a product durable-complete, and a run that is
      // interrupted leaves at most PUBLISH_BATCH products for the next run to heal.
      if (readyToPublish.length >= PUBLISH_BATCH) {
        await publishBatch(readyToPublish.splice(0, readyToPublish.length));
      }
    },
    () => failure !== null,
  );

  if (failure) fail(failure);
  await publishBatch(readyToPublish);
  log(
    `forge — ${createdProducts} product(s) created, ${uploadedPhotos} photo(s) uploaded, ` +
      `${stockedSkus} sku(s) stocked at ${data.default_on_hand}, ${done} put on sale` +
      (borrowed > 0
        ? `; ${borrowed} listed but left alone (already on sale in another store of this tenant)`
        : '') +
      (raced > 0 ? `; ${raced} appeared mid-run and were left for the next` : ''),
  );
}



/** How long the catalogue read must stop changing before this seed believes it. */
const QUIET_CHECKS = 3;
const QUIET_INTERVAL_MS = 2000;
const QUIET_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Block until `products_admin` answers the same total `QUIET_CHECKS` times in a row — the projection has
 * caught up with whatever a previous run committed. One request per check, so this costs nothing on a store
 * that is already settled (three requests) and minutes on one that has just been filled.
 *
 * ⚠️ IT TIMES OUT LOUDLY rather than proceeding on a moving number. Seeding against a read that is still
 * climbing is precisely the failure this exists to stop, and "we waited a while and gave up" is the same
 * decision as not waiting.
 */
export async function awaitQuietCatalogue({ read, log, fail }, opts = {}) {
  const interval = opts.intervalMs ?? QUIET_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? QUIET_TIMEOUT_MS;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  const started = now();
  let last = null;
  let stable = 0;
  let announced = false;
  for (;;) {
    const total = Number((await read('products_admin', { limit: '1', page: '1' }))?.total ?? 0);
    stable = total === last ? stable + 1 : 0;
    last = total;
    if (stable >= QUIET_CHECKS - 1) {
      if (announced) log(`forge — the catalogue read settled at ${total}`);
      return total;
    }
    if (now() - started > timeout) {
      fail(
        `the catalogue read never settled (${total} and still moving after ${Math.round(timeout / 1000)}s).\n` +
          '  Every "does this already exist?" here is served from product_projection, which the outbox relay\n' +
          '  fills after the commit. Seeding against a moving number re-creates what is already there and\n' +
          '  dies on the kernel\'s unique handle. Let the relay drain, then run this again.',
      );
    }
    if (!announced) {
      log('forge — waiting for the catalogue read to settle (the projection lags the commit)');
      announced = true;
    }
    await sleep(interval);
  }
}

/**
 * WHAT THIS RUN DOES TO EACH PRODUCT — the whole decision, in one pure function, because getting it wrong
 * is not a small error and a Set lookup buried in a 200-line loop is not something anybody re-reads.
 *
 * Three states, and only the middle one is new:
 *   · already on sale HERE      → not in the list at all. It is complete; a re-run writes nothing.
 *   · on sale in ANOTHER store  → in the list, `mine: false`. It gets LISTED here and nothing else: no
 *                                 stock, no categorise. Its inventory and its shelf belong to whoever set
 *                                 them, and the outlet's sold-out sizes are the proof that this matters.
 *   · on sale nowhere           → in the list, `mine: true`. Either this run creates it, or a previous run
 *                                 of this module created it and died before publishing — either way nobody
 *                                 else can be relying on it, so this run finishes it.
 */
export function planProducts(products, { publishedHere, ownedElsewhere, idleShelf }) {
  const idle = idleShelf ?? new Set();
  return products
    .filter((p) => !publishedHere.has(p.handle))
    .filter((p) => !idle.has(p.handle))
    .map((p) => ({ ...p, mine: !ownedElsewhere.has(p.handle) }));
}

/** Every media key one product declares — its own and its SKUs' — in the order they will be uploaded. */
export function mediaKeysOf(product) {
  const keys = [];
  for (const m of product.media ?? []) keys.push(m.provider_key);
  for (const sku of product.skus ?? []) for (const m of sku.media ?? []) keys.push(m.provider_key);
  return [...new Set(keys)];
}

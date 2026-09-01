#!/usr/bin/env node
// THE DEMO'S BIRTH DATA, DRIVEN THROUGH THE PORT.
//
//   FORGE_SEED_TOKEN=… node bin/seed.mjs                      # against FORGE_PUBLIC_ORIGIN
//   FORGE_SEED_TOKEN=… node bin/seed.mjs --api http://localhost:8080
//
// ⚠️ THIS IS NOT A SEEDER AND IT IS NOT TRYING TO BE. Forge ships one (`node dist/seed-demo.js`, the
// `demo-data` app) that fills a store with a rich generated catalogue. This is not that: it is the MINIMUM
// that makes this demo stand up — the stores, and the six coffees the coffee store lists. Decision of Renan,
// 2026-08-31: no full seed yet, because "fica mais claro como rechear" once the whole demo exists. Building
// an importer now would be guessing at the shape of data the finished demo has not asked for.
//
// EVERY WRITE GOES THROUGH THE DOOR. Not one line of this file knows a table name, and it holds no database
// credential — it holds an API key, exactly like an ERP would. That is the point of running it against a
// box rather than inside one: if `catalog.product.create` cannot express something, the answer is a slice on
// the kernel, not a shortcut in this script. (The one thing it does NOT create is the first store: that is
// `provision-ref`'s, at bootstrap, and this script checks for it instead.)
//
// IDEMPOTENT BY CONSTRUCTION. Everything it creates is keyed by a handle it chooses, so it asks the read
// face first and skips what is already there. Re-running converges; it never duplicates and never deletes.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(HERE, 'seed');
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const token = process.env.FORGE_SEED_TOKEN ?? '';
// ★ WHICH TENANT, and it is a HEADER rather than something the credential carries on its own.
//
// ⚠️ MEASURED THE HARD WAY, and it cost this slice an evening of believing the door was shut. A tenant
// credential presented WITHOUT `x-forge-tenant` is refused by the write face with
// `forbidden: "tenant required"` (packages/core/src/dispatcher.ts:272) — while the same token answers the
// INTERNAL READ face with real data on the same request. Reading a 403 next to a 200 and concluding "this
// credential cannot write" is the wrong conclusion, and it was mine: the adapter reads the tenant off a
// header (apps/api/src/adapter.ts:42) and nothing supplies a default.
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? process.env.FORGE_REF_TENANT ?? '';

if (!api) fail('no API base. Pass --api http://… or set FORGE_PUBLIC_ORIGIN (see .env.example).');
if (!tenant) {
  fail(
    'no tenant. Pass --tenant <id> or set FORGE_SEED_TENANT / FORGE_REF_TENANT (see .env.example).\n' +
      '  The write face takes it as a header and refuses without one, with `tenant required` — a refusal\n' +
      '  that reads like a permission problem and is not.',
  );
}
if (!token) {
  fail(
    'no FORGE_SEED_TOKEN. Any TENANT credential holding the scopes below will do, and this box already has\n' +
      '  one: the "Reference Operator" token `provision-ref` prints at bootstrap. A narrower API key minted\n' +
      '  with `iam.api_key.create` is the better long-term answer, and that command is reachable through the\n' +
      '  door too. Scopes needed: tenant.store.write, catalog.product.write, catalog.sku.write,\n' +
      '  custom_fields.write, media.write.',
  );
}

function fail(message) {
  process.stderr.write(`[seed] ${message}\n`);
  process.exit(1);
}
const log = (message) => process.stderr.write(`[seed] ${message}\n`);

/** One command through the tenant write face. The ONLY way this file changes anything. */
async function command(name, input) {
  const res = await fetch(`${api}/v1/commands/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-forge-tenant': tenant,
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) {
    // The kernel's refusals are actionable and this script must not swallow them: a seed that reports
    // "failed" instead of "handle already taken" costs somebody an hour of guessing.
    fail(`${name} → HTTP ${res.status}\n  ${text.slice(0, 900)}`);
  }
  return text ? JSON.parse(text) : {};
}

/** One read through the internal face — used ONLY to decide what already exists (idempotence). */
async function read(name, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${api}/v1/read/internal/${name}${qs ? `?${qs}` : ''}`, {
    headers: { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant },
  });
  if (!res.ok) fail(`read.${name} → HTTP ${res.status}\n  ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

/**
 * One read through the PUBLIC face — the shopper's, which is the only one that answers "is this product ON
 * SALE in this store?".
 *
 * ⚠️ IT EXISTS BECAUSE ASKING THE OTHER FACE GAVE A CONFIDENT WRONG ANSWER. `publish()` first asked
 * `/v1/read/internal/products?store=<id>`, which answers 200 with the WHOLE TENANT CATALOGUE and ignores the
 * `store` param entirely (measured: 6 items for a store with 0 published). So the idempotence check read
 * "all six already on sale" for a shop that was showing nothing, and the publish never ran. Same shape as the
 * envelope defect `rows()` above carries a note about: a read that answers a DIFFERENT question than the one
 * asked, silently, and the caller cannot tell.
 */
async function publicRead(name, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${api}/v1/read/${name}${qs ? `?${qs}` : ''}`);
  if (!res.ok) fail(`read.${name} (public) → HTTP ${res.status}`);
  return res.json();
}

/**
 * The rows of a read, whatever envelope it came in.
 *
 * ⚠️ THE `?? []` THIS REPLACES WAS A DEFECT, AND IT HID ITSELF IN THE ONE PLACE IT COULD DO DAMAGE. The
 * paginated reads answer `{ items, page, limit, total }`; this function knew `rows` and `data`, so it read a
 * real page of six products as ZERO — and the caller is the IDEMPOTENCE check. A "did I already make this?"
 * that silently answers "no" is not a missing feature, it is a duplicate-create: the second run died on
 * `catalog.product.create → HTTP 409 … "forge-alvorada" is already used`, which is the kernel catching what
 * this function had got wrong.
 *
 * So an envelope it does not recognise is now a LOUD failure and never an empty list. Guessing empty is the
 * one answer that turns a read bug into a write bug.
 */
function rows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'rows', 'data']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  fail(
    `a read answered a shape this script cannot page: ${JSON.stringify(payload).slice(0, 200)}\n` +
      '  Refusing to read it as EMPTY — that would make every "does it already exist?" answer no, and turn\n' +
      '  this idempotent script into one that creates duplicates until the kernel refuses.',
  );
}

// ── 1. the stores ───────────────────────────────────────────────────────────────────────────────────────────
async function stores() {
  const existing = new Map(rows(await read('stores')).map((s) => [s.handle, s]));
  for (const store of catalog.stores) {
    const found = existing.get(store.handle);
    if (store.bootstrap) {
      // NOT created here, on purpose: the first store is `provision-ref`'s, at bootstrap. Checking for it is
      // the useful thing this script can do — its absence means the bootstrap step was skipped, and every
      // command below would then fail for a reason that names something else.
      if (!found) {
        fail(
          `the bootstrap store "${store.handle}" does not exist. Run the one-shot first:\n` +
            '    docker compose run --rm kernel node dist/provision-ref.js',
        );
      }
      // …but what the catalogue DECLARES about it is still this file's promise to keep. `provision-ref`
      // creates the store with no theme, and leaving it there would make `theme_key: "outlet"` a line in a
      // JSON file that nothing applies — the shape of promise this repo exists to avoid.
      // ⚠️ Safe before the theme folder exists: a `theme_key` nothing answers resolves to the base theme and
      // never 500s, which is the whole reason that rule is written the way it is.
      if (store.theme_key && found.theme_key !== store.theme_key) {
        await command('tenant.store.update', { id: found.id, theme_key: store.theme_key });
        log(`store ${store.handle} — the bootstrap one; theme_key → ${store.theme_key}`);
        continue;
      }
      log(`store ${store.handle} — the bootstrap one, left alone`);
      continue;
    }
    if (found) {
      log(`store ${store.handle} — already there`);
      continue;
    }
    const out = await command('tenant.store.create', {
      handle: store.handle,
      name: store.name,
      ...(store.theme_key ? { theme_key: store.theme_key } : {}),
    });
    log(`store ${store.handle} — created (${out.store_id ?? out.id ?? '?'})`);
  }
}

/** ★ E1 — the words, written AFTER the custom fields are declared (an undeclared `vocabulary_*` is accepted
 *  and then read by nobody, which is the silent half this order avoids). Runs over every store, so a store
 *  that declares none simply gets no call. */
async function vocabulary() {
  const byHandle = new Map(rows(await read('stores')).map((s) => [s.handle, s]));
  for (const store of catalog.stores) {
    const words = store.vocabulary ?? {};
    const keys = Object.keys(words);
    if (keys.length === 0) continue;
    const found = byHandle.get(store.handle);
    if (!found) fail(`store "${store.handle}" is not there — cannot write its words.`);
    // Idempotent by VALUE, not by presence: `set_custom_fields` is a write, and re-writing the same words
    // every run would be a no-op that still spends a command and an audit row.
    const current = found.custom_fields ?? {};
    const missing = keys.filter((k) => current[`vocabulary_${k}`] !== words[k]);
    if (missing.length === 0) {
      log(`vocabulary ${store.handle} — already ${keys.map((k) => `${k}="${words[k]}"`).join(', ')}`);
      continue;
    }
    // ⚠️⚠️ THE CURRENT BAG IS SPREAD BACK IN, AND THIS IS NOT DEFENSIVENESS — IT IS MEASURED.
    //
    // `tenant.store.set_custom_fields` REPLACES the map; it does not merge. Measured on this bench: writing
    // `{vocabulary_cart: ""}` alone left the store's bag as exactly `{"vocabulary_cart": ""}` and
    // `vocabulary_cart_empty_title` was GONE.
    //
    // And the bag is shared. The kernel keeps TWO features' reserved keys in it — `vocabulary_<key>` (E1) and
    // `chrome_<region>` (P2, the store's own header/footer content) — plus whatever a merchant or an ERP put
    // there. So a script that sends only its own keys silently erases a store's chrome, and a screen that
    // sets the chrome silently erases its words. This one sends the bag it found, with its words on top.
    await command('tenant.store.set_custom_fields', {
      store_id: found.id,
      custom_fields: {
        ...current,
        ...Object.fromEntries(keys.map((k) => [`vocabulary_${k}`, words[k]])),
      },
    });
    log(`vocabulary ${store.handle} — ${keys.map((k) => `${k}="${words[k]}"`).join(', ')}`);
  }
}

// ── 2. the custom fields the catalogue uses ─────────────────────────────────────────────────────────────────
// DECLARED BEFORE ANY PRODUCT WRITES ONE. `catalog.product.create` validates declared product fields and
// leaves undeclared metadata keys free — so an undeclared `regiao` would be accepted and then be invisible to
// every faceting and PDP feature that reads declarations. Silent, and exactly the kind of thing that is found
// three slices later.
/**
 * ★ E1 — THE STORE'S OWN WORDS, and they are a CUSTOM FIELD OF THE STORE, not of a product.
 *
 * The kernel publishes only the keys the kit curates (`cart`, `cart_empty_title`), under a reserved
 * `vocabulary_` prefix, on `read.store_flags`. A key outside that list is written happily and read by nobody
 * — deliberately: the list is a closed contract, not merchant-side i18n.
 *
 * ⚠️ AND THE TWO ARE DIFFERENT SPECIES. `cart` is a NOUN, interpolated only where a bare verb precedes it
 * ("Abrir sacola"); `cart_empty_title` is a WHOLE SENTENCE because Portuguese makes the noun's gender
 * load-bearing — "Sua sacola está vazia", never "Seu sacola está vazio". A noun poured into our sentence
 * would be a string list doing grammar.
 */
const VOCABULARY_FIELDS = ['cart', 'cart_empty_title'];

const FIELDS = [
  { key: 'regiao', label: 'Região', type: 'text', facetable: true },
  { key: 'produtor', label: 'Produtor', type: 'text', facetable: false },
  { key: 'fazenda', label: 'Fazenda', type: 'text', facetable: false },
  { key: 'altitude', label: 'Altitude', type: 'text', facetable: false },
  { key: 'variedade', label: 'Variedade', type: 'text', facetable: true },
  { key: 'processo', label: 'Processo', type: 'text', facetable: true },
  { key: 'torra', label: 'Torra', type: 'text', facetable: true },
  { key: 'notas', label: 'Notas sensoriais', type: 'text', facetable: false },
  { key: 'sca', label: 'Pontuação SCA', type: 'text', facetable: false },
];

async function customFields() {
  const declared = new Set(
    rows(await read('custom_field_definitions')).map((d) => `${d.owner_entity}:${d.key}`),
  );
  for (const key of VOCABULARY_FIELDS) {
    const name = `vocabulary_${key}`;
    if (declared.has(`store:${name}`)) {
      log(`cf ${name} — already declared`);
      continue;
    }
    await command('custom_field.define', { owner_entity: 'store', key: name, type: 'text' });
    log(`cf ${name} — declared (store)`);
  }
  for (const field of FIELDS) {
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
    });
    log(`cf ${field.key} — declared${field.facetable ? ' (facetable)' : ''}`);
  }
}

// ── 3. the photos ───────────────────────────────────────────────────────────────────────────────────────────
// THE BYTES COME BEFORE THE PRODUCTS, and the order is the whole lesson of a Staging incident the platform's
// own seeder records: `catalog.product.create` takes media refs, so a byte failure discovered afterwards has
// already published a catalogue of refs pointing at nothing.
//
// Three steps, all through the door: `media.request_upload` validates the mime/size and NAMES the key (it
// writes nothing and returns no bytes), the connector edge mints the URL, and the PUT carries the bytes
// straight there — they never pass through the command port.
async function upload(filename) {
  const bytes = readFileSync(join(SEED, 'photos', filename));
  const plan = await (async () => {
    const res = await fetch(`${api}/v1/media/commands/media.request_upload`, {
      method: 'POST',
      headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-forge-tenant': tenant,
    },
      body: JSON.stringify({
        filename,
        mime: 'image/png',
        kind: 'image',
        size: bytes.byteLength,
      }),
    });
    if (!res.ok) fail(`media.request_upload(${filename}) → HTTP ${res.status}\n  ${await res.text()}`);
    return res.json();
  })();

  const key = plan.provider_key ?? plan.value?.provider_key;
  const url = plan.upload_url ?? plan.value?.upload_url;
  if (!key) fail(`media.request_upload(${filename}) returned no provider_key: ${JSON.stringify(plan)}`);
  if (!url) {
    fail(
      `media.request_upload(${filename}) returned no upload_url. That is what a driver with no egress\n` +
        '  looks like (the kernel truth carries none by design). This script only knows how to place bytes\n' +
        '  through a signed URL; with a bucket driver, upload them with that provider\'s own tool first.',
    );
  }

  const put = await fetch(url.startsWith('http') ? url : `${api}${url}`, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: bytes,
  });
  if (!put.ok) fail(`PUT ${url} → HTTP ${put.status}`);

  await command('asset.create', {
    provider_key: key,
    filename,
    mime: 'image/png',
    kind: 'image',
    size: bytes.byteLength,
  });
  return key;
}

// ── 4. the products ─────────────────────────────────────────────────────────────────────────────────────────
async function products() {
  // ★ `products_admin` AND NOT `products`, and the difference is the whole question this read is asked.
  // ⚠️ Measured: `read.internal.products` does not exist, and `read.products` is the STORE's published list —
  // it demands a `store` and caps at 100 rows. A product this script has just created is not published to any
  // store yet, so asking the store's list would report "not there" for a product that IS there and create it
  // twice. `products_admin` is the tenant's WHOLE catalogue, drafts and unpublished included, and no store to
  // scope by — which is exactly the question "did I already make this?".
  const existing = new Set(rows(await read('products_admin', { limit: '100' })).map((p) => p.handle));
  const photos = new Set(readdirSync(join(SEED, 'photos')));

  for (const product of catalog.products) {
    if (existing.has(product.handle)) {
      log(`product ${product.handle} — already there`);
      continue;
    }
    if (!photos.has(product.photo)) {
      fail(`product ${product.handle} names photo "${product.photo}", which seed/photos/ does not have.`);
    }
    const providerKey = await upload(product.photo);

    // The SKUs, expanded from the option axes the catalogue declares. `option_values` is what ties a SKU to
    // its point on the grid, and `code` is derived from the handle and the values so a re-run is diffable
    // and a human reading an order line can tell which coffee, which grind and which weight it was.
    const skus = product.skus.map((sku, index) => ({
      code: `${product.handle}-${sku.options.map((v) => slug(v)).join('-')}`,
      amount: sku.amount,
      ...(sku.compare_at_amount ? { compare_at_amount: sku.compare_at_amount } : {}),
      is_default: index === 0,
      option_values: sku.options.map((value, axis) => ({
        option: product.options[axis].name,
        value,
      })),
    }));

    const out = await command('catalog.product.create', {
      handle: product.handle,
      title: product.title,
      description: product.description,
      status: 'active',
      options: product.options,
      skus,
      // The `cf.*` vocabulary, as the product's metadata — which is where a declared custom field's value
      // lives. Undeclared keys would be accepted silently, which is why step 2 runs first.
      metadata: { ...product.custom_fields, ...(product.subtitle ? { subtitle: product.subtitle } : {}) },
      media: [{ provider_key: providerKey, kind: 'image', position: 0, alt: product.title }],
    });
    log(`product ${product.handle} — created with ${skus.length} sku(s) (${out.product_id ?? '?'})`);
  }
}

/**
 * ★ PUBLISHING — the second act, and D1 did only the first.
 *
 * `catalog.product.create` makes a product of the TENANT. Being ON SALE IN A STORE is a separate command, and
 * skipping it leaves a catalogue that exists and a shop that shows nothing. Measured on this bench with all
 * six coffees created: `read.products?store=<cafe>` answered **0**. A product is not a listing.
 *
 * Idempotent against the STORE's published list, which is the only thing that answers the question being
 * asked here — the tenant catalogue (`products_admin`, used for "did I create this?") cannot tell a published
 * product from an unpublished one.
 */
async function publish() {
  const storeHandle = catalog.products_store;
  if (!storeHandle) fail('seed/catalog.json names no `products_store` — nobody sells these products.');
  const store = rows(await read('stores')).find((s) => s.handle === storeHandle);
  if (!store) fail(`the selling store "${storeHandle}" does not exist.`);

  const wanted = new Map(
        // `product_id`, not `id` — measured: `products_admin` names it that way, and reading `p.id` made every
    // entry `undefined`. It failed LOUDLY on the first product rather than publishing nothing quietly, which
    // is the only reason this line is a two-minute fix and not a shop that stays empty.
    rows(await read('products_admin', { limit: '100' })).map((p) => [p.handle, p.product_id ?? p.id]),
  );
  const already = new Set(
    rows(await publicRead('products', { store: store.id, limit: '100', projection: 'feed' })).map(
      (p) => p.handle,
    ),
  );
  const todo = catalog.products
    .filter((p) => !already.has(p.handle))
    .map((p) => {
      const id = wanted.get(p.handle);
      if (!id) fail(`product ${p.handle} was never created — cannot publish it.`);
      return id;
    });

  if (todo.length === 0) {
    log(`publish ${storeHandle} — all ${catalog.products.length} already on sale`);
    return;
  }
  await command('catalog.product.publish_bulk', { product_ids: todo, store_id: store.id });
  log(`publish ${storeHandle} — ${todo.length} product(s) put on sale`);
}

/**
 * ★ STOCK — the third act, and D1 did none of it.
 *
 * `catalog.sku.create` prices a SKU. It does not stock one, and the kernel is right to refuse a cart line it
 * cannot serve: measured on this bench with all six coffees published and none stocked,
 * `cart.add_line` → `conflict · insufficient_stock · available: 0`. A catalogue nobody can put in a bag.
 *
 * Idempotent because it sets an ABSOLUTE `on_hand` rather than a delta — running it twice leaves the same
 * number, where two deltas would leave double. It is skipped entirely for a SKU already at or above the
 * declared figure, so a re-run does not overwrite stock somebody moved by hand on the bench.
 */
async function stock() {
  const fallback = catalog.default_on_hand;
  if (!fallback) fail('seed/catalog.json declares no `default_on_hand` — nothing would be buyable.');

  const bySku = new Map();
  for (const product of catalog.products) {
    for (const sku of product.skus) {
      bySku.set(`${product.handle}-${sku.options.map((v) => slug(v)).join('-')}`, sku.on_hand ?? fallback);
    }
  }

  // ⚠️ `stock_levels` AND NOT `products_admin`, and this cost a second wrong answer of the same shape as the
  // two above. `products_admin` publishes a sku's price, code, options and media and NOT its stock — measured,
  // its sku keys are [amount, code, compare_at_amount, currency, ean, id, is_default, media, metadata, name,
  // option_values, ref, status]. Reading `sku.on_hand` off it gave `undefined` for every sku, so `have` was
  // always 0, so every run re-set all 25. It was idempotent in EFFECT (an absolute `on_hand` twice is the same
  // number) and not in ACT — 25 commands and 25 audit rows per run, for nothing.
  //
  // ★ Third time tonight that a field name I did not measure was a defect. The rule this file now keeps: ask
  // the read whose NAME is the question, and look at its keys before using one.
  let moved = 0;
  for (const product of rows(await read('stock_levels', { limit: '100' }))) {
    for (const sku of product.skus ?? []) {
      const want = bySku.get(sku.sku_code);
      if (want === undefined) continue;
      if ((sku.on_hand ?? 0) >= want) continue;
      await command('inventory.adjust', {
        sku_id: sku.sku_id,
        on_hand: want,
        reason: 'correction',
        note: 'demo birth data',
      });
      moved += 1;
    }
  }
  log(moved === 0 ? 'stock — every sku already stocked' : `stock — ${moved} sku(s) set`);
}

const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────
log(`against ${api} as tenant ${tenant}`);
await stores();
await customFields();
await vocabulary();
await products();
await publish();
await stock();
log('done. Re-running this is a no-op.');
log(
  'NOT seeded, and named rather than silently missing: the three supporting products the catalogue ' +
    'document promises for bought-together and never lists. See seed/catalog.json.',
);

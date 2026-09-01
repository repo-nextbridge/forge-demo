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

if (!api) fail('no API base. Pass --api http://… or set FORGE_PUBLIC_ORIGIN (see .env.example).');
if (!token) {
  fail(
    'no FORGE_SEED_TOKEN. It is a TENANT API key, minted ONCE in the admin (Developers ▸ API keys) and\n' +
      '  kept in your secret store as `forge-seed-token` — see env-source.sh for why there is no headless\n' +
      '  way to mint one. The scopes it needs: tenant.store.write, catalog.product.write,\n' +
      '  catalog.sku.write, custom_fields.write, media.write, asset.write.',
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
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
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
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) fail(`read.${name} → HTTP ${res.status}\n  ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

const rows = (payload) => (Array.isArray(payload) ? payload : (payload?.rows ?? payload?.data ?? []));

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

// ── 2. the custom fields the catalogue uses ─────────────────────────────────────────────────────────────────
// DECLARED BEFORE ANY PRODUCT WRITES ONE. `catalog.product.create` validates declared product fields and
// leaves undeclared metadata keys free — so an undeclared `regiao` would be accepted and then be invisible to
// every faceting and PDP feature that reads declarations. Silent, and exactly the kind of thing that is found
// three slices later.
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
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
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
  const existing = new Set(rows(await read('products', { limit: '200' })).map((p) => p.handle));
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

const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────
log(`against ${api}`);
await stores();
await customFields();
await products();
log('done. Re-running this is a no-op.');
log(
  'NOT seeded, and named rather than silently missing: the three supporting products the catalogue ' +
    'document promises for bought-together and never lists. See seed/catalog.json.',
);

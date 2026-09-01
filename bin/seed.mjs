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
// The OUTLET store's own content (D2) — a module of its own, handed the port this file already built.
// It lives beside the data it drives rather than in here, so two slices can fill two stores without
// meeting in one file.
import { seedCoffee } from '../seed/coffee.mjs';
// The FORGE store (S1) — the sports shop, filled from the platform's example dataset by PATH rather than
// from a catalogue committed here. `mimeOf` comes from the same module because the mime of a dataset file
// is the dataset's business, and `upload()` below is the one place that needs to ask.
import { mimeOf, resolveMediaFile, seedForge } from '../seed/forge.mjs';
import { planRepoint, reuseKey, sha256 } from '../seed/media.mjs';
// WHICH SKUs STILL NEED STOCKING — a function, and it takes BOTH reads on purpose. See the file: the version
// that trusted `stock_levels` alone could not stock a product that had never been stocked, in silence.
import { planStock } from '../seed/stock.mjs';
import { createReadAll } from '../seed/paginate.mjs';
import { seedOutlet } from '../seed/outlet.mjs';
// The COUNTER (T2·S2) — the store the totem serves. A module of its own beside its data, like the two above,
// and it runs AFTER seedCoffee for a reason the kernel enforces: six of the twenty-one things it puts on sale
// are the coffee shop's OWN products, published into a second store rather than created a second time.
import { seedTotem } from '../seed/totem.mjs';
// The FORGE store's SHOP WINDOW (S4) — banners, shelves, pages and the merchandising promotions. A module of
// its own beside the catalogue's, and it runs AFTER it for a reason the commands enforce: a shelf sourced from
// a category and a promotion targeting a handle both resolve against products that have to be published first.
import { seedVitrine } from '../seed/vitrine.mjs';

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

// ── ★★ THE TWO PHASES, AND WHY THE WINDOW IS NOT A STEP OF THE FIRST ONE ─────────────────────────────────────
//
//   --phase curated   (default)  the terrain and the curated content: stores, vocabulary, declared fields,
//                                the six coffees, the outlet's eight, the counter's menu, the placeholders.
//   --phase window               the shop window of the sports store: the composed blocks, the app settings,
//                                the institutional pages, the DATASET's promotions, and the cache bust.
//
// ⚠️ THEY ARE TWO INVOCATIONS BECAUSE A THIRD PROCESS RUNS BETWEEN THEM. The massive half — the 2 790-product
// catalogue and the assortment — is filled by `dist/seed-demo.js`, a one-shot INSIDE the container. The order
// is therefore: this script (curated) → the one-shot (massive) → this script again (window).
//
// ★ AND THE WINDOW HAS TO BE LAST, FOR A REASON THAT IS NOT TASTE. It seeds the dataset's PROMOTIONS, and each
// one resolves its target by handle through the PUBLIC face — the only face that answers "is this on sale in
// THIS store?". Those targets are handles of the MASSIVE catalogue (`florsheim-shine-sponge`,
// `farm-rio-metal-chain-belt`, …). Run before the one-shot, every promotion target is unresolvable: the
// window needs the massive, and the massive needs the curated (it publishes curated handles it does not
// define). Three moments, one direction, no circle.
//
// ⚠️ THE CIRCLE WAS INVISIBLE UNTIL `seedForge` STOPPED BEING CALLED, and that is worth writing down rather
// than fixing quietly: this script used to create the 2 790 itself, a few lines above the window, so the
// window always found its targets. The crutch hid the dependency; removing it did not create one.
//
// ★ THE WINDOW ALSO CONVERGES WITH THE ONE-SHOT'S OWN PLACEMENT, and that is measured, not hoped: both read
// the SAME `storefront.json` and write the SAME config shape, and neither duplicates — the one-shot only
// re-points art when instances already exist (and the `banners` app declares `hooks: []`, so installing it
// places nothing), while this side takes over the empty default instance the `shelves` install leaves rather
// than adding a second. Running LAST, this side is the one whose config survives if the two ever diverge —
// the CURATED winning over the generated, which is the order that should win. They are not redundant; they
// are CONVERGENT, and the dangerous day is the day they stop deriving from one declaration.
const phase = argOf('--phase') ?? 'curated';
if (phase !== 'curated' && phase !== 'window') {
  fail(
    `unknown --phase "${phase}". It is "curated" (the terrain and the curated content) or "window"\n` +
      '  (the shop window, which runs AFTER the one-shot). See the README.',
  );
}

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

// ── ★★ TWO TENANTS, AND THE ONE THING THAT MAKES THAT DANGEROUS ─────────────────────────────────────────────
//
// This demo is TWO tenants — `forgeco` (the shoe brand: `forge` + `outlet`) and `forgecafe` (the coffee shop:
// `cafe` + `balcao`) — because a shoe brand and a coffee shop are not one company. Each has its OWN credential,
// and this script runs ONCE PER TENANT, the same shape the box already uses for `provision-ref`.
//
// ⚠️⚠️ THE INTERNAL READ FACE IGNORES `x-forge-tenant` AND RESOLVES THE TENANT FROM THE CREDENTIAL. Only the
// WRITE face honours the header. Measured on this bench, both halves:
//
//     GET  /v1/read/internal/stores   token=T1  header: x-forge-tenant: forgecafe
//       → HTTP 200  ["forge","outlet"]        ← the T1 stores. The header was ignored, and it did not say so.
//     POST /v1/commands/custom_field.define   token=T1  header: x-forge-tenant: forgecafe
//       → HTTP 403  {"code":"forbidden"}     ← the write face refuses, correctly.
//
// ★ WHY THAT IS WORSE THAN IT LOOKS FOR THIS FILE SPECIFICALLY: every idempotence check here is a READ. "Does
// this already exist?" asked with the wrong credential answers about the wrong tenant, confidently, with real
// data and a 200 — so a run can decide "already there, nothing to do" about a store it has never seen, and
// exit 0 having written nothing. The failure is a seed that reports success over an empty tenant.
//
// So the guard below is not "write first so the refusal shows" — it is better than that: THE READ'S OWN ANSWER
// IS THE PROOF. A credential can only ever show the stores of its own tenant, so asking it which stores it can
// see and comparing that against the stores this run intends to touch cannot be faked by the wrong token.
// It needs no ordering discipline and nobody has to remember to write first.
const storesOfThisTenant = catalog.stores.filter((s) => (s.tenant ?? tenant) === tenant);
if (storesOfThisTenant.length === 0) {
  fail(
    `seed/catalog.json declares no store for tenant "${tenant}". It knows: ` +
      `${[...new Set(catalog.stores.map((s) => `${s.handle}→${s.tenant}`))].join(', ')}.\n` +
      '  Pass --tenant with one of those, and the credential of THAT tenant.',
  );
}

/**
 * ★ THE CREDENTIAL IS IN THE TENANT IT CLAIMS — proven by what it can SEE, not by what it was told.
 *
 * Runs before the first write. A fresh tenant has exactly one store (`provision-ref`'s), which is enough: the
 * question is never "are all my stores there yet", it is "is this credential looking at MY tenant at all".
 */
async function assertCredentialTenant() {
  const seen = rows(await read('stores')).map((s) => s.handle);
  const mine = storesOfThisTenant.map((s) => s.handle);
  if (seen.length > 0 && !seen.some((handle) => mine.includes(handle))) {
    fail(
      `WRONG CREDENTIAL. This run says --tenant ${tenant}, whose stores are [${mine.join(', ')}], but the\n` +
        `  token in FORGE_SEED_TOKEN can only see [${seen.join(', ')}] — so it belongs to another tenant.\n` +
        '  ⚠️ The internal READ face resolves the tenant from the CREDENTIAL and ignores `x-forge-tenant`, so\n' +
        '  without this check every "does it already exist?" below would have answered about the wrong tenant,\n' +
        '  with a 200 and real data, and this run would have exited 0 having written nothing.\n' +
        `  Export the ${tenant} credential (the box keeps one per tenant) and run again.`,
    );
  }
  log(`credential check — sees [${seen.join(', ') || 'no store yet'}], expected to touch [${mine.join(', ')}]`);
}

// ── THE PACER ───────────────────────────────────────────────────────────────────────────────────────────────
//
// ★ S1 — THE KERNEL RATE-LIMITS THIS CREDENTIAL, AND UNTIL THE SPORTS STORE THERE WAS NO WAY TO NOTICE.
//
// `apps/api/src/index.ts:791` caps a credential at FORGE_RATE_LIMIT_PER_CREDENTIAL commands per
// FORGE_RATE_LIMIT_WINDOW_SECONDS — 6000/60s by default, which is what this box runs (both variables are
// empty in its .env, measured). Fourteen products never came close. The forge store is ~74 000 commands, so
// the cap is now the clock, and a seed that simply fires as fast as it can spends the difference collecting
// 429s and retrying — which costs MORE requests, not fewer.
//
// So the script paces ITSELF, below the cap, instead of discovering it. A token bucket refilling at a steady
// rate is the whole mechanism: the 429 handling further down stays as the net, and on a correctly paced run
// it never fires.
//
// ⚠️ IT COVERS READS TOO, and that is not caution. The limiter is ONE bucket over the command face AND the
// internal read face (`index.ts`'s own comment on `commandRateLimit` says so). A pacer that counted only
// writes would be a pacer that is wrong by exactly the number of reads.
const RATE_PER_SECOND = Number(process.env.FORGE_SEED_RATE_PER_SECOND ?? 85);
const pacer = (() => {
  let tokens = RATE_PER_SECOND;
  let last = Date.now();
  const queue = [];
  const refill = () => {
    const now = Date.now();
    tokens = Math.min(RATE_PER_SECOND, tokens + ((now - last) / 1000) * RATE_PER_SECOND);
    last = now;
  };
  const pump = () => {
    refill();
    while (queue.length > 0 && tokens >= 1) {
      tokens -= 1;
      queue.shift()();
    }
    if (queue.length > 0) setTimeout(pump, Math.ceil(1000 / RATE_PER_SECOND));
  };
  return () =>
    new Promise((resolve) => {
      queue.push(resolve);
      pump();
    });
})();

/**
 * One HTTP call to the kernel, paced, with the 429 net behind the pacer.
 *
 * A 429 that is retried immediately is a request that is refused again; the kernel's window is fixed, so the
 * only useful wait is until the window turns over. `retry-after` carries that when the kernel sends it.
 */
async function paced(url, init, describe) {
  for (let attempt = 0; ; attempt++) {
    await pacer();
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    if (attempt >= 5) {
      fail(
        `${describe} → HTTP 429 after ${attempt} retries. The credential's window ` +
          `(FORGE_RATE_LIMIT_PER_CREDENTIAL) is smaller than this seed's pace. Lower it with\n` +
          `  FORGE_SEED_RATE_PER_SECOND=<n>  (currently ${RATE_PER_SECOND}/s).`,
      );
    }
    const after = Number(res.headers.get('retry-after'));
    await new Promise((r) => setTimeout(r, Number.isFinite(after) && after > 0 ? after * 1000 : 2000));
  }
}

/**
 * One command through the tenant write face. The ONLY way this file changes anything.
 *
 * ★ S1 — `tolerate` names refusal CODES this caller is prepared to read as an answer instead of a death.
 * It exists for exactly one shape: `catalog.product.create` answering `conflict / handle_taken`, which is
 * the kernel saying "that product already exists". A seed racing its own projection can genuinely meet
 * that (see awaitQuietCatalogue in seed/forge.mjs), and dying on the kernel being RIGHT is the wrong
 * response. Everything not named still kills the run — the default is unchanged, and silence is not a
 * tolerated code anywhere.
 */
async function command(name, input, { tolerate = [] } = {}) {
  const res = await paced(
    `${api}/v1/commands/${name}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-forge-tenant': tenant,
      },
      body: JSON.stringify(input),
    },
    name,
  );
  const text = await res.text();
  if (!res.ok) {
    const body = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();
    // A refusal the CALLER declared it can read. Handed back as a value, never as a silent success: the
    // caller has to branch on `refused`, so it cannot mistake this for a command that ran.
    const reason = body?.details?.reason ?? body?.code;
    if (reason && tolerate.includes(reason)) return { refused: true, reason, error: body };
    // The kernel's refusals are actionable and this script must not swallow them: a seed that reports
    // "failed" instead of "handle already taken" costs somebody an hour of guessing.
    fail(`${name} → HTTP ${res.status}\n  ${text.slice(0, 900)}`);
  }
  return text ? JSON.parse(text) : {};
}

/** One read through the internal face — used ONLY to decide what already exists (idempotence). */
async function read(name, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await paced(
    `${api}/v1/read/internal/${name}${qs ? `?${qs}` : ''}`,
    { headers: { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant } },
    `read.${name}`,
  );
  if (!res.ok) fail(`read.${name} → HTTP ${res.status}\n  ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

// EVERY PAGE OF A READ — the mechanism, and the reason it exists, live in seed/paginate.mjs.
// Two paginators because there are two faces: the internal one answers "does this exist in the
// tenant?", and the public one is the only one that answers "is this ON SALE in this store?".
const readAll = createReadAll({ read, rows, fail });
const publicReadAll = createReadAll({ read: publicRead, rows, fail });


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
  const res = await paced(`${api}/v1/read/${name}${qs ? `?${qs}` : ''}`, {}, `read.${name} (public)`);
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
  for (const store of storesOfThisTenant) {
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
  for (const store of storesOfThisTenant) {
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
//
// ★ S1 — TWO THINGS IT USED TO ASSUME, AND BOTH WERE ONLY TRUE OF THE SIX COFFEES.
//
//   · THE MIME. It sent `image/png` for everything, because `seed/photos/` holds PNGs. The dataset's 18582
//     photographs are JPEG, and a JPEG announced as PNG gets a provider_key ending in `.png` with non-PNG
//     bytes behind it — a `content-type` the storefront's optimiser reads BEFORE it sniffs, so the picture
//     fails at the edge instead of being wrong in a way anyone can see. The mime now comes from the file.
//   · THE LIBRARY. It registered every upload with `asset.create`. That is right for the coffees (they are
//     Asset Library rows an operator sees) and wrong for a catalogue: 18582 product photographs would be
//     18582 extra commands and 18582 rows of library nobody curated. `media_ref` stores the provider_key
//     directly — a product photo needs no asset row — so `library` is now the caller's choice, and the
//     default keeps the old behaviour for the callers that already had it.
//
// ── ★★ THE CONTENT INDEX — how this seed notices that a FILE CHANGED ──────────────────────────────────
//
// THE HOLE IT FILLS, and it cost a slice of its own. The Renan re-cut the six coffee photographs (less
// transparent margin, 1024x1536 -> 733x1266) and re-running the seed changed NOTHING: `products()` skips a
// product that already exists, and `upload()` only ever ran for a product being created. The bytes on disk
// were new and the shop kept serving the old picture, in silence. Swapping a photo needed a human driving
// the port by hand.
//
// So the question this asks is no longer "does this product exist?" but "is the object in the store the
// SAME BYTES as the file on disk?". Nothing else answers it honestly: the provider_key cannot, because
// `media.request_upload` mints `<schema>/<ULID>-<slug>.<ext>` — a NEW key every call, whatever the content
// (its own generated summary calls that key "deterministic"; it is not, see plan-upload.ts:112). And the
// registered `size` cannot either: it is a 4-byte hash with a 1-in-nothing collision rate, and "the file
// changed but stayed the same length" is exactly the re-encode case a designer produces.
//
// ⚠️ IT IS MEASURED CHEAP, AND THAT MEASUREMENT IS WHY IT EXISTS RATHER THAN A CARD. The library is 49
// objects / 25.3 MB on this box, and reading every one of them back through the media route and hashing it
// takes **0.200 s**. It is one pass, cached for the run.
//
// ⚠️ AND IT IS SCOPED TO THE LIBRARY ON PURPOSE — `library: false` uploads never consult it. Those are the
// 18 520 catalogue photographs, which carry no `asset` row to index and would cost a 3.5 GB read on every
// run to hash. The catalogue path skips whole products instead, which is the right granularity for it. A
// content sweep there is a different slice, and its cost has to be paid deliberately, not by inheritance.
const contentIndex = (() => {
  /** filename -> Map<sha256, provider_key>. Built once, then kept current by upload() itself. */
  let building = null;
  const build = async () => {
    const assets = await readAll('assets');
    const byName = new Map();
    await Promise.all(
      assets.map(async (a) => {
        if (!a.filename || !a.provider_key) return;
        const res = await fetch(`${api}/v1/media/local/${a.provider_key}`);
        // An asset whose bytes are gone is not a match for anything; it is simply not indexed. Refusing the
        // whole run over one orphan row would make a harmless leftover fatal.
        if (!res.ok) return;
        const sha = sha256(Buffer.from(await res.arrayBuffer()));
        const byHash = byName.get(a.filename) ?? new Map();
        byHash.set(sha, a.provider_key);
        byName.set(a.filename, byHash);
      }),
    );
    return byName;
  };
  return {
    async lookup(filename, sha) {
      building ??= build();
      return reuseKey(await building, filename, sha);
    },
    async remember(filename, sha, providerKey) {
      building ??= build();
      const byName = await building;
      const byHash = byName.get(filename) ?? new Map();
      byHash.set(sha, providerKey);
      byName.set(filename, byHash);
    },
  };
})();

//
// @param file  a bare name (resolved inside `seed/photos/`) or an absolute path.
async function upload(file, { library = true } = {}) {
  const path = file.startsWith('/') ? file : join(SEED, 'photos', file);
  const filename = path.slice(path.lastIndexOf('/') + 1);
  const mime = mimeOf(filename);
  if (!mime) fail(`upload(${path}): this seed does not know the mime of "${filename}".`);
  const bytes = readFileSync(path);

  // ★ SAME NAME, SAME BYTES → the object is already in the store. Upload nothing and hand back the key it
  // already has. This is what makes a re-run with no file change cost ZERO uploads, and a re-run after a
  // re-cut cost exactly the files that changed.
  const sha = library ? sha256(bytes) : null;
  if (sha) {
    const already = await contentIndex.lookup(filename, sha);
    if (already) return already;
  }

  const plan = await (async () => {
    const res = await paced(
      `${api}/v1/media/commands/media.request_upload`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-forge-tenant': tenant,
        },
        body: JSON.stringify({ filename, mime, kind: 'image', size: bytes.byteLength }),
      },
      `media.request_upload(${filename})`,
    );
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

  // The PUT is NOT a command — it goes to the connector's own edge, so it is not paced and does not spend
  // the credential's window. Only the two commands around it do.
  const put = await fetch(url.startsWith('http') ? url : `${api}${url}`, {
    method: 'PUT',
    headers: { 'content-type': mime },
    body: bytes,
  });
  if (!put.ok) fail(`PUT ${url} → HTTP ${put.status}`);

  if (library) {
    await command('asset.create', { provider_key: key, filename, mime, kind: 'image', size: bytes.byteLength });
    // Two products naming the same photograph upload it once: the second finds it here.
    if (sha) await contentIndex.remember(filename, sha, key);
  }
  return key;
}

/** handle -> product id, filled by products() and read by repointMedia(). */
let existingIds = new Map();
/** sku code -> sku id, for the SKUs THIS RUN minted. Read by stock(); see the note there. */
const mintedSkus = new Map();

// ── 4. the products ─────────────────────────────────────────────────────────────────────────────────────────
async function products() {
  // ★ `products_admin` AND NOT `products`, and the difference is the whole question this read is asked.
  // ⚠️ Measured: `read.internal.products` does not exist, and `read.products` is the STORE's published list —
  // it demands a `store` and caps at 100 rows. A product this script has just created is not published to any
  // store yet, so asking the store's list would report "not there" for a product that IS there and create it
  // twice. `products_admin` is the tenant's WHOLE catalogue, drafts and unpublished included, and no store to
  // scope by — which is exactly the question "did I already make this?".
  const catalogue = await readAll('products_admin');
  const existing = new Set(catalogue.map((p) => p.handle));
  // The ids too: re-pointing a photograph needs the product, and `products_admin` is the only read here
  // that answers for a product which may not be published anywhere yet.
  existingIds = new Map(catalogue.map((p) => [p.handle, p.product_id ?? p.id]));
  const photos = new Set(readdirSync(join(SEED, 'photos')));

  for (const product of catalog.products) {
    if (existing.has(product.handle)) {
      // ★ ALREADY THERE IS NOT THE SAME AS UNCHANGED. Its photograph may have been re-cut since; the step
      // below is the only thing in this file that ever looks at a product it did not just create.
      await repointMedia(product, photos);
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
    // ★★ THE ID IS REMEMBERED THE MOMENT IT IS MINTED, and this line is a fix, not bookkeeping.
    //
    // `publish()` below resolved handle→id by re-reading `products_admin`, which is a PROJECTION. On a bench
    // where the products already existed that always worked; on a FRESH tenant it is a race, and this run
    // lost it: six coffees created, then `product forge-alvorada was never created — cannot publish it`,
    // with the product sitting in the catalogue. The command already handed us the id — asking a projection
    // for something we were just told is how a seed makes its own success unreadable.
    existingIds.set(product.handle, out.product_id ?? out.id);
    // ★★ AND THE SKU IDS, for the same reason and the same race — see `stock()` below. `catalog.product.create`
    // returns them in the order the skus were sent, which is the order this array was built in.
    for (const [i, sku] of skus.entries()) {
      const id = out.sku_ids?.[i];
      if (id) mintedSkus.set(sku.code, id);
    }
    log(`product ${product.handle} — created with ${skus.length} sku(s) (${out.product_id ?? '?'})`);
  }
}


/**
 * ★★ THE PHOTOGRAPH OF A PRODUCT THAT ALREADY EXISTS — the half `products()` did not have.
 *
 * A product is created ONCE, with its media inline, and from then on this file never looked at its pictures
 * again. So when the six coffee photographs were re-cut (1024x1536 -> 733x1266, less transparent margin)
 * re-running the seed changed nothing at all, and the shop kept serving the old frame. That is not the seed
 * being idempotent; it is the seed being blind.
 *
 * The desired state is the FILE ON DISK. `upload()` resolves it to a provider_key — the existing one when
 * the bytes match, a new one when they do not (see the content index above). If the product's current
 * reference already names that key, nothing happens and no command is spent. If it names another, the new
 * one is ATTACHED FIRST and the old one detached after: for the width of one command the product carries
 * two pictures, which is a strictly better failure than carrying none.
 *
 * ⚠️ THE OLD ASSET IS NOT DELETED, deliberately. Detaching drops the REFERENCE; the library row and the
 * bytes stay. An orphan costs a few MB on a demo box; deleting is destructive and irreversible, and this
 * script has no way to know who else points at those bytes.
 */
async function repointMedia(product, photos) {
  const id = existingIds.get(product.handle);
  if (!id) return; // never created here — nothing this file knows how to re-point
  if (!product.photo) return;
  if (!photos.has(product.photo)) {
    fail(`product ${product.handle} names photo "${product.photo}", which seed/photos/ does not have.`);
  }

  const want = await upload(product.photo);
  const refs = rows(await read('product_media', { product_id: id }));
  const plan = planRepoint(refs, want);
  if (!plan.attach && plan.detach.length === 0) {
    log(`product ${product.handle} — already there, photo unchanged`);
    return;
  }

  if (plan.attach) {
    await command('catalog.media.attach', {
      owner_type: 'product',
      owner_id: id,
      provider_key: want,
      kind: 'image',
      position: 0,
      alt: product.title,
    });
  }
  for (const mediaId of plan.detach) await command('catalog.media.detach', { media_id: mediaId });
  log(
    `product ${product.handle} — photo RE-POINTED (${plan.detach.length} old reference(s) detached; ` +
      'the old assets are KEPT, not deleted)',
  );
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
    (await readAll('products_admin')).map((p) => [p.handle, p.product_id ?? p.id]),
  );
  // ⚠️ AND THE IDS THIS RUN JUST MINTED WIN OVER THE PROJECTION. `products_admin` is a projection and a
  // product created seconds ago may not be in it yet — measured on a fresh tenant, where the read came back
  // without the six coffees that had just been created and this step died naming one of them. What the
  // command returned is not a cache of the truth; it IS the truth.
  for (const [handle, id] of existingIds) if (id) wanted.set(handle, id);
  const already = new Set(
    (await publicReadAll('products', { store: store.id, projection: 'feed' })).map((p) => p.handle),
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

  // ⚠️⚠️ THIS STEP USED TO WALK `stock_levels` ALONE, AND IT COULD NOT STOCK A NEW PRODUCT AT ALL.
  //
  // That read's SQL ends in `having present_count > 0` (packages/core/src/read/
  // inventory-admin-capabilities.ts) and its own summary says it in words: it "lists the products this
  // warehouse stocks something of". A SKU that has never been stocked has no `stock` row, so it is not in
  // the answer — and a loop over the answer therefore found NOTHING to do for the six coffees, logged
  // "stock — every sku already stocked", and exited 0 over a shop nobody could buy from.
  //
  // MEASURED on the totem bench 2026-09-01: `stock_levels` answered `total: 8` (the Outlet's eight, which
  // seed/outlet.mjs stocks by a different path — with the ids `catalog.product.create` returns — and which
  // is why it never met this), the six coffees were absent, and `cart.add_line` on the Alvorada answered
  // `conflict · insufficient_stock · available: 0`.
  //
  // ⚠️ AND IT DID NOT REPRODUCE ON A BENCH THAT HAD BEEN RUNNING FOR A WHILE — a box carrying stock from
  // earlier rounds has the rows, so the loop tops them up and looks right. Day one of a real customer is
  // exactly the case it fails, which is what makes it worth fixing here rather than working around it.
  //
  // ★ THE SHAPE OF THE FIX IS THE LESSON THIS FILE ALREADY WROTE TWICE — ask the read whose NAME is the
  // question. "Which SKUs exist?" is `products_admin`; "what are the stocked ones at?" is `stock_levels`;
  // neither answers the other. `planStock` requires BOTH, so the blind version is not writable through it.
  //
  // ⚠️ `stock_levels` PAGES (limit caps at 200, by PRODUCT) and truncates `skus` past 50 per product
  // (`skus_truncated: true`) — harmless for products with 1–6 SKUs, and named so the next person to grow
  // one knows it is there.
  // ⚠️⚠️ THE THIRD TIME THIS PROJECTION RACE HAS BILLED THIS REPOSITORY TODAY, and the first time this
  // particular path ever RAN far enough to meet it.
  //
  // MEASURED on a fresh box: this step died with `declares 25 sku code(s) the catalogue has no sku for`, and
  // minutes later the SAME read answered `products: 6 | sku codes: 25` — exactly those codes. The skus
  // existed; what did not exist, at the instant of the question, was the PROJECTION. `products_admin` is one.
  //
  // ★ WHY THE MINTED IDS AND NOT `awaitQuietCatalogue`, WHICH THIS REPOSITORY ALSO HAS. Because for THIS
  // path the minted ids are already the house pattern, 3 sites to 0: `seed/outlet.mjs` stocks straight from
  // `out.sku_ids` (which is exactly why it never had this bug), `seed/totem.mjs` does the same, and
  // `publish()` above resolves handle→id the same way. `awaitQuietCatalogue` answers a DIFFERENT question,
  // in `seed/forge.mjs`: there ~2 790 products are created in pools and the whole catalogue has to become
  // readable to compute a skip set — there is no minted map at that scale. Adding a wait here would be a
  // second technique for one problem, and two techniques is how a repository ends up with two truths.
  //
  // ★ AND IT COVERS EXACTLY THE WINDOW WHERE THE RACE EXISTS, which is what makes it better than a wait: the
  // race is only possible for a product created THIS RUN — and that is precisely when a minted id exists. On
  // a re-run the projection settled long ago and `products_admin` answers for everything. No polling, no
  // timeout that can still be wrong.
  const catalogue = [
    ...(await readAll('products_admin')),
    { skus: [...mintedSkus].map(([code, id]) => ({ code, id })) },
  ];
  const { adjustments, missing } = planStock(
    bySku,
    catalogue,
    await readAll('stock_levels', { limit: '200' }),
  );
  if (missing.length > 0) {
    // A declared sku code that no product answers to is a catalogue bug, and skipping it in silence is how
    // a product ends up published, priced and permanently unbuyable.
    // ⚠️ IT SAYS WHAT IT MEASURED, AND STOPS THERE — and the old sentence is the defect of the day in
    // miniature. It read "Either the product was never created, or its option values were renamed after it
    // was": TWO causes, confidently, and the real one was a THIRD it did not list — the read had not caught
    // up. Whoever read it went looking for a missing product and a renamed option, found both plausible, and
    // lost half an hour. A message that asserts more than it measured is the same species as "re-run this
    // script": it spends somebody else's time on the author's guess.
    fail(
      `stock — ${missing.length} sku code(s) this seed declares are in no product that ` +
        `read.internal.products_admin answered with, and were not minted by this run:\n` +
        `    ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` … (+${missing.length - 5})` : ''}\n` +
        `  MEASURED: that read answered ${catalogue.length - 1} product(s); this run minted ` +
        `${mintedSkus.size} sku(s).\n` +
        '  This does NOT say why. Ask the read again before assuming: if the codes appear a moment later, it\n' +
        '  was the projection and not the catalogue. If they do not, the product was never created or an\n' +
        '  option value was renamed after it was — and those two look identical from here.',
    );
  }
  for (const adjustment of adjustments) {
    await command('inventory.adjust', {
      sku_id: adjustment.sku_id,
      on_hand: adjustment.on_hand,
      reason: 'correction',
      note: 'demo birth data',
    });
  }
  log(
    adjustments.length === 0
      ? `stock — every one of the ${bySku.size} sku(s) already stocked`
      : `stock — ${adjustments.length} of ${bySku.size} sku(s) set`,
  );
}

const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * ★ THE PLACEHOLDER ART, INTO THE ASSET LIBRARY — where the curation happens.
 *
 * Order of the Renan: *"onde precisa de banner mas não tem imagem, cria uma imagem qualquer e sobe. Eu depois
 * faço a curadoria."* `bin/make-placeholders.mjs` DRAWS them (deterministic, captioned with their own slot,
 * store and size); this puts them where a person can find and replace them.
 *
 * ⚠️ `library: true` IS THE WHOLE POINT. A product photograph needs no asset row — but these exist to be
 * BROWSED and swapped one at a time, which is exactly what the Asset Library is. One search for
 * `placeholder-` returns the set.
 *
 * ⚠️ AND ONLY THIS TENANT'S SHOPS. The file name carries the store handle, so a run uploads the art of the
 * stores it owns and leaves the other tenant's to the other run. The alternative — every tenant holding every
 * shop's placeholder — is a library where the search returns other people's shops.
 *
 * Idempotent for free: `upload()` matches on name AND bytes, and the generator is byte-stable, so a re-run
 * uploads nothing. That pairing is the reason the generator pins the PNG time chunk.
 */
async function placeholders() {
  let dir;
  try {
    dir = readdirSync(join(SEED, 'placeholder-media'));
  } catch {
    log('placeholders — seed/placeholder-media/ is not there; run `node bin/make-placeholders.mjs`');
    return;
  }
  const handles = storesOfThisTenant.map((s) => s.handle);
  const mine = dir.filter(
    (file) => file.startsWith('placeholder-') && handles.some((h) => file.startsWith(`placeholder-${h}-`)),
  );
  if (mine.length === 0) {
    log('placeholders — none for this tenant\'s shops');
    return;
  }
  for (const file of mine) await upload(join(SEED, 'placeholder-media', file), { library: true });
  log(
    `placeholders — ${mine.length} in the Asset Library for [${handles.join(', ')}]. ` +
      'To curate: search "placeholder-" there and replace them one at a time.',
  );
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// ★ ONCE PER TENANT, and each step runs only where its store lives. The same shape the box already uses for
// `provision-ref`: two tenants, two runs, two credentials. A step whose store belongs to the OTHER tenant is
// SKIPPED with a line — never failed, because "not mine" is the ordinary state of half this file on any run.
//
// ⚠️ AND THIS SCRIPT OWNS THE CURATED HALF ONLY. The 2 790-product catalogue and the assortment belong to the
// dataset and to `demo-data`'s `populate`, which runs as a one-shot INSIDE the box. The boundary is CURATED ×
// MASSIVE: what a HUMAN WROTE lives here (the six coffees and their descriptions, the counter's menu, the
// outlet's eight, and the curated promotions — the identity of this demo); what a GENERATOR produced lives
// there (the volume, and which shop sells what).
//
// ⚠️⚠️ ORDER CONTRACT, and it binds the box's script: THIS RUNS BEFORE THE ONE-SHOT. `populate` PUBLISHES the
// curated handles it does not define — so they have to exist first. Inverted, the publication fails loudly
// naming the handle and the shop (which is the right behaviour, and still a morning lost to wondering why).
log(`against ${api} as tenant ${tenant} — phase ${phase}`);
await assertCredentialTenant();
const here = (handle) => storesOfThisTenant.some((s) => s.handle === handle);

if (phase === 'curated') {
await stores();
await customFields();
await placeholders();
await vocabulary();
// The six coffees are the COFFEE store's, so they are created on that tenant's run and nowhere else.
if (here(catalog.products_store)) {
  await products();
  await publish();
  await stock();
} else {
  log(`catalogue — the "${catalog.products_store}" store is not on this tenant; its six coffees are not mine to create`);
}
// The OUTLET store, which shares only the stores and the field declarations with everything above it.
if (here('outlet')) {
  await seedOutlet({ api, token, tenant, command, read, readAll, rows, log, fail });
} else {
  log('outlet — not on this tenant, skipped');
}
// The COFFEE store's own half: the subscription mark on the SKUs the merchant curated, and the promotion
// that prices it. Same shape as the Outlet's — one store, one file, the seed keeps deciding the order.
if (here('cafe')) {
  await seedCoffee({ api, token, tenant, command, read, readAll, rows, log, fail });
} else {
  log('coffee — not on this tenant, skipped');
}
// The COUNTER's own half: its store, the four bands of the menu, the fifteen products only it sells, the
// publication of the six coffees it re-sells, the pickup point every order needs, and its two promotions.
// `uploadAsset` and not the bare `upload`: fifteen photographs an operator curates ARE Asset Library rows —
// the opposite of the catalogue photographs below, which carry no asset row on purpose.
if (here('cafe')) {
  // The counter is the coffee shop's second store — same tenant, created by the module itself.
  await seedTotem({
  api,
  token,
  tenant,
  command,
  read,
  readAll,
  publicRead,
  publicReadAll,
  rows,
  log,
  fail,
    uploadAsset: (file) => upload(file, { library: true }),
  });
} else {
  log('totem — the counter is not on this tenant, skipped');
}
// The FORGE store — the sports shop. Last, and it is the only one whose content does not live in this repo:
// it comes from the dataset directory FORGE_SEED_DATASET_DIR points at. Unset → one line and a no-op.
// Its uploads are NOT library assets: 2790 products' photographs are catalogue, not curated inventory.
// ⛔⛔ THE SPORTS CATALOGUE IS NOT THIS SCRIPT'S ANY MORE — AND IT WAS ABOUT TO BE FILLED TWICE.
//
// Measured on the bench, step 8 of the box script: `[seed] forge — 33 categories, 351 brands, 2790 products`
// and `0 of 2790 already on sale`. The one-shot at step 9 fills the SAME 2 790 from the SAME dataset. Two
// pieces filling one thing is the shape this repository has already paid for twice — it is how one of them
// rots without anybody seeing (`stock()` was the last one), and here it would also have every product created
// by whichever ran first and re-published by the other.
//
// ★ THE BOUNDARY DECIDES, and it is the one the spec now carries (§3.3): the demo repo owns the CURATED — what
// a HUMAN wrote, the six coffees with their descriptions, the counter's menu, the outlet's eight, the curated
// promotions — and the dataset + `demo-data`'s `populate` own the MASSIVE and the ASSORTMENT: what a GENERATOR
// produced. `seedForge` fills the massive. It is therefore not called.
//
// ⚠️ THE FILE IS NOT DELETED, AND THAT IS DELIBERATE. Retiring it is a COMPARISON, not a decision: the one-shot
// published 2 555 into this shop and this would have published 2 790, and until that difference is EXPLAINED
// nothing gets deleted. What is measured so far (see RELATORIO-P-B §8): the assortment rule excludes nothing —
// it matches all 2 790 — and the dataset holds no duplicate handle, no product without a sku and no product in
// an undeclared category. So the two numbers are not the same measurement: 2 790 is what this would DISPATCH,
// 2 555 is what the public feed REPORTS, and that read is gated by an active sku and by projection freshness.
// The comparison finishes on the box; the call stops now because the collision is real either way.
//
// ★ AND THE SYMPTOM THAT BLOCKED THE BOX GOES WITH IT: no host process needs the dataset's 3,6 GB of photos
// any more, so the ENOENT on `/data/seed-photos` — a CONTAINER path handed to a HOST process — stops existing.
// That was ownership wearing a wiring costume, exactly like the custom-field collision.
if (false) {
  await seedForge({
  api,
  token,
  tenant,
  command,
  read,
  readAll,
  publicRead,
  publicReadAll,
  rows,
  log,
  fail,
    upload: (file) => upload(file, { library: false }),
  });
} else {
  log(
    'forge — the sports catalogue is the dataset\'s and the one-shot fills it (`dist/seed-demo.js`). This ' +
      'script owns the CURATED half only. Run the one-shot AFTER this one: it publishes curated handles it ' +
      'does not define.',
  );
}
// The FORGE store's WINDOW, after its catalogue. `uploadAsset` and not `upload`: a banner tile references the
// asset LIBRARY by id, so those seven files ARE curated inventory an operator sees in the admin — the opposite
// of the 18582 catalogue photographs above, which carry no asset row on purpose.
log('curated — done. Next: the one-shot (`dist/seed-demo.js`), then `--phase window`.');
} // ── end of the curated phase ───────────────────────────────────────────────────────────────────────────────

// ── ★ THE WINDOW — AFTER the one-shot, never before. The header of `--phase` says why. ──────────────────────
if (phase === 'window') {
if (here('forge')) {
  await seedVitrine({
  api,
  token,
  tenant,
  command,
  read,
  readAll,
  publicRead,
  rows,
  log,
  fail,
  uploadAsset: (file) => upload(file, { library: true }),
    resolveMedia: resolveMediaFile,
  });
} else {
  log('vitrine — the sports store is not on this tenant, skipped');
}
} // ── end of the window phase ────────────────────────────────────────────────────────────────────────────────
log('done. Re-running this is a no-op.');
log(
  'NOT seeded, and named rather than silently missing: the three supporting products the catalogue ' +
    'document promises for bought-together and never lists. See seed/catalog.json.',
);

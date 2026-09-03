#!/usr/bin/env node
// WHAT THE SEED ACTUALLY LEFT BEHIND — the measurement, parameterised, so proving the bench is a command
// and not an improvisation at eleven at night.
//
//   FORGE_SEED_TOKEN=… node bin/verify-seed.mjs --api http://localhost:8200 --tenant forgeco
//   FORGE_SEED_TOKEN=… node bin/verify-seed.mjs --api http://localhost:8200 --tenant forgecafe
//
// One tenant per run, exactly like `bin/seed.mjs` and for the same reason: the internal read face resolves
// the tenant from the CREDENTIAL, so a run can only honestly speak about the tenant whose token it holds.
// Two runs are the whole picture.
//
// ── ★★ WHAT IT REFUSES, AND WHY THAT IS THE POINT ───────────────────────────────────────────────────────
//
// A verifier that prints numbers whatever it finds is worse than no verifier: on a half-filled box it prints
// a small number, the number looks like a number, and somebody reads it as a result. Every check below
// therefore has an EXPECTATION, and a shop that has fewer products than the seed declares is reported
// `INCOMPLETE` — not as a count. The exit code is non-zero unless everything it checked is settled.
//
// ⚠️ The expectations are DERIVED from the same files the seed reads, never typed here: `seed/catalog.json`
// (the six coffees), `seed/totem.json` (the counter's fifteen plus the six it re-sells) and
// `seed/outlet.json` (the eight). A number typed into a verifier is a number that stops being true the day
// somebody edits the catalogue, and it stops being true SILENTLY — which is the whole failure this file is
// supposed to catch.
//
// ★ AND IT MEASURES THE NEGATIVE, which is the half nobody remembers to measure. "The counter got its pickup
// point" is easy to see; "the counter got NO freight and NO free-shipping promotion" is the half that would
// go unnoticed for a month, and it is the Renan's own rule — *"não faz sentido nascer dado de promoção de
// frete grátis para o totem"*.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// ⚠️ THE EXPECTATIONS ARE IMPORTED, NEVER RE-TYPED. `seed/coffee.mjs` is what the SEED writes from; a
// verifier with its own copy of the nine field names would agree with a stale catalogue and say so proudly.
import { COFFEE_PROMOTIONS, expectedCoffees } from '../seed/coffee.mjs';
// The pool is graded here for the same reason everything else is: what it declares is worthless until the
// box holds it, and the one way it can go wrong is invisible on every screen.
import { poolProducts } from '../seed/pool.mjs';

const SEED = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const read = (name) => JSON.parse(readFileSync(join(SEED, name), 'utf8'));

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
const token = process.env.FORGE_SEED_TOKEN ?? '';

const out = [];
const say = (line = '') => out.push(line);
let failures = 0;
const fail = (message) => {
  process.stderr.write(`[verify] ${message}\n`);
  process.exit(2);
};
/** A settled check. */
const ok = (label, detail) => say(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
/** A check that came out wrong, or a box that is not finished. Both are non-zero exits: a verifier that
 *  distinguished "wrong" from "not ready" by exit code would invite a script to treat one as success. */
const bad = (label, detail) => {
  failures += 1;
  say(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

if (!api) fail('no API base. Pass --api http://… (or set FORGE_PUBLIC_ORIGIN).');
if (!tenant) fail('no tenant. Pass --tenant forgeco | forgecafe.');
if (!token) fail('no FORGE_SEED_TOKEN. Export the credential OF THAT TENANT — the read face resolves the\n  tenant from the credential, so the wrong one answers about the wrong tenant, with a 200.');

/** An internal read. A transport failure is FATAL and never an empty answer: "the box is not up" and "the box
 *  is up and empty" are opposite facts, and only one of them is a result. */
async function internal(name, params = {}) {
  const qs = new URLSearchParams(params).toString();
  let res;
  try {
    res = await fetch(`${api}/v1/read/internal/${name}${qs ? `?${qs}` : ''}`, {
      headers: { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant },
    });
  } catch (error) {
    fail(`cannot reach ${api} — ${error?.message ?? error}.\n  Nothing was measured.`);
  }
  if (!res.ok) fail(`read.${name} → HTTP ${res.status}. Nothing was measured.`);
  return res.json();
}

async function publicRead(name, params = {}) {
  const qs = new URLSearchParams(params).toString();
  let res;
  try {
    res = await fetch(`${api}/v1/read/${name}${qs ? `?${qs}` : ''}`);
  } catch (error) {
    fail(`cannot reach ${api} — ${error?.message ?? error}. Nothing was measured.`);
  }
  if (!res.ok) return null; // a store the public face cannot resolve yet — the caller decides what that means
  return res.json();
}

const rows = (payload) => (Array.isArray(payload) ? payload : (payload?.items ?? []));

/**
 * EVERY page of an internal read.
 *
 * ⚠️ IT PAGES BECAUSE THE NEGATIVE CHECK MUST NOT BE ABLE TO MISS. Asking for one page and asserting "no
 * free-shipping promotion on the counter" over it is an assertion about the first N rows, dressed as an
 * assertion about the shop — and it fails in the dangerous direction: it says the rule holds when the
 * offending row is on page two. (The dry run also found the cap: `promotions_admin` refuses `limit=200` with
 * `too_big … maximum: 100`, so a hand-picked large limit is not a substitute for paging either.)
 */
async function allOf(name, params = {}) {
  const limit = 100;
  const all = [];
  for (let page = 1; page <= 1000; page++) {
    const payload = await internal(name, { ...params, limit: String(limit), page: String(page) });
    const batch = rows(payload);
    if (Array.isArray(payload)) return batch; // an unpaginated read answers a bare array
    all.push(...batch);
    if (batch.length < limit) return all;
  }
  fail(`read.${name} never ran out of pages — refusing to guess what it holds.`);
}

// ── the expectations, derived ───────────────────────────────────────────────────────────────────────────
const catalog = read('catalog.json');
const totem = read('totem.json');
const outlet = read('outlet.json');
// ★ WHOSE CATALOGUE THE MOUNTED DATASET IS — the field `bin/box-up.sh` reads to decide who step 9 runs for.
// This file reads the SAME declaration so it grades the box against what the box was told to build.
const box = read('box.json');
const boxTenant = box.tenants.find((t) => t.id === tenant);
const carriesDataset = boxTenant?.dataset === true;

/** handle → how many products this REPOSITORY CREATES in that shop. Not the same question as `EXPECTED`
 *  above, which counts what a shop PUBLISHES: `balcao` re-publishes six coffees it does not create, and
 *  `outlet`/`forge` create nothing at all — every product they sell is the dataset's, written by the
 *  one-shot. A tenant's whole catalogue is the sum of this, and nothing else may be in it. */
const CREATES = {
  cafe: catalog.products.length,
  balcao: totem.products.length,
  outlet: 0,
  forge: 0,
};

/** ⛔ AND THE PRODUCTS THAT BELONG TO NO SHOP AT ALL — the STOCK POOL (`seed/catalog.json` →
 *  `stock_pool`, and `seed/pool.mjs` creates them). They are keyed by no store handle because being on
 *  sale nowhere is the whole point of them: step 10 builds the stock screen's three alert states by
 *  zeroing them, which it may only do to something nobody is selling.
 *
 *  ⚠️ THEY MUST BE IN THIS SUM. Section 1 counts what each shop PUBLISHES and will never see them; this
 *  section counts what the TENANT HOLDS and would otherwise read two unexplained products as another
 *  brand's catalogue leaking in — the exact accusation this section exists to make, made falsely. */
const CREATES_WITHOUT_A_SHOP = (catalog.stock_pool?.products ?? []).length;

/** key → the module of THIS repository that declares it, for the tenant that owns that module's store.
 *  Derived from the same files the seeds read; a name typed here would agree with a stale catalogue. */
const OWN_WORDS = [
  { store: catalog.products_store, source: 'seed/catalog.json', keys: (catalog.custom_fields ?? []).map((f) => f.key) },
  { store: 'balcao', source: 'seed/totem.json', keys: (totem.custom_fields ?? []).map((f) => f.key) },
];

/** handle → how many products the seed declares that shop sells. `forge` is the dataset's and its size is
 *  not knowable from this repository — reported as a count, never judged. */
const EXPECTED = {
  cafe: catalog.products.length,
  balcao: totem.products.length + totem.publish_also.handles.length,
  outlet: outlet.products.length,
};
/** handle → what that kind of shop is allowed to have. Mirrors the dataset's archetype table. */
const ARCHETYPE = {
  forge: 'shoes',
  outlet: 'outlet',
  cafe: 'coffee',
  balcao: 'counter',
};
/** The shops that must NEVER carry freight or a free-shipping promotion. */
const COUNTERS = ['balcao'];

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────
const stores = rows(await internal('stores'));
const mine = catalog.stores.filter((s) => (s.tenant ?? tenant) === tenant).map((s) => s.handle);
const seen = stores.map((s) => s.handle);
if (seen.length > 0 && !seen.some((h) => mine.includes(h))) {
  fail(
    `WRONG CREDENTIAL. --tenant ${tenant} owns [${mine.join(', ')}], but this token can only see\n` +
      `  [${seen.join(', ')}]. The internal read face resolves the tenant from the CREDENTIAL, so every\n` +
      '  number below would have been about the wrong tenant. Nothing was measured.',
  );
}

say(`verify-seed — ${api}, tenant ${tenant}`);
say(`  credential sees [${seen.join(', ') || 'no store'}]`);
say();

// ── 1. the shops ────────────────────────────────────────────────────────────────────────────────────────
say('THE SHOPS — published products, against what the seed declares');
const byHandle = new Map(stores.map((s) => [s.handle, s]));
for (const handle of seen) {
  const archetype = ARCHETYPE[handle] ?? '(not one of the four)';
  const store = byHandle.get(handle);
  const page = await publicRead('products', { store: store.id, projection: 'feed', limit: '1', page: '1' });
  if (page === null) {
    // The public face resolves store→tenant through a projection the relay fills; a brand-new store 404s
    // there for a moment. That is "not ready", never "empty".
    bad(`${handle} (${archetype})`, 'the public face does not resolve this store yet — the box is not ready');
    continue;
  }
  const total = Number(page.total ?? 0);
  const want = EXPECTED[handle];
  if (want === undefined) {
    say(`  · ${handle} (${archetype}) — ${total} published (this shop's size is the dataset's; not judged)`);
    if (total === 0) bad(`${handle}`, 'nothing published — the one-shot has not filled it');
    continue;
  }
  if (total === want) ok(`${handle} (${archetype})`, `${total} published, exactly what the seed declares`);
  else bad(`${handle} (${archetype})`, `${total} published, INCOMPLETE — the seed declares ${want}`);
}
say();

// ── 2. ★ THE NEGATIVE ───────────────────────────────────────────────────────────────────────────────────
say('THE NEGATIVE — what must NOT have been born (the half nobody measures)');
const counters = seen.filter((h) => COUNTERS.includes(h));
if (counters.length === 0) {
  say('  · no counter on this tenant — nothing to assert here');
} else {
  const promotions = await allOf('promotions_admin');
  const methods = rows(await internal('shipping_methods_admin'));
  const points = rows(await internal('pickup_locations'));

  for (const handle of counters) {
    const store = byHandle.get(handle);
    const freight = promotions.filter(
      (p) => p.store_id === store.id && (p.benefit?.kind ?? p.class) === 'free_shipping',
    );
    if (freight.length === 0) ok(`${handle}`, 'NO free-shipping promotion — the counter hands goods over');
    else bad(`${handle}`, `${freight.length} free-shipping promotion(s): ${freight.map((p) => p.name).join(', ')}`);
  }

  // ★ s7-11 · BUILD VOCABULARY AS THE TITLE OF A ROW IN THE OPERATOR'S PROMOTION LIST. The kernel's demo-data
  // app names its promotions `DEMO-HIST-01-FORGE`, `DEMO-HIST-D2`… — correct where it lives, and a database
  // dump on a demo screen. The commerce pass renames each of them to its own curated `label`; this is that
  // rename asked of the box.
  {
    const internalNames = promotions.filter((p) => /^DEMO-HIST[-_]/.test(String(p.name ?? '')));
    if (internalNames.length === 0)
      ok('the promotion list', `${promotions.length} promotion(s), no build vocabulary on the screen`);
    else
      bad(
        'the promotion list',
        `${internalNames.length} promotion(s) still titled with an internal name: ` +
          `${internalNames.map((p) => p.name).join(', ')} — the commerce pass renames them to their label`,
      );
  }

  // The counter's own half must exist, or the negative above is true for the wrong reason (nothing was
  // seeded at all). A negative with no positive beside it is not a measurement.
  const pickupMethods = methods.filter((m) => m.kind === 'pickup');
  if (pickupMethods.length >= 1) ok('pickup method', `${pickupMethods.map((m) => m.name).join(', ')} (kind: pickup)`);
  else bad('pickup method', 'none — the counter cannot hand anything over');
  if (points.length >= 1) ok('pickup point', points.map((p) => p.name).join(', '));
  else bad('pickup point', 'none — place_order would have nowhere to send the buyer');

  const delivery = methods.filter((m) => m.kind !== 'pickup');
  const delivers = seen.filter((h) => ARCHETYPE[h] && ARCHETYPE[h] !== 'counter');
  // ⚠️ THE FOUR CASES, AND THE DRY RUN CAUGHT ME COLLAPSING TWO OF THEM. "No delivery method" is only good
  // news when no shop here delivers; on a tenant that HAS a delivering shop it is a missing half, and the
  // first version of this printed the reassuring sentence for both. A verifier that says "none — and no shop
  // here delivers" over a coffee e-commerce is worse than silence.
  if (delivers.length === 0 && delivery.length > 0) {
    bad('delivery', `${delivery.length} delivery method(s) on a tenant whose only shop is a counter`);
  } else if (delivers.length === 0) {
    ok('delivery', 'none — and no shop here delivers');
  } else if (delivery.length > 0) {
    ok('delivery', `${delivery.length} method(s) — legitimate: ${delivers.join(', ')} deliver(s)`);
  } else {
    bad('delivery', `none, but ${delivers.join(', ')} deliver(s) — those shops cannot quote freight`);
  }
}
say();

// ── 2b. ★★★ WHOSE CATALOGUE AND WHOSE WORDS — the crossing nobody could see from the shop window ─────────
//
// ⛔ THE DEFECT THIS SECTION EXISTS FOR, AND IT WAS INVISIBLE TO EVERY CHECK ABOVE. On the bench of 02/09 the
// COFFEE tenant held 2 811 products and 44 490 SKUs: its own 21 plus the footwear dataset's 2 790, because
// step 9 of `bin/box-up.sh` ran `for t in $TENANTS` and `dist/seed-demo.js` fills the tenant it is pointed at.
// The mirror was true too — the footwear tenant's product form offered TORRA, FAZENDA and PONTUAÇÃO SCA,
// because `bin/seed.mjs` declared the coffee vocabulary on whatever tenant it was pointed at.
//
// ⚠️⚠️ AND SECTION 1 WOULD NEVER HAVE CAUGHT IT, WHICH IS THE LESSON WORTH MORE THAN THE CHECK. Those 2 790
// products were UNPUBLISHED in both coffee stores — the vitrine was spotless — and section 1 counts what the
// PUBLIC face publishes. The dirt was in the tenant's DATA and on the merchant's screens, and only a read
// that answers for the whole tenant can see it. `products_admin` is that read: no store, drafts included.
//
// ★ IT GRADES THE RESULT, NEVER THE DECLARATIONS. Asking "does box.json still say dataset: false?" would be
// asking the input whether the input is right, and it would stay green through any edit that reintroduced the
// crossing by another road — a hand-run one-shot, a second dataset, an app installed by mistake. What is
// asked here is what the tenant actually HOLDS, through the door, and the numbers come from the declarations
// rather than from this file.
say("THE TENANT'S OWN CATALOGUE — nothing from a brand this tenant is not");
{
  const held = Number((await internal('products_admin', { limit: '1', page: '1' }))?.total ?? 0);
  const mineCreated =
    seen.reduce((sum, handle) => sum + (CREATES[handle] ?? 0), 0) +
    // The pool rides with the shop whose catalogue file declares it, and on no other tenant's run.
    (seen.includes(catalog.products_store) ? CREATES_WITHOUT_A_SHOP : 0);
  const unaccounted = seen.filter((handle) => CREATES[handle] === undefined);
  if (carriesDataset) {
    // The dataset's size is not knowable from this repository, so it is reported and never judged — the same
    // rule section 1 applies to the `forge` shop. What IS judged is that it is not empty.
    if (held > mineCreated) {
      ok(`${tenant}`, `${held} product(s) — this tenant carries the box's dataset, so its size is the dataset's`);
    } else {
      bad(`${tenant}`, `${held} product(s), but this tenant carries the dataset — the one-shot has not filled it`);
    }
  } else if (unaccounted.length > 0) {
    // A shop this file has no CREATES entry for makes the sum a guess, and a guess dressed as an expectation
    // is the failure this whole verifier was written against.
    bad(
      `${tenant}`,
      `${held} product(s), and [${unaccounted.join(', ')}] is a shop this file cannot size — add it to CREATES`,
    );
  } else if (held === mineCreated) {
    ok(`${tenant}`, `${held} product(s), exactly what this repository creates here — no other brand's catalogue`);
  } else {
    bad(
      `${tenant}`,
      `${held} product(s), and this repository creates ${mineCreated} here — ${held - mineCreated} came from ` +
        "somewhere else. `dataset` is not true for this tenant in seed/box.json, so step 9 of bin/box-up.sh " +
        'must not have filled it; check who did (the massive one-shot run by hand is the usual answer).',
    );
  }
}
say();

say('THE VOCABULARY — a custom field definition is PER TENANT, so each declares only its own');
{
  const defs = rows(await internal('custom_field_definitions', { owner_entity: 'product' }));
  const mineDeclared = new Map();
  for (const group of OWN_WORDS) {
    if (!seen.includes(group.store)) continue;
    for (const key of group.keys) mineDeclared.set(key, group.source);
  }

  // ★ THE DATASET'S WORDS ARE IDENTIFIED BY `source`, NOT BY A LIST OF NAMES. `extension.install` materializes
  //   them as `app:demo-data`, so the registry itself says who asked — and a dataset that gains a tenth field
  //   tomorrow is covered without anyone editing this file.
  const fromDataset = defs.filter((d) => String(d.source ?? '').startsWith('app:demo-data'));
  if (carriesDataset) {
    if (fromDataset.length > 0) ok('the dataset vocabulary', `${fromDataset.length} field(s) — this tenant carries the dataset`);
    else bad('the dataset vocabulary', 'not one field — the demo-data install has not run on the tenant that owns the catalogue');
  } else if (fromDataset.length === 0) {
    ok('the dataset vocabulary', "absent — and this tenant is not the dataset's brand");
  } else {
    bad(
      'the dataset vocabulary',
      `${fromDataset.length} field(s) from another brand's catalogue: ${fromDataset.map((d) => d.key).join(', ')}. ` +
        'They arrive with the `demo-data` INSTALL, which step 9 of bin/box-up.sh does — and box.json says this ' +
        'tenant does not carry the dataset. `custom_field.archive` removes them; the box being reborn is cheaper.',
    );
  }

  // Everything a MERCHANT declared has to be a word one of this tenant's own shops uses. `source` is the
  // discriminator again: an app's fields are the app's business and are not graded here.
  const merchant = defs.filter((d) => String(d.source ?? 'merchant') === 'merchant');
  const strangers = merchant.filter((d) => !mineDeclared.has(d.key));
  if (strangers.length === 0) {
    ok('this tenant\'s own words', `${merchant.length} field(s), every one declared by a shop that is here`);
  } else {
    bad(
      'this tenant\'s own words',
      `${strangers.map((d) => d.key).join(', ')} — no shop on this tenant uses these. A seed that declares a ` +
        'vocabulary on whatever tenant it is pointed at is how a shoe came to offer a roast; the declaration ' +
        'belongs beside the products that fill it, behind the same gate they are.',
    );
  }

  // ★ AND THE POSITIVE HALF, because "nothing crossed over" is also true of a tenant that got nothing at all.
  const present = new Set(defs.map((d) => d.key));
  const missing = [...mineDeclared].filter(([key]) => !present.has(key));
  if (mineDeclared.size === 0) say('  · no shop on this tenant declares a product vocabulary — nothing to assert');
  else if (missing.length === 0) ok('declared × landed', `all ${mineDeclared.size} of this tenant's own field(s) are in the registry`);
  else bad('declared × landed', `${missing.map(([k, src]) => `${k} (${src})`).join(', ')} declared and NOT in the registry`);
}
say();

// ── 3. ★★ THE FOUR STOCK CUTS ───────────────────────────────────────────────────────────────────────────
say('THE STOCK SCREEN — the four cuts of PACK-2·A, each with a line in it');
if (!seen.includes('outlet')) {
  say('  · the clearance shop is not on this tenant — nothing to assert here');
} else {
  const cuts = ['in_stock', 'low', 'partial', 'out'];
  const counts = {};
  for (const cut of cuts) {
    const page = await internal('stock_levels', { availability: cut, limit: '1', page: '1' });
    counts[cut] = Number(page?.total ?? 0);
  }
  const empty = cuts.filter((c) => counts[c] === 0);
  const line = cuts.map((c) => `${c}=${counts[c]}`).join(' · ');
  if (empty.length === 0) {
    ok('the four cuts', `${line} — every one of them opens with something in it`);
  } else {
    // This is the card that was in `Done` and that nobody could look at: a flat stock figure leaves three
    // of the four filters empty on a seeded bench.
    bad('the four cuts', `${line} — EMPTY: ${empty.join(', ')}. A flat stock figure is what does this.`);
  }
}
say();

// ── 5. ★★ THE COFFEE — declared × landed (A46 · A47) ─────────────────────────────────────────────────────
//
// Every line here answers the same question in a different column: DID WHAT THE DATASET DECLARES ACTUALLY
// REACH THE BOX? Both defects this section exists for were writes that never happened and never complained —
// the subscription mark and the nine custom fields — so the measurement is of the RESULT, on the anonymous
// face the shopper's page actually reads.
say();
say('THE COFFEE — what seed/catalog.json declares, against what the shop serves');
if (!seen.includes('cafe')) {
  say('  · the coffee shop is not on this tenant — nothing to assert here');
} else {
  const store = byHandle.get('cafe');
  const page = await publicRead('products', { store: store.id, limit: '100', page: '1' });
  const served = new Map((page?.items ?? []).map((p) => [p.handle, p]));
  const reviews = await allOf('extension_records', { extension: 'reviews', model: 'review' });
  const byProduct = new Map();
  for (const r of reviews) byProduct.set(r.product_id, (byProduct.get(r.product_id) ?? 0) + 1);

  for (const want of expectedCoffees()) {
    const got = served.get(want.handle);
    if (!got) {
      bad(want.handle, 'the shop does not serve it at all');
      continue;
    }
    const bag = got.metadata && typeof got.metadata === 'object' ? got.metadata : {};
    const lost = Object.keys(want.metadata).filter((k) => bag[k] !== want.metadata[k]);
    const photos = (got.media ?? []).filter((m) => m.kind === undefined || m.kind === 'image').length;
    const sections = (got.content_sections ?? []).length;
    const marked = (got.skus ?? []).filter((k) => k?.metadata?.sub_enabled === true).length;
    const wall = byProduct.get(got.product_id) ?? 0;

    const problems = [];
    if (lost.length > 0) problems.push(`${lost.length} custom field(s) missing or wrong: ${lost.join(', ')}`);
    if (photos !== want.photos.length) problems.push(`${photos} photograph(s), declared ${want.photos.length}`);
    if (sections !== want.sections.length) problems.push(`${sections} content section(s), declared ${want.sections.length}`);
    // ⚠️ THE NEGATIVE IS HALF THE CHECK. The Edição do Produtor is deliberately NOT subscribable, and a
    // verifier that only asked "is it marked?" would call a catalogue where everything is marked a success —
    // which is the failure the curation exists to make impossible.
    if (want.subscribable && marked === 0) problems.push('NO sku carries sub_enabled — the page draws no subscription');
    if (!want.subscribable && marked > 0) problems.push(`${marked} sku(s) carry sub_enabled and this coffee is curated OUT`);
    if (wall < 6) problems.push(`${wall} review(s) — the ask is at least 6 per product`);

    if (problems.length === 0) {
      ok(
        want.handle,
        `${Object.keys(want.metadata).length} field(s) · ${photos} photo(s) · ${sections} section(s) · ` +
          `${want.subscribable ? `${marked} sku(s) subscribable` : 'not subscribable, on purpose'} · ${wall} review(s)`,
      );
    } else {
      bad(want.handle, problems.join(' · '));
    }
  }

  // ── ★★ WHAT A SUBSCRIBER GETS (D14) — the PERKS, graded on the box and not on the declaration ─────────
  //
  // The buy box prints three of them ("Frete grátis · 10% OFF sempre · Pause quando quiser") and until
  // 03/09 the freight one did not exist as data — a promise the checkout could not keep, with nothing
  // anywhere saying so. `seed/coffee.test.mjs` holds the sentence and the declaration together; this asks
  // the box whether the declaration landed, which is the failure class this whole file exists for.
  {
    const held = await allOf('promotions_admin');
    for (const spec of COFFEE_PROMOTIONS) {
      const got = held.find((p) => p.name === spec.name);
      if (!got) {
        bad(`the perk "${spec.name}"`, 'not in this tenant at all — the coffee phase did not create it');
        continue;
      }
      const problems = [];
      if ((got.benefit?.kind ?? null) !== spec.benefit.kind)
        problems.push(`benefit is ${got.benefit?.kind ?? '(none)'}, declared ${spec.benefit.kind}`);
      if (got.status !== 'active') problems.push(`status is ${got.status} — a draft perk charges what the page says it will not`);
      if (got.store_id !== store.id) problems.push(`scoped to ${got.store_id ?? 'the whole tenant'}, not to the coffee shop`);
      if (got.target?.field !== 'sub_plan') problems.push(`targets ${JSON.stringify(got.target)} — not the subscribed line`);
      if (problems.length === 0) ok(`the perk "${spec.name}"`, `${got.benefit.kind}, active, on sub_plan lines`);
      else bad(`the perk "${spec.name}"`, problems.join(' · '));
    }
  }

  // ── ⛔ THE STOCK POOL (D5) — products this tenant HOLDS and NO shop sells ──────────────────────────────
  //
  // The one thing about them that can silently go wrong is the one that empties the demo's whole past:
  // being published. `seed-history` takes its three alert states from products nothing sells, and a pool
  // product on a shelf leaves the pool — after which the past refuses by a number nobody connects to this.
  {
    const catalogue = new Map(
      (await allOf('products_admin')).map((p) => [p.handle, p.product_id ?? p.id]),
    );
    for (const declared of poolProducts()) {
      const id = catalogue.get(declared.handle);
      if (!id) {
        bad(`the pool's ${declared.handle}`, 'not in the catalogue — seed/pool.mjs did not create it');
        continue;
      }
      const shops = rows(await internal('product_stores', { product_id: id }));
      const where = (Array.isArray(shops) ? shops : []).length;
      if (where === 0) ok(`the pool's ${declared.handle}`, 'in the catalogue, on sale NOWHERE — which is the point');
      else bad(`the pool's ${declared.handle}`, `published to ${where} store(s) — it has left the stock pool`);
    }
  }

  // ★★ s3-14 / s7-11 · THE SAME SENTENCE ON TWO PRODUCTS, MEASURED IN THE BOX RATHER THAN IN THE SEED.
  //
  // `seed/commerce.test.mjs` already refuses a repeated (author, text) pair in the DECLARATION. This asks the
  // shop, which is a different question and the one that matters: rows written by an earlier version of the
  // seed are still there, and the home's review mosaic reads THEM. Measured 02/09 on the bench: "Tomo puro,
  // sem leite…" (Priscila N.) appeared on four coffees at once, two of them side by side on the home.
  const pairs = new Map();
  const echoes = [];
  for (const r of reviews) {
    const pair = `${r.author} :: ${r.body}`;
    const first = pairs.get(pair);
    if (first === undefined) pairs.set(pair, r.product_id);
    else if (first !== r.product_id) echoes.push(`"${r.author}" on 2+ products`);
  }
  if (echoes.length === 0) ok('the review wall', `${reviews.length} row(s), no sentence on two products`);
  else bad('the review wall', `${[...new Set(echoes)].length} voice(s) recycled across products — the home puts them side by side: ${[...new Set(echoes)].join(', ')}`);

  // The moderation queue has to have something on it, and the wall has to have something in it. Both, or the
  // demo shows one screen at the cost of the other.
  const byStatus = reviews.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const line = Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(' · ') || 'none';
  if ((byStatus.approved ?? 0) > 0 && (byStatus.pending ?? 0) > 0 && (byStatus.rejected ?? 0) > 0) {
    ok('the review mix', `${line} — the wall has rows, the queue has rows, and moderation was exercised`);
  } else {
    bad('the review mix', `${line} — approved, pending AND rejected are all needed (the vocabulary is approved|pending|rejected, never "published")`);
  }
}
say();
// ── 4. the placeholders ─────────────────────────────────────────────────────────────────────────────────
say('THE PLACEHOLDER ART — findable in one gesture');
const assets = await allOf('assets', { q: 'placeholder-' });
if (assets.length === 0) {
  bad('placeholders', 'none in the Asset Library — the seed has not uploaded them');
} else {
  ok('placeholders', `${assets.length} in the Asset Library`);
  say(`      admin → Biblioteca de Assets → buscar "placeholder-"`);
  for (const a of assets.slice(0, 12)) say(`      · ${a.filename ?? a.provider_key}`);
}

// ── the verdict ─────────────────────────────────────────────────────────────────────────────────────────
say();
if (failures === 0) {
  say(`VERDICT: settled. Everything this run checked on ${tenant} is what the seed declares.`);
} else {
  say(`VERDICT: ${failures} check(s) NOT settled on ${tenant}. Read the ✗ lines above.`);
}
process.stdout.write(`${out.join('\n')}\n`);
process.exit(failures === 0 ? 0 : 1);

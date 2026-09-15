#!/usr/bin/env node
// WHAT THE SEED ACTUALLY LEFT BEHIND — the measurement, parameterised, so proving the bench is a command
// and not an improvisation at eleven at night.
//
//   FORGE_OPERATOR_TOKEN=… node bin/verify-seed.mjs --api http://localhost:8200 --tenant forgeco
//   FORGE_OPERATOR_TOKEN=… node bin/verify-seed.mjs --api http://localhost:8200 --tenant forgecafe
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
// go unnoticed for a month, and it is this repository's own rule: a free-shipping promotion makes no sense
// as birth data for the counter, which has nothing to ship.
//
// ── ★★ AND IT MAY NOT ASK WHAT THE READ DOES NOT ANSWER (see `field`, below) ─────────────────────────────
// Every name this file takes off a live response goes through an assertion that THE KEY CAME BACK. A name
// that did not is this file's own defect: it prints `⚑`, it is counted apart from the ✗ lines, and it exits
// 2 rather than 1. It cannot become a verdict about the box, and that is structural rather than careful —
// `field` throws and every check runs inside `checking`. On 03/09 two comparisons asked the frozen promotion
// list for `status` and `store_id`, which it does not publish; one accused correct data in red and the other
// waved a real defect through in green. `bin/verify-seed.test.mjs` runs a SABOTAGED copy of this file against
// a correct box and requires it to accuse itself.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// ⚠️ THE EXPECTATIONS ARE IMPORTED, NEVER RE-TYPED. `seed/coffee.mjs` is what the SEED writes from; a
// verifier with its own copy of the nine field names would agree with a stale catalogue and say so proudly.
import { COFFEE_PROMOTIONS, expectedCoffees } from '../seed/coffee.mjs';
// The pool is graded here for the same reason everything else is: what it declares is worthless until the
// box holds it, and the one way it can go wrong is invisible on every screen.
import { poolProducts } from '../seed/pool.mjs';
// The Outlet's institutional set, from the function the SEED writes it with. A second list of those seven
// slugs typed in here would be a second list that goes stale — and it would go stale agreeing with itself.
import { outletPages } from '../seed/outlet.mjs';
// ★ AND THE CAFÉ'S SEVEN, for the same reason and from the same shape of function. It declared NONE until
// this slice — the section below reported the number and did not judge it — while the shop's own sidebar and
// footer drew all seven links into its own 404.
import { coffeePages } from '../seed/coffee.mjs';
// ★ THE PICKUP WEEK, from the module that holds the rule and the list of points the dataset declares — so
// this file grades a live point against the SAME sentence the seed refuses to write with.
import { declaredPickupPoints, pickupWeekProblem } from '../seed/pickup-hours.mjs';
// ★ 08/09 — AND THE MOUNTED DATASET, WHICH IS WHERE THE `forge` STORE'S WINDOW IS DECLARED. `seed/vitrine.mjs`
// composes that shop from `<dataset>/storefront.json`, a MONOREPO file this repository does not own; the only
// honest expectation for it is the one read off the same file the seed read. Absent mount ⇒ reported, never
// invented. Same function the seed uses, so the two cannot disagree about where the dataset is.
import { datasetDir, DATASET_DIR_ENV } from '../seed/forge.mjs';
// ★ AND THE THREE SUBSCRIBERS, from the module that signs them. A second list of names typed here would go
// stale agreeing with itself — the failure this whole file is written against.
import { SUBSCRIBERS } from '../seed/subscriptions.mjs';
// ★ 10/09 — AND THE ADMIN HOME'S WIDGET ORDER, from the module the SEED writes it with. Same rule, one place:
// a second copy of "which widgets come first" here would be the declaration this slice exists to stop having
// two of. Its header carries the measurement of the two boards.
import {
  ADMIN_WIDGETS_SLOT,
  declaredAdminWidgets,
  widgetName,
  widgetPrefixProblem,
} from '../seed/widgets.mjs';

const SEED = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const read = (name) => JSON.parse(readFileSync(join(SEED, name), 'utf8'));

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
const token = process.env.FORGE_OPERATOR_TOKEN ?? '';

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

// ── ★★ ABSENCE IS NOT A VALUE ────────────────────────────────────────────────────────────────────────────
//
// ⛔ THE DEFECT THIS EXISTS FOR, measured on the birth of 03/09. This file accused CORRECT data and dropped
// `box-up` to 1:
//
//     ✗ o benefício "Assinante 10% OFF" — status is undefined — a draft perk charges what the page says it
//       will not · scoped to the whole tenant, not to the coffee shop
//
// The database held both perks `active` and confined to the coffee shop. Nothing was wrong with the box. The
// frozen list publishes `state`, not `status`, and it does not publish `store_id` AT ALL — so both names read
// back `undefined`, and `undefined !== 'active'` is TRUE. A question with NO ANSWER came out as the loudest
// possible accusation, which is the worst translation of "I do not know" there is.
//
// ⚠️ FIXING THOSE TWO LINES DOES NOT FIX THE SPECIES. This file asks live responses for names by hand dozens
// of times, and nothing stopped any of them from asking for a name that is not there.
//
// ⇒ So every name is read through `field()`, which ASSERTS THE KEY CAME BACK before anything compares it. A
//   key that did not come back is THIS FILE's defect and never the box's: its own sentence, its own counter,
//   its own exit code. And because `field` THROWS while every check runs inside `checking()`, there is no
//   path at all from a missing key to a ✗ — the property is structural, not a convention someone remembers.
//
// ⚠️ IT ASSERTS AGAINST THE LIVE ANSWER, NOT AGAINST A MIRROR OF THE KERNEL'S TYPES. This repository does not
// compile against `/contracts` and must never grow a hand-copied echo of it: a copy would agree with a stale
// contract exactly the way a typed-in expectation agrees with a stale catalogue — the failure this whole file
// was written against. The question asked here is the only one a reader can honestly ask: did the key come
// back, in this answer, from this box?
class WrongQuestion extends Error {
  constructor(read, key, row) {
    super(`read.${read} does not publish \`${key}\``);
    this.read = read;
    this.key = key;
    this.row = row;
  }
}
let wrongQuestions = 0;
const askedWrong = (e) => {
  wrongQuestions += 1;
  const published =
    e.row && typeof e.row === 'object' ? Object.keys(e.row).join(', ') : `${e.row === null ? 'null' : typeof e.row}`;
  say(`  ⚑ WRONG QUESTION — read.${e.read} does not publish \`${e.key}\`. The question is wrong, not the data.`);
  say(`      what came back instead: ${published || '(an object with no keys at all)'}`);
};

/**
 * One name, off one row of one live read.
 *
 * @param row  the row as the box answered it — never a shape this file invented
 * @param key  the name being asked for
 * @param read the read that answered, so a wrong question can name the door it knocked on
 */
const field = (row, key, read) => {
  if (row === null || typeof row !== 'object' || !Object.hasOwn(row, key)) {
    throw new WrongQuestion(read, key, row);
  }
  return row[key];
};
/** The accessor of ONE read, so a call site reads `promo(p, 'state')` and cannot forget which door it is at. */
const of = (read) => (row, key) => field(row, key, read);

/**
 * Run one check. A wrong question aborts THIS check — never the run, and never into a ✗.
 *
 * ⚠️ The granularity is the check, not the file: a name this file cannot ask must not take the other twenty
 * measurements down with it, and it must not be swallowed either. What it costs is the rest of that one
 * block, which the ⚑ line explains.
 */
const checking = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof WrongQuestion) return askedWrong(e);
    throw e;
  }
};

/** A name the WHOLE RUN stands on (the store list, and the ids every later read is scoped by). A wrong
 *  question here is not one check going quiet — it is nothing having been measured, so it ends the run. */
const foundation = (fn) => {
  try {
    return fn();
  } catch (e) {
    if (!(e instanceof WrongQuestion)) throw e;
    askedWrong(e);
    say();
    say(
      'VERDICT: nothing was measured. The question above is this verifier\'s own, and every number that would ' +
        'have followed it is derived from a name that did not come back.',
    );
    process.stdout.write(`${out.join('\n')}\n`);
    process.exit(2);
  }
};

if (!api) fail('no API base. Pass --api http://… (or set FORGE_PUBLIC_ORIGIN).');
if (!tenant) fail('no tenant. Pass --tenant forgeco | forgecafe.');
if (!token) fail('no FORGE_OPERATOR_TOKEN. Export the credential OF THAT TENANT — the read face resolves the\n  tenant from the credential, so the wrong one answers about the wrong tenant, with a 200.');

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
 *
 * ⚠️ ★ AND `page` IS A QUESTION TOO — THE SAME SPECIES, IN THE PARAMS INSTEAD OF THE FIELDS. Not every read
 * pages by that word: `read.promotions_admin` declares `offset`, and a param a read does not declare is
 * SILENTLY DROPPED (its Zod object strips what it does not know). So a walk over it would ask for page 2,
 * be handed page 1 again, append the same hundred rows, and go round until the backstop — and until this
 * tenant grows past a hundred promotions, nothing about that is visible. The envelope is what answers it:
 * a read that pages by `page` ECHOES the page it was given (`ReadList`), and one that does not publishes no
 * such key. So the second lap checks, before it believes anything, that the read heard the question.
 */
async function allOf(name, params = {}) {
  const limit = 100;
  const all = [];
  for (let page = 1; page <= 1000; page++) {
    const payload = await internal(name, { ...params, limit: String(limit), page: String(page) });
    const batch = rows(payload);
    if (Array.isArray(payload)) return batch; // an unpaginated read answers a bare array
    if (page > 1 && Number(payload?.page) !== page) {
      fail(
        `read.${name} does not page by \`page\` — asked for page ${page}, and the answer says ` +
          `${payload?.page === undefined ? 'nothing at all (no `page` in the envelope)' : `\`page: ${payload.page}\``}. ` +
          'This walk would have re-read the first page until the backstop and then called the pile the whole ' +
          'set. The read pages by another word (`offset`, for the promotion list). Nothing was measured.',
      );
    }
    all.push(...batch);
    if (batch.length < limit) return all;
  }
  fail(`read.${name} never ran out of pages — refusing to guess what it holds.`);
}

const promo$ = of('promotions_admin');
const scope$ = of('promotion_stores');

/**
 * WHICH STORE EACH PROMOTION IS CONFINED TO — `null` meaning EVERY store of this tenant.
 *
 * ★★ IT IS A SEPARATE READ ON PURPOSE, AND THAT IS THE WHOLE LESSON OF 03/09. `PromotionListItem` — the
 * frozen row of `read.promotions_admin` — carries no `store_id` and was never going to: the shape could not
 * grow, so `read.promotion_stores` was written to answer the scope of a WHOLE PAGE in one call. Two places
 * in this file asked the LIST for that name instead. One of them turned `undefined` into "scoped to the
 * whole tenant" and accused correct data; the other turned it into a filter that matched nothing and waved
 * a real defect through. Neither could have happened if the name had had to exist first.
 *
 * ⚠️ CHUNKED AT THE READ'S OWN CEILING (`LIST_LIMITS.promotion_stores.maxIds` = 100). A tenant with more
 * than a hundred promotions — which the dataset's brand has — would otherwise be refused with `too_big`,
 * and `internal()` turns that into a fatal "nothing was measured" for the whole run.
 */
async function scopesOf(promotions) {
  const ids = promotions.map((p) => promo$(p, 'id'));
  const map = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const asked = ids.slice(i, i + 100);
    const answered = rows(await internal('promotion_stores', { promotion_ids: asked.join(',') }));
    for (const row of answered) map.set(scope$(row, 'promotion_id'), scope$(row, 'store_id'));
  }
  return map;
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

/** handle → the institutional slugs THIS REPOSITORY declares that shop publishes. A shop that is not a key
 *  here is reported and never judged: `forge`'s seven are the mounted dataset's, `balcao` declares none (it
 *  is the totem's store and no browser reaches it), and an expectation invented for either would be this
 *  file disagreeing with the box on purpose. */
const PAGES_DECLARED = {
  outlet: outletPages().map((p) => p.slug),
  cafe: coffeePages().map((p) => p.slug),
};

/**
 * ★★ 08/09 — THE HOME'S BLOCKS, PER STORE, EACH DERIVED FROM THE FILE THAT DECLARES THAT STORE.
 *
 * ⛔ THE DEFECT THIS EXISTS FOR IS A PAGE THAT LOOKS RIGHT IN THE ADMIN AND IS WRONG THE NEXT MORNING. The
 * Outlet's banner mosaic was moved into `home.hero` by dragging it in Compose, and kept there on purpose —
 * and the seed is RESET + SEED by definition, so the next re-semeadura writes whatever the dataset says and
 * the drag is gone. Nothing measured whether the box came back up in the chosen slot.
 *
 * ⚠️ AND THE TWO SHOPS ARE DECLARED IN TWO DIFFERENT REPOSITORIES, which is why this is two expectations and
 * not one list. `outlet` is `seed/outlet.json`, right here. `forge` is the MOUNTED DATASET's
 * `storefront.json` — read at run time through the same `datasetDir()` the seed uses, and simply NOT JUDGED
 * when no dataset is mounted. Typing the shoe shop's slots in here would be this file disagreeing with a
 * file it cannot see, which is the failure section 1 and section 3b already refuse by name.
 *
 * ⚠️ THE OUTLET IS JUDGED ON `position` AND THE FORGE IS NOT. `outlet.json` declares one, because the
 * reconciler in `seed/outlet.mjs` governs that page and orders it; the dataset declares no position at all
 * (`seed/vitrine.mjs` appends), so asking for one there would be a question the declaration cannot answer.
 */
const OUTLET_HOME = [
  { app: 'banners', component: 'banner', slot: outlet.mosaic.slot, position: outlet.mosaic.position },
  ...outlet.shelves.map((s) => ({ app: 'shelves', component: 'shelf', slot: s.slot, position: s.position })),
];

/**
 * The blocks the MOUNTED dataset declares for its own store, or null when it cannot be read — and the
 * `whyNoDataset` beside it says WHICH of the two, because they are different states and one of them is a
 * misconfiguration.
 *
 * ⚠️ `bin/box-up.sh` REMAPS THE VARIABLE FOR HOST PROCESSES (`host_node`, CONTAINER_PATH_VARS):
 * `FORGE_SEED_DATASET_DIR` is the CONTAINER's path and its host sibling is `FORGE_SEED_DATASET_HOST_DIR`.
 * So a step-12 run really does get a readable directory, and a hand-run with the container path exported
 * gets a `storefront.json` that is not there — which must read as "I could not look", never as "nothing is
 * declared".
 */
let whyNoDataset = `no ${DATASET_DIR_ENV} is set`;
function datasetHome() {
  const dir = datasetDir();
  if (!dir) return null;
  let declared;
  try {
    declared = JSON.parse(readFileSync(join(dir, 'storefront.json'), 'utf8'));
  } catch (error) {
    whyNoDataset = `${DATASET_DIR_ENV}=${dir} holds no readable storefront.json (${error?.code ?? error?.message ?? 'unreadable'})`;
    return null;
  }
  if (typeof declared?.store !== 'string') {
    whyNoDataset = `${join(dir, 'storefront.json')} names no \`store\`, so nothing says whose window it is`;
    return null;
  }
  return {
    store: declared.store,
    blocks: [
      ...(declared.banners ?? []).map((b) => ({ app: 'banners', component: 'banner', slot: b.slot })),
      ...(declared.shelves ?? []).map((b) => ({ app: 'shelves', component: 'shelf', slot: b.slot })),
    ],
  };
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────
const store$ = of('stores');
const stores = rows(await internal('stores'));
// `catalog.stores` is THIS repository's own declaration, read off disk — not an answer, so not a question.
const mine = catalog.stores.filter((s) => (s.tenant ?? tenant) === tenant).map((s) => s.handle);
const seen = foundation(() => stores.map((s) => store$(s, 'handle')));
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
const products$ = of('products');
const byHandle = new Map(foundation(() => stores.map((s) => [store$(s, 'handle'), s])));
const storeIdOf = (handle) => foundation(() => store$(byHandle.get(handle), 'id'));
for (const handle of seen) {
  await checking(async () => {
    const archetype = ARCHETYPE[handle] ?? '(not one of the four)';
    const page = await publicRead('products', {
      store: storeIdOf(handle),
      projection: 'feed',
      limit: '1',
      page: '1',
    });
    if (page === null) {
      // The public face resolves store→tenant through a projection the relay fills; a brand-new store 404s
      // there for a moment. That is "not ready", never "empty".
      bad(`${handle} (${archetype})`, 'the public face does not resolve this store yet — the box is not ready');
      return;
    }
    // ⚠️ `total` READ THROUGH THE ASSERTION, and this is exactly where the old `?? 0` was dangerous: an
    // envelope without it would have been reported as a shop with nothing in it — INCOMPLETE, in red, about
    // a shop that is full.
    const total = Number(products$(page, 'total'));
    const want = EXPECTED[handle];
    if (want === undefined) {
      say(`  · ${handle} (${archetype}) — ${total} published (this shop's size is the dataset's; not judged)`);
      if (total === 0) bad(`${handle}`, 'nothing published — the one-shot has not filled it');
      return;
    }
    if (total === want) ok(`${handle} (${archetype})`, `${total} published, exactly what the seed declares`);
    else bad(`${handle} (${archetype})`, `${total} published, INCOMPLETE — the seed declares ${want}`);
  });
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

  // ⛔ THE FALSE GREEN, AND IT IS THE SAME WRONG QUESTION AS THE FALSE RED — silent instead of loud.
  //
  // This filter used to read `p.store_id === store.id` off a `promotions_admin` row. That list does not
  // publish `store_id` (see `scopesOf`), so the left-hand side was `undefined` for EVERY promotion, the
  // filter matched NOTHING, and the counter was declared free of free-shipping promotions without a single
  // row ever having been looked at. The perk check three sections down accused correct data with the same
  // absent name; this one waved a real one through. Neither was measuring anything.
  //
  // ★ AND THE SCOPE THAT REACHES THE COUNTER IS TWO CASES, NOT ONE. `store_id: null` is not "no scope" — it
  // is EVERY store of the tenant, the counter included, exactly like the tenant-wide delivery methods
  // `seed/box.json` writes up. A check that only looked for promotions confined to the counter would call a
  // tenant-wide free-shipping campaign clean.
  const scopes = await scopesOf(promotions);
  for (const handle of counters) {
    await checking(async () => {
      const id = storeIdOf(handle);
      const freight = promotions.filter(
        (p) =>
          promo$(p, 'benefit')?.kind === 'free_shipping' &&
          [id, null].includes(scopes.get(promo$(p, 'id'))),
      );
      if (freight.length === 0) ok(`${handle}`, 'NO free-shipping promotion — the counter hands goods over');
      else
        bad(
          `${handle}`,
          `${freight.length} free-shipping promotion(s): ${freight.map((p) => promo$(p, 'name')).join(', ')}`,
        );
    });
  }

  // ★ s7-11 · BUILD VOCABULARY AS THE TITLE OF A ROW IN THE OPERATOR'S PROMOTION LIST. The kernel's demo-data
  // app names its promotions `DEMO-HIST-01-FORGE`, `DEMO-HIST-D2`… — correct where it lives, and a database
  // dump on a demo screen. The commerce pass renames each of them to its own curated `label`; this is that
  // rename asked of the box.
  await checking(() => {
    const internalNames = promotions.filter((p) => /^DEMO-HIST[-_]/.test(String(promo$(p, 'name'))));
    if (internalNames.length === 0)
      ok('the promotion list', `${promotions.length} promotion(s), no build vocabulary on the screen`);
    else
      bad(
        'the promotion list',
        `${internalNames.length} promotion(s) still titled with an internal name: ` +
          `${internalNames.map((p) => promo$(p, 'name')).join(', ')} — the commerce pass renames them to their label`,
      );
  });

  // The counter's own half must exist, or the negative above is true for the wrong reason (nothing was
  // seeded at all). A negative with no positive beside it is not a measurement.
  const method$ = of('shipping_methods_admin');
  const point$ = of('pickup_locations');
  await checking(() => {
    const pickupMethods = methods.filter((m) => method$(m, 'kind') === 'pickup');
    if (pickupMethods.length >= 1)
      ok('pickup method', `${pickupMethods.map((m) => method$(m, 'name')).join(', ')} (kind: pickup)`);
    else bad('pickup method', 'none — the counter cannot hand anything over');
  });
  await checking(() => {
    if (points.length >= 1) ok('pickup point', points.map((p) => point$(p, 'name')).join(', '));
    else bad('pickup point', 'none — place_order would have nowhere to send the buyer');
  });

  await checking(() => {
    const delivery = methods.filter((m) => method$(m, 'kind') !== 'pickup');
    const delivers = seen.filter((h) => ARCHETYPE[h] && ARCHETYPE[h] !== 'counter');
    // ⚠️ THE FOUR CASES, AND THE DRY RUN CAUGHT ME COLLAPSING TWO OF THEM. "No delivery method" is only good
    // news when no shop here delivers; on a tenant that HAS a delivering shop it is a missing half, and the
    // first version of this printed the reassuring sentence for both. A verifier that says "none — and no
    // shop here delivers" over a coffee e-commerce is worse than silence.
    if (delivers.length === 0 && delivery.length > 0) {
      bad('delivery', `${delivery.length} delivery method(s) on a tenant whose only shop is a counter`);
    } else if (delivers.length === 0) {
      ok('delivery', 'none — and no shop here delivers');
    } else if (delivery.length > 0) {
      ok('delivery', `${delivery.length} method(s) — legitimate: ${delivers.join(', ')} deliver(s)`);
    } else {
      bad('delivery', `none, but ${delivers.join(', ')} deliver(s) — those shops cannot quote freight`);
    }
  });
}
say();

// ── 2c. ★★ THE PICKUP WEEK — the half of a point the box can hold WRONG while every other check is green ──
//
// ⛔ THE DEFECT, reported from the screen on 05/09: the counter's pickup card listed the seven
// days as «Fechado» and its today-line said «Fechado hoje». Section 2 above already asserted the point EXISTS
// and was green about it — because `points.length >= 1` is true of a point nobody can ever collect from.
//
// ★ AND NOTHING WAS BROKEN ANYWHERE. `pickup_location.create` accepts a point with no `hours`, an OMITTED day
// is closed to the kernel exactly like a `null` one, and the checkout renders that faithfully. The dataset was
// the only place the ambiguity could be refused, and it was not being refused there either.
//
// ⚠️ THE EXPECTATION IS DERIVED AND THE SEED IS IDEMPOTENT BY NAME — which is why this check has to exist
// HERE and not only over the JSON. A bench born before 05/09 holds the point WITHOUT the week, and no re-run
// of the seed will add it: `seedTotem` and `seedLogistics` both skip a point whose name is already there. A
// stale box is therefore a ✗ with the point's name in it, and never a silence.
say('THE PICKUP WEEK — a point with no hours is a door the checkout invites the shopper to and never opens');
const declaredPoints = declaredPickupPoints().filter((d) => seen.includes(d.store));
if (declaredPoints.length === 0) {
  say('  · this tenant declares no pickup point — nothing to grade');
} else {
  const week$ = of('pickup_locations');
  const livePoints = rows(await internal('pickup_locations'));
  let withAWeek = 0;
  for (const { source, point } of declaredPoints) {
    await checking(() => {
      // `name` and `hours` both go through the assertion: a read that stopped publishing either is THIS
      // file's wrong question (⚑, exit 2) and may never become an accusation about the data.
      const row = livePoints.find((r) => week$(r, 'name') === point.name);
      if (!row) {
        return bad(`pickup point "${point.name}"`, `${source} declares it and this box does not have it`);
      }
      const problem = pickupWeekProblem({ name: point.name, hours: week$(row, 'hours') });
      if (problem) return bad(`pickup point "${point.name}"`, problem);
      withAWeek += 1;
      const days = Object.entries(week$(row, 'hours'))
        .filter(([, h]) => h != null)
        .map(([day]) => day);
      ok(`pickup point "${point.name}"`, `open ${days.length} of 7 days (${days.join(', ')})`);
    });
  }
  const counted = `${withAWeek} of ${declaredPoints.length} declared point(s) publish a week`;
  if (withAWeek === declaredPoints.length) ok('the week', counted);
  else say(`  · ${counted} — the rest are the ✗ lines above, each with its point's name in it`);
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
const catalogue$ = of('products_admin');
say("THE TENANT'S OWN CATALOGUE — nothing from a brand this tenant is not");
await checking(async () => {
  // ⚠️ `total` THROUGH THE ASSERTION. The old `?? 0` would have reported an envelope without it as a tenant
  // holding nothing — and on the tenant that carries the dataset that reads as "the one-shot has not filled
  // it", which is a birth-blocking accusation derived from a name that never came back.
  const held = Number(catalogue$(await internal('products_admin', { limit: '1', page: '1' }), 'total'));
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
});
say();

const cf$ = of('custom_field_definitions');
say('THE VOCABULARY — a custom field definition is PER TENANT, so each declares only its own');
await checking(async () => {
  const defs = rows(await internal('custom_field_definitions', { owner_entity: 'product' }));
  const mineDeclared = new Map();
  for (const group of OWN_WORDS) {
    if (!seen.includes(group.store)) continue;
    for (const key of group.keys) mineDeclared.set(key, group.source);
  }

  // ★ THE DATASET'S WORDS ARE IDENTIFIED BY `source`, NOT BY A LIST OF NAMES. `extension.install` materializes
  //   them as `app:demo-data`, so the registry itself says who asked — and a dataset that gains a tenth field
  //   tomorrow is covered without anyone editing this file.
  const fromDataset = defs.filter((d) => String(cf$(d, 'source')).startsWith('app:demo-data'));
  if (carriesDataset) {
    if (fromDataset.length > 0) ok('the dataset vocabulary', `${fromDataset.length} field(s) — this tenant carries the dataset`);
    else bad('the dataset vocabulary', 'not one field — the demo-data install has not run on the tenant that owns the catalogue');
  } else if (fromDataset.length === 0) {
    ok('the dataset vocabulary', "absent — and this tenant is not the dataset's brand");
  } else {
    bad(
      'the dataset vocabulary',
      `${fromDataset.length} field(s) from another brand's catalogue: ${fromDataset.map((d) => cf$(d, 'key')).join(', ')}. ` +
        'They arrive with the `demo-data` INSTALL, which step 9 of bin/box-up.sh does — and box.json says this ' +
        'tenant does not carry the dataset. `custom_field.archive` removes them; the box being reborn is cheaper.',
    );
  }

  // Everything a MERCHANT declared has to be a word one of this tenant's own shops uses. `source` is the
  // discriminator again: an app's fields are the app's business and are not graded here.
  const merchant = defs.filter((d) => String(cf$(d, 'source')) === 'merchant');
  const strangers = merchant.filter((d) => !mineDeclared.has(cf$(d, 'key')));
  if (strangers.length === 0) {
    ok('this tenant\'s own words', `${merchant.length} field(s), every one declared by a shop that is here`);
  } else {
    bad(
      'this tenant\'s own words',
      `${strangers.map((d) => cf$(d, 'key')).join(', ')} — no shop on this tenant uses these. A seed that declares a ` +
        'vocabulary on whatever tenant it is pointed at is how a shoe came to offer a roast; the declaration ' +
        'belongs beside the products that fill it, behind the same gate they are.',
    );
  }

  // ★ AND THE POSITIVE HALF, because "nothing crossed over" is also true of a tenant that got nothing at all.
  const present = new Set(defs.map((d) => cf$(d, 'key')));
  const missing = [...mineDeclared].filter(([key]) => !present.has(key));
  if (mineDeclared.size === 0) say('  · no shop on this tenant declares a product vocabulary — nothing to assert');
  else if (missing.length === 0) ok('declared × landed', `all ${mineDeclared.size} of this tenant's own field(s) are in the registry`);
  else bad('declared × landed', `${missing.map(([k, src]) => `${k} (${src})`).join(', ')} declared and NOT in the registry`);
});
say();

// ── 3. ★★ THE FOUR STOCK CUTS ───────────────────────────────────────────────────────────────────────────
say('THE STOCK SCREEN — the four cuts of PACK-2·A, each with a line in it');
if (!seen.includes('outlet')) {
  say('  · the clearance shop is not on this tenant — nothing to assert here');
} else {
  await checking(async () => {
    const stock$ = of('stock_levels');
    const cuts = ['in_stock', 'low', 'partial', 'out'];
    const counts = {};
    for (const cut of cuts) {
      // ⚠️ AND THIS ONE WOULD HAVE BEEN THE CRUELLEST `?? 0`: an envelope with no `total` reads as four EMPTY
      // cuts, which is word for word the accusation this section was written to make about a real defect.
      const page = await internal('stock_levels', { availability: cut, limit: '1', page: '1' });
      counts[cut] = Number(stock$(page, 'total'));
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
  });
}
say();

// ── 3b. ★★ THE INSTITUTIONAL PAGES — a line for EVERY store, including the ones with none ────────────────
//
// ⛔ THE DEFECT THIS SECTION EXISTS FOR IS THE ABSENCE OF THIS SECTION. Until 05/09 the Outlet published
// ZERO institutional pages while the Forge store beside it published seven, in the same tenant, and nothing
// went red — because no check counted them. Measured then, seven requests per store: `forge` answered 200 at
// /contato, /entrega, /faq, /privacidade, /sobre, /termos and /trocas-e-devolucoes and the Outlet answered
// 404 at all seven. The bench inventory of that day printed a "Páginas institucionais" heading under one
// shop and simply no heading under the other, and A MISSING SECTION IS INDISTINGUISHABLE FROM "this shop
// does not have any". That is why every store gets a line here even when the answer is zero.
//
// ★ AND ONLY THE STORES THIS REPOSITORY DECLARES PAGES FOR ARE JUDGED. The Forge store's seven are the
// mounted DATASET's (`instances/demo/dataset/storefront.json`, mounted by path and not readable from here),
// so its count is REPORTED and never graded — the same rule section 1 applies to its catalogue. Inventing an
// expectation for a file this repository cannot see is how a verifier starts disagreeing with reality.
//
// ⚠️ `published` IS PART OF THE QUESTION, not a detail. A page card that exists with `published: false` is a
// 404 to every shopper, so counting rows would go green over a store whose whole institutional set is drafts.
say('THE INSTITUTIONAL PAGES — one line per store, because a section that is absent reads as "none exist"');
const page$ = of('pages');
{
  const allPages = await allOf('pages');
  for (const handle of seen) {
    await checking(() => {
      const id = storeIdOf(handle);
      const mine = allPages.filter((p) => page$(p, 'store_id') === id);
      const live = new Set(
        mine.filter((p) => page$(p, 'published') === true).map((p) => page$(p, 'slug')),
      );
      const declared = PAGES_DECLARED[handle];
      if (!declared) {
        say(
          `  · ${handle} — ${mine.length} page(s), ${live.size} published. This repository declares none for ` +
            'this shop, so the number is reported and not judged.',
        );
        return;
      }
      const missing = declared.filter((slug) => !live.has(slug));
      if (missing.length === 0) {
        ok(`${handle}`, `all ${declared.length} institutional page(s) published: ${declared.join(', ')}`);
      } else {
        bad(
          `${handle}`,
          `MISSING, by name: ${missing.join(', ')} (${missing.length} of ${declared.length}). The storefront's ` +
            'institutional sidebar is hardcoded with all seven links, so each one of those is a link the shop ' +
            'draws into its own 404.',
        );
      }
    });
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
  const review$ = of('extension_records');
  const cafeId = storeIdOf('cafe');
  const page = await publicRead('products', { store: cafeId, limit: '100', page: '1' });
  const served = foundation(
    () => new Map(rows(page).map((p) => [products$(p, 'handle'), p])),
  );
  const reviews = await allOf('extension_records', { extension: 'reviews', model: 'review' });
  const byProduct = foundation(() => {
    const counted = new Map();
    for (const r of reviews) {
      const id = review$(r, 'product_id');
      counted.set(id, (counted.get(id) ?? 0) + 1);
    }
    return counted;
  });

  for (const want of expectedCoffees()) {
   await checking(() => {
    const got = served.get(want.handle);
    if (!got) {
      bad(want.handle, 'the shop does not serve it at all');
      return;
    }
    // ⚠️ THE BAG'S CONTENTS ARE DATA; THE BAG ITSELF IS A NAME. `metadata` has to have COME BACK — a document
    // served without it would otherwise read as a coffee that lost all nine of its custom fields — but a key
    // MISSING FROM INSIDE it is precisely the defect this line hunts, and stays a ✗.
    const raw = products$(got, 'metadata');
    const bag = raw && typeof raw === 'object' ? raw : {};
    const lost = Object.keys(want.metadata).filter((k) => bag[k] !== want.metadata[k]);
    // ⚠️ `m.kind === undefined ||` USED TO BE HERE, guessing that a picture with no kind was an image. The
    // reference publishes `kind` on every media row (measured: 24 of 24 on the bench, every one `image`), so
    // the tolerance was not compatibility — it was a media row of an unknown sort silently counted as a
    // photograph, in a check whose whole job is to count photographs.
    const photos = products$(got, 'media').filter((m) => products$(m, 'kind') === 'image').length;
    const sections = products$(got, 'content_sections').length;
    // The BAG is a name; `sub_enabled` inside it is the seed's mark, and its absence is the defect below.
    const marked = products$(got, 'skus').filter((k) => products$(k, 'metadata')?.sub_enabled === true).length;
    const wall = byProduct.get(products$(got, 'product_id')) ?? 0;

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
   });
  }

  // ── ★★ WHAT A SUBSCRIBER GETS (D14) — the PERKS, graded on the box and not on the declaration ─────────
  //
  // The buy box prints three of them ("Frete grátis · 10% OFF sempre · Pause quando quiser") and until
  // 03/09 the freight one did not exist as data — a promise the checkout could not keep, with nothing
  // anywhere saying so. `seed/coffee.test.mjs` holds the sentence and the declaration together; this asks
  // the box whether the declaration landed, which is the failure class this whole file exists for.
  {
    const held = await allOf('promotions_admin');
    // ★★ THE LIST PUBLISHES `state`, NOT `status`, AND IT DOES NOT PUBLISH `store_id` AT ALL — and asking for
    // the names it does not have is how this check accused correct data on 03/09. It reported both perks as
    // "status is undefined — a draft perk charges what the page says it will not" and "scoped to the whole
    // tenant" while the database held them `active` and confined to the coffee shop. A verifier that cries
    // wolf is worse than the defect it hunts: it teaches whoever reads the birth log to skip the ✗ lines.
    //
    //   · `state` is the CONTRACT's name (`PromotionListItem`) and it is the stored status crossed with the
    //     clock, which is the honest thing to grade: a perk that is `active` but scheduled for next month
    //     does not charge anything today either.
    //   · `store_id` is not on the frozen row on purpose. `read.promotion_stores` answers it for N promotions
    //     in one call — the read that exists precisely because the shape could not grow (`scopesOf`).
    //
    // ⇒ Neither name is trusted to a comment any more: `promo$` asserts the key came back, so the day the
    //   contract renames one of them this file says THAT, instead of accusing the box of a draft perk.
    const scopes = await scopesOf(held);
    for (const spec of COFFEE_PROMOTIONS) {
     await checking(() => {
      const got = held.find((p) => promo$(p, 'name') === spec.name);
      if (!got) {
        bad(`the perk "${spec.name}"`, 'not in this tenant at all — the coffee phase did not create it');
        return;
      }
      const problems = [];
      const benefit = promo$(got, 'benefit');
      if ((benefit?.kind ?? null) !== spec.benefit.kind)
        problems.push(`benefit is ${benefit?.kind ?? '(none)'}, declared ${spec.benefit.kind}`);
      const state = promo$(got, 'state');
      if (state !== 'active')
        problems.push(`state is ${state} — a perk that is not active charges what the page says it will not`);
      const scopedTo = scopes.get(promo$(got, 'id')) ?? null;
      if (scopedTo !== cafeId)
        problems.push(`scoped to ${scopedTo ?? 'the whole tenant'}, not to the coffee shop`);
      // `target` is a UNION, so `field` belonging to another variant is a fact about the DATA, not a missing
      // key — which is why the whole target is printed rather than the absence named.
      const target = promo$(got, 'target');
      if (target?.field !== 'sub_plan') problems.push(`targets ${JSON.stringify(target)} — not the subscribed line`);
      if (problems.length === 0) ok(`the perk "${spec.name}"`, `${benefit.kind}, active, on sub_plan lines`);
      else bad(`the perk "${spec.name}"`, problems.join(' · '));
     });
    }
  }

  // ── ⛔ THE STOCK POOL (D5) — products this tenant HOLDS and NO shop sells ──────────────────────────────
  //
  // The one thing about them that can silently go wrong is the one that empties the demo's whole past:
  // being published. `seed-history` takes its three alert states from products nothing sells, and a pool
  // product on a shelf leaves the pool — after which the past refuses by a number nobody connects to this.
  await checking(async () => {
    // `product_id ?? p.id` USED TO BE HERE, and `id` is a name no product document carries — a silent second
    // guess at the first one, which would have mapped every handle to `undefined` had the first ever moved.
    const catalogue = new Map(
      (await allOf('products_admin')).map((p) => [catalogue$(p, 'handle'), catalogue$(p, 'product_id')]),
    );
    for (const declared of poolProducts()) {
      const id = catalogue.get(declared.handle);
      if (!id) {
        bad(`the pool's ${declared.handle}`, 'not in the catalogue — seed/pool.mjs did not create it');
        continue;
      }
      // `read.product_stores` answers a BARE ARRAY of store ids — there is no row here to ask a name of.
      const shops = rows(await internal('product_stores', { product_id: id }));
      const where = (Array.isArray(shops) ? shops : []).length;
      if (where === 0) ok(`the pool's ${declared.handle}`, 'in the catalogue, on sale NOWHERE — which is the point');
      else bad(`the pool's ${declared.handle}`, `published to ${where} store(s) — it has left the stock pool`);
    }
  });

  // ★★ s3-14 / s7-11 · THE SAME SENTENCE ON TWO PRODUCTS, MEASURED IN THE BOX RATHER THAN IN THE SEED.
  //
  // `seed/commerce.test.mjs` already refuses a repeated (author, text) pair in the DECLARATION. This asks the
  // shop, which is a different question and the one that matters: rows written by an earlier version of the
  // seed are still there, and the home's review mosaic reads THEM. Measured 02/09 on the bench: "Tomo puro,
  // sem leite…" (Priscila N.) appeared on four coffees at once, two of them side by side on the home.
  await checking(() => {
    const pairs = new Map();
    const echoes = [];
    for (const r of reviews) {
      const pair = `${review$(r, 'author')} :: ${review$(r, 'body')}`;
      const first = pairs.get(pair);
      if (first === undefined) pairs.set(pair, review$(r, 'product_id'));
      else if (first !== review$(r, 'product_id')) echoes.push(`"${review$(r, 'author')}" on 2+ products`);
    }
    if (echoes.length === 0) ok('the review wall', `${reviews.length} row(s), no sentence on two products`);
    else bad('the review wall', `${[...new Set(echoes)].length} voice(s) recycled across products — the home puts them side by side: ${[...new Set(echoes)].join(', ')}`);
  });

  // The moderation queue has to have something on it, and the wall has to have something in it. Both, or the
  // demo shows one screen at the cost of the other.
  await checking(() => {
    const byStatus = reviews.reduce(
      (acc, r) => ({ ...acc, [review$(r, 'status')]: (acc[review$(r, 'status')] ?? 0) + 1 }),
      {},
    );
    const line = Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(' · ') || 'none';
    if ((byStatus.approved ?? 0) > 0 && (byStatus.pending ?? 0) > 0 && (byStatus.rejected ?? 0) > 0) {
      ok('the review mix', `${line} — the wall has rows, the queue has rows, and moderation was exercised`);
    } else {
      bad('the review mix', `${line} — approved, pending AND rejected are all needed (the vocabulary is approved|pending|rejected, never "published")`);
    }
  });

  // ── ★★ THE SUBSCRIPTIONS — THE OFFER EXISTED AND THE REGISTER DID NOT (pk25/d3) ──────────────────────
  //
  // ⛔ MEASURED ON THE LIVE BENCH, 08/09: `select count(*) from <subscriptions schema>.contract` answered
  // ZERO in both app schemas, on a box that had been offering subscriptions for days. Every check above was
  // green about that shop — the five marked coffees, the two subscriber perks, the plan picker — because
  // each of them grades the OFFER. The admin's home card (`latest_subscriptions`), the app's own screen and
  // every contract ficha were empty, and nothing anywhere said so.
  //
  // ⚠️ THE STATES ARE HALF THE CHECK. Three active contracts render the card and teach an operator nothing:
  // the status filter has one value, the ficha shows one word, and «pausada» and «cancelada» are
  // indistinguishable from "not implemented". `seed/subscriptions.mjs` declares who is in which state and
  // reaches the two non-birth ones by running the app's OWN actions, so this compares the multiset.
  await checking(async () => {
    const contract$ = of('extension_records');
    const held = await allOf('extension_records', { extension: 'subscriptions', model: 'contract' });
    const want = SUBSCRIBERS.map((s) => s.state).sort();
    const got = held.map((row) => contract$(row, 'status')).sort();
    const spell = (list) =>
      Object.entries(list.reduce((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {}))
        .map(([k, n]) => `${k}=${n}`)
        .join(' · ') || 'none';
    if (held.length === 0) {
      bad(
        'the subscriptions',
        'NO contract in this tenant. The shop offers subscriptions and nobody has ever signed one, so the ' +
          "admin home's `latest_subscriptions` card, Apps → Assinaturas and every ficha behind them render " +
          'empty — the capability is demonstrated with nothing in it. A contract is minted by the app from ' +
          'an `order.created` carrying `sub_plan`; see seed/subscriptions.mjs.',
      );
      return;
    }
    if (want.join(',') === got.join(',')) {
      ok('the subscriptions', `${held.length} contract(s): ${spell(got)}`);
    } else {
      bad(
        'the subscriptions',
        `${spell(got)} — the seed declares ${spell(want)}. A state the box does not hold is a word the ficha ` +
          'never shows.',
      );
    }
  });
}
say();
// ── 3c. ★★ THE HOME'S BLOCKS — WHICH SLOT EACH ONE ACTUALLY SITS IN (08/09) ──────────────────────────────
//
// The page is what `hook_placement` says it is, and until now nothing here read that table at all: every
// check above graded catalogue, pages, stock and promotions, and the SHOP WINDOW — the one thing a person
// looks at first — was measured by nobody. The 08/09 move is what made the gap expensive: a re-seed that put
// the Outlet's mosaic back under «Compre por categoria» would be green everywhere and wrong on the screen.
//
// ⚠️ ONLY PLACED, ENABLED INSTANCES COUNT. `read.extension_composition` is the ADMIN EDITOR's model: it also
// answers the manifest's own default hooks that no operator ever placed (`placement_id: null`) and the ones
// an operator switched off. Counting those would report a page nobody can see.
say('THE HOME — the blocks of the shop window, and the slot each one is really in');
{
  const comp$ = of('extension_composition');
  const dataset = datasetHome();
  for (const handle of seen) {
    await checking(async () => {
      const entries = rows(await internal('extension_composition', { store: storeIdOf(handle) }));
      const live = entries
        .filter((e) => comp$(e, 'placement_id') !== null && comp$(e, 'enabled') === true)
        .filter((e) => /^storefront:home\./.test(comp$(e, 'target')))
        .map((e) => ({
          app: comp$(e, 'extension_id'),
          component: comp$(e, 'component'),
          slot: comp$(e, 'target'),
          position: comp$(e, 'position'),
        }));
      const spell = (b) => `${b.app}/${b.component}@${b.slot.replace('storefront:', '')}`;

      if (handle === 'outlet') {
        // JUDGED ON SLOT AND POSITION — `seed/outlet.json` declares both and `seed/outlet.mjs` governs them.
        const want = OUTLET_HOME.map((b) => `${spell(b)}#${b.position}`).sort();
        const got = live.map((b) => `${spell(b)}#${b.position}`).sort();
        if (want.join(' · ') === got.join(' · ')) {
          ok(`${handle}'s home`, want.join(' · '));
        } else {
          bad(
            `${handle}'s home`,
            `is ${got.join(' · ') || '(no block at all)'} — seed/outlet.json declares ${want.join(' · ')}. ` +
              'The banner mosaic belongs in `home.hero` since 08/09, ABOVE «Compre por categoria»; a home ' +
              'that came back with it under the categories is a re-seed that undid that decision.',
          );
        }
        return;
      }

      if (dataset && handle === dataset.store) {
        // JUDGED ON SLOT ONLY, against the MOUNTED declaration — see `datasetHome()`. This is the check that
        // catches the shoe shop losing one of its TWO banner blocks (the hero carousel and the mosaic under
        // the categories), which is the neighbouring damage the Outlet's move could do and which no file of
        // THIS repository declares.
        const count = (list) => {
          const map = new Map();
          for (const b of list) map.set(spell(b), (map.get(spell(b)) ?? 0) + 1);
          return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => (n > 1 ? `${k}×${n}` : k));
        };
        const want = count(dataset.blocks.filter((b) => b.slot.startsWith('storefront:home.')));
        const got = count(live);
        if (want.join(' · ') === got.join(' · ')) {
          ok(`${handle}'s home`, `${want.join(' · ')} (from the mounted dataset)`);
        } else {
          bad(
            `${handle}'s home`,
            `is ${got.join(' · ') || '(no block at all)'} — the mounted dataset declares ${want.join(' · ')}`,
          );
        }
        return;
      }

      say(
        `  · ${handle} — ${live.length} block(s) on the home` +
          `${live.length ? `: ${live.map((b) => `${spell(b)}#${b.position}`).sort().join(' · ')}` : ''}. ` +
          (dataset
            ? "Nothing declares this shop's window, so the list is reported and not judged."
            : `${whyNoDataset}, so the dataset's own declaration cannot be read here; reported and not judged.`),
      );
    });
  }
}
say();
// ── 3d. ★★★ THE ADMIN HOME'S WIDGET ORDER — PER TENANT, because "some tenant is right" is how this hid ─────
//
// ⛔ THE DEFECT, reported from the screen on 10/09: the latest-subscriptions block was still coming out at
// the TOP — right in the café's admin and wrong in the shoe shop's. Measured on the live box, the
// two boards came back in DIFFERENT orders — `forgeco` with `subscriptions` at position 0 and `forgecafe` with
// it at 7 — because installing an app auto-places its widgets at the end, so a widget's position IS the order
// its app was installed in. One of the two tenants happened to land on the declared order by accident.
//
// ★★ SO THE CHECK IS PER TENANT AND NEVER "DOES SOME TENANT LOOK RIGHT". This verifier already runs once per
// tenant, which is what makes that free — and it is the whole reason this check belongs here and not in a
// one-shot: nothing that runs for the DATASET tenant alone can grade the tenant the dataset is not about.
//
// ⚠️ IT GRADES THE PREFIX, NOT THE WHOLE BOARD. The declaration names the widgets somebody decided about;
// everything else keeps the relative place it had, so the two tenants legitimately END differently. Demanding
// the whole list would be inventing a decision nobody made — see `widgetPrefixProblem`.
say("THE ADMIN HOME — the widget order this tenant's board really opens with");
await checking(async () => {
  const { declared, why, from } = declaredAdminWidgets();
  if (declared === null) {
    say(`  · ${why}, so nothing declares an order for ${tenant}'s admin home; reported and not judged.`);
    return;
  }
  if (declared.length === 0) {
    say(`  · ${from} declares no admin_widgets; this board keeps its install order. Not judged.`);
    return;
  }
  // ⚠️ ANY store of this tenant: `admin:` placements carry a NULL store in the kernel, so the argument only
  // has to belong to the tenant. A tenant with no store at all was already refused far above.
  const anyStore = seen[0];
  if (anyStore === undefined) {
    bad(`${tenant}'s admin home`, 'this credential sees no store, so the board could not be read');
    return;
  }
  const comp$ = of('extension_composition');
  const entries = rows(await internal('extension_composition', { store: storeIdOf(anyStore) }));
  // PLACED ONLY, and ordered the way the admin packs them — `position`, then nothing else. The same filter
  // section 3c makes, for the same reason: the editor's model also answers hooks nobody placed.
  const board = entries
    .filter((e) => comp$(e, 'target') === ADMIN_WIDGETS_SLOT && comp$(e, 'placement_id') !== null)
    .map((e) => ({
      extension_id: comp$(e, 'extension_id'),
      component: comp$(e, 'component'),
      position: comp$(e, 'position'),
    }))
    .sort((a, b) => a.position - b.position);
  // ⛔ ANTI-VACUUM, AND IT IS THE HALF THAT MATTERS. A board with no widget makes every comparison below
  // vacuously true, and this file's whole thesis is that a check which passes because it found nothing is
  // worse than no check. A declaration naming seven widgets over an empty board is a RED that names the
  // tenant, never a line that says "nothing to compare".
  if (board.length === 0) {
    bad(
      `${tenant}'s admin home`,
      `carries NO placed widget in ${ADMIN_WIDGETS_SLOT} while ${from} declares ${declared.length} ` +
        `(${declared.join(', ')}) — the cockpit is empty and this check graded nothing. \`admin-dashboard\` ` +
        'is what places them',
    );
    return;
  }
  const problem = widgetPrefixProblem(board, declared);
  if (problem) bad(`${tenant}'s admin home`, problem);
  else ok(`${tenant}'s admin home opens with`, board.slice(0, declared.length).map(widgetName).join(' · '));
});

say();
// ── 3e. ★★ THE APPS' OWN BLOCKS — A CAPABILITY THE BOX CARRIES AND SHOWS NOWHERE (pk31/§6) ───────────────
//
// ⛔ WHY THIS EXISTS, and it is a measurement about THIS FILE rather than about the box. pk31/§6 asked
// whether the `subscriptions` app's `confirmation_note` block — the one sentence a shopper who just signed a
// subscription reads on the receipt — had ever been placed on the demo. The answer was derived by COUNTING:
// the app declares five blocks, the café showed four, so one was missing and it must be that one.
//
// ★ IT WAS WRONG, AND IT WAS WRONG IN THE ONLY WAY A COUNT CAN BE. The fifth block is `latest_subscriptions`,
// an `admin:` one, and an admin placement is seeded ONCE PER TENANT with a NULL store (MULTISTORE M3) — so
// four store-scoped rows plus one tenant-scoped row IS all five. `confirmation_note` was placed and enabled
// on every store of both tenants all along (`hook_placement`, measured on the box of 2026-09-11), and the
// public `read.extensions` publishes it at `storefront:checkout.confirmation`.
//
// ⇒ SO THE DEFECT WAS THAT NOBODY COULD ASK. Every other section of this file grades something a seed of this
//   repository WRITES; an app's default placements are written by the KERNEL (`extension.install` →
//   `seedDefaultPlacements`), and nothing here ever looked at them. A question answered by counting rows in
//   two different scopes is a question answered by guessing, and it cost a whole slice's premise.
//
// ★★ THE RULE, AND IT IS DERIVED — never a list of block names, which would rot the day an app adds one.
//   `read.extension_composition` answers EVERY DECLARED HOOK of this tenant's ACTIVE installs, resolved
//   against each store's placement, including the ones nobody placed (`placement_id: null`) and the ones an
//   operator switched off. So the declaration and the reality arrive in the same answer, from the box.
//
//   A block is LIVE where it has a placement id and is enabled. The verdict is per BLOCK and not per store:
//   **a block that is live in NO store of this tenant is a capability this box carries and shows nowhere.**
//
// ⚠️ PER TENANT AND NOT PER STORE, DELIBERATELY, and the Outlet is the reason. `seed/outlet.mjs` REMOVES the
//   `shelves/shelf` instance that `extension.install` drops into `storefront:list.*` — the Outlet's PLP is
//   meant to carry nothing. That is a decision, not a defect, and a check that demanded every declared block in
//   every store would go red on it and would need an exception list to shut up. An exception list typed here
//   is the thing this house keeps being bitten by. "Live somewhere" needs none: the shoe shop still shows a
//   shelf, so the capability is demonstrated, and a block nobody placed ANYWHERE still cannot hide.
//
// ⚠️ `storefront:` ONLY. The `admin:` half is section 3d's question and it is a stricter one (it grades the
//   ORDER, not merely the presence), so grading it loosely here would be a second, weaker answer to a
//   question that already has a better one.
say('THE APPS — every block an installed app declares, and whether any store really shows it');
await checking(async () => {
  const comp$ = of('extension_composition');
  /** `<app>/<component>` → { target declared by the app, the handles where it is LIVE } */
  const blocks = new Map();
  for (const handle of seen) {
    const entries = rows(await internal('extension_composition', { store: storeIdOf(handle) }));
    for (const e of entries) {
      const target = comp$(e, 'target');
      if (!target.startsWith('storefront:')) continue;
      const name = `${comp$(e, 'extension_id')}/${comp$(e, 'component')}`;
      const block = blocks.get(name) ?? { name, target, live: [] };
      // A declared hook with no placement, and one an operator switched off, are the same thing on a page:
      // nothing. `position` is 3c/3d's business; presence is this one's.
      if (comp$(e, 'placement_id') !== null && comp$(e, 'enabled') === true) block.live.push(handle);
      blocks.set(name, block);
    }
  }
  // ⛔ ANTI-VACUUM, and it is the half that matters here exactly as it does in 3d: with no block in the
  // answer every verdict below is vacuously true, and this whole section exists because a question nobody
  // could ask produced a confident wrong answer. A tenant whose apps declare NOTHING is a box where every
  // shopper-facing app block is missing at once — far likelier a credential or a read that stopped
  // publishing than a deliberate arrangement — so it accuses instead of settling.
  if (blocks.size === 0) {
    bad(
      `${tenant}'s apps`,
      'read.extension_composition named NO storefront block for any store of this tenant. Either no app is ' +
        'installed (and then the shop has no reviews, no shelves, no payment options) or this check graded ' +
        'nothing at all — both are unsettled, neither is a demo',
    );
    return;
  }
  const dark = [...blocks.values()].filter((b) => b.live.length === 0);
  if (dark.length > 0) {
    bad(
      `${tenant}'s apps`,
      `${dark.length} declared block(s) live in NO store: ` +
        `${dark.map((b) => `${b.name} @ ${b.target.replace('storefront:', '')}`).join(' · ')}. ` +
        'The app is installed, the kernel placed it at install and somebody removed or disabled it in every ' +
        'store — so the capability ships with this box and no visitor can ever see it',
    );
    return;
  }
  ok(
    `${tenant}'s apps`,
    `${blocks.size} declared block(s), each live in at least one store: ` +
      [...blocks.values()]
        .map((b) => `${b.name}(${b.live.length})`)
        .sort()
        .join(' · '),
  );
});

say();
// ── 4. the placeholders ─────────────────────────────────────────────────────────────────────────────────
say('THE PLACEHOLDER ART — findable in one gesture');
await checking(async () => {
  const asset$ = of('assets');
  const assets = await allOf('assets', { q: 'placeholder-' });
  if (assets.length === 0) {
    bad('placeholders', 'none in the Asset Library — the seed has not uploaded them');
    return;
  }
  ok('placeholders', `${assets.length} in the Asset Library`);
  say(`      admin → Biblioteca de Assets → buscar "placeholder-"`);
  // `filename` is NULLABLE and the fallback is the design of the read (its own search covers both columns) —
  // so `??` is reading a null VALUE here, which is a different act from reading a name that never came.
  for (const a of assets.slice(0, 12)) say(`      · ${asset$(a, 'filename') ?? asset$(a, 'provider_key')}`);
});

// ── the verdict ─────────────────────────────────────────────────────────────────────────────────────────
say();
// ⚑ COMES FIRST, AND IT IS NOT A COUNT OF FAILURES. A question this file could not ask says nothing about the
// box; reporting it beside the ✗ lines would put the reader back where 03/09 left them — reading an
// accusation and hunting a defect that does not exist. It gets its own sentence and its own exit code.
if (wrongQuestions > 0) {
  say(
    `VERDICT: ${wrongQuestions} question(s) above are THIS VERIFIER's own — a read was asked for a name it ` +
      'does not publish, so those checks measured nothing. Nothing there is a claim about the box; fix the ' +
      `⚑ lines and run it again.${failures > 0 ? ` (${failures} separate ✗ check(s) did not settle.)` : ''}`,
  );
} else if (failures === 0) {
  say(`VERDICT: settled. Everything this run checked on ${tenant} is what the seed declares.`);
} else {
  say(`VERDICT: ${failures} check(s) NOT settled on ${tenant}. Read the ✗ lines above.`);
}
process.stdout.write(`${out.join('\n')}\n`);
// 0 settled · 1 the box did not · 2 the QUESTION did not. `bin/box-up.sh` treats every non-zero as unsettled,
// which is right — but a reader of the code, or a future caller, can tell whose defect it was.
process.exit(wrongQuestions > 0 ? 2 : failures === 0 ? 0 : 1);

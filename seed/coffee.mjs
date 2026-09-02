// THE COFFEE STORE'S BIRTH DATA — the part `seed/catalog.json` cannot express, driven through the port.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, for the same reason `seed/outlet.mjs` is one: two slices
// filling two stores in two worktrees, and one file between them is a conflict with a stopwatch on it. It
// receives the port the seed already built and knows nothing about transport.
//
// ── WHAT THE CATALOGUE FILE COULD NOT SAY, AND WHY EACH OF THESE IS HERE ─────────────────────────────────
//
// `catalog.json` creates six coffees with their custom fields, their options and their SKUs. Three things
// the coffee store's two screens need are NOT product fields, and each one is a different mechanism:
//
//   1. THE SUBSCRIPTION MARK, on the SKU. Not decoration — it is the whole proof of curation-by-SKU that
//      was asked for in these words: *"default nasce falso e o lojista faz a curadoria manual… se eu compro
//      sku, o que eu assino é o sku também"*. Five coffees are marked and the Edição do Produtor is NOT, and
//      the consequence is that the storefront draws no subscription control on its page — with NOT ONE LINE
//      OF `if` IN THE FORK. The vitrine asks `sku.metadata.sub_enabled === true` and that is the entire
//      rule. A product falls out of the offer by not being marked, which is what makes the boundary real.
//
//   2. THE SUBSCRIBER DISCOUNT, as a PROMOTION TARGETING THE LINE'S OWN FIELD. The design shows a struck
//      price on the subscription option; the checkout has to actually take it off. It is written here as an
//      item promotion whose target is `{ kind: 'custom_field', field: 'sub_plan', operator: 'exists' }` —
//      the target the kernel learned in this same stack — so the chain is proven end to end: the app
//      DECLARES the line field, the shopper's choice WRITES it, and the promotion engine PRICES on it.
//      ⚠️ ORDER MATTERS AND THE KERNEL ENFORCES IT: `promotion.create` refuses a custom-field target whose
//      key is not an active `cart_line` declaration ("custom field not declared: sub_plan"). The app must be
//      installed first — installing is what materializes its declaration. That refusal is a feature and this
//      module depends on it rather than working around it.
//
//   3. THE REVIEWS — and they are NOT here. See the block at the bottom: there is no minimal door for them
//      that is not a hole somebody intends to close, and inventing one inside a seed is how a shortcut
//      becomes a dependency. It is reported, not smuggled.
//
// IDEMPOTENT BY CONSTRUCTION, like its sibling: everything is keyed by something this file chooses, the read
// face is asked first, and what is already there is skipped. Re-running converges and never deletes.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unresolved } from './minted.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));

/** The store this module touches, and the only one. Its handle is the catalogue's own. */
const STORE_HANDLE = 'cafe';

/** The apps the coffee store's two screens need INSTALLED. Both are on this box's composition list, which
 *  is what puts them in the image; installing is a separate, per-tenant gesture — the operator's two clicks
 *  in the admin, spelled as a command so a clone comes up the same way. */
const APPS = ['subscriptions', 'reviews'];

/** ★ THE CURATION. Five in, one out, and the one that is out is out ON PURPOSE (`seed/catalog.json` calls it
 *  a rotating lot). Written as the handles that ARE subscribable rather than as the one that is not: a
 *  seventh coffee added tomorrow is NOT subscribable until a human says so, which is the default the mark
 *  exists to defend. */
export const SUBSCRIBABLE_HANDLES = [
  'forge-alvorada',
  'forge-serra-do-caparao',
  'forge-cerrado-mineiro',
  'forge-noturno',
  'forge-descafeinado',
];

/** This app's key on the SKU bag. It belongs to `@forgecommerce/ext-subscriptions` (`subscribable.ts`) and
 *  is repeated here because a seed script may not import an app's source — the app lives in the image. */
export const SUB_ENABLED_FIELD = 'sub_enabled';

/** The subscriber discount, in basis points. 1000 = 10.00%.
 *
 * ⚠️ THIS NUMBER HAS A TWIN IN THE VITRINE (`storefront-coffee/src/lib/coffee/subscription.ts`) and the two
 * MUST agree: the shop prints "10% OFF" beside the subscription option, and this is what the checkout
 * actually takes off. They cannot be one constant — one lives in a container, the other in a database — so
 * the vitrine's copy names this file and this file names the vitrine's. Change one and change both. */
const SUBSCRIBER_PERCENT_BP = 1000;

const PROMOTION_NAME = 'Assinante 10% OFF';

// ── ★★ THE EXPECTATIONS, AS FUNCTIONS — the thing every guard in this repository is derived from ─────────
//
// ⚠️ THEY LIVE HERE AND NOT IN `bin/seed.mjs` FOR THE SAME REASON `seed/media.mjs` gives: that file runs on
// import (it validates the env and then seeds), so nothing can import it to check its reasoning — and a
// verifier that re-typed the nine keys would go stale the day somebody edited the catalogue, SILENTLY. One
// function, two readers: the seed that WRITES and the guard that MEASURES.

/**
 * The metadata bag a coffee is BORN with — the declared custom fields plus the subtitle, which rides the
 * same bag (`product-view.ts` reads `field(product,'subtitle')` for the kicker above the title).
 */
export function expectedMetadata(product) {
  return { ...product.custom_fields, ...(product.subtitle ? { subtitle: product.subtitle } : {}) };
}

/**
 * ★ THE PHOTOGRAPHS ONE PRODUCT DECLARES, IN ORDER — the list, not the picture.
 *
 * `photos` (a list) is what the coffee page reads BY POSITION — `PdpCoffee.tsx:5`: `[0]` is the bag,
 * `[1..3]` are the story. `photo` (singular) is the bag and remains the fallback for a product that declares
 * no list, so nothing regressed on the day the list arrived.
 */
export function expectedPhotos(product) {
  if (Array.isArray(product.photos) && product.photos.length > 0) return product.photos;
  return product.photo ? [product.photo] : [];
}

/** What the dataset says a coffee's page should be able to draw — one object, so the seed and the verifier
 *  cannot disagree about what "complete" means. */
export function expectedCoffee(product) {
  return {
    handle: product.handle,
    metadata: expectedMetadata(product),
    photos: expectedPhotos(product),
    sections: (product.content_sections ?? []).map((x) => ({ title: x.title, body: x.body })),
    subscribable: SUBSCRIBABLE_HANDLES.includes(product.handle),
  };
}

/** Every coffee the catalogue declares, as expectations. The verifier's whole input. */
export function expectedCoffees() {
  return catalog.products.map(expectedCoffee);
}

/**
 * @param port {{ api: string, token: string, tenant: string, command: Function, read: Function,
 *                rows: Function, log: Function, fail: Function }}
 */
export async function seedCoffee(port) {
  const { read, rows, log, fail } = port;

  // By HANDLE here and by ID everywhere after: `store` in a command is the id (`sto_…`), and passing a
  // handle is a 404 that names the store rather than the mistake.
  const store = rows(await read('stores')).find((s) => s.handle === STORE_HANDLE);
  if (!store) {
    fail(
      `the store "${STORE_HANDLE}" does not exist yet. It is created by the catalogue step of bin/seed.mjs —\n` +
        '  run this module after it, never before.',
    );
  }
  log(`coffee — store ${store.handle} (${store.id}), theme "${store.theme_key ?? 'vanilla'}"`);

  await installApps(port);
  await markSubscribable(port, store);
  await subscriberPromotion(port, store);

  log('coffee — done. Re-running this is a no-op.');
}

// ── 1. the apps ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ THE SUBSCRIPTIONS INSTALL IS A PRECONDITION OF STEP 3, not merely a nicety: installing is what
// materializes the app's `sub_plan` declaration, and the promotion below is REFUSED without it.
async function installApps({ command, read, rows, log }) {
  const installed = new Set(
    rows(await read('installed_extensions')).map((e) => e.extension_id ?? e.id),
  );
  for (const id of APPS) {
    if (installed.has(id)) {
      log(`coffee — app ${id} already installed`);
      continue;
    }
    await command('extension.install', { extension_id: id });
    log(`coffee — app ${id} installed`);
  }
}

// ── 2. the curation mark ────────────────────────────────────────────────────────────────────────────────
/**
 * ⛔⛔ WHAT WAS WRONG HERE, MEASURED, BECAUSE THE FIX IS UNREADABLE WITHOUT IT (A46).
 *
 * This step asked `readAll('products', {store})` for the six coffees and marked every SKU of the five it
 * curated. On the pre-seed box it marked **zero, in silence**, and the storefront drew no subscription
 * control on any coffee page. The kernel was innocent and so was the app; the mark had never been written.
 *
 * The read is served by a PROJECTION, and the projection had not received the products yet. Measured on the
 * box (2026-09-02, `event_delivery` joined to `event_outbox`):
 *
 *     catalog.product.created  forge-alvorada   emitted 00:31:44.469955
 *     catalog.projection       applied it at            00:31:45.090644   ← 620 ms later
 *     this step ran between the publish (00:31:44.58) and the counter's seal (00:31:45.012)
 *
 * So the loop walked twenty-nine pages of a catalogue that did not contain the thing it was looking for, and
 * `for (…of []) {}` is not an error. `sku.updated_at === sku.created_at` on all nineteen coffee SKUs; not one
 * `catalog.sku.updated` event exists for any of them.
 *
 * ⚠️ AND THE GUARD THAT EXISTED WATCHED THE WRONG END. It refused a curated handle that `catalog.json` does
 * not declare — a check on the INPUT, which cannot fail as long as the two lists in this file agree — and
 * said nothing at all about the RESULT. A guard on the input is a guard that can only catch a typo.
 *
 * ★ THE FIX IS BOTH HALVES, and neither alone is enough:
 *
 *   1. ASK THE RUN'S OWN REGISTRY FIRST (`seed/minted.mjs`), which covers exactly the window where the race
 *      exists and has no timeout that can still be wrong. The read remains the authority for everything an
 *      EARLIER run made, where there is nothing to race.
 *   2. FAIL ON THE RESULT. Every curated handle must end this function with at least one SKU carrying the
 *      mark. "I was asked to mark five coffees and I marked none" is a sentence, not a log line.
 *
 * ⚠️ THE MARK IS WRITTEN WITH `catalog.sku.update`, AND `metadata` IS REPLACED WHOLESALE. The command
 * validates declared `sku` fields and then COALESCES the bag, so writing `{sub_enabled:true}` over a SKU
 * that already holds something would erase the something. The bag is therefore merged, and for a SKU this
 * run just minted the bag comes from the registry — which knows what was SENT — rather than from a guess.
 */
export async function markSubscribable({ command, readAll, minted, log }, store) {
  const wanted = new Set(SUBSCRIBABLE_HANDLES);
  const known = new Set(catalog.products.map((p) => p.handle));
  const orphans = [...wanted].filter((handle) => !known.has(handle));
  if (orphans.length > 0) {
    // A curated handle that is not in the catalogue is ALWAYS a curation bug, and silence would make a PDP
    // quietly miss its subscription control. Name them and stop. (A check on the INPUT — kept, but it is
    // NOT the guard: see the result check at the bottom.)
    throw new Error(
      `coffee — these handles are marked subscribable but are not in seed/catalog.json: ${orphans.join(', ')}`,
    );
  }

  // ⚠️ `store` IS REQUIRED BY THIS READ even though the internal face answers the whole TENANT catalogue
  // regardless of it (measured by D1, and the note is in bin/seed.mjs). Omitting it is a refusal, not a
  // wider answer — so it is passed, and the filtering below is by handle rather than by trusting it.
  // ★ S1 — AND IT PAGES. With the sports store seeded this read answers 2811 products over 29 pages; one
  // page of 100 would filter six coffees out of a window they are not in, and mark nothing, in silence.
  const fromRead = new Map();
  for (const product of await readAll('products', { store: store.id })) {
    if (wanted.has(product.handle)) fromRead.set(product.handle, product.skus ?? []);
  }

  let marked = 0;
  let already = 0;
  /** handle -> how many of its SKUs now carry the mark. THE thing this function is judged on. */
  const carrying = new Map();
  const unseen = [];
  for (const handle of SUBSCRIBABLE_HANDLES) {
    // ★★ THE REGISTRY FIRST. Only something created by THIS run can be missing from the read, and that is
    // precisely what the registry holds — with the bag it was created with, so the merge below is honest.
    const skus = minted?.skusOf(handle) ?? fromRead.get(handle) ?? null;
    if (!skus || skus.length === 0) {
      unseen.push(handle);
      continue;
    }
    let mine = 0;
    for (const sku of skus) {
      const bag = sku.metadata && typeof sku.metadata === 'object' ? sku.metadata : {};
      mine += 1;
      if (bag[SUB_ENABLED_FIELD] === true) {
        already += 1;
        continue;
      }
      await command('catalog.sku.update', {
        sku_id: sku.id,
        metadata: { ...bag, [SUB_ENABLED_FIELD]: true },
      });
      marked += 1;
    }
    carrying.set(handle, mine);
  }

  // ── ★★ THE GUARD, AND IT IS ON THE RESULT ───────────────────────────────────────────────────────────
  // "Asked to mark five and marked zero" must be a death. This is the check whose absence let A46 ship: the
  // old version logged `0 sku(s) marked` and returned 0 as if it were an answer.
  if (unseen.length > 0) {
    throw new Error(
      unresolved({
        what: 'subscribable coffee(s)',
        names: unseen,
        measured:
          `the store read answered ${fromRead.size} of the ${SUBSCRIBABLE_HANDLES.length} curated handles ` +
          `and this run's registry holds ${minted?.counts?.products ?? 0} product(s); ` +
          `${marked} sku(s) were marked and ${already} already carried the mark`,
        andThen:
          'the catalogue step did not create them — `catalog.product.create` is what mints them and\n' +
          '  `minted.rememberSkusOf` is what makes them findable here before the projection catches up.',
      }),
    );
  }
  const empty = SUBSCRIBABLE_HANDLES.filter((h) => (carrying.get(h) ?? 0) === 0);
  if (empty.length > 0) {
    throw new Error(
      `coffee — ${empty.length} curated coffee(s) resolved but carry NO sku to mark: ${empty.join(', ')}.\n` +
        '  The subscription control on their product page is drawn from `sku.metadata.sub_enabled` and\n' +
        '  nothing else, so a coffee with no marked sku is a coffee nobody can subscribe to — silently.',
    );
  }

  log(
    `coffee — subscription mark: ${marked} sku(s) marked, ${already} already marked, across ` +
      `${carrying.size} coffee(s); ` +
      `${catalog.products.length - SUBSCRIBABLE_HANDLES.length} coffee(s) deliberately left out`,
  );
}

// ── 3. the subscriber discount ──────────────────────────────────────────────────────────────────────────
/**
 * The 10% every subscribed line gets, as an ITEM promotion targeting the line's own declared field.
 *
 * `operator: 'exists'` and not `eq`: the discount is for subscribing, not for one rhythm. A shopper on the
 * weekly plan and one on the monthly plan are both subscribers, and an `eq` per rhythm would be three
 * promotions that have to be kept equal by hand.
 *
 * `scope: 'each_item'` because the design prints the discount PER BAG, next to the bag. An order-level
 * percentage would total the same and would be unable to say what the page says.
 *
 * Scoped to this store: the Outlet and the control store share this tenant, and a tenant-wide subscriber
 * discount would be a promotion the other two shops never asked for.
 */
async function subscriberPromotion({ command, read, readAll, rows, log }, store) {
  const existing = (await readAll('promotions_admin')).find(
    (p) => p.name === PROMOTION_NAME,
  );
  if (existing) {
    log(`coffee — promotion "${PROMOTION_NAME}" already exists (${existing.id})`);
    return;
  }

  const out = await command('promotion.create', {
    name: PROMOTION_NAME,
    label: 'Assinante 10% OFF',
    store_id: store.id,
    benefit: { kind: 'percentage', percent_bp: SUBSCRIBER_PERCENT_BP, scope: 'each_item' },
    // ★ THE WHOLE POINT. The app declares `sub_plan` on the cart line; the shopper's choice writes it; this
    // is what prices on it. The kernel refuses this target if the declaration is not active — which is why
    // installApps() runs first, and why a failure here reads "custom field not declared: sub_plan" rather
    // than a promotion that quietly never applies.
    target: { kind: 'custom_field', field: 'sub_plan', operator: 'exists' },
    // Born ACTIVE, deliberately, unlike the command's own default: a draft subscriber discount is a shop
    // that shows "10% OFF" on the product page and charges full price at the till.
    status: 'active',
    stackable: true,
  });
  log(`coffee — promotion "${PROMOTION_NAME}" created (${out.promotion_id ?? '?'}), 10% off every
    line carrying a subscription plan`);
}

// ── ⚠️ THE REVIEWS ARE NOT SEEDED, AND THIS IS WHY ──────────────────────────────────────────────────────
//
// The review wall is one of the two dynamic pieces the design marked with a hole, and it is the consumer of
// the `fetchPublishedReviews` export. It is NOT filled here, because every door measured is wrong in a
// different way and picking one quietly would bake a shortcut into this instance's birth data:
//
//   · `POST /apps/reviews/submit` — the shopper's own path. Requires a customer SESSION and an ORDER the
//     session owns (the app asks the kernel "is this order yours?" under the shopper's cookie). A seed has
//     neither, and manufacturing them would be a seed that logs in as somebody.
//   · the app's `seed_demo` ACTION, reachable through `POST /v1/internal/extension/action` with a tenant
//     credential — the right-shaped door. But its data source is INJECTED by the platform from
//     `FORGE_SEED_DATASET_DIR`, i.e. the Forge demo's own dataset, whose handles are a shoe shop's. Pointed
//     at this box it would seed nothing, and making it work means this repository shipping a dataset
//     directory in the platform's format — real work, and not "the minimum that closes the journey".
//   · the app's PUBLIC create face, with `status: 'approved'` in the body. It works. It works because of a
//     hole the app's own source names and deliberately leaves open ("a caller can still write
//     `status: 'approved'` and skip the queue… a separate hole, deliberately not closed"). A seed that
//     depends on it becomes a reason not to close it.
//
// So the wall renders EMPTY against this seed, and the storefront draws nothing rather than a broken
// section — which is the degradation the pages were written for anyway. Named here rather than silently
// missing, exactly like the three supporting products the catalogue promises and does not list.

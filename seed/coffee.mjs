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
const SUBSCRIBABLE_HANDLES = [
  'forge-alvorada',
  'forge-serra-do-caparao',
  'forge-cerrado-mineiro',
  'forge-noturno',
  'forge-descafeinado',
];

/** This app's key on the SKU bag. It belongs to `@forgecommerce/ext-subscriptions` (`subscribable.ts`) and
 *  is repeated here because a seed script may not import an app's source — the app lives in the image. */
const SUB_ENABLED_FIELD = 'sub_enabled';

/** The subscriber discount, in basis points. 1000 = 10.00%.
 *
 * ⚠️ THIS NUMBER HAS A TWIN IN THE VITRINE (`storefront-coffee/src/lib/coffee/subscription.ts`) and the two
 * MUST agree: the shop prints "10% OFF" beside the subscription option, and this is what the checkout
 * actually takes off. They cannot be one constant — one lives in a container, the other in a database — so
 * the vitrine's copy names this file and this file names the vitrine's. Change one and change both. */
const SUBSCRIBER_PERCENT_BP = 1000;

const PROMOTION_NAME = 'Assinante 10% OFF';

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
 * Mark every SKU of the five subscribable coffees, and leave the sixth alone.
 *
 * ⚠️ THE MARK IS WRITTEN WITH `catalog.sku.update`, AND `metadata` IS REPLACED WHOLESALE. The command
 * validates declared `sku` fields and then COALESCES the bag, so writing `{sub_enabled:true}` over a SKU
 * that already holds something would erase the something. Nothing on these SKUs holds anything today —
 * measured against `seed/catalog.json`, which writes no SKU metadata at all — but the merge is done anyway,
 * because "nothing there today" is a fact about this afternoon and the destructive version of this line
 * would be found by a merchant, later, missing a field they typed.
 */
async function markSubscribable({ command, read, rows, log }, store) {
  const wanted = new Set(SUBSCRIBABLE_HANDLES);
  const known = new Set(catalog.products.map((p) => p.handle));
  const orphans = [...wanted].filter((handle) => !known.has(handle));
  if (orphans.length > 0) {
    // A curated handle that is not in the catalogue is ALWAYS a curation bug, and silence would make a PDP
    // quietly miss its subscription control. Name them and stop.
    throw new Error(
      `coffee — these handles are marked subscribable but are not in seed/catalog.json: ${orphans.join(', ')}`,
    );
  }

  let marked = 0;
  let already = 0;
  // ⚠️ `store` IS REQUIRED BY THIS READ even though the internal face answers the whole TENANT catalogue
  // regardless of it (measured by D1, and the note is in bin/seed.mjs). Omitting it is a refusal, not a
  // wider answer — so it is passed, and the filtering this loop does is by handle rather than by trusting it.
  for (const product of rows(await read('products', { store: store.id, limit: '100' }))) {
    if (!wanted.has(product.handle)) continue;
    for (const sku of product.skus ?? []) {
      const bag = sku.metadata && typeof sku.metadata === 'object' ? sku.metadata : {};
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
  }
  log(
    `coffee — subscription mark: ${marked} sku(s) marked, ${already} already marked, ` +
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
async function subscriberPromotion({ command, read, rows, log }, store) {
  const existing = rows(await read('promotions_admin', { limit: '100' })).find(
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

// THE BOX STOPS BEING A SHOP WINDOW AND STARTS SELLING — the apps that take money, the channels that stay
// quiet while we seed, and the reviews that arrive through the two doors a real store has.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, for the same reason `seed/totem.mjs` and `seed/coffee.mjs`
// are modules: slices fill a box from different worktrees, and one file between them is a conflict with a
// stopwatch on it. It receives the port the seed already built and knows nothing about transport.
//
// ── ⭐ WHAT THIS FILE DELIBERATELY DOES **NOT** DO, so nobody adds it back in a month ────────────────────
//
// **It seeds no order history.** The demo's PAST comes from one place — the history plan in the `demo-data`
// app, replayed by `node dist/seed-history.js` INSIDE the kernel, which is the only caller that can date an
// order (`createDispatcher({ now })`; the port has no backdating parameter and never will). That plan already
// produces orders across statuses: paid, awaiting payment, shipped, delivered, cancelled, refunded.
//
// So this file places exactly ONE live order per selling store, and its job is not "have orders" — it is to
// prove the box can still take an order TODAY, after everything above it ran. Two populations of orders would
// be two sources for the same fact, and a dashboard that disagrees with itself. (Decision of the tech lead,
// pre-seed wave: "duas populações seriam duas verdades".)
//
// **It creates no logistics.** Zone, method, rate and the pickup point belong to the filler slice, which
// already creates them from the dataset. This file CONSUMES them: it reads the quote and picks what is there.

/** The channel every message in this box travels on. The kernel declares exactly one today (`email`). */
export const EMAIL_CHANNEL = 'email';

/**
 * The buyer-facing order messages, exactly as the kernel declares them (`read.notification_types`,
 * `audience: customer`). Copied by MEASUREMENT rather than by memory — a key invented here is a channel the
 * seed believes it silenced and did not.
 */
export const BUYER_ORDER_TYPES = [
  'order.placed',
  'order.paid',
  'order.awaiting_payment',
  'order.shipped',
  'order.ready_for_pickup',
  'order.delivered',
  'order.cancelled',
];

/**
 * The other two the seed silences, and they are NOT buyer messages — which is why they are named separately
 * even though they now follow the same rule.
 *
 * ⭐ BOTH WERE FOUND BY READING `read.notification_types`, NOT BY REMEMBERING. The wave's brief named the
 * `order.*` buyer types; the port also declares `order.placed.operator` (audience: operator — and on this
 * bench the operator is the same inbox the buyer mail was being kept out of: a hundred seeded orders is a
 * hundred real e-mails) and `ext.reviews.review_request` (audience: customer, fired when an order is
 * delivered — which the history seeds by the dozen). A hand-written list and a read of the port cost the
 * same; only one of them ages.
 */
export const SEED_NOISE_TYPES = ['order.placed.operator', 'ext.reviews.review_request'];

/** Everything the seed switches. Two lists because they mean different things; one rule because, after
 * Renan's literal word (below), they are treated the same. */
export const SEED_MANAGED_TYPES = [...BUYER_ORDER_TYPES, ...SEED_NOISE_TYPES];

/**
 * ⛔ THE STORE THAT SENDS NO E-MAIL AT ALL, FOREVER — not just during the seed.
 *
 * Renan's own words, and they are literal: *"a loja totem não faz sentido mandar email; ela pode nascer com
 * as mensagens desligadas, só as de account ligada"*. The shopper at a kiosk typed a name, not an address —
 * the synthetic `balcao+…@forge.demo` the totem mints exists so the kernel has an e-mail field, and mailing
 * it would be mailing nobody. The number is called out loud at the counter, which is the whole point of it.
 *
 * ⚠️ AND THAT INCLUDES THE OPERATOR'S OWN "an order came in". An earlier draft of this file re-armed it here,
 * reasoning that whoever runs the counter would want to know — a defensible inference, and wrong: his word
 * was "as mensagens", not "as mensagens do comprador". One e-mail per coffee is noise nobody reads.
 * **Inverting it is one line** — take the handle out of this list — and it is the report's job to say so, so
 * that testing the bench and wanting the notice back costs a sentence rather than an investigation.
 */
export const SILENT_STORE_HANDLES = ['balcao'];

/**
 * ⛔⛔ THE ONE REFUSAL THAT IS WORTH MORE THAN EVERYTHING ELSE IN THIS FILE.
 *
 * `notification.channel.set_enabled` turns `auth.*` off exactly as happily as it turns `order.*` off, and a
 * box whose `auth.customer_code` is disabled is a box **nobody can log into** — including the operator, who
 * needs `auth.operator_code` to reach the admin at all. It fails silently: the seed exits green, and the
 * discovery happens later, at a login screen, with no error that names the cause.
 *
 * ⚠️ IT IS A PREFIX RULE AND NOT A LIST OF THE THREE KEYS THAT EXIST TODAY. A deny-list would be correct
 * until somebody adds `auth.operator_recovery`, and then it would be silently wrong. Refusing the whole
 * namespace is what survives the next person editing this file — which is the only kind of guard worth
 * writing, because that person will not have read this comment.
 */
export function assertSeedableChannel(typeKey) {
  if (String(typeKey).startsWith('auth.'))
    throw new Error(
      `the seed refuses to touch "${typeKey}": auth.* is how anyone gets INTO this box. ` +
        'Disabling it fabricates a bench nobody can log into, and the seed would still exit green. ' +
        'If you genuinely need to move an auth channel, do it by hand and know why.',
    );
  return typeKey;
}

/** Every store, since silence is about MAIL and not about commerce — the counter sells too. */
export function sellingStores(stores) {
  return stores.slice();
}

/**
 * The channel rows for one pass of the buyer's order mail.
 *
 * ⚠️ THE ASYMMETRY IS THE POINT, and it is the whole anti-mailbox mechanism: the OFF pass covers **every**
 * store, so nothing can send while the box is being filled; the ON pass **skips the silent ones**, so the
 * counter is never re-armed. Written as one function with a flag rather than two, because two functions
 * drift and the drift is invisible until somebody's inbox fills up.
 */
export function channelPlan(stores, { enabled, types = SEED_MANAGED_TYPES }) {
  const targets = enabled
    ? stores.filter((s) => !SILENT_STORE_HANDLES.includes(s.handle))
    : stores;
  return targets.flatMap((store) =>
    types.map((type_key) => ({
      store_id: store.id,
      handle: store.handle,
      type_key: assertSeedableChannel(type_key),
      channel_key: EMAIL_CHANNEL,
      enabled,
    })),
  );
}

/**
 * ⭐ THE TWO DOORS A REAL STORE HAS, and the split is what keeps the badge honest.
 *
 * A review carrying an `order_id` was EARNED: a real buyer, a real delivered order, written through the
 * buyer's own channel. Those are the verified ones, they are expensive to seed, and they are therefore the
 * MINORITY — which is exactly why the badge means something. Everything else came through the PDP's open
 * form: no order, no badge, and that is correct rather than a shortfall.
 *
 * ⚠️ AND THE SEAL IS NOT THIS SEED'S TO GRANT — IT IS DERIVED BY THE FACE. Measured in the reviews manifest:
 * `verified` is REFUSED from any body by name, and computed from two things at once — whether the kernel
 * could NAME the caller, and whether the row points at an order. The anonymous PDP door can only ever answer
 * the first half `false`, so an open review is born unverified BY CONSTRUCTION; the account form posts
 * through `/v1/ext-customer/…` with the shopper's own session and is born verified for the same reason. It
 * was not always so: a caller who skipped the buyer's endpoint and posted `{"verified": true}` got the badge,
 * and a store with moderation off published the forgery.
 *
 * So what this function decides is which DOOR each review goes through, never what badge it ends up with —
 * and that is exactly why a "verified without an order" cannot be produced here even by mistake. Splitting on
 * `order_id` is therefore not a policy this file enforces; it is this file agreeing with where the face will
 * put each row anyway.
 */
export function reviewSplit(rows) {
  const verified = rows.filter((r) => Boolean(r.order_id));
  const open = rows.filter((r) => !r.order_id).map(({ order_id, ...rest }) => rest);
  return { verified, open };
}

/**
 * ⛔⛔ THE TENANT A CREDENTIAL IS IN IS NOT THE TENANT YOU ASKED FOR, AND THE READ FACE WILL NOT TELL YOU.
 *
 * Measured on the pre-seed box, both directions, `read.internal/stores`:
 *
 *     token of forgeco   + `x-forge-tenant: forgeco`    → 200  ['forge', 'outlet']
 *     token of forgeco   + `x-forge-tenant: forgecafe`  → 200  ['forge', 'outlet']   ← the header is IGNORED
 *     token of forgecafe + `x-forge-tenant: forgecafe`  → 200  ['cafe', 'balcao']
 *
 * The INTERNAL READ resolves the tenant from the CREDENTIAL and ignores the header; only the WRITE honours
 * it. And this seed — like every seed in this repository — is "idempotent by construction": it asks the read
 * face first and skips what is already there. So a run with the wrong token asks "does this exist?", is
 * answered confidently about the OTHER tenant, and carries on. Green. Every skip decision it makes after that
 * is made against a shop it is not in.
 *
 * ⚠️ THE FIX IS NOT TO TRUST A 200. A 200 with real data in it is exactly what the wrong credential returns.
 * The fix is to make the ANSWER the proof: ask which stores this credential can see, and require the ones
 * this run is about to touch to be among them. A wrong token cannot fake that, because it can only ever show
 * its own tenant's shops.
 *
 * Call it ONCE, before the first read that decides anything.
 */
export function assertCredentialTenant(expectedHandles, visibleStores) {
  const visible = visibleStores.map((s) => s.handle);
  const missing = expectedHandles.filter((h) => !visible.includes(h));
  if (missing.length === 0) return;
  throw new Error(
    `the seed credential cannot see ${missing.map((h) => `"${h}"`).join(', ')} — it sees ` +
      `${visible.length ? visible.map((h) => `"${h}"`).join(', ') : 'no stores at all'}. ` +
      'The INTERNAL read face resolves the tenant from the CREDENTIAL and ignores `x-forge-tenant`, so a ' +
      'token from the other tenant answers 200 with the wrong shops and every "does this already exist?" ' +
      'check after it is answered about the wrong tenant. Use the token of the tenant you are seeding.',
  );
}

/**
 * ⭐ WHICH DOOR EACH STORE'S REVIEWS COME THROUGH — and they are not the same door, because the doors are not
 * equally honest in every shop.
 *
 * Review CONTENT belongs to this slice; INSTALLING the app belongs to the filler (one owner per act, the
 * same rule the logistics went by). What that split leaves open is which of the three real doors to use, and
 * the answer is per store rather than global:
 *
 *   · `app_seed_demo` — the reviews app's own `seed_demo` action. It pulls from the PLATFORM's dataset, whose
 *     handles are a SHOE catalogue. In the shoe stores that is not a shortcut, it is the cheapest honest
 *     door: the handles really are theirs, and the content lands on the right products.
 *   · `two_doors`     — the design approved in §6 of the spec: a MINORITY born of a real purchase (buyer,
 *     delivered order, review through the buyer's own channel — the verified ones, expensive, few, and the
 *     reason the badge means anything) plus a MAJORITY through the PDP's open form (no order, no badge, and
 *     that is correct). Used where `seed_demo` would seed NOTHING, because the platform dataset knows no
 *     coffee.
 *   · `none`          — the counter. A totem has no product page and nobody writes a review at a kiosk; the
 *     archetype does not list reviews for it either. Seeding them would be data that looks right and is
 *     absurd, which is the exact failure the archetype rule exists to prevent.
 *
 * ⚠️ THERE IS NO DEFAULT, ON PURPOSE. A store this table does not name is a store somebody added without
 * deciding — and the silent answer would be whichever branch happened to be first. `reviewDoorFor` throws
 * instead, which turns "we forgot" into a sentence rather than into a shop with the wrong reviews.
 */
export const REVIEW_DOORS = {
  // The shoe catalogue IS the platform dataset's — the app's own seeder lands on real handles here.
  forge: 'app_seed_demo',
  // Same catalogue, same door: the outlet sells a cut of the very same products.
  outlet: 'app_seed_demo',
  // The platform dataset has no coffee, so `seed_demo` would write nothing at all. The two honest doors.
  cafe: 'two_doors',
  // A counter has no product page. Nobody reviews a coffee at the kiosk they ordered it from.
  balcao: 'none',
};

export function reviewDoorFor(handle) {
  const door = REVIEW_DOORS[handle];
  if (!door)
    throw new Error(
      `no review door decided for the store "${handle}". Reviews are seeded through different doors in ` +
        'different shops (see REVIEW_DOORS), and there is deliberately no default: a store nobody decided ' +
        'about would get whichever branch came first. Add it to the table, with the reason.',
    );
  return door;
}

/** The stores whose reviews this slice actually writes — everything except the ones that take none. */
export function storesWithReviews(stores) {
  return stores.filter((s) => reviewDoorFor(s.handle) !== 'none');
}

// ── THE DRIVER ───────────────────────────────────────────────────────────────────────────────────────────
//
// Everything above is a pure decision; this is the part that talks. It receives the port `bin/seed.mjs`
// already built (same shape as `seed/totem.mjs` and `seed/coffee.mjs`) and knows nothing about transport.

/** The apps this slice needs INSTALLED to do its work. It installs none of them — that is the filler's act,
 * one owner per gesture — so this list exists to FAIL LOUDLY and early rather than three steps later, when a
 * missing app shows up as "no payment provider for method" on the first order. */
const REQUIRED_APPS = ['payment-reference', 'reviews'];

/** An app action on the tenant face. ⚠️ The tenant is the CREDENTIAL's — `tenant_id` in the body is ignored
 * by construction (action-adapter.ts), which is the write side of the same rule `assertCredentialTenant`
 * exists for on the read side. */
const appAction = (post) => (extension_id, action, input) =>
  post('/v1/internal/extension/action', { extension_id, action, ...(input ? { input } : {}) });

/**
 * THE COMMERCE PASS, in the one order that keeps a mailbox empty.
 *
 *   1. prove the credential is in the tenant we think it is       ← before any "does this exist?" read
 *   2. silence every buyer message in every store
 *   3. the reviews, by the door each shop deserves
 *   4. one live order per selling store — proof the box still sells TODAY
 *   5. re-arm the buyer messages, everywhere except the counter
 *
 * ⚠️ STEP 5 IS IN A `finally`. A seed that dies in the middle must not leave the box mute: a bench nobody can
 * get an e-mail from is a bench whose first bug report is "the store does not send anything". The same
 * reasoning puts the `open_reviews` restore in a `finally` inside `seedReviews`.
 */
export async function seedCommerce({ stores, command, read, log, fail, post }) {
  const visible = (await read('internal/stores')) ?? [];
  assertCredentialTenant(
    stores.map((s) => s.handle),
    visible,
  );
  log(`commerce — credential proven in the tenant holding ${visible.map((s) => s.handle).join(', ')}`);

  const installed = (await read('internal/extensions')) ?? [];
  const absent = REQUIRED_APPS.filter((id) => !installed.some((e) => e.extension_id === id));
  if (absent.length)
    fail(
      `commerce needs ${absent.join(', ')} installed and this slice does not install apps — the filler does. ` +
        'Run the catalogue seed first, or ask for the app to be added to its list.',
    );

  const toggle = async (rows) => {
    for (const row of rows)
      await command('notification.channel.set_enabled', {
        type_key: row.type_key,
        channel_key: row.channel_key,
        store_id: row.store_id,
        enabled: row.enabled,
      });
  };

  await toggle(channelPlan(stores, { enabled: false }));
  log(`commerce — ${SEED_MANAGED_TYPES.length} message types silenced in ${stores.length} store(s)`);

  try {
    await seedReviews({ stores, command, read, log, action: appAction(post) });
    await placeLiveOrders({ stores, command, read, log });
  } finally {
    const on = channelPlan(stores, { enabled: true });
    await toggle(on);
    const armed = [...new Set(on.map((r) => r.handle))];
    log(
      `commerce — buyer messages re-armed in ${armed.join(', ')}; ` +
        `${SILENT_STORE_HANDLES.join(', ')} stays silent on purpose (a totem calls the number out loud)`,
    );
  }
}

/**
 * THE REVIEWS, through whichever door the shop deserves (see `REVIEW_DOORS`).
 *
 * ⚠️ `open_reviews` AND `moderation` ARE CONFIG OF THE PAIR (extension, TENANT), NOT OF THE STORE
 * (`extensions/reviews/settings.ts`). Turning the open form on to seed turns it on for the WHOLE TENANT, and
 * "restore it afterwards" restores it for the whole tenant. That is the third symptom of the same missing
 * axis this box has — app installation, app config, logistics and pickup points all lack a per-store
 * dimension — and it is why the restore is in a `finally`: a seed that dies in the middle must not leave a
 * bench with the open form silently switched on.
 */
async function seedReviews({ stores, read, log, action }) {
  const byDoor = new Map();
  for (const store of storesWithReviews(stores)) {
    const door = reviewDoorFor(store.handle);
    byDoor.set(door, [...(byDoor.get(door) ?? []), store]);
  }

  // ── the cheap honest door: the app's own seeder, where the platform dataset's handles really are the
  //    store's. It dedupes on re-run, which is what keeps the whole seed idempotent.
  if (byDoor.has('app_seed_demo')) {
    const summary = await action('reviews', 'seed_demo');
    log(
      `reviews — the app's own seeder ran for ${byDoor
        .get('app_seed_demo')
        .map((s) => s.handle)
        .join(', ')}: ${JSON.stringify(summary?.summary ?? summary)}`,
    );
  }

  // ── the two honest doors, for the shops the platform dataset knows nothing about.
  if (byDoor.has('two_doors')) {
    const shops = byDoor.get('two_doors').map((s) => s.handle);
    throw new Error(
      `reviews — the two-door path for ${shops.join(', ')} is not wired yet, and it is blocked on a decision ` +
        'rather than on code. The VERIFIED minority has to be written under a shopper SESSION (the face ' +
        'derives the seal from "could the kernel name the caller" plus "does the row point at an order" — it ' +
        'is refused from any body by name). This seed cannot do an OTP login: with Resend live the code goes ' +
        'to a real mailbox it cannot read. The only public door that mints a session without one is ' +
        '`customer.mint_social_session`, which is PUBLIC and which the kernel honours without ever talking to ' +
        'the provider — so a seed using it is a seed asserting a social login that never happened. That is a ' +
        'call for the tech lead, not for this file.',
    );
  }
}

/**
 * ONE live order per selling store — and one only.
 *
 * ⭐ ITS JOB IS NOT "HAVE ORDERS". The demo's past comes from the history plan replayed inside the kernel,
 * which is the only caller that can date an order; this is the proof that the box still takes an order TODAY,
 * after everything above it ran. Two populations would be two sources for one fact and a dashboard that
 * disagrees with itself.
 */
async function placeLiveOrders({ stores, log }) {
  const shops = sellingStores(stores).map((s) => s.handle);
  throw new Error(
    `commerce — the live order for ${shops.join(', ')} is not wired yet. It needs the catalogue the filler ` +
      'slice seeds (a cart can only hold what its store publishes), and the box is still empty: ' +
      'read.products answered 0 items when this was written.',
  );
}

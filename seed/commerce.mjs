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
 * The other two the seed silences while it runs, and they are NOT buyer messages — which is why they are a
 * separate list and get a separate pass.
 *
 * `order.placed.operator` goes to the OPERATOR, and on this bench the operator is Renan: a hundred seeded
 * orders is a hundred real e-mails in the same inbox the buyer mail was being kept out of. `review_request`
 * is a customer message the reviews app sends when an order is delivered — seeding delivered orders would
 * fire it. Both are re-armed for EVERY store afterwards, the counter included: a totem does not e-mail its
 * BUYER, but whoever runs the counter still wants to know an order came in.
 */
export const SEED_NOISE_TYPES = ['order.placed.operator', 'ext.reviews.review_request'];

/**
 * ⛔ THE STORE THAT STAYS QUIET FOR THE BUYER, FOREVER — not just during the seed.
 *
 * Renan's own words: a totem does not send e-mail; the number is called at the counter. The shopper at a
 * kiosk typed a name, not an address — the synthetic `balcao+…@forge.demo` the totem mints exists so the
 * kernel has an e-mail field, and mailing it would be mailing nobody.
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
export function channelPlan(stores, { enabled }) {
  const targets = enabled
    ? stores.filter((s) => !SILENT_STORE_HANDLES.includes(s.handle))
    : stores;
  return targets.flatMap((store) =>
    BUYER_ORDER_TYPES.map((type_key) => ({
      store_id: store.id,
      handle: store.handle,
      type_key: assertSeedableChannel(type_key),
      channel_key: EMAIL_CHANNEL,
      enabled,
    })),
  );
}

/** The same, for the two non-buyer types — and these are re-armed everywhere. See `SEED_NOISE_TYPES`. */
export function noisePlan(stores, { enabled }) {
  return stores.flatMap((store) =>
    SEED_NOISE_TYPES.map((type_key) => ({
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
 * ⚠️ A VERIFIED REVIEW WITHOUT AN ORDER IS THE LIE AN EARLIER SLICE ALREADY HAD TO KILL. The app stores
 * `verified` AND `order_id` precisely so the first can be audited against the second, so this function
 * derives the split FROM the order rather than taking a flag from the data: a row cannot claim to be
 * verified, it can only have been bought.
 */
export function reviewSplit(rows) {
  const verified = rows.filter((r) => Boolean(r.order_id));
  const open = rows.filter((r) => !r.order_id).map(({ order_id, ...rest }) => rest);
  return { verified, open };
}

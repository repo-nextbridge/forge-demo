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
 * same rule the logistics went by). What that split leaves open is which door to use, and the answer is per
 * store:
 *
 *   · `app_seed_demo` — the reviews app's own `seed_demo` action. It pulls from the PLATFORM's dataset, whose
 *     handles are a SHOE catalogue. In the shoe stores that is not a shortcut, it is the cheapest honest
 *     door: the handles really are theirs, and the content lands on the right products.
 *   · `open_form`     — the PDP's anonymous form (`POST /v1/ext-public/reviews/review`), used where
 *     `seed_demo` would write NOTHING because the platform dataset knows no coffee. No order, no badge, and
 *     that is correct rather than a shortfall.
 *   · `none`          — the counter. A totem has no product page and nobody writes a review at a kiosk; the
 *     archetype does not list reviews for it either. Seeding them would be data that looks right and is
 *     absurd, which is the exact failure the archetype rule exists to prevent.
 *
 * ⛔ AND THERE IS NO "VERIFIED" DOOR AT ALL — NOT BECAUSE THIS SLICE RAN OUT OF TIME, BUT BECAUSE THE PRODUCT
 * HAS NONE. The seal is DERIVED by the face from two things at once (could the kernel NAME the caller, and
 * does the row point at an order) and is refused from any body by name; the app's OWN `seed_demo` refuses to
 * write `verified`/`order_id` deliberately, with a test holding it there ("not one seeded row claims a
 * verified purchase it cannot name an order for"). So the whole seeding surface is built so that no seeded
 * row carries a badge. The only way to a session without a mailbox is `customer.mint_social_session`, and in
 * THIS box the kernel warns at boot that its public key is absent — the door is only safe while social login
 * is off. A seed leaning on that becomes a reason never to turn verification on, and this house has already
 * paid once for a seed that depended on a hole.
 *
 * ⇒ The bench is born with OPEN reviews only. The badge is what a human exercises after a real purchase —
 * truer to demonstrate live than to seed, and, today, the only true version. (Decision of the tech lead,
 * pre-seed wave.) The product gap this reveals is written up in the slice report: there is no honest way to
 * seed a verified review, so no demo can SHOW the seal without somebody buying.
 *
 * ⚠️ AND THERE IS NO DEFAULT FOR A NEW STORE, ON PURPOSE. A store this table does not name is a store somebody
 * added without deciding — and the silent answer would be whichever branch happened to be first.
 * `reviewDoorFor` throws instead, which turns "we forgot" into a sentence rather than into a shop with the
 * wrong reviews.
 */
export const REVIEW_DOORS = {
  // The shoe catalogue IS the platform dataset's — the app's own seeder lands on real handles here.
  forge: 'app_seed_demo',
  // Same catalogue, same door: the outlet sells a cut of the very same products.
  outlet: 'app_seed_demo',
  // The platform dataset has no coffee, so `seed_demo` would write nothing at all — the open form instead.
  cafe: 'open_form',
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

/**
 * The apps this slice needs INSTALLED to do its work. It installs none of them — that is the filler's act,
 * one owner per gesture — so this list exists to fail early and by name rather than three steps later.
 *
 * ⚠️ IT NAMES NO PAYMENT APP, AND THE FIRST DRAFT DID (`payment-reference`). That was the same mistake this
 * slice already killed twice: naming a thing instead of asking for the CAPABILITY. Which payment app a
 * tenant runs is the tenant's business — the isolated bench has `payment-pos` and no `payment-reference`,
 * and a check by name would have refused a box that sells perfectly well. Payment is therefore asked per
 * store, where it is used, through `read.payment_methods`, which answers "can this shop be paid?" instead
 * of "is this particular app here?".
 */
const REQUIRED_APPS = ['reviews'];

/**
 * ⛔ "IS THIS APP INSTALLED?" — ONE HELPER, BECAUSE THE OBVIOUS READ IS THE WRONG ONE.
 *
 * `read.extensions` takes a STORE and lists the apps with a block PLACEMENT there. It is not the
 * installation list, and a store can have an app installed and working and still answer `[]` — measured in
 * the totem wave and written up as a finding. `read.installed_extensions` is the tenant's installations,
 * with no store parameter, and it is the question being asked here.
 *
 * ⚠️ THIS FILE FELL INTO THAT EXACT TRAP ANYWAY, hours after writing it down. A finding in a report protects
 * whoever reads the report; it does not protect the person who wrote it. So the question lives in one
 * function with the right read inside it, and `commerce.test.mjs` refuses a module that asks the other one.
 */
export async function appsNotInstalled(read, ids) {
  const installed = (await read('internal/installed_extensions')) ?? [];
  return ids.filter((id) => !installed.some((e) => e.extension_id === id && e.status === 'active'));
}

/** An app action on the tenant face. ⚠️ The tenant is the CREDENTIAL's — `tenant_id` in the body is ignored
 * by construction (action-adapter.ts), which is the write side of the same rule `assertCredentialTenant`
 * exists for on the read side. */
const appAction = (post) => (extension_id, action, input) =>
  post('/v1/internal/extension/action', { extension_id, action, ...(input ? { input } : {}) });

/**
 * ⛔ THE SILENCING — AND IT RUNS IN THE **CURATED** PHASE, NOT THE WINDOW.
 *
 * The seed is three moments, not one: `--phase curated` → the one-shots INSIDE the box → `--phase window`.
 * The one-shots are what create the demo's ORDERS — `seed-history` writes dozens of them, dated. So a
 * silencing that ran in the window would run AFTER those orders were emitted, and the decision to send is
 * taken at EMIT (measured: an order placed while silenced produced no notification even after the channel
 * was re-armed and the dispatcher had 70 further seconds). Silencing late is silencing nothing.
 *
 * ⚠️ AND THE CONSEQUENCE IS A TRADE-OFF TAKEN DELIBERATELY: the re-arm lives in the OTHER phase, so a
 * `finally` cannot span the two; they are two processes. If the window phase never runs, the box stays mute.
 * That is the better failure of the two — a mute box is one command away from being fixed and somebody
 * notices within a day, while dozens of e-mails to a real person cannot be un-sent.
 */
export async function silenceBuyerChannels({ expect, command, read, log, fail }) {
  const stores = await provenStores({ expect, read, log, fail });
  await toggleChannels(command, channelPlan(stores, { enabled: false }));
  log(
    `commerce — ${SEED_MANAGED_TYPES.length} message types silenced in ${stores.length} store(s), ` +
      'BEFORE the one-shots write any order',
  );
}

/**
 * THE COMMERCE PASS — the reviews, the live order, and the re-arm. Runs in the **window** phase, because
 * every one of those needs what the one-shots put there: the massive catalogue a cart can hold, the
 * logistics `place_order` demands, and the payment app that answers for a method.
 *
 * ⭐ THE LIVE ORDER NEEDS NO FENCE OF ITS OWN, because the sequence already is one: the channels were
 * silenced at the end of the CURATED phase and are re-armed at the end of this one, so everything between —
 * the one-shots' hundreds of dated orders and this single live one — is placed in silence. That is the whole
 * reason the silencing was moved to the earlier phase.
 *
 * ⚠️ AND THE ONE WAY TO BREAK IT is to run `--phase window` ALONE against a box whose curated phase was not
 * run in this cycle. Then the channels are armed, and the live order mails a real person. The sequence in
 * the README never does that; a human debugging one phase might. Said here because the failure is silent to
 * whoever causes it and loud to whoever receives it.
 */
export async function seedCommerce({ expect, command, read, log, fail, post }) {
  const stores = await provenStores({ expect, read, log, fail });

  const absent = await appsNotInstalled(read, REQUIRED_APPS);
  if (absent.length)
    fail(
      `commerce needs ${absent.join(', ')} installed and this slice does not install apps — the filler does. ` +
        'Run the catalogue one-shot first, or ask for the app to be added to its list.',
    );

  try {
    await seedReviews({ stores, command, read, log, post, action: appAction(post) });
    await placeLiveOrders({ stores, command, read, log });
    await awaitQueueDrained({ read, log });
  } finally {
    const on = channelPlan(stores, { enabled: true });
    await toggleChannels(command, on);
    const armed = [...new Set(on.map((r) => r.handle))];
    log(
      `commerce — buyer messages re-armed in ${armed.join(', ')}; ` +
        `${SILENT_STORE_HANDLES.join(', ')} stays silent on purpose (a totem calls the number out loud)`,
    );
  }
}

/**
 * The stores this run is FOR, proven against what the credential can see.
 *
 * ⛔ `expect` IS THE CALLER'S DECLARATION and must not come from this read. The first wiring fed both sides
 * from the same `read('internal/stores')` with the same token, so the check compared a list against itself
 * and could never fail — it passed every run and never asked the question once.
 */
async function provenStores({ expect, read, log, fail }) {
  if (!Array.isArray(expect) || expect.length === 0)
    fail(
      'the commerce pass needs `expect`: the store handles this run is FOR, stated by the caller. Deriving ' +
        'them from the same read the guard checks makes the guard compare a list against itself.',
    );
  const visible = (await read('internal/stores')) ?? [];
  assertCredentialTenant(expect, visible);
  const stores = visible.filter((s) => expect.includes(s.handle));
  log(`commerce — credential proven for ${stores.map((s) => s.handle).join(', ')}`);
  return stores;
}

/**
 * ⏳ WAIT FOR THE NOTIFICATION QUEUE BEFORE RE-ARMING — and the wait is part of the gesture, not a courtesy
 * paid when the batch happens to be small.
 *
 * ⚠️ MY OWN MEASUREMENT SAYS THIS SHOULD NOT BE NEEDED, and it is here anyway. The enabled check is taken at
 * EMIT, not at dispatch: an order placed while its channel was silenced produced no record even after the
 * channel was re-armed and the dispatcher had seventy further seconds. By that rule, orders placed inside the
 * fence can never mail, whenever the queue drains.
 *
 * But the cost of being wrong is asymmetric. If the rule is subtler than I measured — a second path, a retry,
 * a future change — the price is real e-mail to a real person, and it cannot be un-sent; the price of waiting
 * is a few seconds of a seed nobody is watching. And the assumption "the queue empties by now" is exactly
 * what bit this wave once already, with 1466 items in it. So: wait, and say what was seen.
 *
 * It waits for the record count to hold STILL, not for a status vocabulary this file has not verified — a
 * dispatched notification writes a row, so a count that stops growing is a dispatcher that stopped working.
 */
async function awaitQueueDrained({ read, log, polls = 6, waitMs = 2_000 }) {
  const count = async () => ((await read('internal/notifications', { limit: 1 }))?.total ?? 0);
  let last = await count();
  let still = 0;
  for (let i = 0; i < polls && still < 2; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const now = await count();
    still = now === last ? still + 1 : 0;
    last = now;
  }
  log(
    still >= 2
      ? `commerce — notification queue still at ${last} record(s); safe to re-arm`
      : `commerce — the queue was still moving after ${(polls * waitMs) / 1000}s (${last} records); ` +
          're-arming anyway and saying so, rather than waiting forever',
  );
}

/** One toggle per row. Every row passed through `assertSeedableChannel` when the plan was built. */
async function toggleChannels(command, rows) {
  for (const row of rows)
    await command('notification.channel.set_enabled', {
      type_key: row.type_key,
      channel_key: row.channel_key,
      store_id: row.store_id,
      enabled: row.enabled,
    });
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
async function seedReviews({ stores, command, read, log, post, action }) {
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

  // ── the open form, for the shops the platform dataset knows nothing about ─────────────────────────────
  //
  // ⚠️ `open_reviews` AND `moderation` ARE CONFIG OF THE PAIR (extension, TENANT), NOT OF THE STORE
  // (`extensions/reviews/settings.ts`). Turning the open form on to seed turns it on for the WHOLE TENANT,
  // and restoring it restores it for the whole tenant. That is another symptom of the missing per-store axis
  // this box has — app installation, app config, logistics and pickup points all lack one.
  //
  // ⭐ AND THE RESTORE IS IN A `finally`, WHICH IS THE WHOLE REASON THIS READS THE OLD VALUE FIRST. A seed
  // that dies halfway must not leave a bench with the open form silently switched on: the next person to
  // look would find a store accepting anonymous reviews and no note anywhere saying who turned it on.
  if (byDoor.has('open_form')) {
    const shops = byDoor.get('open_form');
    // ⚠️ THE READ RETURNS MORE THAN THE COMMAND ACCEPTS. `read.extension_config` answers the stored ROW —
    // `{id, created_at, …}` alongside the declared keys — and handing that whole object back to
    // `extension.config.set` answers HTTP 500 `internal`, not a validation error naming the offending field.
    // So the row metadata is stripped, by derivation rather than by a list of key names kept here.
    const stored = (await read('internal/extension_config', { extension: 'reviews' })) ?? {};
    const before = Object.fromEntries(
      Object.entries(stored).filter(([k]) => !ROW_METADATA_KEYS.includes(k)),
    );
    const wasOpen = before.open_reviews === true;
    try {
      if (!wasOpen)
        await command('extension.config.set', {
          extension_id: 'reviews',
          values: { ...before, open_reviews: true },
        });
      for (const store of shops) await openReviewsFor({ store, read, log, post });
      await moderateSeededReviews({ read, log, action });
    } finally {
      if (!wasOpen) {
        await command('extension.config.set', {
          extension_id: 'reviews',
          values: { ...before, open_reviews: wasOpen },
        });
        log('reviews — the open form is back OFF for the tenant, as it was found');
      }
    }
  }
}

/**
 * ONE live order per selling store — and one only.
 *
 * ⭐ ITS JOB IS NOT "HAVE ORDERS". The demo's past comes from the history plan replayed inside the kernel,
 * which is the only caller that can date an order; this is the proof that the box still takes an order TODAY,
 * after everything above it ran. Two populations would be two sources for one fact and a dashboard that
 * disagrees with itself.
 *
 * ⚠️ EXACTLY ONE `cart.set_buyer` PER STORE, and that is a budget rather than tidiness: `set_buyer` is an
 * ORACLE-class face capped at ten a minute per store+IP, and a seed is one address. Four stores is four
 * calls; a retry loop here would spend somebody's ceiling.
 */
/** The one buyer the live proof order is placed as, per store — STABLE, so a second run recognises it.
 *  `hi+<tag>@forgecommerce.pro` is the wave's address shape: a real mailbox, so nothing bounces. */
function liveProofBuyer(store) {
  return `hi+${store.handle}-liveproof@forgecommerce.pro`;
}

async function placeLiveOrders({ stores, command, read, log }) {
  const placed = [];
  for (const store of sellingStores(stores)) {
    const order = await placeOneLiveOrder({ store, command, read, log });
    if (order) placed.push(`${store.handle} #${order.number}`);
  }
  log(
    placed.length
      ? `commerce — the box still sells today: ${placed.join(' · ')}`
      : 'commerce — no store could take a live order (see the lines above for which piece was missing)',
  );
  return placed;
}

/** The whole journey for one store, through the same door a shopper uses. Returns the confirmation, or null
 *  with a reason logged — a store that cannot sell is a finding, not an exception to throw the seed away on. */
async function placeOneLiveOrder({ store, command, read, log }) {
  const skip = (why) => {
    log(`commerce — ${store.handle} took no live order: ${why}`);
    return null;
  };

  // ⭐ SECOND RUN CONVERGES, AND THE FIRST DRAFT DID NOT. Every run minted a new cart, so a re-run placed a
  // SECOND live order in every store — measured: cafe #1 then #2. A seed that grows the bench each time it
  // runs is a seed nobody can run twice, which is one of this wave's acceptance criteria. The proof order is
  // therefore keyed by a STABLE synthetic buyer per store, and a store that already has one is left alone.
  const already = ((await read('internal/orders_admin', { limit: 100 }))?.items ?? []).find(
    (o) => o.buyer?.email === liveProofBuyer(store) || o.buyer?.email_masked === liveProofBuyer(store),
  );
  if (already) {
    log(`commerce — ${store.handle} already carries its live proof order #${already.number}; leaving it`);
    return already;
  }

  const catalogue = (await read('products', { store: store.id, limit: 5 }))?.items ?? [];
  const sku = catalogue.flatMap((p) => p.skus.filter((k) => k.status === 'active'))[0];
  if (!sku) return skip('it publishes nothing sellable');

  const methods = await read('payment_methods', { store: store.id });
  const method = methods?.methods?.[0];
  const app = methods?.providers?.[0]?.app_id;
  if (!method || !app) return skip('no payment app is installed for this tenant');

  const { cart_id } = await command('cart.create', {}, { store: store.id });
  await command('cart.add_line', { cart_id, sku_id: sku.id, qty: 1 }, { store: store.id });

  // ⚠️ THE BUYER'S ADDRESS IS REQUIRED EVEN FOR PICKUP — measured in the totem wave: a cart with the pickup
  // method, a point and a buyer still answered `missing: [shipping_address]`. So the address is always sent,
  // and it is the PICKUP POINT'S OWN, read back from the kernel, never invented.
  await command(
    'cart.set_buyer',
    { cart_id, email: liveProofBuyer(store), name: 'PRE SEED', guest: true },
    { store: store.id },
  );

  // The quote needs a destination before it will say anything at all (`reason: 'no_destination'`), and for a
  // pickup-only store the value is a key rather than a claim — see the totem slice's measurement.
  const quote = await read('shipping_options', {
    store: store.id,
    cart_id,
    postal_code: QUOTE_SEED_POSTAL_CODE,
  });
  const options = quote?.options ?? [];
  if (options.length === 0) return skip(`the store quotes no shipping (${quote?.reason ?? 'no options'})`);

  // ⭐ CHOOSE BY INTENTION, NOT BY POSITION — and the first version of this chose `options[0]`.
  //
  // It passed every run on the isolated bench, where EVERY store had a pickup point and `[0]` happened to be
  // it. On the real box the delivery methods sort first, `[0]` is a delivery option with no point, and the
  // proof skipped in all four stores. Nothing about the code changed; the accident changed sides.
  //
  // ⚠️ AND IT IS THE SAME DEFECT THIS SLICE HAD JUST CRITICISED IN SOMEBODY ELSE'S FILE, on the same day:
  // `demo-scenario.ts` picks its method with `order by id limit 1` — position instead of intention — and a
  // ULID ordering handed it a pickup method it never wanted. I wrote the criticism and then wrote the defect.
  // A selection that names what it wants cannot be turned by the order of the rows.
  const pickupOption = options.find((o) => o.kind === 'pickup' && (o.pickup_locations ?? []).length > 0);
  const deliveryOption = options.find((o) => o.kind !== 'pickup');
  const option = pickupOption ?? deliveryOption;
  if (!option) return skip('no option is either a usable pickup or a delivery');
  const point = pickupOption ? pickupOption.pickup_locations[0] : undefined;

  // A collected order carries the counter's OWN address, read from the kernel; a delivered one carries the
  // declared address below, which is fiction and says so.
  const address = point ? addressOfPickupPoint(point) : PROOF_DELIVERY_ADDRESS;

  await command(
    'cart.set_delivery',
    { cart_id, shipping_method_id: option.method_id, shipping_address: address },
    { store: store.id },
  );
  if (point)
    await command(
      'cart.set_pickup_location',
      { cart_id, pickup_location_id: point.id },
      { store: store.id },
    );

  await command(
    'cart.set_payment_method',
    { cart_id, method, payment_app: app },
    { store: store.id },
  );
  const { order_id } = await command('checkout.place_order', { cart_id }, { store: store.id });
  await command('payment.initiate', { order_id, method }, { store: store.id, face: 'payment' });

  const confirmation = await read('order_confirmation', { store: store.id, order_id });
  log(
    `commerce — ${store.handle} #${confirmation?.number} ${confirmation?.status} ` +
      `(${method} via ${app}, ${point ? 'pickup' : 'delivery'})`,
  );
  return confirmation;
}

/**
 * A pickup point's address, in the shape `cart.set_delivery` takes.
 *
 * ⚠️ THE READ SAYS `uf`; THE WRITE SAYS `region`. Same fact, two names, and mapping one to the other is the
 * likeliest place for this to be "cleaned up" into a silent failure.
 */
function addressOfPickupPoint(point) {
  const m = /^(.*),\s*([^,]+)$/.exec(point.addr_line1.trim());
  return {
    line1: (m?.[1] ?? point.addr_line1).trim(),
    number: (m?.[2] ?? '').trim(),
    ...(point.addr_line2 ? { line2: point.addr_line2 } : {}),
    neighborhood: point.district ?? '',
    city: point.city,
    region: point.uf,
    postal_code: point.postal_code,
    country_code: 'BR',
  };
}

/** A destination only opens the quote; for a pickup-only store its value reaches nothing. Measured in the
 *  totem wave with three deliberately distant CEPs: one option, the same one, every time. */
const QUOTE_SEED_POSTAL_CODE = '01310-100';

/**
 * Where the proof order is DELIVERED when the store does not collect.
 *
 * ⚠️ IT IS FICTION AND IT IS DECLARED HERE ON PURPOSE. The alternative was to reach for an address by
 * position — the first row of somebody else's table, the first customer of the history — and that is the very
 * habit this file just had to unlearn twice in one day. An address written down is a thing a reader can
 * recognise as invented; an address fetched by position is one they will assume is real.
 *
 * It is a real street in São Paulo with a plausible postcode, and it belongs to nobody: the proof order is
 * never shipped, and this bench sends its mail to `hi+…@forgecommerce.pro`, a box that exists.
 */
const PROOF_DELIVERY_ADDRESS = {
  line1: 'Avenida Paulista',
  number: '1000',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  region: 'SP',
  postal_code: '01310-100',
  country_code: 'BR',
};

/**
 * The anonymous PDP form, for one store's products.
 *
 * ⭐ IT WRITES NO `verified` AND NO `order_id`, AND NOT AS A COURTESY — the face refuses `verified` from any
 * body by name and derives it, so an anonymous create can only ever produce an unbadged row. That is the
 * whole reason this door is honest: it cannot lie even if this file wanted it to.
 *
 * `status` is derived too, from the app's `moderation` config: with moderation ON every row is born
 * `pending`, which is what puts the moderation queue on screen with something in it — and exercising the
 * queue was one of the wave's asks. The seed does not force it either way; it renders whatever the tenant is
 * configured for, and says which it saw.
 */
async function openReviewsFor({ store, read, log, post }) {
  const catalogue = (await read('products', { store: store.id, limit: 12 }))?.items ?? [];
  if (catalogue.length === 0) {
    log(`reviews — ${store.handle} publishes nothing yet; the open form has no product to write about`);
    return;
  }

  // ⭐ SECOND RUN WRITES NOTHING, AND THE FIRST DRAFT WROTE SIX MORE EVERY TIME. The app's own uniqueness
  // (`publicCreate.uniqueBy: ['order_id','product_id']`) cannot bite here: an open review has NO order, so
  // every run looked new. Measured: two runs, twelve rows.
  //
  // ⚠️ AND THE CHECK CANNOT USE THE PUBLIC LIST. With `moderation` on — the tenant's default — a seeded row
  // is born `pending`, and the anonymous face only serves APPROVED rows: the public read answered 0 for a
  // product that already carried six. So the question is asked of the app's own records, on the operator
  // side, which is where a pending row actually is.
  // ⚠️ AND THE DEDUPE KEY IS THE PAIR, NOT THE PRODUCT. With one review per product "has this product got
  // one?" was enough; with eight it would skip a product that carries a single row and never finish its
  // wall. `(product, author)` is the pair this seed can recognise as its own — the app's own uniqueness
  // (`uniqueBy: ['order_id','product_id']`) cannot bite on rows that carry no order.
  const existing = (await allSeededReviews(read)).filter((r) => SEEDED_AUTHORS.has(r.author));
  const done = new Set(existing.map((r) => `${r.product_id}::${r.author}`));

  const voices = voicesFor(store.handle);
  let written = 0;
  for (const product of catalogue) {
    for (const voice of reviewPlanFor(product.handle ?? product.product_id, voices)) {
      if (done.has(`${product.product_id}::${voice.author}`)) continue;
      const created = await post(
        '/v1/ext-public/reviews/review',
        {
          product_id: product.product_id,
          rating: voice.rating,
          body: voice.body,
          author: voice.author,
          // ⚠️ NO `verified`, NO `order_id`, NO `status`. All three are the face's to decide; sending them is
          // either refused by name or overwritten, and pretending otherwise is how a seed grows a belief.
        },
        { store: store.id },
      );
      if (created) written += 1;
    }
  }
  // ★★ A GUARD ON THE RESULT, not on the intention. "It wrote nothing" and "there was nothing to write" are
  // opposite facts and the log line above could not tell them apart — the same shape of silence that let the
  // subscription mark ship unwritten. So the wall is COUNTED, per product, against what was planned.
  //
  // ⚠️ AND IT GIVES THE READ A CHANCE TO CATCH UP BEFORE IT ACCUSES. Every read in this kernel sits behind
  // something, and a guard that fires on the first short answer is a guard that kills correct runs — which
  // is a worse failure than the one it is here to catch, because the next person's fix is to delete it.
  // It re-asks while the number is still MOVING and stops the moment it is enough; a count that stays short
  // through the whole window is a real shortfall and is named.
  let after = [];
  let thin = [];
  const wanted = new Map(
    catalogue.map((p) => [p.product_id, reviewPlanFor(p.handle ?? p.product_id, voices).length]),
  );
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    after = (await allSeededReviews(read)).filter((r) => SEEDED_AUTHORS.has(r.author));
    const perProduct = new Map();
    for (const r of after) perProduct.set(r.product_id, (perProduct.get(r.product_id) ?? 0) + 1);
    thin = catalogue
      .map((p) => ({ handle: p.handle, have: perProduct.get(p.product_id) ?? 0, want: wanted.get(p.product_id) }))
      .filter((row) => row.have < row.want);
    if (thin.length === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (thin.length > 0) {
    throw new Error(
      `reviews — ${thin.length} product(s) of ${store.handle} carry fewer reviews than this seed planned:\n` +
        `    ${thin.map((r) => `${r.handle} ${r.have}/${r.want}`).join(', ')}\n` +
        `  ${written} row(s) were POSTed in this pass, and the count was re-read five times over five\n` +
        '  seconds before this was said. A count that stays short is the face refusing (`open_reviews` off\n' +
        '  for the tenant) or the product not being published in this store — not a lag.',
    );
  }
  log(
    written === 0
      ? `reviews — ${store.handle} already carries its ${after.length} seeded review(s); nothing written`
      : `reviews — ${written} open review(s) written for ${store.handle} (${after.length} in total, ` +
          `${(after.length / Math.max(1, catalogue.length)).toFixed(1)} per product), unbadged by construction`,
  );
}

/**
 * EVERY seeded review row, paged.
 *
 * ⚠️ THE SINGLE `limit: 100` THIS REPLACES WAS CORRECT BY COINCIDENCE OF SIZE — six rows in the tenant. With
 * six coffees carrying eight reviews each it is seventy-two, and the coincidence expires the day somebody
 * adds a seventh coffee. `seed/paginate.mjs` states the rule; this is the same rule, spelled for the one
 * read in this file that needs it.
 */
async function allSeededReviews(read, { pageSize = 100 } = {}) {
  const all = [];
  for (let page = 1; page <= 200; page += 1) {
    const payload = await read('internal/extension_records', {
      extension: 'reviews',
      model: 'review',
      limit: pageSize,
      page,
    });
    const batch = payload?.items ?? [];
    all.push(...batch);
    if (batch.length < pageSize) return all;
    const total = Number(payload?.total);
    if (Number.isFinite(total) && all.length >= total) return all;
  }
  throw new Error('reviews — read.internal.extension_records never ran out of pages; refusing to guess.');
}

/**
 * ⭐ THE MODERATION QUEUE, EXERCISED — and this is not decoration either.
 *
 * With `moderation` on (the tenant's default) every seeded row is born `pending`, which means the PDP shows
 * NONE of them: the anonymous face serves approved rows only. A bench whose reviews are all pending looks
 * like a bench with no reviews. So the seed moderates what it wrote — and, because the wave asked for the
 * queue to be exercised rather than emptied, it leaves the three states a real queue holds: approved rows,
 * one rejected, and one rejected-then-restored.
 *
 * ⚠️ IT ONLY EVER TOUCHES ROWS IT WROTE ITSELF (`SEEDED_AUTHORS`). A seed that approved whatever it found
 * would publish a human's pending review on their behalf.
 */
async function moderateSeededReviews({ read, log, action }) {
  const rows = (await allSeededReviews(read)).filter((r) => SEEDED_AUTHORS.has(r.author));
  // ⚠️ THE HELD ROWS ARE NOT CANDIDATES. One voice per product is written to STAY in the queue, so the
  // moderation screen has something on it whenever anybody opens it. Deciding them here would empty that
  // screen on the first run and there would be nothing to demonstrate — and it would also be the one thing
  // that stops this converging, because the seed would have to write a new pending row every time.
  const pending = rows.filter((r) => r.status === 'pending' && !HELD_AUTHORS.has(r.author));
  if (pending.length === 0) {
    const held = rows.filter((r) => HELD_AUTHORS.has(r.author)).length;
    log(
      `reviews — the queue holds no seeded row to moderate (${rows.length - held} already decided, ` +
        `${held} held on purpose)`,
    );
    return;
  }

  // The majority is published; one stays refused; and one is refused, put back, and then decided.
  //
  // ⚠️ THE LAST STEP IS WHY THIS CONVERGES, AND THE FIRST DRAFT DID NOT. `review_restore` returns a row to
  // `pending` — which is exactly right, it is "put it back in the queue" — so a run that ended there left a
  // pending row behind, and the NEXT run found it and rejected it. Measured: each run flipped one more row,
  // 1 rejected then 2. Deciding it closes the loop: after one pass no seeded row is pending, and the run
  // after that has nothing to do. The three actions are still all exercised, and `moderated_at` keeps the
  // trace.
  const [toReject, toRestore, ...toApprove] = pending;
  for (const row of toApprove) await action('reviews', 'review_approve', { id: row.id });
  if (toReject) await action('reviews', 'review_reject', { id: toReject.id });
  if (toRestore) {
    await action('reviews', 'review_reject', { id: toRestore.id });
    await action('reviews', 'review_restore', { id: toRestore.id });
    await action('reviews', 'review_approve', { id: toRestore.id });
  }
  log(
    `reviews — moderation exercised: ${toApprove.length} approved · ${toReject ? 1 : 0} rejected · ` +
      `${toRestore ? 1 : 0} rejected-then-restored · ` +
      `${rows.filter((r) => HELD_AUTHORS.has(r.author)).length} HELD in the queue on purpose`,
  );
}

/** Columns every stored config row carries and no app declares. Stripped before a write-back. */
const ROW_METADATA_KEYS = ['id', 'created_at', 'updated_at'];

/**
 * ⭐ THE WALL, AND WHY IT IS TWELVE VOICES AND NOT SIX (A47).
 *
 * The first version wrote ONE review per product — `voices[i % voices.length]`, one pass over the store's
 * catalogue — so the coffee shop was born with six reviews in the whole tenant, one per coffee. Measured,
 * and it is what the Renan saw: *"os reviews também estão bem pobrinhos, tem um por café e às vezes nenhum,
 * ideal pelo menos uns 6 por produto"*.
 *
 * ★ AND THE RATINGS VARY ON PURPOSE. A wall where every row is five stars reads as a wall somebody wrote,
 * which is the exact tell a seed exists to avoid. Twelve voices spanning 2★ to 5★ average 4.2 — a shop
 * people like, not a shop nobody criticises.
 *
 * ⚠️ ONE VOICE IS `hold: true` AND IS NEVER MODERATED. The moderation queue has to have something in it for
 * a human to look at, and a queue that empties itself on the first run is a screen that is empty every time
 * anybody opens it. `moderateSeededReviews` skips these rows deliberately, which is also what makes this
 * CONVERGE: a held row is pending after run one and pending after run five, and no run decides it.
 */
export const REVIEW_VOICES = [
  { author: 'Marina R.', rating: 5, body: 'Chegou rápido, moagem certinha e o cheiro ao abrir o pacote é outro nível. Já assinei.' },
  { author: 'Joana P.', rating: 4, body: 'Muito bom no dia a dia. Tirei uma estrela só pelo prazo de entrega.' },
  { author: 'Rafael M.', rating: 5, body: 'Faço na prensa e na V60 e nos dois fica ótimo. Doçura sem precisar de açúcar.' },
  { author: 'Camila S.', rating: 4, body: 'Torra fresca, data recente na embalagem. Rende bem mais do que o que eu comprava no mercado.' },
  { author: 'Diego A.', rating: 3, body: 'Cumpre o que promete, mas para o meu gosto podia ser um pouco mais encorpado.' },
  { author: 'Beatriz L.', rating: 5, body: 'Comprei para presente e acabei ficando com um pacote. A embalagem com válvula faz diferença.' },
  { author: 'Henrique T.', rating: 4, body: 'Boa acidez, nada agressiva. No espresso pede um clique a mais de moagem fina.' },
  { author: 'Larissa F.', rating: 5, body: 'Terceiro pedido. Nunca veio errado e sempre chega dentro do prazo.' },
  { author: 'Otávio B.', rating: 2, body: 'O café é bom, mas o meu veio moído no ponto errado e não deu para trocar a tempo.' },
  { author: 'Priscila N.', rating: 5, body: 'Tomo puro, sem leite, e é o único que eu consigo beber assim sem enjoar.' },
  { author: 'Gustavo A.', rating: 4, body: 'Custo-benefício honesto. Pedi 1kg e durou o mês inteiro em casa com duas pessoas.' },
  // ⚠️ THE HELD ONE. Never approved, never rejected — it is what keeps the moderation queue inhabited.
  { author: 'Tiago N.', rating: 3, body: 'Gostei do café, mas achei a embalagem difícil de fechar de novo depois de aberta.', hold: true },
];

/** The names the seed writes under. They are how it recognises its OWN rows on a second run and in the
 *  moderation queue — a seed must never decide a review a person wrote.
 *
 *  ⚠️ DERIVED, NOT TYPED. It used to be a hand-written list beside the voices, which is two places to add a
 *  name and one of them to forget — and forgetting it makes the seed stop recognising its own rows, write
 *  them again on the next run, and moderate none of them. */
export const SEEDED_AUTHORS = new Set(REVIEW_VOICES.map((v) => v.author));

/** The rows this seed writes and then deliberately leaves in the queue. */
export const HELD_AUTHORS = new Set(REVIEW_VOICES.filter((v) => v.hold).map((v) => v.author));

/**
 * ⛔ WHOSE VOICES THESE ARE — and there is no default, exactly like `REVIEW_DOORS` above.
 *
 * The `open_form` door is decided per store, and today only the coffee shop takes it; the sentences above
 * are a coffee shop's. A second store put on this door with no voices of its own would silently get a wall
 * praising the moagem of a pair of shoes, so this throws instead.
 */
const VOICES_BY_STORE = { cafe: REVIEW_VOICES };

export function voicesFor(handle) {
  const voices = VOICES_BY_STORE[handle];
  if (!voices)
    throw new Error(
      `the store "${handle}" is on the open-review door but has no voices of its own. The sentences are ` +
        'written for one kind of shop and there is deliberately no default: a coffee wall on a shoe shop ' +
        'is data that looks right and is absurd. Add the store to VOICES_BY_STORE, with its own words.',
    );
  return voices;
}

/**
 * ★★ HOW MANY REVIEWS ONE PRODUCT GETS, AND WHICH — pure, deterministic, and derived from the HANDLE.
 *
 * ⚠️ NOT FROM THE PRODUCT'S POSITION IN THE READ, which is what the first version used (`voices[i % n]`).
 * The catalogue read's order is the projection's, and a seed whose data depends on it writes a different
 * shop every time a product is added. From the handle, the six coffees get the same wall on every box.
 *
 * The count is 6..10 — the Renan asked for *"pelo menos uns 6 por produto"* — and the ROTATION is offset by
 * the same hash, so two coffees do not open with the same sentence. The held voice is always included: one
 * pending row per product is what puts something on the moderation screen without emptying the wall.
 */
export function reviewPlanFor(handle, voices = REVIEW_VOICES) {
  let hash = 0;
  for (let i = 0; i < handle.length; i += 1) hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  const open = voices.filter((v) => !v.hold);
  const held = voices.filter((v) => v.hold);
  const count = Math.min(open.length, 5 + (hash % 5)); // 5..9 open, plus the held one → 6..10
  const offset = hash % open.length;
  const picked = Array.from({ length: count }, (_, i) => open[(offset + i) % open.length]);
  return [...picked, ...held];
}


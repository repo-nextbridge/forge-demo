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
// pre-seed wave.)
//
// **It creates no logistics.** Zone, method, rate and the pickup point belong to the filler slice, which
// already creates them from the dataset. This file CONSUMES them: it reads the quote and picks what is there.
//
// ★★ pk25/d3 — AND THERE ARE THREE MORE ORDERS NOW, IN THE CAFÉ, AND THEY ARE NOT A SECOND POPULATION. The
// rule above is about ONE FACT having ONE SOURCE, and "the box still sells today" still has exactly one: the
// live proof order. The café's three answer a DIFFERENT question — does this shop have subscribers — and
// there is no other way to answer it: a subscription contract is not a command, it is DERIVED by the app
// from an `order.created` the kernel itself froze (`seed/subscriptions.mjs` carries the measurement, and the
// reason that derivation is a security property rather than an inconvenience). Signing one means placing an
// order, and inventing rows in the app's schema instead would be the second write path this whole
// architecture refuses.

import { signSubscriptions } from './subscriptions.mjs';

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
 * the literal instruction (below), they are treated the same. */
export const SEED_MANAGED_TYPES = [...BUYER_ORDER_TYPES, ...SEED_NOISE_TYPES];

/**
 * ⛔ THE STORE THAT SENDS NO E-MAIL AT ALL, FOREVER — not just during the seed.
 *
 * THE INSTRUCTION, and it is literal: the totem store has no business sending e-mail; it may be born with
 * the messages OFF and only the account ones on. The shopper at a kiosk typed a name, not an address —
 * the synthetic `balcao+…@forge.demo` the totem mints exists so the kernel has an e-mail field, and mailing
 * it would be mailing nobody. The number is called out loud at the counter, which is the whole point of it.
 *
 * ⚠️ AND THAT INCLUDES THE OPERATOR'S OWN "an order came in". An earlier draft of this file re-armed it here,
 * reasoning that whoever runs the counter would want to know — a defensible inference, and wrong: the
 * instruction said "the messages", not "the buyer's messages". One e-mail per coffee is noise nobody reads.
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

/**
 * ⭐ THE COUPON THE SHOP ADVERTISES — one per store, declared, and the shop window is what asks for it.
 *
 * ⛔ s3-1, SEVERITY HIGH, MEASURED ON THE BENCH: the coffee shop's announcement bar, on EVERY page, says
 * *"10% OFF NA PRIMEIRA COMPRA COM O CUPOM PRIMEIRAXICARA"*, and the tenant's eight promotions are Combo da
 * manhã, PRIMEIROCAFE, Assinante 10% OFF and five DEMO-HIST-*. **The advertised coupon does not exist.** A
 * shopper who types it is told "Cupom não encontrado" by the shop that just told them to type it.
 *
 * ★ AND THE ONE THAT DOES EXIST CANNOT STAND IN FOR IT (s7-5, read off the admin's own screen): PRIMEIROCAFE
 * is scoped to the COUNTER — *"Forge Café · Balcão — Só nessa loja"* — deliberately, by the totem slice,
 * which uses it to PROVE that a promotion can be scoped to one store. Re-pointing it at the e-commerce would
 * delete that proof to fix a sentence, and it would take the counter's own coupon away.
 *
 * ⇒ SO THE DATA IS MADE TRUE RATHER THAN THE SENTENCE MADE SMALLER, and the reason is ownership, not taste:
 * the sentence lives in `storefront-coffee/src/components/coffee/CoffeeChrome.tsx` as a constant of the
 * FORK — the shop's own chrome, which this repository's coffee slice owns and this one does not. What a seed
 * can honestly do about a promise a shop makes is make the shop able to keep it.
 *
 * ⚠️ `stackable: true`, like the counter's coupon and like the subscriber discount beside it. Exclusive, it
 * would tie with "Assinante 10% OFF" (both 10%) and one of the two would silently win — a subscriber typing
 * the code would see the total not move, which is EXACTLY the symptom s3-2 reports for the other coupon.
 * Stacking is also what the sentence promises: the first purchase is a discount ON TOP of what you already
 * get, not instead of it.
 *
 * ⚠️ AND THE `first_purchase` CONDITION IS THE SENTENCE'S OWN WORDS. A coupon that says "na primeira compra"
 * and fires on the fifth is the same class of lie in the other direction, and the kernel spells it exactly
 * (`conditionSchema`, `kind: 'first_purchase'`) so nothing here has to approximate it.
 */
export const STORE_COUPONS = {
  cafe: {
    name: 'Primeira xícara 10%',
    label: 'PRIMEIRAXICARA · 10% OFF na primeira compra',
    code: 'PRIMEIRAXICARA',
    percent_bp: 1_000,
  },
};

/**
 * ⛔⛔ THE RULE THIS BLOCK EXISTS FOR, AND IT IS WORTH MORE THAN THE ROW IT REMOVES.
 *
 * **A STORE WHERE NOBODY CAN BE RECOGNISED MUST NOT CARRY A PROMOTION THAT ASKS WHO IS BUYING.**
 *
 * The counter is a counter. A person at a kiosk types a name and has no e-mail to give, so the totem
 * SYNTHESIZES one per cart — `balcao+<six chars of the cart id>@forge.demo`, frozen in
 * `totem/src/lib/buyer.ts` — purely so `cart.set_buyer` has a field to fill. That address is unique to ONE
 * ORDER, which is what makes every identity condition at that till a question about a person the shop has
 * never seen and will never see again.
 *
 * ⚠️ AND THE FAILURE IS NOT "IT NEVER FIRES" — MEASURED ON THE BENCH 2026-09-15, ON A REAL COUNTER ORDER.
 * `first_purchase` reads `paid_order_count = 0` for a buyer matched BY E-MAIL (packages/core/src/promo/
 * context.ts, `loadCustomerFacts`), and a fresh address always counts zero. Counter order #192 came out
 * `subtotal 11890` → `discount:… "10% na primeira compra" −1189` → `total 10701`: ten per cent off, at the
 * till, for everybody, forever. It is not a first-purchase discount; it is a permanent unannounced markdown
 * wearing a first-purchase label. The other three identity conditions fail the other way and are just as
 * wrong — they fail CLOSED with nobody loaded, so they would be a promise the screen can never keep.
 *
 * ⛔ THIS IS ABOUT THE COUNTER AND NOTHING ELSE. `cafe`, `forge` and `outlet` take a buyer who really signs
 * in or really types their own address, so an identity condition there means exactly what it says. The
 * café's own `Primeira xícara 10%` above carries `first_purchase` deliberately and must keep it.
 */
export const ANONYMOUS_BUYER_STORE_HANDLES = ['balcao'];

/**
 * The conditions the kernel answers by looking at the BUYER rather than at the cart — copied by MEASUREMENT
 * from `packages/core/src/promo/eligibility.ts`, which is the only place that decides it:
 *   · `first_purchase`      — `ctx.customer?.paid_order_count === 0`
 *   · `customer_attribute`  — a native field of the account; no customer, no match
 *   · `customer_in_cluster` — materialized membership; no customer, no match
 *   · `customer_field`      — a fact of the person too; the engine refuses it outright today
 *     (`condition_unsupported`), and a condition that cannot fire anywhere has no business being seeded
 *     where it would be least legible.
 * The four the cart answers on its own (`min_subtotal`, `min_quantity`, `payment_method`, `cart_contains`)
 * are deliberately absent: the counter's own `Combo da manhã` is one of them and is exactly right there.
 *
 * ⚠️ DERIVED FROM THE CONDITION, NEVER FROM A NAME. The row this rule was written for is called
 * "10% na primeira compra" on this box and `DEMO-HIST-02-BALCAO` on the box before the rename pass ran; a
 * list of names would have been right for one birth and silently wrong for the next.
 */
export const IDENTITY_CONDITION_KINDS = [
  'first_purchase',
  'customer_attribute',
  'customer_field',
  'customer_in_cluster',
];

/** Which identity conditions a promotion carries — `[]` for one the cart can answer by itself. */
export function identityConditionsOf(promotion) {
  const conditions = Array.isArray(promotion?.conditions) ? promotion.conditions : [];
  return [
    ...new Set(
      conditions
        .map((c) => String(c?.kind ?? ''))
        .filter((kind) => IDENTITY_CONDITION_KINDS.includes(kind)),
    ),
  ];
}

/**
 * WHICH PROMOTIONS THIS BOX RETIRES, and the shape is the same as `planPromotionRenames`: a pure decision,
 * so the rule can be exercised without a box.
 *
 * A promotion enters `retire` only when BOTH halves are true — it carries an identity condition AND it is
 * confined to a store where nobody can be identified. A TENANT-WIDE promotion (`store_id: null`) is left
 * alone on purpose: it reaches three stores where it is legitimate and one where it is not, and silently
 * deleting it for all four would be this file deciding something it was not asked to decide. It is NAMED
 * instead, which is the same answer `planPromotionRenames` gives a collision.
 */
export function planIdentityRetirements(promotions, anonymousStoreIds) {
  const anonymous = anonymousStoreIds instanceof Map ? anonymousStoreIds : new Map();
  const retire = [];
  const flagged = [];
  for (const promotion of Array.isArray(promotions) ? promotions : []) {
    const kinds = identityConditionsOf(promotion);
    if (kinds.length === 0) continue;
    const storeId = promotion?.store_id ?? null;
    if (storeId === null) {
      flagged.push({
        name: promotion?.name,
        why: 'it is tenant-wide, so retiring it would take it from the three stores where it is legitimate',
      });
      continue;
    }
    const handle = anonymous.get(storeId);
    if (!handle) continue;
    retire.push({ id: promotion.id, name: promotion.name, handle, kinds });
  }
  return { retire, flagged };
}

/**
 * ⛔ THE SAME RULE, ONE STEP EARLIER — the coupons THIS FILE declares.
 *
 * `seedAdvertisedCoupons` gives every advertised coupon `conditions: [{ kind: 'first_purchase' }]`, because
 * the sentence a shop window carries is "na primeira compra". So adding a counter to `STORE_COUPONS` would
 * re-create exactly the row this rule exists to keep out — one line, in a file whose author is looking at a
 * coupon and not at a till. The refusal is a function rather than a comment for that reason, and it is
 * called where the coupons are written.
 */
export function assertNoAdvertisedCouponAtAnonymousStore(coupons = STORE_COUPONS) {
  const offenders = Object.keys(coupons).filter((handle) =>
    ANONYMOUS_BUYER_STORE_HANDLES.includes(handle),
  );
  if (offenders.length > 0)
    throw new Error(
      `the seed refuses to advertise a coupon in ${offenders.join(', ')}: every coupon here is born with ` +
        'the `first_purchase` condition, and a till that mints a new synthetic buyer for every order makes ' +
        'that condition true on every sale — a permanent discount nobody declared. The counter can carry a ' +
        'coupon (see seed/totem.json), just not one that asks who is buying.',
    );
  return coupons;
}

/** The coupon a store advertises, or null. Absent is an ordinary answer here — most shops advertise none —
 *  which is why this does NOT throw the way `reviewDoorFor` does. */
export function couponFor(handle) {
  return STORE_COUPONS[handle] ?? null;
}

/**
 * ⭐ THE PROMOTIONS THE PLATFORM'S OWN DEMO DATA NAMES AFTER ITSELF (s7-11).
 *
 * The dated past of this box is written by the `demo-data` app INSIDE the kernel, and it names its
 * promotions `DEMO-HIST-01-FORGE`, `DEMO-HIST-D2`… — build vocabulary, correct where it lives (that name is
 * the executor's own idempotence key: `select id from promotion where name = $1`). The admin's list shows
 * the NAME as the title of the row, so a demo's promotion screen reads like a database dump.
 *
 * ★ AND THE PLAUSIBLE NAME IS NOT INVENTED HERE — IT IS ALREADY IN THE ROW. The same curation writes a
 * `label`: *"Frete grátis acima de R$ 299"*, *"10% na primeira compra"*, *"Cupom de aniversário (rascunho)"*
 * — the shopper's own words for what the promotion does, kept beside the internal name precisely because
 * they are different jobs. So this DERIVES, and types nothing: a promotion renamed here says what its
 * curation already said it does, and it stays right the day the curation changes.
 *
 * ⚠️ THIS IS DEMO CONTENT AND NOT A PRODUCT FIX. The kernel is pinned by image and its demo-data app is the
 * PRODUCT's; what this instance does is rename ITS OWN rows, through the port, exactly as an operator would.
 * Nothing here reaches upstream, which is the whole point — the box is a fictional shop, and what its
 * promotion list is called is the shop's business.
 *
 * ⚠️ AND IT CONVERGES, WHICH IS NOT OBVIOUS: renaming breaks the executor's `where name = $1` skip, so a
 * second one-shot would recreate `DEMO-HIST-01-FORGE` beside the renamed row. It does not, because that
 * executor gives up long before it gets there — `seed-history` counts orders older than half its window and
 * SKIPS the entire run when it finds any (apps/api/src/seed-history.ts), so on a box that already has a past
 * no promotion is ever created a second time. On a wiped box everything is rebuilt and renamed again.
 *
 * ⛔ A COLLISION IS REFUSED, NEVER RESOLVED. Three other seeds in this repository use the promotion NAME as
 * their idempotence key (`seed/vitrine.mjs`, `seed/totem.mjs`, `seed/coffee.mjs`), so renaming a row onto a
 * name that already exists would make one of them skip a promotion it never created. The rename is dropped
 * and named instead.
 */
export const INTERNAL_PROMOTION_NAME = /^DEMO-HIST[-_]/;

export function planPromotionRenames(items) {
  const rows = Array.isArray(items) ? items : [];
  const internal = rows.filter((p) => INTERNAL_PROMOTION_NAME.test(String(p?.name ?? '')));
  const takenByOthers = new Set(
    rows.filter((p) => !internal.includes(p)).map((p) => String(p?.name ?? '')),
  );
  const rename = [];
  const blocked = [];
  for (const promotion of internal) {
    const to = String(promotion.label ?? '').trim();
    // No label, or a label that IS the internal name: there is nothing to derive from, and inventing one
    // here is the typing this whole function exists to avoid.
    if (!to || to === promotion.name) {
      blocked.push({ name: promotion.name, why: 'it carries no shopper-facing label to derive a name from' });
      continue;
    }
    if (takenByOthers.has(to) || rename.some((r) => r.to === to)) {
      blocked.push({ name: promotion.name, why: `"${to}" is already the name of another promotion` });
      continue;
    }
    rename.push({ id: promotion.id, from: promotion.name, to });
  }
  return { rename, blocked };
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
export const appAction = (post) => async (extension_id, action, input) => {
  const first = await post('/v1/internal/extension/action', {
    extension_id,
    action,
    ...(input ? { input } : {}),
  });

  // ★★★ A 200 THAT MEANS "NO" — AND THIS ONE COST A WHOLE BIRTH.
  //
  // The confirmation gate (`apps/api/src/action-adapter.ts:237`) answers **HTTP 200** with
  // `{ needs_confirmation: true, confirm_phrase }` when an app's preflight demands a typed phrase, and
  // echoes the input back so the re-submit can carry both. `post` sees 200 and returns; the caller counted a
  // move that never happened.
  //
  // ⚠️ MEASURED on the birth of 2026-09-09: the café's seed logged
  //     "3 contract(s) in the café: … Bianca Rocha monthly/canceled (2 moved off `active`…)"
  // and the box held `active=2 · paused=1`. `pause_contract` declares no phrase and worked; `cancel_contract`
  // declares `confirmPhrase: 'CANCEL'` and never ran. Step 12 caught it — *"the seed declares active=1 ·
  // canceled=1 · paused=1"* — three steps later, about the DATA, never about the call.
  //
  // ★ THE PHRASE IS NOT CEREMONY TO SKIP, IT IS THE SERVER-SIDE INTERLOCK, and the adapter's own comment says
  // whose it is: *"a stray app can never nuke/pollute a real catalog without the exact typed phrase"*. So the
  // seed does what an operator does — it reads the phrase THE BOX ASKS FOR and sends that one back. It never
  // guesses a phrase, and it never carries a literal: a phrase typed here would be a second copy of a policy
  // the app owns, and it would go stale the day the app changes it.
  if (!first || first.needs_confirmation !== true) return first;
  if (!first.confirm_phrase)
    throw new Error(
      `${extension_id}.${action} demands a confirmation and did not say which phrase. The box answered ` +
        '`needs_confirmation` with no `confirm_phrase`, so there is nothing to send back — this is the box ' +
        'asking for something it did not name, not a seed that forgot to ask.',
    );
  return post('/v1/internal/extension/action', {
    extension_id,
    action,
    ...(input ? { input } : {}),
    phrase: first.confirm_phrase,
  });
};

/**
 * ⛔ THE SILENCING — AND IT RUNS IN THE **CURATED** PHASE, NOT THE WINDOW.
 *
 * The seed is three moments, not one: `--phase curated` → the one-shots INSIDE the box → `--phase window`.
 * The one-shots are what create the demo's ORDERS — `seed-history` writes dozens of them, dated. So a
 * silencing that ran in the window would run AFTER those orders were emitted. Silencing late is silencing
 * nothing.
 *
 * ⚠️⚠️ AND THE REASON THAT USED TO BE GIVEN HERE WAS TRUE OF A BOX IN STEP AND OF NO OTHER — CORRECTED
 * 2026-09-10 (caderno pk32 §12). This header claimed "the decision to send is taken at EMIT", with a
 * measurement behind it: an order placed while silenced produced no notification even after the channel was
 * re-armed and the dispatcher had 70 further seconds. The measurement is real; the conclusion was too wide.
 *
 * Measured in the kernel: `packages/core/src/notification/dispatch.ts:393` decides `channel_disabled` from
 * `args.toggles`, and those toggles are read WHEN THE CONSUMER RUNS — not when the event enters the outbox.
 * ⇒ the fence holds only while the relay is CAUGHT UP, which is what the 70-second measurement quietly
 * assumed. On the birth of 2026-09-10 the box owed 129 907 events and the phase-11 re-arm landed long BEFORE
 * `notification.send` reached the history: 56 of every 67 sends then failed `550` at the provider (the
 * history's buyers are `@example.com`), the serial relay cycle went from ~1 s to ~75 s, every other consumer
 * was pinned at 100 events a cycle, and `inventory.availability` — the consumer that decides whether a card
 * says ESGOTADO — was ~12 HOURS away. Silencing the channel took it to 2 150 events/min and 24 minutes.
 *
 * ⇒ TIME IS PART OF THIS FENCE, so `awaitNotificationRelay` (below) makes the re-arm wait for the consumer
 * instead of assuming it arrived. A prose that is true of the happy box only is how this went unseen.
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
 *
 * ⚠️ `sleep` IS INJECTED FOR THE TESTS AND FOR NOTHING ELSE, the same reason `signSubscriptions` takes one:
 * the wait before the re-arm has a ten-minute budget, so the sentence it prints when the budget runs out
 * could not be driven end to end on the real clock. Undefined is the seed's own timer, which is what
 * `bin/seed.mjs` passes.
 */
export async function seedCommerce({ expect, command, read, log, fail, post, sleep }) {
  const stores = await provenStores({ expect, read, log, fail });

  const absent = await appsNotInstalled(read, REQUIRED_APPS);
  if (absent.length)
    fail(
      `commerce needs ${absent.join(', ')} installed and this slice does not install apps — the filler does. ` +
        'Run the catalogue one-shot first, or ask for the app to be added to its list.',
    );

  try {
    await nameInternalPromotions({ command, read, log });
    await retireIdentityPromotionsAtTheCounter({ stores, command, read, log });
    await seedAdvertisedCoupons({ stores, command, read, log });
    await seedReviews({ stores, command, read, log, post, action: appAction(post) });
    await placeLiveOrders({ stores, command, read, log });
    // ★★ pk25/d3 — AND THE CAFÉ'S SUBSCRIPTIONS, WHICH ARE ORDERS BEFORE THEY ARE ANYTHING ELSE. It is here
    // and not in `seed/coffee.mjs` for the same reason the live proof order is here: a cart can only hold
    // what the store publishes, and `place_order` needs the logistics and the payment app the one-shot
    // brings. It is INSIDE the silence fence on purpose — three more buyers is three more order mails.
    await signSubscriptions({
      stores,
      read,
      log,
      fail,
      action: appAction(post),
      buyerEmail,
      placeOrder: (args) => placeOneOrder({ command, read, log, ...args }),
      sleep,
    });
    await awaitNotificationRelay({ read, log, sleep });
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
 * The kernel's outbox subscription that turns an `order.*` event into a message
 * (`packages/core/src/notification/consumer.ts`: `notificationConsumerName`). The ONE name this file spells,
 * because it is the subject of the wait below — and `awaitNotificationRelay` refuses to conclude anything
 * when the box does not publish a consumer by that name, rather than reading an absence as "caught up".
 */
const NOTIFICATION_CONSUMER = 'notification.send';

/** How far behind the whole relay may be and still be called a drained notification queue. Zero: the wait is
 *  about ONE consumer, and the number it owes is the number it owes. */
const CAUGHT_UP = 0;

/**
 * ⏳⏳ THE RE-ARM WAITS FOR `notification.send` TO CATCH UP — it no longer assumes it did.
 *
 * ── WHY THE OLD WAIT WAS NOT ENOUGH (measured 2026-09-10, caderno pk32 §12) ───────────────────────────────
 *
 * `awaitQueueDrained` below watches the NOTIFICATION RECORD COUNT and gives up after 12 s. On the birth of
 * 2026-09-10 it did exactly what it says it does: the count was still moving, it printed "re-arming anyway
 * and saying so", and the channel came back on with the whole 180-day history still unconsumed. The box then
 * spent hours trying to mail `@example.com` buyers, 56 of every 67 refused `550`, and because the relay cycle
 * is serial that one consumer held `inventory.availability` ~12 hours behind — a shelf saying ESGOTADO with
 * stock. The count was never the wrong metric; it was the wrong SUBJECT. A count can only say "is anything
 * being written", never "has this consumer reached the events I fenced".
 *
 * ── WHAT MAKES THE RIGHT QUESTION ASKABLE (pk31/p1) ───────────────────────────────────────────────────────
 *
 * `read.relay_depth` on the internal face answers per consumer, for THIS tenant (the face resolves the schema
 * from the credential), with `remaining`, `dead_lettered` and a `state`. Measured against the bench box on
 * 2026-09-10: 200, eleven consumers, `notification.send` among them by that exact name.
 *
 * ⛔ AND IT IS NOT `settled`. `settled` folds every consumer together, so waiting on it here would have waited
 * for the 57 003 events of `inventory.availability` as well — the twelve hours this wait exists to avoid. The
 * shop's honesty and the postman are different deadlines and only one of them fences an e-mail.
 *
 * ★ `null` IS AN ANSWER AND IT IS NOT ZERO. `unregistered` (the relay has not met this consumer in this schema
 * yet) keeps the wait going; `inactive` (the schema lacks the tables the consumer declares) ends it, because
 * there is no dispatcher here to outrun. Neither is reported as "nothing owed".
 *
 * ★ `dead_lettered` ENDS THE WAIT TOO, and says the number. A delivery in the dead letter is one nobody will
 * ever make: waiting for it is waiting forever, and on this box it is the `550` population by construction.
 *
 * ⛔⛔ AND THIS WHOLE FUNCTION IS PROVISIONAL — it is the safety net, not the fix. The fix is the kernel
 * learning to REGISTER an order instead of PLACING one (caderno pk32 §13, decided 2026-09-10):
 * `apps/api/src/seed-history.ts` does not write orders, it DRIVES THE PORT — `checkout.place_order`,
 * `order.mark_paid`, `order.shipment.mark_ready_for_pickup` — so the history's orders really are placements
 * and really do deserve a confirmation e-mail. When the ACT carries the fact ("this already happened, in
 * another system, in another month"), every consumer derives its own answer from the EVENT and the answer no
 * longer depends on WHEN the consumer gets there. ⇒ the temporal fence stops being necessary and this
 * function is deleted without a replacement. Until then, a birth needs a deterministic wait.
 *
 * @param polls / waitMs the budget, in the shape `seed/subscriptions.mjs` already uses: 300 × 2 s = 10 min.
 */
async function awaitNotificationRelay({ read, log, sleep, polls = 300, waitMs = 2_000 }) {
  const nap = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const depthOf = async () => {
    // `commerceRead` answers `null` on 404, which is how an older pinned kernel says "I do not publish this".
    const depth = await read('internal/relay_depth');
    if (!depth || !Array.isArray(depth.consumers)) return { absent: true };
    const row = depth.consumers.find((c) => c.consumer === NOTIFICATION_CONSUMER);
    // ⚠️ ANTI-VACUUM. A box whose consumer set does not carry this name is a box this wait cannot grade, and
    // `undefined` must never pass for `remaining: 0` — that is the shape of green this whole fence lost to
    // once already. Reported as `missing`, never as caught up.
    return row ? { row, named: depth.consumers.map((c) => c.consumer) } : { missing: true, named: depth.consumers.map((c) => c.consumer) };
  };

  const first = await depthOf();
  if (first.absent) {
    log(
      'commerce — ⚠️ this kernel does not publish `read.relay_depth` (the internal read answered 404), so the ' +
        're-arm cannot be fenced on the consumer and falls back to watching the record count. That fallback ' +
        'is blind to a deep queue: see caderno pk32 §12. Pin a kernel that carries pk31/p1.',
    );
    return awaitQueueDrained({ read, log, sleep });
  }
  if (first.missing) {
    log(
      `commerce — ⚠️ \`read.relay_depth\` answered without a \`${NOTIFICATION_CONSUMER}\` consumer (it named ` +
        `${first.named.length}: ${first.named.join(', ')}). The wait before the re-arm CANNOT be made, and an ` +
        'absent row is not an empty queue. Either the kernel renamed the consumer — in which case this file ' +
        'names the wrong one — or this schema has no dispatcher at all.',
    );
    return;
  }

  const waited = (attempts) => Math.round((attempts * waitMs) / 1000);
  let attempts = 0;
  let row = first.row;
  for (let attempt = 0; attempt <= polls; attempt += 1) {
    if (attempt > 0) {
      await nap(waitMs);
      attempts += 1;
      const again = await depthOf();
      // The consumer answered once and then stopped being published: a box that changed under the seed. Not
      // reported as the previous answer — a stale row repeated is the oldest way a wait lies.
      if (!again.row) {
        log(
          `commerce — ⚠️ \`read.relay_depth\` stopped naming ${NOTIFICATION_CONSUMER} after ` +
            `${waited(attempts)}s of waiting (${again.absent ? 'the read itself is gone' : `it now names ${(again.named ?? []).join(', ')}`}). ` +
            'The re-arm proceeds unfenced, and this line is the only record that it was not proven.',
        );
        return;
      }
      row = again.row;
    }
    if (row.state === 'inactive') {
      log(
        `commerce — ${NOTIFICATION_CONSUMER} is not active in this schema (missing ` +
          `${(row.missing_tables ?? []).join(', ') || 'tables it declares'}); there is no dispatcher here to ` +
          'outrun, so the re-arm is safe and nothing was waited for',
      );
      return;
    }
    if (row.state === 'dead_lettered') {
      log(
        `commerce — ${NOTIFICATION_CONSUMER} has nothing left it can deliver: ${row.dead_lettered} ` +
          'delivery(ies) are in the dead letter and nobody will ever make them. Waiting for those is waiting ' +
          'forever, so the re-arm proceeds — and the number is printed because it is the provider refusing ' +
          'this box, not the box being idle.',
      );
      return;
    }
    if (row.state === 'settled' && row.remaining === CAUGHT_UP) {
      log(
        `commerce — ${NOTIFICATION_CONSUMER} caught up after ${waited(attempts)}s (0 owed, ` +
          `${row.dead_lettered ?? 0} dead-lettered); safe to re-arm`,
      );
      return;
    }
    // Every 30 s, what it is still short of — a number that shrinks, never a spinner. `null` says so as null:
    // `unregistered` has no count to print and printing 0 would invent one.
    if (attempt > 0 && attempt % Math.max(1, Math.round(30_000 / waitMs)) === 0)
      log(
        `commerce — still waiting on ${NOTIFICATION_CONSUMER} after ${waited(attempts)}s: ` +
          `state=${row.state}, remaining=${row.remaining ?? 'null (no number to give)'}. Everything the ` +
          'one-shots placed is inside the silence fence, and this wait is what keeps it there.',
      );
  }

  // ⛔ THE CEILING, AND IT SAYS WHAT IS LEFT UNDONE. The `finally` of `seedCommerce` re-arms regardless — a
  // seed that hung here would leave the box mute, which is the worse of the two failures (the header above
  // argues it). So the honest ending is to name the exposure rather than to pass over it.
  log(
    `commerce — ⛔ the ${waited(polls)}s budget ran out and ${NOTIFICATION_CONSUMER} is NOT caught up ` +
      `(state=${row.state}, remaining=${row.remaining ?? 'null'}). The channel is being re-armed anyway, so ` +
      'those events WILL be dispatched with it armed: the fence of the curated phase did not hold for them. ' +
      'This is the race caderno pk32 §12 measured. If the destinations are fictional the provider refuses ' +
      'them one by one and the relay stays slow; the permanent answer is §13 (the kernel REGISTERING an ' +
      'order instead of placing one), not a bigger budget here.',
  );
}

/**
 * ⏳ THE OLD WAIT, NOW THE FALLBACK FOR A BOX THAT CANNOT BE ASKED THE RIGHT QUESTION.
 *
 * ⚠️ IT IS KEPT AND IT IS NOT TRUSTED. It watches the notification RECORD COUNT and gives up after 12 s,
 * which is what it was written to do: "wait, and say what was seen". What 2026-09-10 showed is that a count
 * holding still proves nothing about the events this seed fenced, and that the 12 s gave up exactly when the
 * queue was deepest. `awaitNotificationRelay` above asks the consumer itself; this runs only when the box does
 * not publish `read.relay_depth`, and the caller says so out loud when it falls through to here.
 *
 * The original reasoning, kept because the asymmetry it names is still the reason a wait exists at all: the
 * price of being wrong is real e-mail to a real person and cannot be un-sent, while the price of waiting is a
 * few seconds of a seed nobody is watching.
 */
async function awaitQueueDrained({ read, log, sleep, polls = 6, waitMs = 2_000 }) {
  const nap = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const count = async () => ((await read('internal/notifications', { limit: 1 }))?.total ?? 0);
  let last = await count();
  let still = 0;
  for (let i = 0; i < polls && still < 2; i += 1) {
    await nap(waitMs);
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
 * EVERY promotion of this tenant, paged.
 *
 * ⚠️ `promotions_admin` PAGES BY `offset`, NOT BY `page` — the shared `readAll` in `seed/paginate.mjs` sends
 * `page`, which this read ignores, so it would hand back the SAME first page for every request. Today that
 * is invisible (eight promotions fit in one page and the walk ends on a short page); with more than a
 * hundred it would accumulate duplicates. This walk speaks the read's own vocabulary instead.
 */
async function allPromotions(read, { pageSize = 100 } = {}) {
  const all = [];
  for (let offset = 0; offset <= 10_000; offset += pageSize) {
    const payload = await read('internal/promotions_admin', { limit: pageSize, offset });
    const batch = Array.isArray(payload) ? payload : (payload?.items ?? []);
    all.push(...batch);
    if (batch.length < pageSize) return all;
    const total = Number(payload?.total);
    if (Number.isFinite(total) && all.length >= total) return all;
  }
  throw new Error('promotions — read.internal.promotions_admin never ran out of pages; refusing to guess.');
}

/** The rename pass. See `planPromotionRenames` for what it derives from and why it converges. */
async function nameInternalPromotions({ command, read, log }) {
  const { rename, blocked } = planPromotionRenames(await allPromotions(read));
  for (const row of rename)
    await command('promotion.update', { promotion_id: row.id, name: row.to });
  for (const row of blocked)
    log(`promotions — "${row.name}" keeps its internal name: ${row.why}`);
  log(
    rename.length === 0
      ? 'promotions — no build-vocabulary name left on a promotion screen'
      : `promotions — ${rename.length} promotion(s) renamed to their own label: ` +
          rename.map((r) => `${r.from} → "${r.to}"`).join(' · '),
  );
}

/**
 * ⛔ THE COUNTER GIVES BACK THE PROMOTIONS IT CANNOT HONESTLY EVALUATE — the rule is
 * `ANONYMOUS_BUYER_STORE_HANDLES` and `planIdentityRetirements` above; this is the part that talks.
 *
 * ⚠️ IT RETIRES RATHER THAN PREVENTS, AND THAT IS A BOUNDARY AND NOT A SHORTCUT. The row is not this
 * repository's: the kernel's history executor creates it, and WHICH promotion lands on WHICH shop is decided
 * by the store's POSITION in the brand's list — `ACTIVE_PROMOTIONS[i % ACTIVE_PROMOTIONS.length]`, the
 * pinned `packages/seed-dataset/src/history-plan.ts`. An instance cannot choose there, and it must not fork
 * the kernel to; what it can do is what an operator would do with the same screen, through the same port.
 * A counter that grows a third store, or a plan that reorders its three promotions, changes which row this
 * finds — which is exactly why the decision is derived and not a name.
 *
 * ★ IT ASKS THE PORT THREE QUESTIONS AND JOINS THEM, because no single read answers this one. The list
 * (`promotions_admin`) carries neither the conditions nor the store — that shape is frozen in /contracts —
 * so the SCOPE comes from `promotion_stores` (a whole page in one call) and the CONDITIONS from the
 * promotion's own sheet (`promotion_admin`). The scope is asked FIRST on purpose: it is one call for the
 * tenant, and it is what reduces the per-row sheet reads from "every promotion this brand has" to "the
 * handful the counter carries".
 *
 * ⚠️ IT RUNS AFTER THE RENAME AND THAT ORDER IS LOAD-BEARING. `promotion.update` refuses an ARCHIVED
 * promotion, so retiring a row before the rename pass reached it would turn a later run's rename into a
 * refusal. After it, the row has already taken its shopper-facing name and nothing wants to edit it again.
 *
 * ★ `promotion.archive` AND NOT `pause`, in the kernel's own words: "it is never deleted: closed orders
 * reference it and the usage trail is a record". Orders on this bench DID take this discount, so deleting
 * the row is not on the table even if the port offered it — and archived is the one state pricing does not
 * load at all (`loadCandidatePromotions` reads `active` and `paused`). It is also what makes this pass
 * converge for free: `promotions_admin` hides archived rows, so the second run does not even see them.
 */
async function retireIdentityPromotionsAtTheCounter({ stores, command, read, log }) {
  const anonymous = new Map(
    stores.filter((s) => ANONYMOUS_BUYER_STORE_HANDLES.includes(s.handle)).map((s) => [s.id, s.handle]),
  );
  // A brand with no such store — the footwear tenant is one — has nothing to answer for here.
  if (anonymous.size === 0) return;

  const listed = await allPromotions(read);
  if (listed.length === 0) return;
  const scoped = [];
  // `promotion_stores` looks up at most a hundred ids per call, and it says so by refusing; this box is far
  // under that today and the page is what keeps the sentence true if it ever is not.
  for (let i = 0; i < listed.length; i += 100) {
    const page = listed.slice(i, i + 100);
    const answer = await read('internal/promotion_stores', {
      promotion_ids: page.map((p) => p.id).join(','),
    });
    scoped.push(...(Array.isArray(answer) ? answer : (answer?.items ?? [])));
  }
  const storeOf = new Map(scoped.map((row) => [row.promotion_id, row.store_id ?? null]));
  // ⛔ ANTI-VACUUM. A port with no `promotion_stores` answers 404, `commerceRead` turns that into `null`, and
  // every promotion would then look TENANT-WIDE — which this pass deliberately leaves alone, so the counter
  // would keep its row and the log would explain it with a reason that is not the true one. An empty answer
  // over a non-empty list is the read not being there, and it is said rather than absorbed.
  if (storeOf.size === 0) {
    log(
      'promotions — read.internal.promotion_stores answered nothing for ' +
        `${listed.length} promotion(s), so the store scope is unknown and NOTHING was retired. The counter ` +
        'may be carrying a promotion that asks who is buying; this box cannot tell from here.',
    );
    return;
  }

  const sheets = [];
  for (const promotion of listed) {
    const storeId = storeOf.get(promotion.id) ?? null;
    // Only the counter's own rows, plus the tenant-wide ones the plan has to NAME rather than touch.
    if (storeId !== null && !anonymous.has(storeId)) continue;
    const sheet = await read('internal/promotion_admin', { promotion_id: promotion.id });
    sheets.push({
      id: promotion.id,
      name: promotion.name,
      store_id: storeId,
      conditions: sheet?.conditions ?? [],
    });
  }

  const { retire, flagged } = planIdentityRetirements(sheets, anonymous);
  for (const row of retire) {
    await command('promotion.archive', { promotion_id: row.id });
    log(
      `promotions — "${row.name}" retired from ${row.handle}: it is conditioned on ${row.kinds.join(', ')}, ` +
        'and that counter mints a new synthetic buyer for every order',
    );
  }
  for (const row of flagged)
    log(`promotions — "${row.name}" asks who is buying and is NOT retired: ${row.why}`);
  if (retire.length === 0 && flagged.length === 0)
    log(
      `promotions — no promotion that asks who is buying survives in ${[...anonymous.values()].join(', ')}`,
    );
}

/**
 * The coupon each shop's own shop window advertises (see `STORE_COUPONS`).
 *
 * IDEMPOTENT BY NAME, the key every other seed in this repository uses, and the lookup is tenant-wide
 * because `promotions_admin` is: two stores may not carry the same promotion name.
 *
 * ⚠️ THE CODE IS A SECOND COMMAND and the promotion is inert without it — a coupon promotion nobody can type
 * is exactly the state s3-1 reported, arrived at from the other side. It is tolerated as already-taken so a
 * run that died between the two commands converges; a code owned by ANOTHER promotion is a refusal, because
 * a code is unique tenant-wide and this seed does not steal one.
 */
async function seedAdvertisedCoupons({ stores, command, read, log }) {
  // ⛔ Every coupon below is born asking who is buying — see the function for why that is a refusal and not
  // a filter, and `ANONYMOUS_BUYER_STORE_HANDLES` for the rule it serves.
  assertNoAdvertisedCouponAtAnonymousStore();
  const existing = new Map((await allPromotions(read)).map((p) => [p.name, p]));
  for (const store of stores) {
    const coupon = couponFor(store.handle);
    if (!coupon) continue;
    if (existing.has(coupon.name)) {
      log(`promotions — "${coupon.name}" already there (${existing.get(coupon.name).id})`);
      continue;
    }
    const codeOwner = [...existing.values()].find((p) => (p.codes ?? []).includes(coupon.code));
    if (codeOwner) {
      log(
        `promotions — the code ${coupon.code} already belongs to "${codeOwner.name}" (${codeOwner.id}); ` +
          `${store.handle} keeps advertising it and this seed writes nothing. A code is unique tenant-wide.`,
      );
      continue;
    }
    const out = await command('promotion.create', {
      name: coupon.name,
      label: coupon.label,
      store_id: store.id,
      benefit: { kind: 'percentage', percent_bp: coupon.percent_bp, scope: 'each_item' },
      target: { kind: 'all' },
      conditions: [{ kind: 'first_purchase' }],
      status: 'active',
      // A coupon is TYPED: `trigger` says the shopper has to present it, so it never fires on its own.
      trigger: 'coupon',
      stackable: true,
    });
    await command('promotion.code.add', { promotion_id: out.promotion_id, code: coupon.code });
    log(
      `promotions — "${coupon.name}" created for ${store.handle} with code ${coupon.code}, ` +
        `${coupon.percent_bp / 100}% off the first purchase`,
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
 *
 * ⚠️ `cart.set_buyer` IS A BUDGET RATHER THAN TIDINESS: it is an ORACLE-class face capped at TEN A MINUTE per
 * store+IP, and a retry loop here would spend somebody's ceiling. This pass spends one call per selling
 * store, plus the three the café's subscriptions sign (`seed/subscriptions.mjs`) — so the busiest store in
 * the run makes FOUR of the ten, measured against the declaration and not against a hope.
 */
/**
 * ⭐ WHO THE LIVE PROOF ORDER IS PLACED AS — a person, per store, and it used to be "PRE SEED" (s7-11).
 *
 * The address is the KEY: it is what a second run recognises so it leaves the order alone instead of placing
 * another. The NAME is what a human sees, and that is the half that was wrong. Measured in the admin's order
 * list on 2026-09-02: two rows whose customer is literally `PRE SEED`, beside three hundred rows of
 * plausible Brazilian names from the history — in a demo that reads as a bug in the import, not as a shop.
 *
 * ⚠️ THE SHAPE OF THE ADDRESS IS NOT A CHOICE. It has to be a mailbox that EXISTS, because the buyer's order
 * mail is re-armed at the end of this pass and a bounce is somebody's postmaster problem; `hi@forgecommerce.pro`
 * is the one this box owns, and plus-addressing is how one mailbox becomes four distinct buyers. So the tag
 * is the person's own name rather than `<handle>-liveproof`: same mechanism, and the order sheet no longer
 * shows the seed's internal vocabulary to whoever is being shown the shop.
 *
 * ⛔ AND THERE IS NO DEFAULT, exactly like `REVIEW_DOORS`. A store nobody decided about would take whichever
 * name the fallback happened to hold, in every shop at once — which is how four stores end up sharing one
 * "customer" and the dedupe key stops distinguishing them.
 *
 * ⚠️ CHANGING A TAG CHANGES THE KEY. On a box that already carries a proof order under the old address, the
 * next run does not recognise it and places a SECOND one. That is the one-off price of this rename and it is
 * paid on a box that is rebuilt from zero; it is not a reason to keep the old name on a demo screen.
 */
export const LIVE_PROOF_BUYERS = {
  forge: { name: 'Camila Berutti', tag: 'camila.berutti' },
  outlet: { name: 'Paulo Sarmento', tag: 'paulo.sarmento' },
  cafe: { name: 'Helena Vasconcelos', tag: 'helena.vasconcelos' },
  balcao: { name: 'Rui Nakamura', tag: 'rui.nakamura' },
};

export function liveProofBuyerOf(handle) {
  const buyer = LIVE_PROOF_BUYERS[handle];
  if (!buyer)
    throw new Error(
      `no live-proof buyer decided for the store "${handle}". The proof order's ADDRESS is the key a second ` +
        'run recognises and its NAME is what the admin shows a person, so there is deliberately no default: ' +
        'a fallback would put one "customer" in every shop and stop the key distinguishing them. Add the ' +
        'store to LIVE_PROOF_BUYERS, with a name that reads like a person.',
    );
  return { ...buyer, email: buyerEmail(buyer.tag) };
}

/**
 * ★ THE ONE AUTHOR OF A SEEDED BUYER'S ADDRESS. Every synthetic shopper this seed creates is a plus-tag on
 * the SAME mailbox, and the shape is not decoration: the buyer's order mail is re-armed at the end of this
 * pass, so a bounce is somebody's postmaster problem. `hi@forgecommerce.pro` is the box that exists.
 *
 * ⛔ AND NEVER A REAL PERSON'S ADDRESS. This dataset shipped a real personal one once, in fifteen files.
 * A tag here is a name that reads like a person and a mailbox that is ours.
 */
export const buyerEmail = (tag) => `hi+${tag}@forgecommerce.pro`;

/**
 * ★★ A22 — THE PROOF ORDER IS PLACED THE WAY THE STORE ALLOWS, and getting this wrong would have killed the
 * seed rather than degraded it.
 *
 * MEASURED, 2026-09-04. `checkout.place_order` refuses a PURE GUEST cart when the store's
 * `guest_checkout_enabled` is false — `forbidden · guest_disabled`, at packages/core/src/commands/checkout.ts,
 * before any completeness check. This function used to send `guest: true` unconditionally, so the moment A22
 * turned guests off in the Outlet and the Café the whole run would have died on the kernel being RIGHT.
 *
 * ★ THE FIX IS NOT A TRY/CATCH, IT IS AN INTENT. `guest: false` means "close this order with an account",
 * which is exactly what a shop that forbids guests is asking for, and it is what the KERNEL's own history
 * seeder has always sent (apps/api/src/demo-scenario.ts) — the account is created at close from the buyer's
 * address. So a shop that permits guests gets a guest proof order and a shop that does not gets an account
 * one, and the funnel each store exercises is the funnel that store actually offers.
 *
 * ⚠️ ABSENT ⇒ GUEST. `read.internal.stores` publishes the column, so `undefined` here means the read did not
 * answer (an older kernel), and the pre-A22 behaviour is the honest fallback: it is what every store did.
 */
export function liveProofGuestIntent(store) {
  return store?.guest_checkout_enabled !== false;
}

async function placeLiveOrders({ stores, command, read, log }) {
  const placed = [];
  for (const store of sellingStores(stores)) {
    const order = await placeOneOrder({
      store,
      command,
      read,
      log,
      buyer: liveProofBuyerOf(store.handle),
      what: 'live proof',
    });
    if (order) placed.push(`${store.handle} #${order.number}`);
  }
  log(
    placed.length
      ? `commerce — the box still sells today: ${placed.join(' · ')}`
      : 'commerce — no store could take a live order (see the lines above for which piece was missing)',
  );
  return placed;
}

/**
 * The whole journey for one store, through the same door a shopper uses. Returns the confirmation, or null
 * with a reason logged — a store that cannot sell is a finding, not an exception to throw the seed away on.
 *
 * ★★ pk25/d3 — IT TAKES ITS BUYER AND ITS LINE NOW, and that is what makes a SUBSCRIPTION reachable without
 * a second copy of this journey. The parts that were measured the hard way — a store that forbids guests, an
 * address that is required even for pickup, an option chosen by INTENTION and not by position — are exactly
 * the parts a copy would get subtly wrong, and the subscription orders need every one of them.
 *
 * @param buyer     `{name, email}` — the ADDRESS is the idempotence key, the NAME is what the admin shows.
 * @param what      how this order is described in the log ("live proof", "subscription · weekly", …).
 * @param pickSku   chooses the SKU off the store's published catalogue. Default: the first active one.
 * @param customFields the LINE's declared custom fields, or undefined for an ordinary purchase. This is the
 *                  seam a subscription rides: `sub_plan` is the `subscriptions` app's own `cart_line`
 *                  declaration, the kernel validates it against the declared options and freezes it into
 *                  `sales_order_line.custom_fields`, and the app's `order.created` script mints the contract
 *                  from THAT — the kernel's own snapshot, which is the only inforgeable half.
 */
export async function placeOneOrder({ store, command, read, log, buyer, what, pickSku, customFields }) {
  const skip = (why) => {
    log(`commerce — ${store.handle} took no ${what} order: ${why}`);
    return null;
  };

  // ⭐ SECOND RUN CONVERGES, AND THE FIRST DRAFT DID NOT. Every run minted a new cart, so a re-run placed a
  // SECOND live order in every store — measured: cafe #1 then #2. A seed that grows the bench each time it
  // runs is a seed nobody can run twice, which is one of this wave's acceptance criteria. The proof order is
  // therefore keyed by a STABLE synthetic buyer per store, and a store that already has one is left alone.
  const already = ((await read('internal/orders_admin', { limit: 100 }))?.items ?? []).find(
    (o) => o.buyer?.email === buyer.email || o.buyer?.email_masked === buyer.email,
  );
  if (already) {
    log(`commerce — ${store.handle} already carries its ${what} order #${already.number}; leaving it`);
    // ⚠️⚠️ THE SAME SHAPE AS THE FRESH PATH, AND IT USED NOT TO BE. `orders_admin` publishes the order's id
    // as `id`; the fresh return below carries it as `order_id`, because `order_confirmation` does not
    // publish it at all. So this branch used to hand back a row WITHOUT `order_id` — one function, two
    // shapes, and only on the second run.
    //
    // ★ MEASURED on the birth of 2026-09-09, and the way it failed is the reason this comment is long:
    // `signSubscriptions` does `wanted: signed.map((s) => s.order.order_id)`, so a re-run built
    // `[undefined, undefined, undefined]`, and `awaitContracts` puts that into a `Set` — where THREE
    // undefineds collapse into ONE. The refusal then read
    //     `subscriptions — 1 of 3 order(s) produced no contract: .`
    // — a count that says 1 where three orders were placed, and a list that names nobody. It then sent the
    // reader to check the relay, which was fine; the three contracts existed. ⇒ the seed that promises
    // "SECOND RUN CONVERGES" four lines above could not, in fact, run twice.
    return { ...already, order_id: already.id };
  }

  const catalogue = (await read('products', { store: store.id, limit: 25 }))?.items ?? [];
  const sku = (pickSku ?? ((products) => products.flatMap((p) => p.skus.filter((k) => k.status === 'active'))[0]))(
    catalogue,
  );
  if (!sku) return skip('it publishes nothing sellable this order could hold');

  const methods = await read('payment_methods', { store: store.id });
  const method = methods?.methods?.[0];
  const app = methods?.providers?.[0]?.app_id;
  if (!method || !app) return skip('no payment app is installed for this tenant');

  const { cart_id } = await command('cart.create', {}, { store: store.id });
  await command(
    'cart.add_line',
    { cart_id, sku_id: sku.id, qty: 1, ...(customFields ? { custom_fields: customFields } : {}) },
    { store: store.id },
  );

  // ⚠️ THE BUYER'S ADDRESS IS REQUIRED EVEN FOR PICKUP — measured in the totem wave: a cart with the pickup
  // method, a point and a buyer still answered `missing: [shipping_address]`. So the address is always sent,
  // and it is the PICKUP POINT'S OWN, read back from the kernel, never invented.
  //
  // A22 — the INTENT comes off the store's own flag; see `liveProofGuestIntent` for the refusal it avoids.
  const guest = liveProofGuestIntent(store);
  await command(
    'cart.set_buyer',
    { cart_id, email: buyer.email, name: buyer.name, guest },
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
    `commerce — ${store.handle} #${confirmation?.number} ${confirmation?.status} · ${what} ` +
      `(${method} via ${app}, ${point ? 'pickup' : 'delivery'}, ${guest ? 'guest' : 'account at close'})`,
  );
  // ⚠️ `order_id` IS CARRIED OUT, and the confirmation does not publish it. The subscription step pairs a
  // contract with the order that signed it (`origin_order_id`), and re-deriving that from a number would be
  // a second key for one fact.
  return { ...confirmation, order_id };
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
 * ⭐ THE WALL — AND IT IS WRITTEN PER PRODUCT, NOT DRAWN FROM ONE POOL (A47, then s3-14/s7-11).
 *
 * The first version wrote ONE review per product, and the fix for that was a POOL of twelve voices rotated
 * by a hash of the handle. That solved the count and created a worse problem, measured on the bench by the
 * QA sweep: with twelve sentences spread over six coffees every sentence lands on three or four products, so
 * *"Tomo puro, sem leite…"* (Priscila N.) sat beside itself in the home's review mosaic. A wall that repeats
 * itself is the single loudest tell that a shop is seeded — worse than having no wall at all, because it
 * says the shop has customers AND that they are invented.
 *
 * The same arithmetic did it to the moderation queue: one HELD voice, six products, six identical pending
 * rows from one "Tiago N." — the operator's first screen in the demo, six times the same sentence.
 *
 * ⇒ EACH COFFEE HAS ITS OWN VOICES, and they talk about THAT coffee: the Serra's floral, the Noturno's
 * behaviour under milk, the Descafeinado at ten at night, the Edição's numbered lot. A pool cannot do that
 * however wide it is — a generic sentence is reusable precisely because it says nothing about the product.
 *
 * ★ WHAT IS PRESERVED FROM THE POOL VERSION, deliberately, because it was right:
 *   · 6..10 reviews per product (the floor asked for is at least six each) — 52 rows over the six
 *     coffees, 8.7 each, which is what the bench measured and what was accepted;
 *   · ratings that VARY, averaging 4.2 — a shop people like, not a shop nobody criticises;
 *   · exactly ONE held row per product, never moderated, so the queue is inhabited whenever anybody opens
 *     it and the seed still CONVERGES (a held row is pending after run one and after run five);
 *   · the wall derived from the HANDLE and never from the product's position in the catalogue read.
 *
 * ⚠️ AND THE HELD SIX ARE NOW SIX DIFFERENT PEOPLE SAYING SIX DIFFERENT THINGS. That is the whole of the
 * s7-11 finding: the queue is a screen an operator is shown in a demo, and six copies of one sentence read
 * as a broken import rather than as a morning's work.
 */
export const COFFEE_REVIEWS = {
  // ── O blend da casa — chocolate ao leite, caramelo, nozes; a única com 250g e 1kg em três moagens ──────
  'forge-alvorada': [
    { author: 'Marina Ribas', rating: 5, body: 'Chegou rápido e a moagem para filtro veio certinha. O cheiro ao abrir o pacote já entrega o caramelo.' },
    { author: 'Rodrigo Vilela', rating: 5, body: 'É o café que eu deixo na cozinha do escritório. Ninguém reclama e o pacote de 1kg dura duas semanas.' },
    { author: 'Joana Pontes', rating: 4, body: 'Bom no dia a dia, doce sem precisar de açúcar. Tirei uma estrela porque queria uma opção de 500g.' },
    { author: 'Eduardo Naves', rating: 5, body: 'Faço na prensa francesa e fica redondo, sem amargor nenhum. Virou o padrão lá de casa.' },
    { author: 'Tatiane Bicalho', rating: 4, body: 'Comprei em grãos e moo na hora. Chocolate ao leite é exatamente o que se sente.' },
    { author: 'Wagner Leitão', rating: 3, body: 'Cumpre o que promete, mas para o meu gosto podia ter um pouco mais de acidez.' },
    { author: 'Cláudia Marinho', rating: 5, body: 'Terceiro pedido do 1kg. Sempre com data de torra recente, nunca me veio um lote velho.' },
    { author: 'Sérgio Dantas', rating: 4, body: 'No espresso pede um clique a mais de fino, mas no coado acerta de primeira.' },
    { author: 'Ana Lúcia Ferraz', rating: 3, body: 'Café gostoso, só achei que o pacote de 1kg podia ter um fecho melhor.', hold: true },
  ],

  // ── Microlote lavado da Serra do Caparaó, torra clara, 86 SCA — o café que exige método ────────────────
  'forge-serra-do-caparao': [
    { author: 'Bruno Sales', rating: 5, body: 'O floral aparece mesmo quando a xícara esfria. Não esperava isso de um lavado nessa faixa de preço.' },
    { author: 'Renata Quirino', rating: 5, body: 'Fiz na V60 e a maçã verde ficou nítida do começo ao fim. Um dos melhores microlotes que já pedi aqui.' },
    { author: 'Fernanda Aguiar', rating: 5, body: 'Torra clara de verdade, sem aquele gosto de torrado que estraga microlote bom.' },
    { author: 'Paulo César Bento', rating: 4, body: 'Muito bom, mas exige atenção: se você errar a temperatura da água ele fecha e some.' },
    { author: 'Letícia Bastos', rating: 4, body: 'Delicado e limpo. Só não é o café que eu tomaria com leite — perde tudo o que ele tem de bom.' },
    { author: 'Vinícius Rocha', rating: 5, body: '86 pontos honestos. Comprei duas vezes e as duas vieram iguais, o que em microlote é raro.' },
    { author: 'Marcos Aurélio Pena', rating: 3, body: 'Bom, mas para o preço eu esperava um pouco mais de doçura no final da xícara.' },
    { author: 'Priscila Nogueira', rating: 4, body: 'Tomo puro e sem açúcar, e com esse eu consigo passar a manhã inteira sem enjoar.' },
    { author: 'Heloísa Prado', rating: 3, body: 'Chegou no prazo e o café é ótimo, mas o pacote veio amassado dentro da caixa.', hold: true },
  ],

  // ── Denominação de origem, natural, chocolate 70% e cana — o café de despensa, 250g e 1kg ──────────────
  'forge-cerrado-mineiro': [
    { author: 'Anderson Melo', rating: 4, body: 'O fundo de cana é real e fica na boca. Combina com qualquer coisa, como diz a descrição.' },
    { author: 'Silvia Andrade', rating: 5, body: 'Peguei o 1kg moído para filtro e rendeu o mês inteiro em casa, com duas pessoas tomando todo dia.' },
    { author: 'Caio Bertoldo', rating: 4, body: 'Natural bem feito, sem aquele fermentado exagerado. A avelã aparece limpa na xícara.' },
    { author: 'Juliana Tavares', rating: 5, body: 'Meu marido não bebia café sem açúcar e passou a beber esse. Já é motivo suficiente.' },
    { author: 'Otávio Barreto', rating: 4, body: 'Custo-benefício honesto no 1kg. No 250g eu ainda prefiro o blend da casa.' },
    { author: 'Neusa Ribeiro', rating: 3, body: 'Gostei, mas achei o corpo mais leve do que eu esperava de um natural do Cerrado.' },
    { author: 'Diego Amorim', rating: 5, body: 'Uso na moka italiana e não fica adstringente. Poucos cafés dessa faixa aguentam a moka.' },
    { author: 'Roberta Lins', rating: 5, body: 'Comprei pela denominação de origem e fiquei pela avelã. Já coloquei na assinatura.' },
    { author: 'Fábio Menezes', rating: 3, body: 'Café bom, mas a etiqueta de moagem veio trocada com a do outro pacote do pedido.', hold: true },
  ],

  // ── Torra escura para leite e espresso curto — cacau, melaço, especiarias ──────────────────────────────
  'forge-noturno': [
    { author: 'Thiago Correia', rating: 5, body: 'É o único que não some no leite. Faço cappuccino em casa e finalmente dá para sentir o café.' },
    { author: 'Amanda Feitosa', rating: 4, body: 'No espresso curto sai com crema bonita. Para coado achei pesado demais, mas não é para isso.' },
    { author: 'Rogério Pinto', rating: 5, body: 'Comprei para a máquina do bar e virou padrão da casa. Amargor limpo, sem gosto de queimado.' },
    { author: 'Michele Duarte', rating: 4, body: 'As especiarias aparecem no fim. Meu filho levou o pacote embora no primeiro fim de semana.' },
    { author: 'Gilberto Nunes', rating: 5, body: 'Torra escura sem gosto de cinza é difícil de achar por aqui. Esse acerta a mão.' },
    { author: 'Karina Sobral', rating: 2, body: 'Para o meu gosto ficou amargo demais mesmo com leite. Voltei para o blend da casa.' },
    { author: 'Alexandre Reis', rating: 5, body: 'Melaço mesmo, não é força de expressão. Faço na moka com um dedo de leite e vira sobremesa.' },
    { author: 'Denise Vasques', rating: 4, body: 'Ótimo com leite, mas se você gosta de café claro e ácido não peça esse.' },
    { author: 'Ivan Guimarães', rating: 4, body: 'Muito bom. Só queria ver a data de torra na página antes de comprar, e não só no pacote.', hold: true },
  ],

  // ── Swiss Water, torra média, biscoito e chocolate — o café das nove da noite ──────────────────────────
  'forge-descafeinado': [
    { author: 'Cristina Aires', rating: 4, body: 'Descafeinado que continua sendo café. Tomo às dez da noite e durmo do mesmo jeito.' },
    { author: 'Leandro Bispo', rating: 5, body: 'Sem gosto químico nenhum. O Swiss Water faz diferença e dá para perceber na primeira xícara.' },
    { author: 'Verônica Sampaio', rating: 4, body: 'Minha mãe não pode cafeína e voltou a tomar café por causa desse. Biscoito é a nota exata.' },
    { author: 'Marcelo Tinoco', rating: 5, body: 'Comprei achando que seria fraco e é encorpado. Pedi de novo na semana seguinte.' },
    { author: 'Sônia Bragança', rating: 3, body: 'Bom, mas ainda prefiro o comum. Fica um pouco mais seco no final da xícara.' },
    { author: 'Hugo Peixoto', rating: 4, body: 'Grávida em casa, esse resolveu o problema do cheiro de café de manhã sem cortar o ritual.' },
    { author: 'Elaine Motta', rating: 5, body: 'Uso na prensa e não perde corpo. Servi para visita e ninguém percebeu que era descafeinado.' },
    { author: 'Nelson Cardoso', rating: 3, body: 'Gostei, mas a embalagem do descafeinado devia ser mais fácil de distinguir da do comum.', hold: true },
  ],

  // ── Dona Cida, Sítio Boa Vista, honey, 88 SCA, lote numerado e só em grãos ─────────────────────────────
  'forge-edicao-do-produtor': [
    { author: 'Isabela Fontes', rating: 5, body: 'Jasmim de verdade no aroma. Guardei a etiqueta do lote numerado, é bonita demais para jogar fora.' },
    { author: 'Ricardo Salgado', rating: 5, body: 'Honey bem seco, doçura de rapadura sem enjoar. Vale o preço uma vez por mês, sem culpa.' },
    { author: 'Patrícia Lemos', rating: 4, body: 'Excelente, mas só vem em grãos — quem não tem moedor em casa fica de fora dessa.' },
    { author: 'Gustavo Aranha', rating: 5, body: 'Fiz em Chemex para quatro pessoas e as quatro perguntaram o nome do café. Os 88 pontos se sentem.' },
    { author: 'Simone Vidal', rating: 5, body: 'Comprei pela história da Dona Cida e voltei pelo pêssego. As duas coisas se sustentam.' },
    { author: 'Frederico Alencar', rating: 4, body: 'Muito bom, mas some rápido: 250g de um café assim dura uma semana e olhe lá.' },
    { author: 'Larissa Fontoura', rating: 3, body: 'Ótimo café, porém acabou antes de eu conseguir repetir o pedido. Avisem quando o lote voltar.' },
    { author: 'Márcio Teixeira', rating: 4, body: 'Café excepcional. Só faltou a página dizer quantos pacotes ainda existem do lote.', hold: true },
  ],
};

/** Every voice this seed writes, in one flat list — DERIVED from the walls above, so a coffee added to the
 *  table cannot be forgotten by the two sets below. */
export const REVIEW_VOICES = Object.values(COFFEE_REVIEWS).flat();

/** The names the seed writes under. They are how it recognises its OWN rows on a second run and in the
 *  moderation queue — a seed must never decide a review a person wrote.
 *
 *  ⚠️ DERIVED, NOT TYPED. It used to be a hand-written list beside the voices, which is two places to add a
 *  name and one of them to forget — and forgetting it makes the seed stop recognising its own rows, write
 *  them again on the next run, and moderate none of them. */
export const SEEDED_AUTHORS = new Set(REVIEW_VOICES.map((v) => v.author));

/** The rows this seed writes and then deliberately leaves in the queue — now ONE PER COFFEE, six different
 *  people saying six different things (s7-11). */
export const HELD_AUTHORS = new Set(REVIEW_VOICES.filter((v) => v.hold).map((v) => v.author));

/**
 * ⛔ WHOSE VOICES THESE ARE — and there is no default, exactly like `REVIEW_DOORS` above.
 *
 * The `open_form` door is decided per store, and today only the coffee shop takes it; the sentences above
 * are a coffee shop's. A second store put on this door with no voices of its own would silently get a wall
 * praising the moagem of a pair of shoes, so this throws instead.
 */
const VOICES_BY_STORE = { cafe: COFFEE_REVIEWS };

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
 * ★★ WHICH REVIEWS ONE PRODUCT GETS — its own, by HANDLE, and there is deliberately no default.
 *
 * ⚠️ NOT FROM THE PRODUCT'S POSITION IN THE READ, which an early version used (`voices[i % n]`): the
 * catalogue read's order is the projection's, and a seed whose data depends on it writes a different shop
 * every time a product is added.
 *
 * ⚠️ AND NOT FROM A HASH OVER A SHARED POOL EITHER, which is what replaced it. A hash spreads twelve
 * sentences over six products and every sentence lands on three of them; the home's review mosaic then shows
 * the same words twice, side by side. Deriving deterministically is necessary and it is not sufficient — the
 * sentences themselves have to be different, and a sentence that fits four coffees is a sentence that says
 * nothing about any of them.
 *
 * ⛔ A PRODUCT THIS TABLE DOES NOT NAME IS A REFUSAL. The alternative is a PDP with an empty wall in a shop
 * whose every other page has one, discovered by whoever is being shown the demo. Adding a coffee is adding
 * its voices — the seed says so, by name, instead of shipping the shop half-populated.
 */
export function reviewPlanFor(handle, voices = COFFEE_REVIEWS) {
  const plan = voices[handle];
  if (!plan)
    throw new Error(
      `the product "${handle}" has no reviews written for it. Each coffee carries its OWN voices ` +
        '(COFFEE_REVIEWS in seed/commerce.mjs) — a shared pool is what put the same sentence on four ' +
        'products and gave the seed away. There is deliberately no default and no rotation: write this ' +
        "product's own eight or nine, one of them `hold: true` so the moderation queue keeps a row.",
    );
  return plan;
}

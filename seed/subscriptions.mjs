// ★★ THE SUBSCRIPTIONS THE CAFÉ ALREADY SOLD — the half of the demo that existed as an OFFER and never as a
// REGISTER.
//
// ── ⛔ THE HOLE, MEASURED (2026-09-08) ────────────────────────────────────────────────────────────────────
//
// `seed/coffee.mjs` installs the `subscriptions` app, marks five of the six coffees `sub_enabled`, creates
// the two subscriber perks (10% off + free freight on a `sub_plan` line) and the forked vitrine draws the
// plan picker on those product pages. So a SHOPPER can see the whole offer and sign it.
//
// The OPERATOR could see nothing. Asked of the live bench, in both app schemas of `forge-preseed`:
//
//     select count(*) from <subscriptions schema>.contract;   →   0
//
// Zero contracts, on a box that has been running the coffee shop for days — because nothing in this seed
// ever placed an order carrying a plan. The admin's home draws the app's own card
// (`latest_subscriptions`, `extensions/subscriptions/manifest.ts`) and it came up EMPTY, so the capability
// the platform closed this week — "an app puts a card on the admin's home, reading its own data through the
// port with the scope the tenant consented" — demonstrated itself with nothing in it. The app's own screen
// (Apps → Assinaturas) was equally blank, and so were the three words of a contract's ficha.
//
// ── ★★ HOW A CONTRACT IS BORN, AND WHY THIS FILE PLACES ORDERS INSTEAD OF WRITING ROWS ────────────────────
//
// It is NOT a command and there is no door that creates one. The app's manifest says it in full: the
// contract is DERIVED FROM THE ORDER — the platform runs `ext:subscriptions:order-placed` on every
// `order.created`, the script re-reads the FROZEN order through the port and mints a contract for the lines
// that carry `sub_plan`. Its reason is a security one and it is the right one: a contract is the thing that
// will keep asking a person for money, so "this is a subscription" must not be forgeable by whoever can POST
// a cart. The only inforgeable half is the kernel's own order line.
//
// ⇒ So this file signs subscriptions the way a shopper does: `cart.add_line` with the app's declared
//   `sub_plan` custom field, through the same journey `seed/commerce.mjs` already measured. Everything else
//   is the app's, and NOTHING here writes into the app's schema.
//
// ⚠️ AND IT IS THEREFORE ASYNCHRONOUS. The script runs off the OUTBOX, not inside the transaction, so the
// contract does not exist the instant `place_order` answers. This file waits for it and says how long it
// waited; it never assumes and it never gives up in silence (`awaitContracts`).
//
// ⚠️ A SUBSCRIPTION NEEDS AN ACCOUNT. `order-placed.ts` returns without minting anything when the order has
// no `customer_id`, which is every GUEST order. The café forbids guests (A22, `seed/box.json`), so
// `liveProofGuestIntent` sends `guest: false` and the kernel creates the account at close — which is exactly
// the condition the script needs. On a store that permitted guests this step would place orders and produce
// no contract at all, and that is why the wait below FAILS instead of shrugging.
//
// ── ★ THE THREE STATES, AND WHY NOT ONE ──────────────────────────────────────────────────────────────────
//
// One active contract proves the widget renders. It does not show the ficha's vocabulary, the admin's status
// filter, or that a paused subscription looks different from a cancelled one — which is the whole of what an
// operator is being shown. The app declares a CLOSED set of three (`SUBSCRIPTION_STATUSES` =
// active|paused|canceled), and the two that are not the birth state are reached the only way they can be:
// by running the app's own actions through the tenant action face. No status is invented here.

/**
 * ⛔ THE CAFÉ AND ONLY THE CAFÉ. THE CORRECTION: subscriptions are exercised by the COFFEE shop, and the
 * shoe brand is not meant to come with the app installed at all. The app is installed
 * by `seed/coffee.mjs` for that tenant alone (`seed/box.json` says so with all the letters), so a run against
 * the shoe brand finds no install and this whole step is a no-op with a line, never a failure.
 */
export const STORE_HANDLE = 'cafe';

export const APP = 'subscriptions';
export const CONTRACT_MODEL = 'contract';

/**
 * ★★ THE APP'S OWN LINE FIELD. `extensions/subscriptions/cycle.ts` → `PLAN_FIELD = 'sub_plan'`, declared by
 * the manifest as a `cart_line` custom field and MATERIALIZED by the install — which is why installing the
 * app is a precondition of the perks `seed/coffee.mjs` creates, and of every order below.
 *
 * ⚠️ THE KERNEL VALIDATES THE VALUE against the declaration's own options, so a rhythm outside the app's
 * vocabulary is a refusal at `cart.add_line` and never a line nobody can read.
 */
export const PLAN_FIELD = 'sub_plan';

/**
 * ★★ THE THREE SUBSCRIBERS — a person, a rhythm and a state each, and none of the three is arbitrary.
 *
 * · THE NAMES are what an operator reads in the app's screen and on the home card, beside three hundred
 *   plausible Brazilian names from the dated history. `PRE SEED` in that list reads as a bug in the import
 *   and not as a shop — the same lesson `LIVE_PROOF_BUYERS` already paid for.
 * · THE ADDRESSES are plus-tags on the mailbox this box owns (`seed/commerce.mjs` → `buyerEmail`). ⛔ Never
 *   a real person's: this dataset shipped a real personal address once, in fifteen files.
 * · THE RHYTHMS are three of the store's OFFER, and the offer is read from the box rather than assumed —
 *   see `offeredRhythms`. A contract on a rhythm the product page cannot sell is a screen that contradicts
 *   the shop beside it.
 * · THE STATES are the app's whole closed set. `active` is the birth state; the other two are REACHED by
 *   running the app's own actions, so the demo's data can only ever hold states the engine really has.
 *
 * ⚠️ THE E-MAIL IS THE IDEMPOTENCE KEY, exactly as it is for the live proof order: a second run recognises
 * the order it already placed and leaves it alone. Renaming a tag places a second order.
 */
export const SUBSCRIBERS = [
  { name: 'Marina Toledo', tag: 'marina.toledo', plan: 'weekly', state: 'active' },
  { name: 'Otávio Ferraz', tag: 'otavio.ferraz', plan: 'biweekly', state: 'paused' },
  { name: 'Bianca Rocha', tag: 'bianca.rocha', plan: 'monthly', state: 'canceled' },
];

/** state → the action that reaches it from `active`, or null when it IS the birth state. Derived from the
 *  app's declared actions (`pause_contract`, `cancel_contract`); a state with no action here is a state this
 *  file must not claim to produce. */
export const ACTION_FOR = {
  active: null,
  paused: 'pause_contract',
  canceled: 'cancel_contract',
};

/**
 * ★ THE RHYTHMS THIS STORE OFFERS, from the store's own config, with the app's declared default as the
 * fallback — and the fallback is a MEASUREMENT, not a guess: `read.extension_config?extension=subscriptions`
 * answers 404 on a box that never configured the app (`seed/commerce.mjs` documents that exact response),
 * and the app then serves `DEFAULT_FREQUENCIES` — weekly, biweekly, monthly (`extensions/subscriptions/
 * config.ts`). This box configures nothing, so the fallback is the live answer today.
 *
 * ⚠️ IT IS READ RATHER THAN ASSUMED because the failure is invisible: a contract on a rhythm the store
 * stopped offering renders perfectly in the admin and cannot be signed by any shopper on the PDP beside it.
 *
 * @param stored the body of `read.extension_config`, or null when the app has never been configured
 */
export function offeredRhythms(stored) {
  const raw = stored?.config?.frequencies ?? stored?.frequencies;
  if (typeof raw !== 'string') return null;
  const offered = raw
    .split(',')
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
  return offered.length > 0 ? offered : null;
}

/**
 * ★★ WHICH SKU EACH SUBSCRIBER SIGNS — one per subscriber, all different, and every one of them CURATED.
 *
 * ⚠️ THE MARK IS THE WHOLE POINT AND IT IS NOT DECORATION. `seed/coffee.mjs` marks five of the six coffees
 * `sku.metadata.sub_enabled`, and the vitrine draws the plan picker from that and nothing else. A seed that
 * subscribed the SIXTH — the Edição do Produtor, curated OUT on purpose — would put a contract in the admin
 * for a coffee whose own page refuses to sell one, which is the curation boundary demonstrating its own
 * absence.
 *
 * ⚠️ AND IT DERIVES THE LIST FROM THE SHOP, never from a typed handle. This is the A46 lesson in the file
 * that could repeat it: the mark is written by a step that once wrote ZERO of them in silence, and a picker
 * with a hard-coded handle would sail past that and sign a SKU that carries no mark.
 *
 * @param products one page of the store's PUBLIC catalogue (the only face that answers "on sale HERE")
 * @param index    which subscriber this is
 */
export function pickSubscribableSku(products, index) {
  const marked = products
    .flatMap((product) =>
      (product.skus ?? [])
        .filter((sku) => sku.status === 'active' && sku.metadata?.sub_enabled === true)
        .map((sku) => ({ ...sku, product_handle: product.handle })),
    )
    // The public read is not promised in any order, and a demo whose three subscriptions change coffee on
    // every rebuild is a demo nobody can screenshot twice.
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (marked.length === 0) return null;
  return marked[index % marked.length];
}

/**
 * ⏳ WAIT FOR THE APP'S SCRIPT — the contract is minted by an outbox consumer, so it does not exist when
 * `place_order` answers.
 *
 * ⚠️ IT FAILS RATHER THAN SHRUGGING. A step that placed three orders and reported "no contracts yet" would
 * leave a box that looks seeded and shows an empty widget — the exact state this whole file exists to end.
 *
 * ★★★ THE CEILING IS 600s, AND IT IS NOT A THIRD GUESS — IT IS THE ONE THIS BOX ALREADY DECLARES.
 * `bin/box-up.sh` step 10b waits for the dispatcher with `DRAIN_CEILING_S=600` for the same question this
 * wait asks: "is the relay still behind?". Two waits on one box answering one question with two different
 * ceilings is how you get a third number next month. 15s failed, 60s failed; the number is now the box's.
 *
 * ⛔⛔ AND QUIETNESS CANNOT BE THE RULE HERE, WHICH IS THE THING I TRIED FIRST AND MEASURED AWAY.
 * Step 10b gives up on PROGRESS, not on the clock, and that is the better shape — so the obvious fix was to
 * watch this app's own runs (`internal/extension_runs`, backed by `extension_invocation`) and give up when it
 * went quiet. Measured on the birth of 2026-09-09, per minute, for the café's tenant:
 *
 *     22:34  reviews 48 · subscriptions —      ← the three orders are placed at 22:34:30
 *     22:35  (nothing ran)
 *     22:36  (nothing ran)
 *     22:37  subscriptions 5                   ← the three contracts, at 22:37:50
 *
 * ⇒ THREE MINUTES OF LEGITIMATE SILENCE. A quietness rule would have given up in the middle of it and blamed
 * the relay, which is the very failure this file exists to stop. The reason the silence is legitimate is the
 * one thing a per-tenant credential CANNOT see: the queue delaying the café belonged to the OTHER tenant —
 * 32 018 storefront invalidations, 31 880 availability rows and 37 458 catalogue projections, all forgeco's.
 * Nothing published by this box says "the relay is behind": not `/health` (`{status, service, extensions}`),
 * not any `internal/*` face. Step 10b works around it with the NOTIFICATION queue, and that proxy is blind
 * exactly here — measured: forgeco wrote 17-30 notifications a minute through the whole window and the café
 * wrote ZERO, because its channel is disabled. ⇒ THE REAL FIX IS THAT THE BOX PUBLISH ITS RELAY DEPTH, and
 * until it does, a ceiling is the honest instrument. That is a slice, and it is named in CADERNO-PK29 §14.
 *
 * ★★ THE BUDGET WAS 60s AND NOT 15s, AND THE MEASUREMENT IS WHY (pk28, the birth of 09/09). The three orders
 * DID mint their contracts — they were simply not there yet at the fifteenth second. Measured on that box
 * after the failure: `ext:subscriptions:order-placed` had **717 deliveries, all `delivered`, zero errors**,
 * the three orders all carried a `customer_id`, and the three contracts existed. The relay was not broken; it
 * was BEHIND, because this same birth had just written 7 250 reviews and hundreds of orders into the outbox
 * and eight consumers were draining it.
 *
 * ⚠️⚠️ AND THAT IS WHY THE SENTENCE BELOW CHANGED. It used to name exactly two causes — "the relay is not
 * delivering" and "the order closed as a GUEST" — and on the first real failure BOTH WERE FALSE. A diagnostic
 * that offers two hypotheses and omits the true one is worse than none: it sends the reader to check a relay
 * that is fine. The third cause is "it has not arrived yet", and it is the likeliest one on a birth.
 *
 * @param wanted the order ids that must each have produced a contract
 */
export async function awaitContracts({ read, log, wanted, polls = 300, waitMs = 2_000, sleep }) {
  const nap = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  // ★★ A WAIT THAT IS ASKED TO WATCH FOR NOTHING SAYS SO, INSTEAD OF WATCHING FOREVER AND BLAMING THE RELAY.
  // Measured on the birth of 2026-09-09: `placeOrder`'s re-run branch returned a row with no `order_id`, so
  // this was called with `[undefined, undefined, undefined]` — and a `Set` collapses those into ONE. The
  // refusal then said `1 of 3 order(s) produced no contract: .` — a count that contradicts the sentence
  // beside it and a list that names nobody — and pointed the reader at a relay that was healthy. The caller's
  // defect is fixed (`seed/commerce.mjs`); this is the half that makes the NEXT one loud instead of confusing.
  const blank = wanted.filter((id) => typeof id !== 'string' || id === '').length;
  if (blank > 0)
    throw new Error(
      `subscriptions — ${blank} of ${wanted.length} order id(s) handed to the contract wait are not ids. ` +
        'This is NOT a relay problem and no amount of waiting fixes it: whoever placed the orders returned ' +
        'something without `order_id`. Note that a Set collapses repeated blanks, so the count of "missing" ' +
        'orders further down would UNDERSTATE it and name nobody.',
    );
  const missing = new Set(wanted);
  const waited = () => Math.round((attemptsMade * waitMs) / 1000);
  let attemptsMade = 0;
  let held = [];
  for (let attempt = 0; attempt <= polls; attempt += 1) {
    if (attempt > 0) {
      await nap(waitMs);
      attemptsMade += 1;
    }
    held = (await read('internal/extension_records', { extension: APP, model: CONTRACT_MODEL, limit: 100 }))?.items ?? [];
    for (const row of held) missing.delete(row.origin_order_id);
    if (missing.size === 0) {
      log(`subscriptions — ${wanted.length} contract(s) minted by the app, after ${waited()}s of waiting`);
      return held;
    }
    // ★ A TEN-MINUTE CEILING THAT SAYS NOTHING IS INDISTINGUISHABLE FROM A HANG, and the operator watching a
    // birth is the one who decides whether to kill it. Every 30s the wait states what it is still short of.
    // ⚠️ It reports the ORDERS, not a spinner: "still 2 of 3" is a fact that shrinks; "waiting…" is not.
    if (attempt > 0 && attempt % Math.max(1, Math.round(30_000 / waitMs)) === 0)
      log(
        `subscriptions — still waiting on ${missing.size} of ${wanted.length} contract(s) after ${waited()}s ` +
          `(${[...missing].join(', ')}). The app mints from \`order.created\` through the outbox, and on a ` +
          'birth the relay is draining every tenant of this box, not just this one.',
      );
  }
  return { unresolved: [...missing], held };
}

/** The contract born from one order, or undefined. */
export const contractOf = (held, orderId) => held.find((row) => row.origin_order_id === orderId);

/**
 * THE STEP. Runs in the WINDOW phase, after `placeLiveOrders` — it needs the same three things that pass
 * needs (a catalogue a cart can hold, logistics `place_order` demands, a payment app) plus one more that
 * only the coffee phase supplies: the `subscriptions` app installed, which is what materializes `sub_plan`.
 *
 * ⚠️ `buyerEmail` IS INJECTED RATHER THAN IMPORTED, and that is not ceremony: `seed/commerce.mjs` calls this
 * function, so importing its address helper back would close a cycle between the two modules. One author of
 * the address shape, one direction of dependency.
 *
 * ⚠️ `sleep` IS INJECTED FOR THE SAME REASON AND ONLY FOR THE TESTS. The wait below is a MINUTE on a birth
 * (see `awaitContracts`), so the refusal it produces — the sentence a person reads when no contract arrives —
 * could not be driven end to end without either shortening the real budget or waiting a real minute per run.
 * Undefined here is the seed's own timer, which is what every caller of this file passes.
 *
 * @param port {{ stores, read, log, fail, action, placeOrder, buyerEmail, sleep? }}
 */
export async function signSubscriptions({ stores, read, log, fail, action, placeOrder, buyerEmail, sleep }) {
  const store = stores.find((s) => s.handle === STORE_HANDLE);
  if (!store) {
    log(`subscriptions — the "${STORE_HANDLE}" store is not on this tenant; nothing to sign`);
    return;
  }
  const installed = (await read('internal/installed_extensions')) ?? [];
  if (!installed.some((e) => e.extension_id === APP && e.status === 'active')) {
    // Not a failure: `seed/coffee.mjs` is what installs it, and a run against a tenant without the café is
    // legitimately without the app.
    log(`subscriptions — the ${APP} app is not installed on this tenant; nothing to sign`);
    return;
  }

  // ── the offer, read off the box ──────────────────────────────────────────────────────────────────────
  const offered = offeredRhythms(await read('internal/extension_config', { extension: APP }));
  if (offered) {
    const unsellable = SUBSCRIBERS.filter((s) => !offered.includes(s.plan)).map((s) => s.plan);
    if (unsellable.length > 0)
      fail(
        `subscriptions — this store offers [${offered.join(', ')}] and the seed wants to sign ` +
          `[${unsellable.join(', ')}]. A contract on a rhythm the product page cannot sell is a screen that ` +
          'contradicts the shop beside it. Change SUBSCRIBERS, or change the offer.',
      );
    log(`subscriptions — the store offers [${offered.join(', ')}], stored`);
  } else {
    log(`subscriptions — the store stores no rhythm offer; the app's own default applies`);
  }

  // ── the orders ───────────────────────────────────────────────────────────────────────────────────────
  const signed = [];
  for (const [index, subscriber] of SUBSCRIBERS.entries()) {
    const order = await placeOrder({
      store,
      buyer: { name: subscriber.name, email: buyerEmail(subscriber.tag) },
      what: `subscription · ${subscriber.plan}`,
      pickSku: (products) => pickSubscribableSku(products, index),
      customFields: { [PLAN_FIELD]: subscriber.plan },
    });
    if (!order) {
      // The journey logs its own reason. This one is worth a second line because the CAUSE is almost always
      // the curation mark, and that is a different file's defect.
      fail(
        `subscriptions — ${subscriber.name} could not sign. If the reason above is "publishes nothing ` +
          'sellable this order could hold", NO published sku of this shop carries `metadata.sub_enabled` — ' +
          'the mark `seed/coffee.mjs` writes never landed, and the product pages are drawing no plan picker ' +
          'either.',
      );
      // ⚠️ `fail` IS TERMINAL IN THE REAL SEED (`bin/seed.mjs` exits) and THROWS in the tests, so nothing
      // reaches this line today. It is here so that a future `fail` that merely reports cannot turn a
      // refusal into a `null.order_id` five lines down — the crash would be about the wrong thing.
      return;
    }
    signed.push({ ...subscriber, order });
  }

  // ── the contracts, which are the APP's to create ─────────────────────────────────────────────────────
  const outcome = await awaitContracts({
    read,
    log,
    wanted: signed.map((s) => s.order.order_id),
    sleep,
  });
  if (outcome.unresolved) {
    fail(
      `subscriptions — ${outcome.unresolved.length} of ${signed.length} order(s) produced no contract: ` +
        `${outcome.unresolved.join(', ')}. The app mints one from \`order.created\` through the outbox. ` +
        'THREE things produce this, and they are checked in this order because that is how likely they are ' +
        'on a birth: (1) the relay is still BEHIND — this seed writes thousands of events and eight ' +
        'consumers drain them, so look at `event_delivery` for `ext:subscriptions:order-placed` before ' +
        'anything else; a row per order with status `delivered` means it arrived and the contract is coming; ' +
        '(2) the relay is not running at all — then there are no rows for that consumer; (3) the order closed ' +
        'as a GUEST — `order-placed.ts` returns without minting when the order carries no customer_id.',
    );
    return; // see the note above on `fail` being terminal
  }
  const held = outcome;

  // ── the states, reached by the app's own actions ──────────────────────────────────────────────────────
  let moved = 0;
  for (const subscriber of signed) {
    const contract = contractOf(held, subscriber.order.order_id);
    const wantedAction = ACTION_FOR[subscriber.state];
    if (!wantedAction) continue;
    if (contract.status === subscriber.state) {
      log(`subscriptions — ${subscriber.name}'s contract is already ${subscriber.state}`);
      continue;
    }
    const outcome = await action(APP, wantedAction, { id: contract.id });
    // ★★ THE STEP READS THE ANSWER INSTEAD OF COUNTING THE CALL. On 2026-09-09 this line was
    // `await action(...); moved += 1;` and it reported "2 moved off active" while the box held `active=2`:
    // `cancel_contract` declares a confirmation phrase, the gate answered **200** with
    // `{ needs_confirmation: true }`, and a step that counts calls cannot tell that from a run. The app's own
    // refusals travel the same way — `{ refused: true, reason: 'unknown_contract' | 'contract_canceled' }` —
    // so this one check covers both, and the message names the contract rather than the count.
    if (outcome?.needs_confirmation)
      fail(
        `subscriptions — \`${wantedAction}\` on ${subscriber.name}'s contract came back asking for the ` +
          `phrase "${outcome.confirm_phrase ?? '?'}" instead of running. The seed answers that gate ` +
          '(`appAction`), so reaching here means the answer did not travel — check that the second POST ' +
          'carries `phrase`.',
      );
    if (outcome?.refused)
      fail(
        `subscriptions — \`${wantedAction}\` refused ${subscriber.name}'s contract: ` +
          `${outcome.reason ?? 'no reason given'}. The contract is ${contract.status} and the seed wants it ` +
          `${subscriber.state}.`,
      );
    moved += 1;
  }
  // ⚠️ AND THE LINE BELOW USED TO BE THE ONLY WITNESS, WHICH IS WHY IT LIED FOR A WHOLE BIRTH. It prints what
  // the seed WANTED (`s.state`, off SUBSCRIBERS) next to a count of calls it made. Both were true and the box
  // still disagreed. Step 12 (`verify-seed`) is what caught it, three steps later. The re-read below makes
  // this step answer for itself.
  const after = (await read('internal/extension_records', { extension: APP, model: CONTRACT_MODEL, limit: 100 }))?.items ?? [];
  const wrong = signed
    .map((s) => ({ s, got: after.find((r) => r.origin_order_id === s.order.order_id)?.status }))
    .filter(({ s, got }) => got !== s.state);
  if (wrong.length > 0)
    fail(
      `subscriptions — ${wrong.length} contract(s) did not reach the state the seed declares: ` +
        `${wrong.map(({ s, got }) => `${s.name} is ${got ?? 'gone'}, wanted ${s.state}`).join(' · ')}. ` +
        'The actions were invoked and reported no refusal, so the app accepted them and the record did not ' +
        'move — read this app\'s runs (`internal/extension_runs`) before anything else.',
    );
  log(
    `subscriptions — ${signed.length} contract(s) in the café: ` +
      `${signed.map((s) => `${s.name} ${s.plan}/${s.state}`).join(' · ')}` +
      `${moved > 0 ? ` (${moved} moved off \`active\` by the app's own actions)` : ''}`,
  );
}

// ★★ THE CAFÉ'S SUBSCRIPTIONS — `node --test seed/subscriptions.test.mjs` (or: `bash bin/test.sh`).
//
// ── WHAT THIS FILE GRADES, AND THE DEFECT IT WAS WRITTEN FROM ────────────────────────────────────────────
//
// Measured on the live bench of 2026-09-08: `select count(*) from <subscriptions schema>.contract` answered
// ZERO, in both app schemas, on a box whose coffee shop had been offering subscriptions for days. The offer
// was complete — five coffees marked `sub_enabled`, both subscriber perks created, the plan picker drawn on
// every one of those product pages — and the REGISTER was empty, so the admin's home card
// (`latest_subscriptions`) and the app's own screen showed nothing at all.
//
// ⇒ The rules below are about the DECLARATION (who signs what, in which state) and about the SEAM (the plan
//   rides a cart line, the contract is the app's to mint, the states are reached by the app's own actions).
//   What the box actually holds afterwards is `bin/verify-seed.mjs`'s question, not this file's.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_FOR,
  APP,
  awaitContracts,
  CONTRACT_MODEL,
  contractOf,
  offeredRhythms,
  pickSubscribableSku,
  PLAN_FIELD,
  signSubscriptions,
  STORE_HANDLE,
  SUBSCRIBERS,
} from './subscriptions.mjs';

/** The app's whole closed lifecycle, as `extensions/subscriptions/model.ts` declares it. Written here
 *  because this repository cannot import the app; it is three words and they are the ones the ficha prints. */
const STATUSES = ['active', 'paused', 'canceled'];

// ── the declaration ──────────────────────────────────────────────────────────────────────────────────────

test('★★★ THE SEED SIGNS AT LEAST ONE SUBSCRIPTION — an empty list is the empty widget, by name', () => {
  // ⛔ THE SABOTAGE THIS EXISTS FOR: empty `SUBSCRIBERS`, or delete the step. Everything else in the seed
  // stays green — the coffees are marked, the perks are created, the picker renders — and the OPERATOR's
  // half of the demo is a blank card. That is the state measured on 08/09 and it went unnoticed for days,
  // because nothing anywhere asked this question.
  assert.ok(
    Array.isArray(SUBSCRIBERS) && SUBSCRIBERS.length > 0,
    'the seed declares NO subscription. The admin home\'s `latest_subscriptions` card — the app\'s own ' +
      'widget, and the whole demonstration of "an app puts a card on the home reading its own data" — ' +
      'renders EMPTY, and so does Apps → Assinaturas and every contract ficha behind it. A shop that offers ' +
      'a subscription nobody ever signed proves the offer and nothing else.',
  );
});

test('★★ the three states of the ficha are all present — one active row proves the widget, not the vocabulary', () => {
  // ⚠️ WHY THREE AND NOT ONE. `active` alone renders the card and teaches an operator nothing: the status
  // filter has one value in it, the ficha shows one word, and "paused" and "cancelled" are indistinguishable
  // from "not implemented". The app's set is closed at three, so three is also the whole of it.
  const seeded = new Set(SUBSCRIBERS.map((s) => s.state));
  assert.deepEqual(
    [...seeded].sort(),
    [...STATUSES].sort(),
    `the seeded states are [${[...seeded].join(', ')}] and the app declares [${STATUSES.join(', ')}]`,
  );
});

test('⛔ no state is INVENTED — every one of them is the app\'s, and reachable by a declared action', () => {
  // The rule that keeps the demo honest about the engine: a status this seed could not produce by driving
  // the app would have to be written into the app's schema by hand, which is the second write path the whole
  // architecture refuses.
  for (const subscriber of SUBSCRIBERS) {
    assert.ok(STATUSES.includes(subscriber.state), `"${subscriber.state}" is not one of the app's three states`);
    assert.ok(
      Object.hasOwn(ACTION_FOR, subscriber.state),
      `nothing says how to reach "${subscriber.state}" — see ACTION_FOR`,
    );
  }
  // …and the birth state is the one with no action, because that is what "birth state" means.
  assert.equal(ACTION_FOR.active, null);
  assert.equal(ACTION_FOR.paused, 'pause_contract');
  assert.equal(ACTION_FOR.canceled, 'cancel_contract');
});

test('★ the rhythms are DIFFERENT — three contracts on one rhythm show one row three times', () => {
  const plans = SUBSCRIBERS.map((s) => s.plan);
  assert.equal(new Set(plans).size, plans.length, `two subscribers share a rhythm: ${plans.join(', ')}`);
});

test('⛔ every contact detail is FICTIONAL and every tag is unique — the key is the address', () => {
  // ⛔ THIS DATASET SHIPPED THE OWNER'S PERSONAL ADDRESS ONCE, IN FIFTEEN FILES. The addresses are minted by
  // `seed/commerce.mjs`'s `buyerEmail` as plus-tags on the one mailbox this box owns, so what is graded here
  // is the half this file decides: the tag. A duplicate tag is a duplicate address, and the address is the
  // idempotence key — two subscribers sharing one would make the second run recognise the first's order and
  // sign only one contract, in silence.
  const tags = SUBSCRIBERS.map((s) => s.tag);
  assert.equal(new Set(tags).size, tags.length, `two subscribers share a tag: ${tags.join(', ')}`);
  for (const subscriber of SUBSCRIBERS) {
    assert.match(subscriber.tag, /^[a-z]+\.[a-z]+$/, `"${subscriber.tag}" is not a plain first.last tag`);
    assert.ok(!subscriber.tag.includes('@'), 'a tag is not an address — the mailbox is commerce.mjs\'s to decide');
    assert.match(subscriber.name, /\S+\s+\S+/, 'the admin shows this name beside three hundred real-looking ones');
  }
});

test('★ the store is the CAFÉ, and the seam is the app\'s own declared line field', () => {
  // His correction, 08/09: «é o de café que exercita assinatura, o de tênis não é pra demo vir instalado
  // assinatura». And `sub_plan` is the app's key, not this repository's invention.
  assert.equal(STORE_HANDLE, 'cafe');
  assert.equal(PLAN_FIELD, 'sub_plan');
  assert.equal(APP, 'subscriptions');
  assert.equal(CONTRACT_MODEL, 'contract');
});

// ── the offer ────────────────────────────────────────────────────────────────────────────────────────────

test('the stored offer is read as a comma list; nothing stored is null, never an empty offer', () => {
  assert.deepEqual(offeredRhythms({ config: { frequencies: 'weekly,monthly' } }), ['weekly', 'monthly']);
  assert.deepEqual(offeredRhythms({ frequencies: ' weekly , biweekly ' }), ['weekly', 'biweekly']);
  // 404 → `commerceRead` answers null, and the app then serves its own defaults. "Nothing stored" and "an
  // offer of nothing" are opposite facts and only one of them is a reason to refuse.
  assert.equal(offeredRhythms(null), null);
  assert.equal(offeredRhythms({ config: { frequencies: '' } }), null);
});

// ── the curation boundary ────────────────────────────────────────────────────────────────────────────────

const coffee = (handle, id, marked) => ({
  handle,
  skus: [{ id, status: 'active', metadata: marked ? { sub_enabled: true } : {} }],
});

test('★★ an UNMARKED coffee is never signed — the curation boundary is the whole proof of curation', () => {
  // ⛔ THE ONE THAT WOULD READ AS A FEATURE. `seed/coffee.mjs` marks five of six and leaves the Edição do
  // Produtor out on purpose («default nasce falso e o lojista faz a curadoria manual»). A subscription
  // against that coffee puts a contract in the admin for a product page that refuses to sell one — the
  // boundary demonstrating its own absence.
  const shop = [coffee('forge-alvorada', 'sku_a', true), coffee('forge-edicao-do-produtor', 'sku_z', false)];
  for (let i = 0; i < 6; i += 1) {
    assert.equal(pickSubscribableSku(shop, i).id, 'sku_a');
  }
});

test('★★ it derives the marked list from the SHOP, so a mark that never landed is a refusal and not a wrong sku', () => {
  // ⚠️ THE A46 LESSON IN THE FILE THAT COULD REPEAT IT. `markSubscribable` once wrote ZERO marks in silence
  // (it walked a projection that had not received the products yet). A picker holding a typed handle would
  // sail straight past that and sign a SKU carrying no mark; this one answers null, and the step turns that
  // into a sentence naming the cause.
  assert.equal(pickSubscribableSku([coffee('forge-alvorada', 'sku_a', false)], 0), null);
  assert.equal(pickSubscribableSku([], 0), null);
});

test('★ different subscribers get different coffees, and the same one every rebuild', () => {
  // The public read promises no order, so a demo whose three subscriptions change coffee on every rebuild is
  // a demo nobody can screenshot twice.
  const shop = [coffee('c', 'sku_c', true), coffee('a', 'sku_a', true), coffee('b', 'sku_b', true)];
  assert.deepEqual([0, 1, 2].map((i) => pickSubscribableSku(shop, i).id), ['sku_a', 'sku_b', 'sku_c']);
  const shuffled = [shop[2], shop[0], shop[1]];
  assert.deepEqual([0, 1, 2].map((i) => pickSubscribableSku(shuffled, i).id), ['sku_a', 'sku_b', 'sku_c']);
});

// ── the wait ─────────────────────────────────────────────────────────────────────────────────────────────

test('★★ the contract is the APP\'s to mint, so the step WAITS — and says what is still missing', () => {
  // ⚠️ AT-LEAST-ONCE, THROUGH THE OUTBOX. `place_order` answers before `ext:subscriptions:order-placed` has
  // run, so a step that read the records straight after placing would find nothing and be right about the
  // instant and wrong about the box.
  const rows = [];
  const read = async () => ({ items: rows });
  return awaitContracts({ read, log: () => {}, wanted: ['ord_1'], polls: 2, waitMs: 0, sleep: async () => {
    // the app catches up between the first poll and the second
    rows.push({ id: 'sub_1', origin_order_id: 'ord_1', status: 'active' });
  } }).then((held) => {
    assert.ok(Array.isArray(held), 'a contract that arrived late should still resolve');
    assert.equal(contractOf(held, 'ord_1').id, 'sub_1');
  });
});

test('⛔ a contract that never arrives is UNRESOLVED, never an empty success', async () => {
  // The failure this shape prevents: three orders placed, no contract minted (the relay is down, or the
  // order closed as a guest and `order-placed.ts` returned without minting), and a seed that reports done.
  const outcome = await awaitContracts({
    read: async () => ({ items: [] }),
    log: () => {},
    wanted: ['ord_1', 'ord_2'],
    polls: 1,
    waitMs: 0,
    sleep: async () => {},
  });
  assert.deepEqual(outcome.unresolved, ['ord_1', 'ord_2']);
});

// ★★★ pk29/D1 — THE BUDGET AND THE SENTENCE, WHICH ARE THE TWO HALVES OF THE 09/09 FAILURE.
//
// The birth of 2026-09-09 stopped here: `awaitContracts` gave up at the fifteenth second and reported "no
// contract", naming two causes — a relay that is not delivering, and a guest checkout. Measured on that box
// minutes later, BOTH WERE FALSE: `ext:subscriptions:order-placed` had 717 deliveries, all `delivered`, zero
// errors; the three orders each carried a `customer_id`; and the three contracts EXISTED. The relay was not
// broken, it was BEHIND — the same birth had just written 7 250 reviews and hundreds of orders into the
// outbox for eight consumers to drain.
//
// `8517dc9` widened the budget and rewrote the sentence and shipped NEITHER with a test, which is what these
// two rules are. They grade the two things that failed, and they grade them the way the box experiences them:
// the budget is MEASURED by summing what the wait asks to sleep (never read off the signature), and the
// sentence is read off a REFUSAL driven end to end.

test('★★★ the DEFAULT budget outlives the backlog the same birth writes — 15s is where it died', async () => {
  // ⛔ NO `polls`/`waitMs` OVERRIDE. Every other rule here passes its own budget, so all of them were green
  // on the day the default was too short: the default is the thing that runs on a birth and the only thing
  // this rule is about. It is measured rather than read — `sleep` is handed the interval, so summing what the
  // wait ASKS FOR is the box's own answer to "how long does this step give the app?".
  let budgetMs = 0;
  const outcome = await awaitContracts({
    read: async () => ({ items: [] }),
    log: () => {},
    wanted: ['ord_1'],
    sleep: async (ms) => {
      budgetMs += ms;
    },
  });
  assert.ok(outcome.unresolved, 'a contract that never arrives must still be UNRESOLVED');
  assert.ok(
    budgetMs >= 60_000,
    `this step gives the app ${budgetMs / 1000}s. The birth of 2026-09-09 failed at the FIFTEENTH second ` +
      'with all three contracts already on their way: the relay was draining an outbox this same birth had ' +
      'just filled with 7 250 reviews and hundreds of orders, for eight consumers. A budget under a minute ' +
      'is a step that reports a broken relay because the box was busy.',
  );
});

test('★★★ …and a contract that lands PAST the old budget still resolves, on the default', async () => {
  // The concrete shape of the failure: the app minted it, just not by second fifteen. At second forty the
  // old budget had already given up and the new one has not.
  const LATE = 40;
  const rows = [];
  let naps = 0;
  const held = await awaitContracts({
    read: async () => ({ items: rows }),
    log: () => {},
    wanted: ['ord_1'],
    sleep: async () => {
      naps += 1;
      if (naps === LATE) rows.push({ id: 'sub_1', origin_order_id: 'ord_1', status: 'active' });
    },
  });
  assert.ok(
    Array.isArray(held),
    `a contract minted at second ${LATE} was reported as never minted — the default budget gave up first`,
  );
  assert.equal(contractOf(held, 'ord_1').id, 'sub_1');
  assert.equal(naps, LATE, 'it kept polling after the contract arrived, or stopped before it did');
});

// ── the step, driven end to end against a fake port ──────────────────────────────────────────────────────

/** A port that records every gesture. The contracts appear the moment an order is placed, which is what the
 *  app's script really does — just without the outbox in between. */
function fakePort({ installed = true, stored = null, statusOf = () => 'active', mints = true } = {}) {
  // `statusOf(index)` is the status the contract is BORN with in this fixture — 'active' for a first run,
  // and each subscriber's declared state for the "second run" case, which is the page the first run leaves.
  const calls = { orders: [], actions: [], failed: null };
  const contracts = [];
  return {
    calls,
    contracts,
    port: {
      stores: [{ handle: 'cafe', id: 'sto_cafe' }],
      log: () => {},
      fail: (message) => {
        calls.failed = message;
        throw new Error(message);
      },
      buyerEmail: (tag) => `hi+${tag}@forgecommerce.pro`,
      read: async (name) => {
        if (name === 'internal/installed_extensions')
          return installed ? [{ extension_id: 'subscriptions', status: 'active' }] : [];
        if (name === 'internal/extension_config') return stored;
        if (name === 'internal/extension_records') return { items: contracts };
        throw new Error(`the step asked for a read the fake port does not serve: ${name}`);
      },
      action: async (app, name, input) => {
        calls.actions.push({ app, name, input });
        const row = contracts.find((c) => c.id === input.id);
        row.status = name === 'pause_contract' ? 'paused' : 'canceled';
      },
      placeOrder: async (args) => {
        calls.orders.push(args);
        const order_id = `ord_${calls.orders.length}`;
        // `mints: false` is the box of 09/09: the orders are placed and no contract ever appears within the
        // budget. It is the only way to reach the refusal, and the refusal is a sentence somebody has to read.
        if (!mints) return { order_id, number: calls.orders.length };
        contracts.push({
          id: `sub_${calls.orders.length}`,
          origin_order_id: order_id,
          status: statusOf(calls.orders.length - 1),
        });
        return { order_id, number: calls.orders.length };
      },
    },
  };
}

test('★★★ the whole gesture: one order per subscriber, the PLAN on the line, and the states reached by ACTIONS', async () => {
  const { port, calls } = fakePort();
  await signSubscriptions(port);

  assert.equal(calls.orders.length, SUBSCRIBERS.length);
  for (const [i, subscriber] of SUBSCRIBERS.entries()) {
    const order = calls.orders[i];
    assert.equal(order.store.handle, 'cafe', 'a subscription was signed in the wrong shop');
    assert.equal(order.buyer.name, subscriber.name);
    assert.equal(order.buyer.email, `hi+${subscriber.tag}@forgecommerce.pro`);
    // ⚠️ THE SEAM, ASSERTED. Without this key the kernel freezes an ordinary line, the app's script finds no
    // plan on the order and mints nothing — three orders, zero contracts, and every log line green.
    assert.deepEqual(order.customFields, { [PLAN_FIELD]: subscriber.plan });
  }

  // The two that are not `active` are moved by the app's own actions, and the one that is, is not touched.
  assert.deepEqual(
    calls.actions.map((a) => [a.app, a.name]),
    [
      ['subscriptions', 'pause_contract'],
      ['subscriptions', 'cancel_contract'],
    ],
  );
});

test('★★ a second run over the state the first produced runs NO action — the states are already right', async () => {
  // ⚠️ THE HALF THAT WOULD CHURN. `cancel_contract` is declared `destructive`; re-running it on every seed
  // would write an audit row per run forever, and on a bench somebody is testing on it would fight whatever
  // an operator had just done by hand. (The orders themselves are recognised one layer down, by the buyer's
  // address — `placeOneOrder` in `seed/commerce.mjs`.)
  const { port, calls } = fakePort({ statusOf: (index) => SUBSCRIBERS[index].state });
  await signSubscriptions(port);
  assert.equal(calls.orders.length, SUBSCRIBERS.length);
  assert.deepEqual(calls.actions, []);
});

test('★ a tenant WITHOUT the app is a no-op with a line, never a failure — the shoe brand has no subscriptions', async () => {
  // `seed/coffee.mjs` installs it for the coffee tenant alone, on his instruction. A run against `forgeco`
  // must not die on the app being legitimately absent.
  const { port, calls } = fakePort({ installed: false });
  await signSubscriptions(port);
  assert.deepEqual(calls.orders, []);
  assert.equal(calls.failed, null);
});

test('★ a tenant without the CAFÉ is a no-op too — the store list is the credential\'s', async () => {
  const { port, calls } = fakePort();
  port.stores = [{ handle: 'forge', id: 'sto_forge' }];
  await signSubscriptions(port);
  assert.deepEqual(calls.orders, []);
  assert.equal(calls.failed, null);
});

test('⛔ a rhythm the STORE does not offer is refused by name, before a single order is placed', async () => {
  // The invisible failure: a contract on a rhythm the shop stopped offering renders perfectly in the admin
  // and cannot be signed by any shopper on the PDP beside it. The offer is READ, so this cannot be right by
  // accident.
  const { port, calls } = fakePort({ stored: { config: { frequencies: 'weekly' } } });
  await assert.rejects(() => signSubscriptions(port));
  assert.match(calls.failed, /this store offers \[weekly\]/);
  assert.deepEqual(calls.orders, [], 'it placed an order before checking the offer');
});

test('★★★ pk29/D1 — the refusal names the TABLE to look in, and offers the TRUE cause FIRST', async () => {
  // ★ THE LESSON THIS RULE PINS: *a diagnostic that lists two hypotheses and omits the true one is worse than
  // none — it sends the reader to check a relay that is fine.* On 09/09 this sentence named exactly two
  // causes, "the relay is not delivering" and "the order closed as a GUEST", and on the first real failure
  // BOTH WERE FALSE. What was true was a THIRD thing the sentence did not mention: the relay was behind.
  //
  // ⚠️ IT IS DRIVEN, NOT GREPPED. The message is produced by a run that really places three orders and really
  // gets no contract, which is what makes this rule notice a refusal that stops being reached at all.
  const { port, calls } = fakePort({ mints: false });
  await assert.rejects(() => signSubscriptions({ ...port, sleep: async () => {} }));
  const said = calls.failed;

  // The evidence, by name. A reader told "the relay may be behind" and not told WHERE to look is a reader
  // who checks the relay's logs — which is exactly the trip this sentence exists to save.
  assert.match(
    said,
    /event_delivery/,
    'the refusal does not name `event_delivery`, the table that answers "has it arrived yet?" — without it ' +
      'the likeliest cause is a hypothesis the reader cannot check.',
  );
  assert.match(
    said,
    /ext:subscriptions:order-placed/,
    'the refusal does not name the CONSUMER whose rows to read; `event_delivery` has one row per consumer ' +
      'per event and this seed drives eight of them.',
  );

  // ⛔ AND THE ORDER IS THE CLAIM. "Three causes" in the wrong order is the same defect in a longer sentence:
  // the reader works down the list and the first thing they do is still the wrong one.
  const behind = said.indexOf('BEHIND');
  const dead = said.search(/not running/);
  const guest = said.indexOf('GUEST');
  assert.ok(behind >= 0 && dead >= 0 && guest >= 0, `one of the three causes is missing: ${said}`);
  assert.ok(
    behind < dead && dead < guest,
    'the causes are not in the order they are likely on a birth. The one that actually happened — the relay ' +
      'BEHIND a backlog this same seed wrote — has to come first, before "the relay is not running" and ' +
      'before "the order closed as a guest".',
  );
});

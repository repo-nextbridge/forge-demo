// The commerce module's own tests — `node --test 'seed/**/*.test.mjs'`, the runner the other seed modules use.
//
// WHAT IS WORTH TESTING HERE, and it is deliberately not "the box sells". That is proven by running the seed
// against a box and counting, which the slice report does. What a run CANNOT prove is the class of defect
// this slice had to design around — the write that is wrong SILENTLY, or the one whose damage lands in
// somebody's inbox:
//
//   · a seed that turns OFF `auth.*` — the box where nobody can log in, and the seed exits green;
//   · a seed that enables the buyer's order mail BEFORE it seeds orders — dozens of real e-mails, and the
//     only evidence is in a mailbox nobody is reading yet;
//   · a "verified" review with no order behind it — the badge becomes decoration, which is the exact lie an
//     earlier slice already had to kill;
//   · the counter re-armed with buyer mail — a totem that e-mails, when the number is called at the counter.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BUYER_ORDER_TYPES,
  SILENT_STORE_HANDLES,
  appsNotInstalled,
  assertCredentialTenant,
  assertSeedableChannel,
  channelPlan,
  REVIEW_DOORS,
  reviewDoorFor,
  reviewSplit,
  storesWithReviews,
  seedCommerce,
  silenceBuyerChannels,
  sellingStores,
  SEED_NOISE_TYPES,
} from './commerce.mjs';

const STORES = [
  { handle: 'forge', id: 'sto_forge' },
  { handle: 'outlet', id: 'sto_outlet' },
  { handle: 'cafe', id: 'sto_cafe' },
  { handle: 'balcao', id: 'sto_balcao' },
];

// ── ⛔ THE ONE THE WAVE ASKED FOR BY NAME ────────────────────────────────────────────────────────────────
test('the seed REFUSES to touch an auth.* channel, by construction', () => {
  for (const key of ['auth.customer_code', 'auth.operator_code', 'auth.operator_invite']) {
    assert.throws(
      () => assertSeedableChannel(key),
      /auth\./,
      `${key} must be refused: turning it off fabricates a box nobody can enter`,
    );
  }
});

test('and it refuses the whole namespace, not the three keys that exist today', () => {
  assert.throws(() => assertSeedableChannel('auth.something_invented_next_month'), /auth\./);
});

test('an order.* channel is allowed — the refusal is a prefix rule, not a deny-list of everything', () => {
  for (const key of BUYER_ORDER_TYPES) assert.doesNotThrow(() => assertSeedableChannel(key));
});

test('every type the seed toggles really is a buyer order message', () => {
  for (const key of BUYER_ORDER_TYPES) assert.match(key, /^order\./);
});

// ── ⛔ THE ORDER THAT KEEPS THE MAILBOX EMPTY ────────────────────────────────────────────────────────────
test('the OFF pass covers every selling store and every buyer order type', () => {
  const off = channelPlan(STORES, { enabled: false });
  for (const store of STORES)
    for (const type of BUYER_ORDER_TYPES)
      assert.ok(
        off.some((r) => r.store_id === store.id && r.type_key === type && r.enabled === false),
        `${store.handle} / ${type} must be silenced before any order is seeded`,
      );
});

test('★ the ON pass SKIPS the counter — a totem does not e-mail, the number is called at the counter', () => {
  const on = channelPlan(STORES, { enabled: true });
  assert.equal(
    on.some((r) => r.store_id === 'sto_balcao'),
    false,
    'the counter must never be re-armed with buyer mail',
  );
  for (const handle of SILENT_STORE_HANDLES)
    assert.ok(STORES.some((s) => s.handle === handle), `${handle} should be a real store`);
});

test('the ON pass DOES re-arm every store that is not silent', () => {
  const on = channelPlan(STORES, { enabled: true });
  for (const store of STORES.filter((s) => !SILENT_STORE_HANDLES.includes(s.handle)))
    for (const type of BUYER_ORDER_TYPES)
      assert.ok(on.some((r) => r.store_id === store.id && r.type_key === type && r.enabled === true));
});

test('no pass ever emits an auth.* row, whatever the store list says', () => {
  for (const enabled of [true, false])
    for (const row of channelPlan(STORES, { enabled }))
      assert.equal(row.type_key.startsWith('auth.'), false);
});

// ── the stores that actually take an order ───────────────────────────────────────────────────────────────
test('the counter sells, and is therefore in the selling list even though it is silent', () => {
  // Silence is about MAIL, not about commerce. Conflating the two would leave the counter untested.
  const handles = sellingStores(STORES).map((s) => s.handle);
  assert.ok(handles.includes('balcao'));
  assert.deepEqual(handles.sort(), ['balcao', 'cafe', 'forge', 'outlet']);
});

// ── ⭐ THE BADGE HAS TO BE TRUE ──────────────────────────────────────────────────────────────────────────
test('a verified review ALWAYS carries the order it was earned by', () => {
  const split = reviewSplit([
    { handle: 'a', rating: 5, body: 'x', order_id: 'ord_1' },
    { handle: 'b', rating: 4, body: 'y' },
    { handle: 'c', rating: 3, body: 'z' },
  ]);
  for (const r of split.verified) assert.ok(r.order_id, 'a verified review with no order is the lie');
});

test('an OPEN review never claims an order — no badge, and that is correct', () => {
  const split = reviewSplit([
    { handle: 'a', rating: 5, body: 'x', order_id: 'ord_1' },
    { handle: 'b', rating: 4, body: 'y' },
  ]);
  for (const r of split.open) assert.equal(r.order_id, undefined);
});

test('the verified ones are the MINORITY — they are expensive, and that is the point', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    handle: `h${i}`,
    rating: 5,
    body: 'x',
    ...(i < 2 ? { order_id: `ord_${i}` } : {}),
  }));
  const split = reviewSplit(rows);
  assert.ok(split.verified.length < split.open.length);
  assert.equal(split.verified.length + split.open.length, rows.length);
});

// ── ⛔ THE COUNTER SENDS NOTHING AT ALL — his word was "as mensagens", not "as do comprador" ──────────────
test('★ the counter is not re-armed for the OPERATOR notice either', () => {
  const on = channelPlan(STORES, { enabled: true });
  assert.equal(
    on.some((r) => r.store_id === 'sto_balcao'),
    false,
    'one e-mail per coffee is noise nobody reads — inverting this is one line, on purpose',
  );
});

test('the seed silences the two non-buyer types it found by READING the port', () => {
  const off = channelPlan(STORES, { enabled: false });
  for (const type of SEED_NOISE_TYPES)
    for (const store of STORES)
      assert.ok(off.some((r) => r.store_id === store.id && r.type_key === type && !r.enabled));
});

test('the other three stores DO get the operator notice back', () => {
  const on = channelPlan(STORES, { enabled: true });
  for (const handle of ['forge', 'outlet', 'cafe'])
    assert.ok(on.some((r) => r.handle === handle && r.type_key === 'order.placed.operator' && r.enabled));
});

// ── ⛔ THE WRONG CREDENTIAL ANSWERS 200 WITH THE WRONG SHOP ──────────────────────────────────────────────
test('★ a credential that cannot see the stores this run touches is refused', () => {
  // The measured case: the forgeco token, pointed at the coffee tenant, answers 200 with forge + outlet.
  assert.throws(
    () => assertCredentialTenant(['cafe', 'balcao'], [{ handle: 'forge' }, { handle: 'outlet' }]),
    /cannot see "cafe", "balcao"/,
  );
});

test('and the message names the mechanism, because the symptom looks like missing data', () => {
  assert.throws(
    () => assertCredentialTenant(['cafe'], [{ handle: 'forge' }]),
    /resolves the tenant from the CREDENTIAL and ignores/,
  );
});

test('the right credential passes', () => {
  assert.doesNotThrow(() =>
    assertCredentialTenant(['cafe', 'balcao'], [{ handle: 'cafe' }, { handle: 'balcao' }]),
  );
});

test('a credential that sees NOTHING is refused too — an empty 200 is not a pass', () => {
  assert.throws(() => assertCredentialTenant(['cafe'], []), /no stores at all/);
});

// ── ⭐ ONE OWNER, DIFFERENT DOORS PER SHOP ───────────────────────────────────────────────────────────────
test('the shoe stores use the app’s own seeder — its dataset handles really are theirs', () => {
  assert.equal(reviewDoorFor('forge'), 'app_seed_demo');
  assert.equal(reviewDoorFor('outlet'), 'app_seed_demo');
});

test('the coffee store uses the OPEN form — the platform dataset knows no coffee', () => {
  assert.equal(reviewDoorFor('cafe'), 'open_form');
});

test('★ no store anywhere is seeded through a VERIFIED door, because the product has none', () => {
  // The seal is derived by the face and refused from any body by name; the app's own seed_demo refuses to
  // write verified/order_id, with a test holding it there. A door named here would be a door that lies.
  for (const door of Object.values(REVIEW_DOORS))
    assert.ok(['app_seed_demo', 'open_form', 'none'].includes(door), `unknown door: ${door}`);
  assert.equal(Object.values(REVIEW_DOORS).includes('verified'), false);
});

test('★ the counter takes NO reviews — a totem has no product page', () => {
  assert.equal(reviewDoorFor('balcao'), 'none');
  assert.deepEqual(
    storesWithReviews(STORES).map((s) => s.handle),
    ['forge', 'outlet', 'cafe'],
  );
});

test('★ a store nobody decided about is a REFUSAL, never a default', () => {
  assert.throws(() => reviewDoorFor('loja-nova'), /no review door decided/);
  assert.throws(() => reviewDoorFor('loja-nova'), /deliberately no default/);
});

test('every store of the target topology has an explicit decision', () => {
  for (const s of STORES) assert.ok(reviewDoorFor(s.handle));
});

// ── ⛔ THE FINDING THAT DID NOT PROTECT ITS OWN AUTHOR ───────────────────────────────────────────────────
//
// `read.extensions` takes a STORE and lists block PLACEMENTS; `read.installed_extensions` is the tenant's
// installations. This module wrote that distinction down as a finding in an earlier slice and then used the
// wrong one anyway. A note in a report protects the reader, not the writer — so this is a guard.
test('★ "is it installed?" asks installed_extensions, never the placement read', async () => {
  const asked = [];
  const read = async (name) => {
    asked.push(name);
    return [{ extension_id: 'reviews', status: 'active' }];
  };
  assert.deepEqual(await appsNotInstalled(read, ['reviews']), []);
  assert.deepEqual(asked, ['internal/installed_extensions']);
});

test('it reports an app that is present but NOT active as absent', async () => {
  const read = async () => [{ extension_id: 'reviews', status: 'suspended' }];
  assert.deepEqual(await appsNotInstalled(read, ['reviews']), ['reviews']);
});

test('an unreadable answer is "absent", never a silent pass', async () => {
  const read = async () => null;
  assert.deepEqual(await appsNotInstalled(read, ['reviews']), ['reviews']);
});

test('★ and no line of the module asks the placement read for this question', () => {
  const src = readFileSync(new URL('./commerce.mjs', import.meta.url), 'utf8');
  const placementReads = [...src.matchAll(/read\(\s*'internal\/extensions'/g)];
  assert.equal(
    placementReads.length,
    0,
    "read('internal/extensions') is the per-STORE placement list — use appsNotInstalled()",
  );
});

// ── ⛔ THE GUARD HAS TO BE ABLE TO FAIL WHERE IT IS WIRED, not only where it is defined ──────────────────
//
// `assertCredentialTenant` had unit tests from the first commit and they passed — because they drive it with
// two different lists. The WIRING fed both sides from the same `read('internal/stores')` with the same
// token, so in the only place that runs it compared a list against itself. These tests exercise
// `seedCommerce` itself, which is where the mistake lived.
test('★ the silencing refuses a credential that cannot see the stores the run declares', async () => {
  const read = async (name) => (name === 'internal/stores' ? [{ handle: 'forge' }, { handle: 'outlet' }] : []);
  await assert.rejects(
    () => silenceBuyerChannels({ expect: ['cafe', 'balcao'], read, command: async () => ({}), log: () => {}, fail: (m) => { throw new Error(m); } }),
    /cannot see "cafe", "balcao"/,
  );
});

test('★ and it refuses to run at all without a stated expectation', async () => {
  await assert.rejects(
    () => silenceBuyerChannels({ read: async () => [], command: async () => ({}), log: () => {}, fail: (m) => { throw new Error(m); } }),
    /needs `expect`/,
  );
});

test('the expectation is what SELECTS the stores it works on — never the whole box', async () => {
  // A credential that can see four stores, a run declared for two: it must touch two.
  const seen = [];
  const read = async (name) => {
    if (name === 'internal/stores')
      return [{ handle: 'forge', id: 'a' }, { handle: 'outlet', id: 'b' }, { handle: 'cafe', id: 'c' }, { handle: 'balcao', id: 'd' }];
    if (name === 'internal/installed_extensions') return [{ extension_id: 'reviews', status: 'active' }];
    return [];
  };
  await silenceBuyerChannels({
    expect: ['cafe', 'balcao'],
    read,
    command: async (_n, input) => { if (input?.store_id) seen.push(input.store_id); return {}; },
    log: () => {},
    fail: (m) => { throw new Error(m); },
  });
  assert.deepEqual([...new Set(seen)].sort(), ['c', 'd']);
});

// ── ⛔ AN APP THAT WAS NEVER CONFIGURED ANSWERS 404, AND THAT IS AN ORDINARY STATE ───────────────────────
//
// Measured on a bench, per installed app: `extension_config?extension=reviews` → 200, `…=banners` → 404,
// `…=subscriptions` → 404. A fresh box has no config row for anything. The orchestrator's own `read()`
// treats every non-2xx as fatal — right for the catalogue, wrong here — so the pass takes a read whose 404
// is `null`, and falls back to the app's declared defaults exactly as the app itself does.
test('★ a missing config row is defaults, not death', async () => {
  const wrote = [];
  const read = async (name) => {
    if (name === 'internal/stores') return [{ handle: 'cafe', id: 'c' }];
    if (name === 'internal/installed_extensions') return [{ extension_id: 'reviews', status: 'active' }];
    if (name === 'internal/extension_config') return null; // never configured
    if (name === 'products') return { items: [] };
    return [];
  };
  await seedCommerce({
    expect: ['cafe'],
    read,
    command: async (n, input) => { wrote.push([n, input]); return {}; },
    log: () => {},
    fail: (m) => { throw new Error(m); },
    post: async () => ({}),
  });
  // It turned the open form ON without carrying a stored row, and put it back OFF afterwards.
  const configWrites = wrote.filter(([n]) => n === 'extension.config.set');
  assert.equal(configWrites.length, 2, 'on, then back off');
  assert.equal(configWrites[0][1].values.open_reviews, true);
  assert.equal(configWrites[1][1].values.open_reviews, false);
});

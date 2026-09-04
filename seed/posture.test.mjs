// A22 — THE CHECKOUT POSTURES, AND THE THREE THINGS THAT ARE WRONG IN SILENCE ABOUT THEM.
//
// What is worth testing here is not "the flags are booleans". It is:
//   · the CONTRAST exists at all — three shops, three answers. A box where they agree by accident
//     demonstrates nothing, and it is the state this slice found (measured 04/09: guest on everywhere);
//   · a declaration that would be silently OVERWRITTEN is refused, because the failure mode is a file that
//     says one thing while the box shows another and nothing anywhere goes red;
//   · the counter is deliberately EXCLUDED, and the reason is a measurement rather than an oversight —
//     turning guests off there would refuse every order the totem places.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CHECKOUT_FLAGS, bootstrapFlagConflicts, checkoutFlagPatch } from './posture.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const BOX = JSON.parse(readFileSync(join(SEED, 'box.json'), 'utf8'));

const tenantOf = (handle) =>
  BOX.tenants.find((t) => (t.stores ?? []).some((s) => s.handle === handle));
const storeOf = (handle) =>
  BOX.tenants.flatMap((t) => t.stores ?? []).find((s) => s.handle === handle);

/** What the columns say before anybody configures them — measured on the bench of 2026-09-04, on a store no
 *  seeder had touched (`outlet`: masked=f, guest=t). */
const DEFAULTS = { masked_checkout_enabled: false, guest_checkout_enabled: true };

/** ★ WHAT THE DATASET ONE-SHOT WRITES, and it is the THIRD writer of these columns. `configureStore`
 *  (apps/api/src/seed-storefront.ts) re-asserts both flags ON, every run, on the BOOTSTRAP store of a
 *  `dataset: true` tenant only — measured on the bench, where `forge` came out t/t and its sibling `outlet`
 *  t/f. So a store this box deliberately says nothing about is not a store at its defaults. */
const ONE_SHOT = { masked_checkout_enabled: true, guest_checkout_enabled: true };

/** A store's EFFECTIVE posture — what it will actually answer on the box, from whichever of the three
 *  writers has the last word: the declaration here, the one-shot, or the column default. */
const postureOf = (handle) => {
  const store = storeOf(handle) ?? {};
  const oneShot = tenantOf(handle)?.dataset === true && store.bootstrap === true;
  const base = oneShot ? ONE_SHOT : DEFAULTS;
  return Object.fromEntries(CHECKOUT_FLAGS.map((f) => [f, store[f] ?? base[f]]));
};

test('★★★ the three servable shops answer the checkout question THREE different ways', () => {
  // The whole value of the item is the contrast. Two shops agreeing is fine; three shops agreeing is a
  // demonstration of nothing, and that is what this box was before — every store had guest checkout on.
  const shown = ['forge', 'outlet', 'cafe'].map((h) => JSON.stringify(postureOf(h)));
  assert.equal(
    new Set(shown).size,
    3,
    `the three shops must give three different answers; they gave ${shown.join(' / ')}`,
  );
});

test('★★ and each one is the answer A22 decided, named by store', () => {
  // Spelled out rather than derived, because THIS is the decision — the table in the caderno, in code.
  assert.deepEqual(postureOf('forge'), {
    guest_checkout_enabled: true,
    masked_checkout_enabled: true,
  });
  assert.deepEqual(postureOf('outlet'), {
    guest_checkout_enabled: false,
    masked_checkout_enabled: true,
  });
  assert.deepEqual(postureOf('cafe'), {
    guest_checkout_enabled: false,
    masked_checkout_enabled: false,
  });
});

test('⛔ the COUNTER declares no posture — guest-off there refuses every order the totem places', () => {
  // MEASURED: `totem/src/lib/buyer.ts` sends `guest: true` on every counter order, and
  // `checkout.place_order` refuses a pure-guest cart with `guest_disabled` when the flag is off. So this is
  // not a store somebody forgot; it is a store the item's own table would have broken.
  const balcao = storeOf('balcao');
  assert.ok(balcao, 'seed/box.json no longer declares the counter store');
  for (const flag of CHECKOUT_FLAGS) {
    assert.equal(
      balcao[flag],
      undefined,
      `the counter declares ${flag}. Turning guest checkout off there makes the totem unable to place an ` +
        'order at all — see `_checkout_posture_why` in seed/box.json for the two measurements.',
    );
  }
  // …and the reason is WRITTEN DOWN, because a store silently absent from a decision is indistinguishable
  // from one nobody thought about.
  assert.match(String(balcao._checkout_posture_why ?? ''), /guest_disabled/);
});

test('★★ the FORGE store declares nothing either, and refusing it is mechanical', () => {
  // Step 9 owns the bootstrap store of a dataset tenant and speaks AFTER seed-box. A declaration there is
  // not a smaller mistake than a wrong value — it is a file that lies with nothing going red.
  const forgeco = BOX.tenants.find((t) => t.id === 'forgeco');
  assert.equal(forgeco.dataset, true, 'this test is about a DATASET tenant');
  assert.deepEqual(bootstrapFlagConflicts(forgeco), []);

  // …and the guard is CAPABLE OF RED, proven on a copy rather than trusted.
  const sabotaged = {
    ...forgeco,
    stores: forgeco.stores.map((s) =>
      s.bootstrap ? { ...s, masked_checkout_enabled: true } : s,
    ),
  };
  assert.deepEqual(
    bootstrapFlagConflicts(sabotaged).map((s) => s.handle),
    ['forge'],
  );
});

test('★ a NON-dataset tenant may state its bootstrap store — nobody else writes those columns', () => {
  const forgecafe = BOX.tenants.find((t) => t.id === 'forgecafe');
  assert.equal(forgecafe.dataset, false);
  assert.ok(
    forgecafe.stores.some((s) => s.bootstrap && s.guest_checkout_enabled !== undefined),
    'the coffee shop IS the case this exception exists for — it declares its own bootstrap posture',
  );
  assert.deepEqual(bootstrapFlagConflicts(forgecafe), []);
});

test('the patch is IDEMPOTENT BY VALUE — a flag already right spends no command', () => {
  const declared = { guest_checkout_enabled: false, masked_checkout_enabled: true };
  assert.deepEqual(checkoutFlagPatch(declared, { ...DEFAULTS }), {
    guest_checkout_enabled: false,
    masked_checkout_enabled: true,
  });
  assert.deepEqual(checkoutFlagPatch(declared, declared), {});
});

test('⚠️ an UNDECLARED flag is left alone — `undefined` is not `false`', () => {
  // The distinction is what lets one store's posture be owned here and its sibling's by the one-shot. A
  // patch that read absence as `false` would turn "no opinion" into "turn it off".
  assert.deepEqual(
    checkoutFlagPatch({ masked_checkout_enabled: true }, { ...DEFAULTS }),
    { masked_checkout_enabled: true },
  );
});

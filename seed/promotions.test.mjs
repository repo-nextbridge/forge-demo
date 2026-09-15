// ⛔⛔ THE ROSTER — every promotion the COFFEE BRAND carries, and the guard that keeps a rebirth from losing one.
//
// ── THE DEFECT THIS FILE EXISTS FOR, AND IT HAS NO SYMPTOM ──────────────────────────────────────────────
//
// A promotion made by clicking in the admin lives in one place: the bench's database. `bash bin/box-up.sh`
// on a virgin box replays this repository and nothing else, so a promotion nobody wrote down simply is not
// there on the next box — and NOTHING says so. The shop comes up, the screens render, the coupon the
// announcement bar advertises answers "Cupom não encontrado", and the person testing assumes they typed it
// wrong. Measured on `main` (`git grep` over `seed/`): of the four promotions the bench held, exactly ONE
// was declared. Three had been typed by hand.
//
// ── WHAT IS MEASURED HERE, AND WHY IT IS A FROZEN LIST AND NOT A DERIVATION ─────────────────────────────
//
// A guard can derive what the seed DECLARES. What it cannot derive is what the bench HOLDS — that is a
// measurement, and this is it, taken on the bench of 2026-09-03 against the coffee tenant's own schema:
//
//     select name, class, benefit->>'kind', store_id from promotion order by created_at
//     ──────────────────────────────────────────────────────────────────────────────────
//     Assinante 10% OFF     item   percentage    sto_…QNG9AG (cafe)     ← seed/coffee.mjs
//     Primeiro café 10%     item   percentage    sto_…N2S38  (balcao)   ← hand-typed on main
//     Combo da manhã        order  fixed_amount  sto_…N2S38  (balcao)   ← hand-typed on main
//     Primeira xícara 10%   item   percentage    sto_…QNG9AG (cafe)     ← hand-typed on main
//
// Every row of that measurement must be findable in the dataset. Adding a fifth promotion by hand and not
// writing it here leaves this file green — a guard cannot see a gesture nobody recorded — but the moment
// anybody writes the roster down, the seed has to answer for it. That is the whole trade, stated rather
// than pretended away.
//
// ⚠️ THE NAME IS THE KEY, in all three declaring places and in the history executor inside the kernel
// (`select id from promotion where name = $1`). So this file also refuses a COLLISION: two sources claiming
// one name would make one of them skip a promotion it never created.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COFFEE_PROMOTIONS } from './coffee.mjs';
import { IDENTITY_CONDITION_KINDS, identityConditionsOf, STORE_COUPONS } from './commerce.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const totem = JSON.parse(readFileSync(join(SEED, 'totem.json'), 'utf8'));

/** What the bench of 2026-09-03 held, read off `promotion` in the coffee tenant's schema. NOT derived —
 *  this is the observation the seed is graded against. */
const MEASURED_ON_THE_BENCH = [
  'Assinante 10% OFF',
  'Primeiro café 10%',
  'Combo da manhã',
  'Primeira xícara 10%',
];

/** Every promotion of this brand the dataset declares, and WHICH file declares it — three sources, because
 *  three slices own three shops and one file between them is a merge conflict with a stopwatch on it. */
function declared() {
  return [
    ...COFFEE_PROMOTIONS.map((p) => ({ name: p.name, from: 'seed/coffee.mjs' })),
    ...Object.values(STORE_COUPONS).map((c) => ({ name: c.name, from: 'seed/commerce.mjs' })),
    ...Object.values(totem.promotions).map((p) => ({ name: p.name, from: 'seed/totem.json' })),
  ];
}

test('★★ every promotion the bench held is DECLARED — a rebirth loses none of them', () => {
  const byName = new Map(declared().map((p) => [p.name, p.from]));
  const orphans = MEASURED_ON_THE_BENCH.filter((name) => !byName.has(name));
  assert.deepEqual(
    orphans,
    [],
    `these promotions exist on the bench and in no seed file, so a virgin box is born without them: ${orphans.join(', ')}`,
  );
});

test('⛔ no two sources claim one NAME — the key three seeds use for idempotence', () => {
  // A collision does not fail loudly anywhere: the second seed reads `promotions_admin`, finds the name,
  // logs "already exists" and skips a promotion it never created.
  const seen = new Map();
  for (const { name, from } of declared()) {
    assert.equal(
      seen.has(name),
      false,
      `"${name}" is declared by both ${seen.get(name)} and ${from}`,
    );
    seen.set(name, from);
  }
});

// ── ⛔⛔ AND THE COUNTER'S HALF OF THE ROSTER HAS A SECOND RULE ──────────────────────────────────────────
//
// `ANONYMOUS_BUYER_STORE_HANDLES` in `seed/commerce.mjs` carries the argument: the till mints a synthetic
// buyer per cart, so a promotion conditioned on WHO is buying means nothing there — `first_purchase` fires
// on every single sale and the other three never fire at all. `seed/commerce.mjs` retires such a row when it
// finds one on the box; this file is the other end, and it grades what this repository DECLARES, which is
// the half a retirement pass can never reach: a row declared here would be created on every birth and
// retired again on every birth, forever.
test('★★ no promotion this repository DECLARES for the counter asks who is buying', () => {
  const declaredForCounter = Object.entries(totem.promotions).map(([key, p]) => ({
    key,
    name: p.name,
    // `seed/totem.mjs` is what turns this file into `promotion.create` input, and a `conditions` array is
    // the only shape the kernel takes. `combo.contains` becomes `cart_contains`, which the cart answers.
    conditions: Array.isArray(p.conditions) ? p.conditions : [],
  }));
  for (const promotion of declaredForCounter) {
    const asks = identityConditionsOf(promotion);
    assert.deepEqual(
      asks,
      [],
      `seed/totem.json declares "${promotion.name}" for the counter with ${asks.join(', ')}`,
    );
  }
  assert.equal(declaredForCounter.length, 2, 'a third counter promotion appeared and nobody graded it');
});

test('⛔ and no line of seed/totem.mjs writes an identity condition either', () => {
  // The JSON above is not the whole declaration: `seed/totem.mjs` hardcodes the conditions it sends. A guard
  // over the data alone would stay green while the code beside it re-introduced the row.
  const src = readFileSync(join(SEED, 'totem.mjs'), 'utf8');
  for (const kind of IDENTITY_CONDITION_KINDS)
    assert.equal(
      src.includes(`'${kind}'`),
      false,
      `seed/totem.mjs sends "${kind}" — the counter cannot honestly evaluate it`,
    );
});

test('★ the counter’s coupon stays the counter’s — that scoping is the thing it PROVES', () => {
  // s7-5: PRIMEIROCAFE is `store_id`-scoped to the Balcão on purpose, and the e-commerce advertises its own
  // (PRIMEIRAXICARA). Re-pointing one at the other store would delete a proof to fix a sentence.
  assert.equal(totem.promotions.coupon.code, 'PRIMEIROCAFE');
  assert.equal(STORE_COUPONS.cafe.code, 'PRIMEIRAXICARA');
  assert.notEqual(totem.promotions.coupon.code, STORE_COUPONS.cafe.code);
});

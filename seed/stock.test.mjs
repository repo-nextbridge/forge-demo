// The stock planner's tests — `node --test 'seed/**/*.test.mjs'`.
//
// ONE OF THESE IS THE REASON THE FILE EXISTS, and it is the first: a SKU that has never been stocked has no
// row in `stock_levels`, so the loop that walked that read alone never saw it, found nothing to do, and
// logged "every sku already stocked" over a shop nobody could buy from. It was measured in production data
// (the six coffees at `available: 0`) and it survived every run of this seed because a bench that has been
// up for a while already has the rows. The test below is the one that would have caught it on day one.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planStock } from './stock.mjs';

/** A `products_admin` row, as the internal read answers it: skus carry `id` and `code`, never stock. */
const catalogueRow = (product_id, skus) => ({
  product_id,
  skus: skus.map(([id, code]) => ({ id, code, amount: 1000 })),
});

/** A `stock_levels` row, as the internal read answers it: `sku_id`/`sku_code`/`on_hand`, and `present`. */
const levelRow = (product_id, skus) => ({
  product_id,
  skus: skus.map(([sku_id, sku_code, on_hand, present = true]) => ({
    sku_id,
    sku_code,
    on_hand,
    present,
  })),
});

// ── the defect ──────────────────────────────────────────────────────────────────────────────────────────

test('a SKU with NO stock row at all is planned — the one the old loop could not see', () => {
  // ⚠️ THIS IS THE MEASURED FAILURE, in miniature. `read.internal.stock_levels` ends its SQL in
  // `having present_count > 0`: it lists the products this warehouse holds something of. A brand-new
  // product is in NO row of it. The version of this step that walked `stock_levels` and adjusted what it
  // found therefore planned nothing for the six coffees, and `cart.add_line` on them answered
  // `conflict · insufficient_stock · available: 0` while the seed reported success.
  const want = new Map([['forge-alvorada-graos-250g', 100]]);
  const catalogue = [catalogueRow('prod_alvorada', [['sku_a', 'forge-alvorada-graos-250g']])];
  const levels = []; // the warehouse holds nothing of it, so the read does not mention it AT ALL

  const { adjustments, missing } = planStock(want, catalogue, levels);
  assert.deepEqual(missing, []);
  assert.equal(
    adjustments.length,
    1,
    'a sku the warehouse has never counted was not seen — that is the whole defect',
  );
  assert.deepEqual(adjustments[0], {
    sku_id: 'sku_a',
    sku_code: 'forge-alvorada-graos-250g',
    on_hand: 100,
  });
});

test('a SKU flagged `present: false` is not a level — it is planned like an absent one', () => {
  // The read puts EVERY sku of a listed product on the row and flags the ones with no line. Reading
  // `on_hand: 0` off such a sku would be believing a placeholder: "absent is not zeroed" is the read's own
  // sentence, and the difference decides whether this sku is ever stocked.
  const want = new Map([
    ['cappuccino-p-integral', 9999],
    ['cappuccino-g-aveia', 9999],
  ]);
  const catalogue = [
    catalogueRow('prod_cap', [
      ['sku_p', 'cappuccino-p-integral'],
      ['sku_g', 'cappuccino-g-aveia'],
    ]),
  ];
  const levels = [
    levelRow('prod_cap', [
      ['sku_p', 'cappuccino-p-integral', 9999, true],
      ['sku_g', 'cappuccino-g-aveia', 0, false],
    ]),
  ];

  const { adjustments } = planStock(want, catalogue, levels);
  assert.deepEqual(
    adjustments.map((a) => a.sku_code),
    ['cappuccino-g-aveia'],
  );
});

// ── the idempotence the old loop DID have, and which must survive the fix ───────────────────────────────

test('a SKU already at or above the figure is left alone — no command, no audit row', () => {
  const want = new Map([
    ['espresso-forge-simples', 9999],
    ['espresso-forge-duplo', 9999],
  ]);
  const catalogue = [
    catalogueRow('prod_esp', [
      ['sku_1', 'espresso-forge-simples'],
      ['sku_2', 'espresso-forge-duplo'],
    ]),
  ];
  const levels = [
    levelRow('prod_esp', [
      ['sku_1', 'espresso-forge-simples', 9999],
      // Above the figure: somebody moved it by hand on the bench, and a re-run must not undo that.
      ['sku_2', 'espresso-forge-duplo', 12000],
    ]),
  ];
  assert.deepEqual(planStock(want, catalogue, levels).adjustments, []);
});

test('a SKU BELOW the figure is topped up, absolutely and not by a delta', () => {
  const want = new Map([['pao-de-queijo-unidade', 9999]]);
  const catalogue = [catalogueRow('prod_pao', [['sku_x', 'pao-de-queijo-unidade']])];
  const levels = [levelRow('prod_pao', [['sku_x', 'pao-de-queijo-unidade', 12]])];
  const { adjustments } = planStock(want, catalogue, levels);
  // 9999, never 9987: an absolute figure run twice is the same number, where two deltas would double it.
  assert.deepEqual(adjustments, [{ sku_id: 'sku_x', sku_code: 'pao-de-queijo-unidade', on_hand: 9999 }]);
});

// ── the catalogue's own bugs, named rather than skipped ─────────────────────────────────────────────────

test('a declared code no SKU answers to is REPORTED, never silently skipped', () => {
  // The old loop skipped it by construction (`if (want === undefined) continue`, from the other side), so
  // a product that was never created, or an option value renamed after the fact, produced a shop with a
  // permanently unbuyable line and a green exit code.
  const want = new Map([
    ['cookie-forge-baunilha-com-gotas', 9999],
    ['cookie-forge-sabor-que-nao-existe', 9999],
  ]);
  const catalogue = [catalogueRow('prod_cookie', [['sku_c', 'cookie-forge-baunilha-com-gotas']])];
  const { adjustments, missing } = planStock(want, catalogue, []);
  assert.deepEqual(missing, ['cookie-forge-sabor-que-nao-existe']);
  assert.deepEqual(
    adjustments.map((a) => a.sku_code),
    ['cookie-forge-baunilha-com-gotas'],
  );
});

test('a SKU of another slice is not this seed\'s to touch — only declared codes are planned', () => {
  // The tenant catalogue holds every store's products. Planning by what the CATALOGUE has rather than by
  // what the seed DECLARES would re-stock the Outlet's deliberately sold-out sizes, which is the mistake
  // seed/forge.mjs records having made once.
  const want = new Map([['espresso-forge-simples', 9999]]);
  const catalogue = [
    catalogueRow('prod_esp', [['sku_1', 'espresso-forge-simples']]),
    catalogueRow('prod_boot', [['sku_boot_39', 'MENS_ECCO_BYWAY-39']]),
  ];
  const { adjustments } = planStock(want, catalogue, []);
  assert.deepEqual(
    adjustments.map((a) => a.sku_code),
    ['espresso-forge-simples'],
  );
});

test('the plan keeps the order the seed declared, so a run reads like the file', () => {
  const want = new Map([
    ['a-1', 5],
    ['b-1', 5],
    ['c-1', 5],
  ]);
  const catalogue = [
    catalogueRow('p', [
      ['sku_c', 'c-1'],
      ['sku_a', 'a-1'],
      ['sku_b', 'b-1'],
    ]),
  ];
  assert.deepEqual(
    planStock(want, catalogue, []).adjustments.map((a) => a.sku_code),
    ['a-1', 'b-1', 'c-1'],
  );
});

// WHICH SKUs THIS SEED HAS TO STOCK — as a function, because the version that lived inside one loop was
// wrong in silence and the silence is the whole point.
//
// ── ★★ THE DEFECT THIS FILE EXISTS TO END, MEASURED ─────────────────────────────────────────────────────
//
// `stock()` in `bin/seed.mjs` walked `read.internal.stock_levels` and adjusted what it found there. That
// read's own SQL ends in `having present_count > 0` (packages/core/src/read/inventory-admin-capabilities.ts)
// — its summary says so in words too: it "lists the products this warehouse stocks something of". A SKU
// that has NEVER been stocked has no `stock` row, so it is not in that answer at all.
//
// So the loop found nothing to do for a brand-new product, logged **"stock — every sku already stocked"**,
// and exited 0 over a shop nobody can buy from. Measured on the totem bench, 2026-09-01: the six coffees of
// the coffee store were absent from `stock_levels` (`total: 8`, and the eight were the Outlet's, which
// `seed/outlet.mjs` stocks by a different path — with the sku ids `catalog.product.create` hands back — and
// which is why it escaped), and `cart.add_line` on the Alvorada answered
// `conflict · insufficient_stock · available: 0`.
//
// ⚠️ IT DID NOT REPRODUCE ON A BENCH THAT HAD BEEN RUNNING FOR A WHILE, and that is what kept it hidden: a
// box carrying stock from earlier rounds has the rows, so the loop tops them up and looks correct. A NEW
// box — day one of a customer, and the path a real seed takes — is where the coffee shop comes up unable
// to sell anything.
//
// ⚠️ AND IT IS THE THIRD TIME IN THIS REPOSITORY THAT A READ ANSWERED A DIFFERENT QUESTION THAN THE ONE
// ASKED, silently: `rows()`'s `?? []` read a real page as zero, `read.internal.products?store=` answers the
// whole tenant and ignores the store, and now this. The rule `bin/seed.mjs` already wrote for itself — ask
// the read whose NAME is the question, and look at its keys before using one — is what this file enforces
// mechanically: the plan CANNOT be computed from the levels alone, because the function will not accept
// them alone.
//
// THE ANSWER, IN ONE SENTENCE: the CATALOGUE says which SKUs exist, the LEVELS say what the ones that have
// a level are at, and a SKU in the first and not the second is at zero and needs the adjustment that
// creates its row.

/**
 * @param wanted    Map<sku_code, on_hand> — the figure this seed declares, by the code it wrote.
 * @param catalogue rows of `read.internal.products_admin` — the SKU ids. This is the argument the broken
 *                  version did not have, and requiring it is what makes the defect unwritable here.
 * @param levels    rows of `read.internal.stock_levels` — the current on-hand of the SKUs that have a row.
 * @returns `{ adjustments, missing }` — `adjustments` are the `inventory.adjust` calls to make, in
 *          catalogue order; `missing` are declared codes no SKU answers to, which is a catalogue bug the
 *          caller should NAME rather than skip in silence.
 */
export function planStock(wanted, catalogue, levels) {
  const ids = new Map();
  for (const product of catalogue) {
    for (const sku of product.skus ?? []) {
      if (sku.code && wanted.has(sku.code)) ids.set(sku.code, sku.id ?? sku.sku_id);
    }
  }

  const have = new Map();
  for (const product of levels) {
    for (const sku of product.skus ?? []) {
      // ⚠️ `present: false` IS NOT ZERO AND IT IS NOT A LEVEL. The read puts every SKU of a listed product
      // on the row and flags the ones with no line — so reading `on_hand: 0` off an absent SKU would be
      // believing a placeholder. It is left out of this map entirely, which puts it in the plan below.
      if (sku.present === false) continue;
      if (sku.sku_code) have.set(sku.sku_code, sku.on_hand ?? 0);
    }
  }

  const adjustments = [];
  const missing = [];
  // ★ THE WALK IS OVER WHAT THE SEED WANTS, NEVER OVER WHAT THE WAREHOUSE ALREADY HAS. That inversion is
  // the fix: a SKU absent from `levels` is `have.get(code) === undefined`, which is below every positive
  // target, so it is planned. The broken version walked `levels`, and a SKU that is not in it was never
  // even considered.
  for (const [code, on_hand] of wanted) {
    const sku_id = ids.get(code);
    if (!sku_id) {
      missing.push(code);
      continue;
    }
    // Absolute, never a delta: running twice leaves the same number. A SKU already at or above the figure
    // is skipped, so a re-run does not undo stock somebody moved by hand on the bench.
    if ((have.get(code) ?? 0) >= on_hand) continue;
    adjustments.push({ sku_id, sku_code: code, on_hand });
  }
  return { adjustments, missing };
}

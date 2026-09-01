// THE MODAL'S ARITHMETIC — pure, and deliberately reachable from the browser.
//
// ★ WHY THIS IS A FILE OF ITS OWN. `product.ts` next door READS the port, so it pulls in `next/headers` and
// the kit's server clients; the modal that renders variant buttons runs on the CLIENT. Importing one from
// the other is how a server module ends up in a browser bundle — which webpack answers with a parse error
// several layers away from the mistake. So the shapes and the three functions the screen needs live here,
// with no import that touches a port.

import { money } from './money';

export type OptionValue = { valueId: string; label: string };
export type OptionAxis = { optionId: string; label: string; values: OptionValue[] };

export type ProductDetail = {
  handle: string;
  name: string;
  description: string;
  imageUrl: string | undefined;
  /** The band this product sits in, for the modal's kicker. */
  kicker: string;
  axes: OptionAxis[];
  /** Every purchasable SKU, with the value ids that identify it and its live price. */
  variants: { skuId: string; valueIds: string[]; amount: number; label: string }[];
  /** The cheapest variant, which is what the modal opens on. */
  defaultSkuId: string | null;
};

/** The SKU whose option values are exactly this selection, or undefined when the combination is not sold. */
export function skuFor(detail: ProductDetail, chosen: string[]): string | undefined {
  return variantFor(detail, chosen)?.skuId;
}

function variantFor(detail: ProductDetail, chosen: string[]) {
  return detail.variants.find(
    (v) => v.valueIds.length === chosen.length && chosen.every((id) => v.valueIds.includes(id)),
  );
}

/**
 * What one option button costs ON TOP of the current selection.
 *
 * ⚠️ IT IS A DIFFERENCE BETWEEN TWO REAL SKU PRICES, NEVER A SURCHARGE TABLE. The artboard shows "+ R$ 3,00"
 * beside an option; that number is `other.amount - current.amount`, so a product whose large costs less than
 * its small shows a negative delta and still charges the truth. A table would drift from the till the first
 * time somebody repriced one variant.
 *
 * `null` means the combination does not exist — the screen then shows nothing rather than a made-up zero.
 */
export function deltaFor(
  detail: ProductDetail,
  chosen: string[],
  axisIndex: number,
  valueId: string,
): number | null {
  const current = variantFor(detail, chosen);
  const candidate = chosen.slice();
  candidate[axisIndex] = valueId;
  const other = variantFor(detail, candidate);
  if (!current || !other) return null;
  return other.amount - current.amount;
}

/** The modal's price label for a selection, or the first variant's when nothing is selected yet. */
export function priceLabelOf(detail: ProductDetail, skuId: string | undefined, qty: number): string {
  const v = detail.variants.find((x) => x.skuId === skuId) ?? detail.variants[0];
  return money((v?.amount ?? 0) * qty);
}

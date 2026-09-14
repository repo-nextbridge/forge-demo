// THE SCROLLING CARD'S SHAPE AND ITS ONE PIECE OF ARITHMETIC — pure, and deliberately reachable from the
// browser.
//
// ★ WHY THIS IS A FILE OF ITS OWN, and it is the same reason `product-select.ts` is: `menu.ts` next door
// READS the port, so it pulls in `next/headers` and the kit's server clients; the component that renders the
// cards runs on the CLIENT. Importing one from the other is how a server module ends up in a browser bundle —
// which webpack answers with a parse error several layers away from the mistake.

export type MenuCard = {
  handle: string;
  name: string;
  /** The product's own short description — what the MODAL shows, and the fallback for the card. */
  description: string;
  /**
   * ★★ A48 — THE COUNTER'S OWN ONE-LINER (`desc_totem`), and the clean example of trava 3 in this instance:
   * dado novo → CAMPO PRÓPRIO. No kernel change, no contract, no new surface — the instance declares one
   * more product custom field, fills it, and each surface chooses what to read.
   *
   * Undefined for every product nobody wrote one for, which is the whole design: see `cardDescription`.
   */
  descTotem: string | undefined;
  imageUrl: string | undefined;
  chip: string | undefined;
  /** True when the product's SKUs do not all cost the same — the artboard's "a partir de". */
  fromPrice: boolean;
  priceLabel: string;
};

/**
 * ★★ WHAT THE SCROLLING CARD SAYS, AND WHY THE FALLBACK IS THE POINT AND NOT A DETAIL.
 *
 * A card is a tile on a screen a metre away; the shop's `description` is a paragraph written for a product
 * page somebody reads sitting down. The six coffees the counter re-sells carry the shop's paragraph — 200+
 * characters — and it ran over the tile. So the counter reads its OWN field first.
 *
 * ⚠️ WITHOUT THE `??` A PRODUCT NOBODY WROTE ONE FOR WOULD HAVE A MUTE CARD, which is worse than a long one
 * and would make the new field a REQUIREMENT rather than an upgrade. With it, the fifteen products of the
 * counter's own menu — whose descriptions are already one line — render exactly as they did before, and
 * nothing about the coffee shop's vitrine changes at all: it never asks for this field.
 *
 * The MODAL deliberately does NOT use this. It shows `description`, because a modal is where somebody who
 * stopped to choose reads the longer sentence — see `Totem.tsx`'s `modalDesc` and `lib/product.ts`.
 */
export function cardDescription(card: Pick<MenuCard, 'descTotem' | 'description'>): string {
  return card.descTotem ?? card.description;
}

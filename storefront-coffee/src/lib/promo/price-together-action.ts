'use server';

// PROMO — "what do these skus cost together?", asked from a client component AFTER hydration.
//
// WHY AN ACTION AND NOT A FETCH FROM THE BROWSER. The read port's base URL is server configuration
// (FORGE_READ_BASE_URL); a client component that called it directly would need a browser-reachable origin
// baked into the bundle, which PERF-B deliberately removed from this app. So the client asks the server, and
// the server asks the port — the same shape the minicart's seed and the CEP box already use.
//
// ★ IT CARRIES NO SHOPPER, and it cannot: the quote is anonymous by construction on the kernel's side (no
// buyer, no payment method), and there is no parameter here through which one could travel. That is what
// makes it safe to render inside a page whose HTML is cached and shared.
//
// It is a READ, so it revalidates nothing and sets no cookie: the answer is data the caller renders.

import { readClient } from '@forgeco/storefront-kit/config';
import type { PriceTogether } from '@forgeco/storefront-kit/read-client';

export async function priceTogetherAction(
  store: string,
  skuIds: string[],
): Promise<PriceTogether | null> {
  // Fewer than two is not a set — the caller (the bought-together block) always sends the pair it drew.
  if (skuIds.length < 2) return null;
  try {
    return await readClient().priceTogether(store, skuIds);
  } catch {
    // The port hiccupping must not break a product page: no quote → the block falls back to the plain sum,
    // which is what it did before any of this existed.
    return null;
  }
}

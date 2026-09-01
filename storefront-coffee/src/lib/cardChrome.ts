// S7-SF-HOME — the store-level chrome the ProductCard needs but the product doc does NOT carry: the
// free-shipping threshold (the "Frete grátis" tag) and the max installments (the "ou Nx de R$ X" line). Both
// are STORE-level facts, identical for every card on the page, so this is a `React.cache()` memo keyed by
// store: one shipping_summary read + one payment_methods read PER REQUEST, deduplicated across all the cards a
// shelf renders. Neither value is ever hardcoded — the threshold is S7-SF-SMALLS's read, the installments come
// from the payment app's front-facing config (never a literal "12x").
//
// Everything degrades to null: a down port, an absent read, a store with no free-shipping rate, or no payment
// app installed → the card simply omits that tag/line. The card is a pure Server Component over this result.

import { readClient } from '@forgecommerce/storefront-kit/config';
import { cache } from 'react';

export type CardChrome = {
  /** The free-shipping floor in cents, or null (no promise → no "Frete grátis" tag). */
  freeShippingThreshold: number | null;
  /** The store's max installments (the "ou Nx de …"), or null (no payment app → no installment line). */
  maxInstallments: number | null;
};

const EMPTY: CardChrome = { freeShippingThreshold: null, maxInstallments: null };

/** Read a positive integer out of a payment app's opaque front config (`config.max_installments`). */
function readMaxInstallments(config: Record<string, unknown> | undefined): number | undefined {
  const raw = config?.max_installments;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.floor(n) : undefined;
}

/** The largest `max_installments` any installed payment app offers (the store's headline plan), or null. */
function maxInstallmentsOf(providers: { config: Record<string, unknown> }[]): number | null {
  let max: number | undefined;
  for (const p of providers) {
    const n = readMaxInstallments(p.config);
    if (n !== undefined && (max === undefined || n > max)) max = n;
  }
  return max ?? null;
}

/** The card chrome for a store — memoized per request (deduped across every card on the page). Fully
 * defensive: a down port, an absent read, or a client that does not serve these reads → the empty chrome (the
 * card simply shows neither the tag nor the installment line). */
export const cardChrome = cache(async (store: string): Promise<CardChrome> => {
  if (!store) return EMPTY;
  try {
    const client = readClient();
    const [shipping, payments] = await Promise.all([
      Promise.resolve(client.shippingSummary(store)).catch(() => null),
      // PERF-B — the ISR-cached variant of read.payment_methods, not the checkout's fresh one. This value is
      // store configuration (`max_installments`) rendered on every card of the catalog; asking for it uncached
      // put an uncacheable fetch inside the most cached page in the store, which Next answers by refusing to
      // cache the page at all. The checkout still uses the fresh read.
      Promise.resolve(client.paymentMethodsCached(store)).catch(() => null),
    ]);
    return {
      freeShippingThreshold: shipping?.free_shipping_threshold ?? null,
      maxInstallments: maxInstallmentsOf(payments?.providers ?? []),
    };
  } catch {
    return EMPTY;
  }
});

// The identity price overlay — the client half (CUST-CLUSTER wave 4, decision 7).
//
// The page's HTML is one-for-all and anonymous-safe. A signed-in shopper whose cluster earns them a different
// price gets that difference here, after the render, from `/api/my-prices`. Anonymous visitors never call this
// at all — the fetch is behind a session check, so their visit costs exactly what it costs today.
//
// ★★ THE CEILING, AND WHAT HAPPENS ABOVE IT — the decision this file exists to make explicit, because a
// ceiling without a declared behaviour is the next person's "why did the member price disappear at the bottom
// of the page?".
//
// The port refuses a batch bigger than `MY_PRICES_MAX_SKUS`; it does not truncate. Three behaviours were on the
// table and only one of them is honest:
//
//   1. TRUNCATE SILENTLY — answer the first 48 and drop the rest. REJECTED, and it is the worst of the three:
//      card 48 shows the member price while card 49 shows the anonymous one, and the shopper cannot tell "this
//      product has no discount" from "this product we did not ask about". Inconsistency inside one page is
//      worse than no overlay at all, because a uniform absence is at least honest.
//   2. REFUSE THE WHOLE PAGE — uniform, but it throws away 48 correct prices to punish the 49th, and it fails
//      precisely for the shopper who browsed the most.
//   3. ASK FOR ALL OF THEM, IN BATCHES OF AT MOST 48 — what this does. Every sku on screen is asked about, so
//      the page can never be half-right.
//
// The common page is ONE request: the PLP accumulates 20 cards per "load more", so 20 and 40 both fit under 48.
// A shopper who loads more twice pays a second request — proportional to what they asked for. What the DoD's
// "one batched request" forbids is the anti-pattern of one request PER PRODUCT, and that stays impossible: the
// count is ceil(N / 48), never N.
//
// The ceiling itself protects the PORT (a crafted URL must not fan out into it), which is why it is an ERROR
// there — the same rule `list-limits.ts` and `ASSORTMENT_BULK_LIMITS` already state: a declared maximum is an
// error, never a silent clamp. The client is the side that knows how many skus are on screen, so the client is
// the side that batches.

import type { MyPrice } from '@forgecommerce/storefront-kit/customer-client';
import { batchSkus as splitBatches } from '@/lib/batch-skus';

/** The port's declared ceiling per call. Mirrors @forge/core's `MY_PRICES_MAX_SKUS`; the parity is asserted in
 * `overlay.test.ts` against the kernel source, so the two cannot drift into a 400 nobody expected. */
export const MY_PRICES_MAX_SKUS = 48;

/** Split the page's skus into the batches the port will accept. ceil(N / MAX), order preserved. The splitting
 * itself moved to `@/lib/batch-skus` once a second capped read (availability, ceiling 100) needed it; this
 * keeps the default ceiling that every caller here means. */
export function batchSkus(skuIds: readonly string[], max: number = MY_PRICES_MAX_SKUS): string[][] {
  return splitBatches(skuIds, max);
}

/**
 * Fetch the overlay for every sku on the page.
 *
 * Batches run in PARALLEL: they are independent reads and a page with 60 cards should not wait two round trips
 * end to end. A batch that fails is skipped rather than failing the page — the cards it covered keep the
 * anonymous price, which is true for everyone and is what the HTML already shows.
 *
 * Returns an empty map when nobody is signed in (the route answers 204), which is also what a store with no
 * identity-conditioned promotion returns — and in both cases the caller draws nothing.
 */
export async function fetchIdentityPrices(
  skuIds: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, MyPrice>> {
  const batches = batchSkus(skuIds);
  if (batches.length === 0) return {};

  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetchImpl(`/api/my-prices?skus=${encodeURIComponent(batch.join(','))}`);
        // 204 = anonymous. Anything not ok = the page keeps its anonymous prices.
        if (res.status === 204 || !res.ok) return {};
        return (await res.json()) as Record<string, MyPrice>;
      } catch {
        return {};
      }
    }),
  );
  return Object.assign({}, ...results) as Record<string, MyPrice>;
}

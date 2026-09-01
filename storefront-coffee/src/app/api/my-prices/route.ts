// GET /api/my-prices?skus=<id>,<id> — where the SIGNED-IN shopper's price differs from the one the cached HTML
// is showing (CUST-CLUSTER wave 4, decision 7).
//
// ★ WHY THIS EXISTS AT ALL. A cluster promotion applies BECAUSE of who is asking, so it can never be in the
// storefront's HTML: that HTML is edge-cached and served one-for-all. Personalising it was VETOED — three
// times the cost, and it kills the CDN. So the page stays anonymous-safe for everyone and the DIFFERENCE is
// fetched here, once per page, by a browser that has a session.
//
// ★ AND WHY IT IS NOT THE SAME REQUEST AS /api/availability, which the brief suggested as a precedent. The two
// look alike — both are per-visit fetches over a batch of skus — and they are not the same request, because
// availability is ANONYMOUS and this one REQUIRES a session. Folding them together would make every anonymous
// visitor pay the signed-in path: a cookie read, a customer-session round trip and a per-person response, on
// the visit that is supposed to cost nothing. The shapes rhyme; the audiences do not.
//
// THE THREE PROPERTIES THAT ARE NOT NEGOTIABLE (decision 7), and where each one lives:
//   · `private, max-age=60` — the USER's browser, never a shared cache. Segmentation must never enter a cache
//     key, and the surest way to guarantee that is for the response to be un-shareable by construction.
//   · no session → 204, no body, no port call. An anonymous visit costs exactly nothing.
//   · the kernel read is `no-store` (customer-client), so Next's shared data cache can never hold one
//     shopper's prices and hand them to the next.

import { customerClient } from '@forgecommerce/storefront-kit/kernel-write-clients';
import { readCustomerSession } from '@forgecommerce/storefront-kit/session';
import { NextResponse } from 'next/server';
import { MY_PRICES_MAX_SKUS } from '@/lib/prices/overlay';

export const dynamic = 'force-dynamic';

/** The per-person cache window. On the BROWSER only — a shared cache holding this would be one shopper's
 * prices served to another, which is the whole failure mode decision 7 exists to prevent. */
const PRIVATE_CACHE = `private, max-age=60`;

export async function GET(req: Request): Promise<NextResponse> {
  const token = await readCustomerSession();
  // Anonymous: zero change, zero port call. 204 rather than `{}` so the client can tell "nobody is signed in"
  // from "signed in, nothing differs" without parsing a body.
  if (!token) return new NextResponse(null, { status: 204 });

  const raw = new URL(req.url).searchParams.get('skus') ?? '';
  const skus = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (skus.length === 0) {
    return NextResponse.json({}, { headers: { 'cache-control': PRIVATE_CACHE } });
  }
  // The ceiling is the PORT's and it REFUSES rather than truncating; asking for more from here would be a 400
  // the shopper cannot act on, so the batching happens in the client (lib/prices/overlay.ts) and this is the
  // backstop for a hand-crafted URL.
  if (skus.length > MY_PRICES_MAX_SKUS) {
    return NextResponse.json(
      { error: `skus must be <= ${MY_PRICES_MAX_SKUS} per call` },
      { status: 400, headers: { 'cache-control': PRIVATE_CACHE } },
    );
  }

  try {
    const prices = await customerClient().myPrices(token, skus);
    return NextResponse.json(prices ?? {}, { headers: { 'cache-control': PRIVATE_CACHE } });
  } catch {
    // A failed overlay leaves the page exactly as it rendered — the anonymous-safe price, which is true for
    // everyone. Never an error the shopper has to read.
    return NextResponse.json({}, { headers: { 'cache-control': PRIVATE_CACHE } });
  }
}

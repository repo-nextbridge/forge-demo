'use client';

// The identity price overlay's mount point (CUST-CLUSTER wave 4, decision 7).
//
// It renders NOTHING. Its whole job is: find the price anchors the server put on this page, ask
// `/api/my-prices` about them once, and fill them. That is deliberate and is what keeps the guarantee intact:
//
//   · the HTML stays ONE-FOR-ALL — this component adds no markup, so the anonymous page is byte-for-byte the
//     page it has always been (there is a test that compares it);
//   · an ANONYMOUS visit costs nothing beyond one 204 — and the route answers that before touching the port;
//   · nothing per-person ever enters a cache key, because nothing per-person is ever in the HTML.
//
// It mounts on the PLP and the PDP alike: both render prices through anchors, so one component covers both and
// there is no second implementation to drift.

import { formatMoney } from '@forgecommerce/storefront-kit/money';
import { applyIdentityPrices, skusOnPage } from '@forgecommerce/storefront-kit/prices/apply';
import { useEffect } from 'react';
import { fetchIdentityPrices } from '@/lib/prices/overlay';

export function IdentityPriceOverlay({ currency }: { currency?: string }) {
  useEffect(() => {
    let alive = true;
    // The skus are read from the DOM rather than passed as props: the page already stamped them on every price
    // it rendered, and threading a second list through every template would be a second source of truth about
    // what is on screen — one that could disagree with the anchors the overlay actually fills.
    const skus = skusOnPage(document);
    if (skus.length === 0) return;

    fetchIdentityPrices(skus)
      .then((prices) => {
        if (!alive || Object.keys(prices).length === 0) return;
        applyIdentityPrices(document, prices, (amount) => formatMoney(amount, currency));
      })
      .catch(() => {
        // A failed overlay leaves the page as it rendered: the anonymous-safe price, true for everyone.
      });
    return () => {
      alive = false;
    };
  }, [currency]);

  return null;
}

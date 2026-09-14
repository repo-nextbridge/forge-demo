// ★★★ pk32/d3 — THE STORE-SCOPED ERROR BOUNDARY of the dynamic tree: the twin of this group's `not-found.tsx`.
//
// The group already decided that a customer who lands on a dead end keeps the café around him — header, footer,
// minicart — and is given a way back. The OTHER dead end had no such file, so a throw in any page of this group
// (a PDP, a PLP, `/b/<slug>`, the catch-all, the cart) escaped to Next's white "Application error", which
// carries no chrome, no café and no word of Portuguese.
//
// Being HERE is the whole mechanism: an error boundary renders inside its enclosing layouts, so this file
// inherits `(storefront)/layout.tsx` and only supplies the body — exactly like the 404 next to it.
//
// ⚠️ `HOST_BASE` + `ErrorWayOut` FOR THE SAME REASON THE 404 USES `NotFoundWayOut` (p3-7): App Router hands a
// boundary no route params and `headers()` here would de-opt the whole group, so the prefix arrives after
// hydration from the store `/api/store` confirms. Without it, on a box whose single Host serves two
// TENANTS, every way out of the coffee shop's error page lands in the shoe shop.

'use client';

import {
  ceilingRefusalWaitSeconds,
  isCeilingRefusalDigest,
} from '@forgecommerce/storefront-kit/ceiling-digest';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { BusyContent } from '@/components/BusyContent';
import { ErrorContent } from '@/components/ErrorContent';
import { ErrorWayOut } from '@/components/ErrorWayOut';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (isCeilingRefusalDigest(error.digest)) {
    return (
      <BusyContent
        base={HOST_BASE}
        waitSeconds={ceilingRefusalWaitSeconds(error.digest)}
        reset={reset}
        wayOut={<ErrorWayOut base={HOST_BASE} reset={reset} kind="busy" />}
      />
    );
  }
  return (
    <ErrorContent
      base={HOST_BASE}
      digest={error.digest}
      reset={reset}
      wayOut={<ErrorWayOut base={HOST_BASE} reset={reset} kind="error" />}
    />
  );
}

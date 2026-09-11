// ★★★ pk32/d3 — THE STORE-LESS ROOT ERROR BOUNDARY, twin of the store-less root `not-found.tsx` beside it.
//
// Reached when there is no store to give the page chrome: an unknown host (the middleware rewrites to /404), a
// truly unmatched path, a throw above `[store]`. Because it has no store it wears the platform's own mark, and
// its links are the platform's — a store-less boundary must not fabricate a store, exactly as its 404 sibling
// refuses to fabricate category chips.
//
// It branches on the one cause it CAN know: a read ceiling refusal carries a digest that names itself and the
// port's own `Retry-After`. Everything else keeps the apology, which is what an unknown cause deserves.
//
// ⚠️ The predicate comes from `@/lib/ceiling-digest` and NOT from the kit, which is not a preference: the kit
// ships `src/ceiling-digest.ts` and does not publish the subpath, so a fork cannot import it. That file's header
// carries the measurement and the product file:line; its guard proves the weld and the kit agree.

'use client';

import {
  ceilingRefusalWaitSeconds,
  isCeilingRefusalDigest,
} from '@/lib/ceiling-digest';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { BusyContent } from '@/components/BusyContent';
import { ErrorContent } from '@/components/ErrorContent';

export default function RootError({
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
        brand
        waitSeconds={ceilingRefusalWaitSeconds(error.digest)}
        reset={reset}
      />
    );
  }
  return <ErrorContent base={HOST_BASE} brand digest={error.digest} reset={reset} />;
}

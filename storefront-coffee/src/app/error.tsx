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
// ★ The predicate comes from the KIT — `@forgecommerce/storefront-kit/ceiling-digest` — and until 2026-09-11 it
// could not: the subpath was in the kit's `exports` and missing from its `publishConfig.exports`, so a tarball
// could not import it and this fork carried a weld. `pk32/p1` published the subpath and wrote the guard that
// makes a missing one red, and the weld's own guard went red on the first re-vendor asking to be deleted. It was.

'use client';

import {
  ceilingRefusalWaitSeconds,
  isCeilingRefusalDigest,
} from '@forgecommerce/storefront-kit/ceiling-digest';
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

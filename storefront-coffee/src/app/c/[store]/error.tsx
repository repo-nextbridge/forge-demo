// ★★★ pk32/d3 — THE ERROR BOUNDARY OF THE CACHEABLE TREE, twin of this tree's `not-found.tsx`.
//
// A near-copy of the dynamic tree's boundary for the same structural reason its 404 is one: Next builds a
// boundary into the route's STATIC SHELL, so this file's imports are as load-bearing as the page's — a single
// dynamic API here turns every cached page of this tree into a runtime 500. It therefore reads nothing, and the
// way out (with the store prefix corrected) arrives as a client fragment.

'use client';

import {
  ceilingRefusalWaitSeconds,
  isCeilingRefusalDigest,
} from '@/lib/ceiling-digest';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { BusyContent } from '@/components/BusyContent';
import { ErrorContent } from '@/components/ErrorContent';
import { ErrorWayOut } from '@/components/ErrorWayOut';

export default function CachedStoreError({
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

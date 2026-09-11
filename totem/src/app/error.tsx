// ★★★ pk32/d3 — THE COUNTER'S ONLY ERROR BOUNDARY, because the counter is one route.
//
// `app/page.tsx` is `force-dynamic` by necessity (a cached till would greet a customer with the previous
// customer's basket), so EVERY visit reads the menu and the cart through the port. A refusal on either one used
// to reach the glass as Next's white English "Application error". This is the body it gets instead.
//
// It branches on the one cause the counter CAN know, and the label travels in the digest — see
// `lib/port.ts`, where `PortRateLimited` now carries one: `totemFetch` intercepts 429 before the kit can label
// it, so without that line a rate-limited RENDER arrives here indistinguishable from a dead kernel. The
// predicate and the wait come from `@/lib/ceiling-digest` — the kit's vocabulary, welded in because the kit does
// not publish the subpath to a tarball (that file's header carries the measurement). Same words the reference
// fronts and the coffee vitrine branch on.
//
// ⛔ NO `global-error.tsx` — deliberately, and the reference does not have one either. A global boundary
// replaces the root layout, which on this fork is where the typefaces and the demo gate are mounted: the counter
// would lose its own face in the one moment it most needs to look like itself.

'use client';

import {
  ceilingRefusalWaitSeconds,
  isCeilingRefusalDigest,
} from '@/lib/ceiling-digest';
import { CounterBusy, CounterDown } from '@/components/CounterFault';

export default function CounterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (isCeilingRefusalDigest(error.digest)) {
    return <CounterBusy waitSeconds={ceilingRefusalWaitSeconds(error.digest)} reset={reset} />;
  }
  return <CounterDown digest={error.digest} reset={reset} />;
}

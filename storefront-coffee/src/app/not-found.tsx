// The store-LESS root 404 (S7-SF-CLOSE, HANDOVER §9) — served when there is NO store to give it chrome:
// unknown host (middleware rewrites to /404), a truly unmatched path, and the 301 hook's fallback. Because it
// has no store, it renders the theme's 404 body WITH the `forge.` logo and with links that are the platform's
// own. A store-scoped miss (unknown handle) uses `s/[store]/(storefront)/not-found.tsx`, which inherits the
// header/footer and points its CTAs at the store the port confirmed.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { NotFoundContent } from '@/components/NotFoundContent';
import { NotFoundTitle } from '@/components/NotFoundTitle';

export default function NotFound() {
  // The store-LESS 404 (unknown host): there is no store, so there is no store context — the links are the
  // platform's own.
  return (
    <>
      {/* p2-4 — the tab. An element, not a `metadata` export: see NotFoundTitle.tsx for the two
          User-Agents that show the resolved title being streamed into a shell that drops it. */}
      <NotFoundTitle />
      <NotFoundContent base={HOST_BASE} brand />
    </>
  );
}

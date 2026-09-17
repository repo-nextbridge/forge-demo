// The 404 of the cacheable tree. It is a near-copy of the dynamic tree's not-found for one structural
// reason: Next renders the not-found boundary as part of a route's STATIC SHELL, so this file's imports are
// as load-bearing as the page's — a single dynamic API here turns every cached page of this tree into a
// runtime 500. It therefore reads nothing: the whole way out arrives as a client fragment.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { NotFoundContent } from '@/components/NotFoundContent';
import { NotFoundWayOut } from '@/components/NotFoundWayOut';
import { NotFoundTitle } from '@/components/NotFoundTitle';

export default function CachedStoreNotFound() {
  return (
    <>
      {/* p2-4 — the tab, which this boundary's `metadata` cannot carry (see NotFoundTitle.tsx). */}
      <NotFoundTitle />
      <NotFoundContent base={HOST_BASE} wayOut={<NotFoundWayOut base={HOST_BASE} />} />
    </>
  );
}

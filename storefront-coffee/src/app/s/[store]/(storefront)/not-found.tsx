// The store-scoped 404 (S7-SF-CLOSE, HANDOVER §9). Rendered for an unknown/unpublished handle within a store
// (the notFound() of p/[handle], [...catpath], b/[slug], account/orders/[id]) — so it inherits the (storefront)
// layout's chrome (header/megamenu/footer/minicart) and only supplies the BODY: the "4·0·4" hero + CTAs + real
// category chips.
//
// PERF-B — IT MUST NOT TOUCH A DYNAMIC API, and this is the least obvious rule in the app. Next renders the
// not-found boundary as part of a route's STATIC SHELL, so the `headers()` this file used to call (to read the
// `x-forge-store` the middleware sets) made every page in the group dynamic AT RUNTIME — proven by a trivial,
// data-free page in this group answering `500 — Page changed from static to dynamic at runtime, reason:
// headers`. App Router still hands not-found.tsx no route params, so the store is not knowable here at all
// any more: the way out became a CLIENT fragment that asks /api/categories which store this request is about.
// No JS / failed fetch / unknown store → the server-rendered CTAs stand and no chip row appears, never a crash.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { NotFoundContent } from '@/components/NotFoundContent';
import { NotFoundWayOut } from '@/components/NotFoundWayOut';
import { NotFoundTitle } from '@/components/NotFoundTitle';

export default function StoreNotFound() {
  // MULTISTORE M1-β — HOST_BASE here is what the SERVER can know and nothing more: this boundary gets no route
  // params and lives in the static shell, so the store is unknowable here — the same reason the chips became a
  // client fragment. p3-7: the fragment therefore carries the CTAs too, and re-renders them against the store
  // `/api/categories` confirms, so a shopper under `/s/<store>` stops being sent to the Host's store.
  return (
    <>
      {/* p2-4 — the tab, which this boundary's `metadata` cannot carry (see NotFoundTitle.tsx). */}
      <NotFoundTitle />
      <NotFoundContent base={HOST_BASE} wayOut={<NotFoundWayOut base={HOST_BASE} />} />
    </>
  );
}

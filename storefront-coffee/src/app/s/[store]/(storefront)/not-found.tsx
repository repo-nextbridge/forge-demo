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
// any more: the chips became a CLIENT fragment that resolves the store from the request Host itself, through
// /api/categories. No JS / failed fetch / no browsable categories → no chips, never a crash — the two CTAs
// are the real way out and stay server-rendered.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { NotFoundChips } from '@/components/NotFoundChips';
import { NotFoundContent } from '@/components/NotFoundContent';

export default function StoreNotFound() {
  // MULTISTORE M1-β — HOST_BASE here is a LIMIT, not a fact (see NotFoundContent's `base` doc): this boundary
  // gets no route params and lives in the static shell, so the store is unknowable — the same reason the chips
  // became a client fragment. Under `/s/<store>` these CTAs therefore lead to the Host's store.
  return <NotFoundContent base={HOST_BASE} chips={<NotFoundChips />} />;
}

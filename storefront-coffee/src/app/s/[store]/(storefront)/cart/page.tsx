// ★ QA-CESTA E1 — `/cart` IS AN ADDRESS BUYERS TYPE, AND IT WAS A 404.
//
// Measured on Staging 2026-08-22 (QA-S3, OBS-1). This storefront has no cart PAGE by design: the cart is the
// minicart drawer, and the editable one lives inside `/checkout` (the header icon links straight there, so
// nothing on screen is broken). But `/cart` is muscle memory from every other shop on the web, and typing it
// answered the 404 hero — a dead end for a shopper who has items and is trying to get to them.
//
// ⚠️ A REDIRECT, NOT A SECOND CART. Building a page here would be a second surface over the same cart, free to
// drift from the one inside the checkout — which is the shape this storefront deliberately does not have. The
// address is honoured; the cart stays in one place.
//
// ⚠️ AND IT IS TEMPORARY (`storeRedirect`, 307), NOT PERMANENT (`storePermanentRedirect`, 308), WHICH IS THE
// CAUTIOUS HALF. A 308 is cached by browsers
// indefinitely, so it is a promise that `/cart` will never be a page — and whether this storefront grows a
// cart page is a product decision nobody has taken. A temporary redirect fixes the dead end today and costs
// nothing the day somebody decides otherwise. `storeHref` keeps the target right under path-based store
// routing (`/s/<store>/checkout`) as well as on a store's own host.

import { storeRedirect } from '@forgecommerce/storefront-kit/store-navigation';
import { requestStoreBase } from '@forgecommerce/storefront-kit/store-route.server';

export const dynamic = 'force-dynamic';

export default async function CartPage({ params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  // ⚠️ `storeRedirect`, not a bare `redirect(storeHref(…))` — the house has ONE door for this and a guard
  // that says so, because a redirect built by hand is where an unscoped path escapes into a store's tree.
  storeRedirect(await requestStoreBase(store), '/checkout');
}

// The (storefront) route group's layout — the chrome for this shop's pages, on the DYNAMIC tree.
//
// ★ THE CHROME IS THIS SHOP'S OWN (`components/coffee/CoffeeChrome.tsx`), not the reference vitrine's. The
// design has two links, a logo, an account button and a bag, and no drawer at all — a shape that is written
// rather than configured. What is KEPT from what we inherited is the cart state machine underneath it; see
// the header of CoffeeChrome for why replacing that too would be the expensive mistake.
//
// Route groups don't change the URL — these pages still resolve at `/s/<store>/...`.

import { requestStoreBase } from '@forgeco/storefront-kit/store-route.server';
import type { ReactNode } from 'react';
import { CoffeeChrome } from '@/components/coffee/CoffeeChrome';

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  // MULTISTORE M1-β — the one request fact the chrome needs. Free here: every page in this group is
  // `force-dynamic` (the cacheable twin is `c/[store]`, which never asks).
  const base = await requestStoreBase(store);
  return (
    <CoffeeChrome store={store} base={base}>
      {children}
    </CoffeeChrome>
  );
}

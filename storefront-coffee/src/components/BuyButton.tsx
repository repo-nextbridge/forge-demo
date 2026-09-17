// BuyButton — the PDP "Comprar". Adds the resolved SKU to the cookie-held cart (via the Server Action) and
// navigates to the one-page checkout. There is NO cart page: the cart accumulates item-by-item across PDP
// visits (the cookie). NOTE 3: the button DISABLES itself while submitting, so a double-click cannot create a
// second cart before the cookie is set. Semantic tokens only.
'use client';

import { type StoreBase, storeHref } from '@forgeco/storefront-kit/store-route';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addToCartAction } from '@/lib/cart-actions';
import styles from './BuyButton.module.css';

export function BuyButton({
  store,
  base,
  skuId,
}: {
  store: string;
  /** MULTISTORE M1-β — the store prefix of the current request, so "Comprar" opens THIS store's checkout. */
  base: StoreBase;
  skuId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return; // debounce: ignore re-clicks while the first add is in flight
    setBusy(true);
    try {
      await addToCartAction(store, skuId);
      router.push(storeHref(base, '/checkout'));
    } catch {
      setBusy(false); // let the shopper retry
    }
  }

  return (
    <button
      type="button"
      className={styles.buy}
      onClick={onClick}
      disabled={busy}
      data-testid="buy-button"
    >
      {busy ? 'Adicionando…' : 'Comprar'}
    </button>
  );
}

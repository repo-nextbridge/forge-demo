// AddToCartForm — the PDP "Adicionar ao carrinho" as a progressively-enhanced native form. The base is a real
// <form action={addToCartThenCheckoutAction}> (a store+sku-bound Server Action): with NO JS, submitting adds the line and
// the action redirects to /checkout — the exact v0.1 fallback (SearchBox pattern). With JS, onSubmit is
// intercepted (preventDefault) and instead adds via the port + opens the drawer, keeping the shopper on the
// page. The sibling "Comprar agora" (the existing BuyButton) stays the fast path. Semantic tokens only.
'use client';

import { useTransition } from 'react';
import { useDelayedFlag } from '@/lib/useDelayedFlag';
import styles from './AddToCartForm.module.css';
import { useMinicart } from './MinicartProvider';

export function AddToCartForm({
  action,
  skuId,
  label = 'Adicionar ao carrinho',
}: {
  /** The no-JS fallback: a Server Action bound to (store, skuId) that adds the line and redirects to /checkout. */
  action: () => Promise<void>;
  /** The resolved SKU — the JS path adds it via the port and opens the drawer. */
  skuId: string;
  label?: string;
}) {
  const { addAndOpen, busy } = useMinicart();
  const [pending, startTransition] = useTransition();
  // Optimistic by default (the drawer opens at once); the "Adicionando…" label appears only if the add
  // outlives 1s (useDelayedFlag) — a fast add never flashes it. The button still disables immediately to
  // block a double-submit.
  const working = busy || pending;
  const showSpinner = useDelayedFlag(working);

  return (
    <form
      action={action}
      // No `method` here (PRE-S7-STOREFRONT-DEBT): when the action is a FUNCTION (a Server Action), React owns
      // the method and says so out loud — "React provides those automatically. They will get overridden." It
      // wrote `method="POST"` into the server HTML and applied our `method="post"` on the client: one of the
      // PDP's two hydration mismatches. The no-JS fallback is untouched — the method in the HTML is React's,
      // and it was always POST.
      className={styles.form}
      data-testid="add-to-cart-form"
      onSubmit={(e) => {
        // JS path: never navigate — add through the port and open the drawer in place.
        e.preventDefault();
        startTransition(() => {
          // A failed add REJECTS: the provider's `run` clears `busy` in its finally and re-throws. Without an
          // owner that became an unhandled rejection in the browser (the S5 class) and the shopper saw
          // nothing at all. Catching here is no longer a SILENCE: before re-throwing, `run` records the
          // refusal on the provider's error channel (MinicartProvider's `error`), which is what the shopper
          // is told from. This owner's only job is the local one — the button re-enables and the add can be
          // retried.
          addAndOpen(skuId).catch(() => {});
        });
      }}
    >
      <button type="submit" className={styles.button} disabled={working} data-testid="add-to-cart">
        {showSpinner ? 'Adicionando…' : label}
      </button>
    </form>
  );
}

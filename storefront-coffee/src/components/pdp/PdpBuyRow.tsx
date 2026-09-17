// S7-SF-PDP — the PDP buybox CTA (HANDOVER §4): ONE full-width "Adicionar ao carrinho" with the quantity
// embedded (− N +). Progressive enhancement, the house pattern (AddToCartForm): the base is a real
// <form action={addToCartThenCheckoutAction}> (a store+sku-bound Server Action) that, with NO JS, adds the line and
// redirects to /checkout. With JS the submit is intercepted and the SKU is added optimistically through the
// minicart at the chosen qty — the drawer opens (FOUNDATION), the shopper stays on the page. The qty rides a
// hidden field so the no-JS POST carries it too. Inert (no add) when there is no minicart provider (SSR/preview).
'use client';

import { ShoppingCart } from '@forgeco/storefront-kit/icons';
import { useState, useTransition } from 'react';
import { useOptionalMinicart } from '@/components/minicart/MinicartProvider';
import { useDelayedFlag } from '@/lib/useDelayedFlag';
import styles from './PdpBuyRow.module.css';

export function PdpBuyRow({
  action,
  skuId,
  soldOut = false,
  needsColor = false,
}: {
  /** The no-JS fallback: a Server Action bound to (store, skuId) that adds the line and redirects to /checkout. */
  action: () => Promise<void>;
  /** The resolved SKU — the JS path adds it (at the chosen qty) via the port and opens the drawer. */
  skuId: string;
  /** STK-1 — the resolved SKU has 0 available: the CTA disables and relabels "Esgotado" (no add path). */
  soldOut?: boolean;
  /** QA-PACK-1 C1 — the colour axis is still unpicked. A SKU is always resolved (the default one), so without
   * this the CTA would buy a colour nobody clicked while the legend beside it read "Cor: selecione". Same
   * treatment as `soldOut` and for the same reason: the two paths that can add must BOTH be closed. */
  needsColor?: boolean;
}) {
  const cart = useOptionalMinicart();
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const busy = (cart?.busy ?? false) || pending;
  // The two reasons this CTA must not add. Kept separate above (they say different things to the shopper) and
  // joined here (the add path does not care WHY).
  const blocked = soldOut || needsColor;
  // Optimistic add; the "Adicionando…" label appears only past 1s (useDelayedFlag). Disable is immediate.
  const showSpinner = useDelayedFlag(busy);

  return (
    <form
      action={action}
      className={styles.bar}
      data-testid="pdp-buy-row"
      onSubmit={(e) => {
        // Sold out, or a colour still to pick: never add, on either path. The disabled button already stops
        // the no-JS POST; this closes the JS one (and a programmatic submit).
        if (blocked) {
          e.preventDefault();
          return;
        }
        // JS path: never navigate — add through the port at the chosen qty and open the drawer in place. With no
        // provider (preview/SSR shell) let the native POST proceed (the no-JS fallback).
        if (!cart) return;
        e.preventDefault();
        startTransition(() => {
          // Same as AddToCartForm: `addAndOpen` re-throws on a failed add, and with no owner that was an
          // unhandled rejection in the browser with nothing shown to the shopper. The provider's finally
          // re-enables the button, and its `run` records the refusal on the error channel before re-throwing
          // — so this catch is the local owner, not the place the failure goes to die.
          cart.addAndOpen(skuId, qty).catch(() => {});
        });
      }}
    >
      {/* qty carried for the no-JS POST too (the action reads only skuId today, but the field keeps the DOM honest). */}
      <input type="hidden" name="qty" value={qty} readOnly />
      {/* HANDOVER §4 — the qty stepper is EMBEDDED on the left of the one dark bar, a hairline divider apart. */}
      <div className={styles.qty} data-testid="pdp-qty">
        <button
          type="button"
          className={styles.step}
          aria-label="Diminuir quantidade"
          data-testid="pdp-qty-minus"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          −
        </button>
        <span className={styles.qtyValue} data-testid="pdp-qty-value">
          {qty}
        </span>
        <button
          type="button"
          className={styles.step}
          aria-label="Aumentar quantidade"
          data-testid="pdp-qty-plus"
          onClick={() => setQty((q) => q + 1)}
        >
          +
        </button>
      </div>
      <button
        type="submit"
        className={styles.add}
        disabled={busy || blocked}
        data-soldout={soldOut || undefined}
        data-needscolor={needsColor || undefined}
        data-testid="pdp-add-to-cart"
      >
        {blocked ? null : <ShoppingCart size={17} className={styles.addIcon} />}
        {soldOut
          ? 'Esgotado'
          : needsColor
            ? 'Escolha uma cor'
            : showSpinner
              ? 'Adicionando…'
              : 'Adicionar ao carrinho'}
      </button>
    </form>
  );
}

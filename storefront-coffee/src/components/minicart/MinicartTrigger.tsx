// MinicartTrigger — the header cart affordance (icon + live count badge) AND the anchor for the minicart
// dropdown (§2.3: a panel under the icon, not a side drawer). The icon + the <MinicartDrawer> share a
// position:relative wrapper so the panel opens absolutely beneath the icon. Progressive enhancement: the base is
// a real store-scoped anchor to the checkout (works with no JS); with JS a click TOGGLES the panel (icon-open
// mode: no timer, a backdrop, mobile swipe-hint) and the badge shows the live unit count. Semantic tokens only.
'use client';

import { ShoppingCart } from '@forgeco/storefront-kit/icons';
import { type StoreBase, storeHref } from '@forgeco/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { MinicartDrawer } from './MinicartDrawer';
import { useMinicart } from './MinicartProvider';
import styles from './MinicartTrigger.module.css';

export function MinicartTrigger({
  base,
  top,
  belowItems,
}: {
  /** MULTISTORE M1-β — the store prefix of the current request. The no-JS fallback IS this anchor, so a lost
   * prefix here takes a shopper with JS off straight into another store's checkout. */
  base: StoreBase;
  /** Fill for the minicart.top slot (an <ExtensionOutlet> from the layout; absent/null in V1). */
  top?: ReactNode;
  /** Fill for the minicart.below_items slot (absent/null in V1). */
  belowItems?: ReactNode;
}) {
  const { snapshot, open, openDrawer, close } = useMinicart();
  const count = snapshot.count;

  return (
    <div className={styles.wrap}>
      <a
        className={styles.trigger}
        href={storeHref(base, '/checkout')}
        aria-label={count > 0 ? `Carrinho (${count})` : 'Carrinho'}
        data-testid="minicart-trigger"
        onClick={(e) => {
          e.preventDefault();
          if (open) close();
          else openDrawer();
        }}
      >
        <ShoppingCart size={19} />
        {count > 0 ? (
          <span className={styles.badge} data-testid="minicart-count">
            {count}
          </span>
        ) : null}
      </a>
      <MinicartDrawer base={base} top={top} belowItems={belowItems} />
    </div>
  );
}

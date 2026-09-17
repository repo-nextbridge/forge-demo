// Shelf — the responsive auto-fill grid of product cards (the list page's body). Server-rendered.
//
// renderCard (S7-SF-PLP): the theme's ONE card is INJECTED so the PLP shows the same card the shelves and
// recommendations do — WITH its store chrome (the "Frete grátis" tag + "ou Nx" line), which the page reads once
// via cardChrome and threads in. Absent → the plain card (no chrome), keeping every existing renderToString of a
// bare Shelf green.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import type { StoreBase } from '@forgeco/storefront-kit/store-route';
import { Fragment, type ReactNode } from 'react';
import { ProductCard } from './ProductCard';
import styles from './Shelf.module.css';

export function Shelf({
  products,
  base,
  renderCard,
}: {
  products: ProductDoc[];
  /** MULTISTORE M1-β — the store prefix for the FALLBACK card (an injected `renderCard` carries its own). */
  base: StoreBase;
  renderCard?: (product: ProductDoc) => ReactNode;
}) {
  return (
    <div className={styles.shelf} data-testid="shelf">
      {products.map((p) => (
        // A keyed Fragment (not a wrapper div) so the card's <article> stays the direct grid child.
        <Fragment key={p.product_id}>
          {renderCard ? renderCard(p) : <ProductCard product={p} base={base} />}
        </Fragment>
      ))}
    </div>
  );
}

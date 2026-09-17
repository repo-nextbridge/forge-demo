// The PDP template (structure, yellow zone): composes the native blocks (breadcrumb, gallery, buybox with
// the SKU selector) and marks the declared slots' render sites (<Slot>). The presentational components it uses
// are theme (green) and consume only semantic tokens.

import { mediaOptimized } from '@forgeco/storefront-kit/media/src';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE, type StoreBase } from '@forgeco/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from '@/components/Breadcrumb';
import { DocumentLinks } from '@/components/MediaBlocks';
import { Slot } from '@/lib/slots/Slot';
import { PdpGallerySelector } from './PdpGallerySelector';
import { ProductTabs } from './ProductTabs';
import styles from './template.module.css';

// `belowGallery` / `belowBuybox` / `belowCrossSell` are the fills for the pdp.below_gallery / pdp.below_buybox /
// pdp.below_cross_sell slots — each an <ExtensionOutlet> the view mounts (async, product-scoped: the extension
// blocks read this product's context via the ports). The template stays SYNCHRONOUS (renderToString-safe): it
// just places the nodes it is handed into the declared slots.
//
// BODY ORDER (S7 fix): the three body slots render one after another below the gallery/buybox hero —
// below_gallery (reviews) → below_buybox (the "compre junto" cross-sell) → below_cross_sell (the "related"
// shelf) — and the description tabs render LAST, below all of them. The buybox's own info column keeps only the
// product's native document links (below the CEP box); the cross-sell no longer sits tucked under the buybox.
export function PdpTemplate({
  product,
  crumbs,
  belowGallery,
  belowBuybox,
  belowCrossSell,
  store,
  base = HOST_BASE,
  freeShippingThreshold,
  maxInstallments,
  initialCep,
  initialSku,
  availability,
}: {
  product: ProductDoc;
  crumbs: Crumb[];
  belowGallery?: ReactNode;
  belowBuybox?: ReactNode;
  belowCrossSell?: ReactNode;
  /** The store, so the buybox can render "Comprar" (adds to the cookie cart). Absent in pure SSR snapshots. */
  store?: string;
  /** MULTISTORE M1-β — the store prefix of the current request. Optional for the SAME reason `store` is: the
   * preview gallery renders this template with no store at all, and therefore with no store context either. A
   * real page always passes it (PdpView does), and the host-resolved base is the honest default for a preview. */
  base?: StoreBase;
  /** S7 — store chrome for the buybox (the "Frete grátis" tag + "ou Nx" line), from cardChrome. */
  freeShippingThreshold?: number | null;
  maxInstallments?: number | null;
  /** S7 — the CEP already persisted on the cart, so the PDP box re-opens with it. */
  initialCep?: string | null;
  /** ★ QA16 — the `?sku=` the request carried, so the SERVED HTML is already the named variant (see
   * PdpGallerySelector). Only the dynamic entries pass it; the edge-cacheable twin never reads a query. */
  initialSku?: string;
  /** STK-1 — sku_id → available units, for the buybox's sold-out state. Absent → no sold-out UI. */
  availability?: Record<string, number>;
}) {
  // ASSETS — split media by kind: images AND video_external feed the Gallery (inside PdpGallerySelector, which
  // swaps them per variant and plays a video on the stage — S6-PDP); documents render as their own block.
  // A legacy ref without a kind is an image.
  const documents = product.media.filter((m) => m.kind === 'document');
  return (
    <main className={styles.pdp}>
      <Breadcrumb crumbs={crumbs} current={product.title} base={base} />
      <PdpGallerySelector
        product={product}
        store={store}
        base={base}
        // PRE-S7-STOREFRONT-DEBT — resolved HERE, on the server, and serialized across the boundary. The gallery
        // is a client island: if IT asked the env, the browser would get a different answer and the <img> would
        // hydrate into a mismatch.
        optimized={mediaOptimized()}
        freeShippingThreshold={freeShippingThreshold}
        maxInstallments={maxInstallments}
        initialCep={initialCep}
        initialSku={initialSku}
        availability={availability}
        // The info column below the buybox keeps ONLY the product's native document links (the cross-sell moved
        // into the body flow below — see the ordered slots after the hero).
        belowBuybox={<DocumentLinks media={documents} />}
      />
      <Slot name="pdp.below_gallery">{belowGallery}</Slot>
      <Slot name="pdp.below_buybox">{belowBuybox}</Slot>
      <Slot name="pdp.below_cross_sell">{belowCrossSell}</Slot>
      <ProductTabs product={product} />
    </main>
  );
}

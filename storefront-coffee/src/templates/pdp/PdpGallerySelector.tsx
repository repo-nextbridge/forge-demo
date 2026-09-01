// S5-SKU-EXPAND — the PDP's gallery + buybox column, made reactive to the variant. This client wrapper lifts the
// option selection out of SkuSelector so the GALLERY can swap to the selected variant's media, and shows the
// selected variant's commercial name in the product title. SSR-first: the default SKU's media + name render on
// first paint (the crawler sees a gallery + price).
//
// S6-PDP — the selection survives a LINK: selecting a variant rewrites the URL (`?sku=<code>`, replaceState), and
// opening a URL that carries the param pre-selects that variant. The canonical URL stays the product's: `?sku=`
// never becomes a second indexable page.
//
// ★★ QA16 / S2A-4 — THE SERVER RESOLVES THAT LINK NOW (`initialSku`), and it had to. The param used to be read
// on the CLIENT only, off `window.location` in a layout effect: correct for a hydrated page, and worth nothing
// to a browser with JS off, which is why a product with variations was unbuyable there — the URL the swatches
// point at answered with the default variant, at the default price, under the default "Escolha uma cor". The
// route hands the resolved code down and the FIRST PAINT is already the named variant.
//
// It costs no cache: `?sku=` is not a tracking param, so the edge already routes any request carrying it to the
// dynamic tree (lib/edge-cache.ts) — the cacheable twin never sees one and keeps rendering the default sku. The
// mount effect below stays as the belt for a host that renders this without the prop (the preview gallery), and
// it reads the same URL to the same answer, so nothing fights.
//
// S7-SF-PDP — the gallery now filters by COLOR (HANDOVER §4), not by the resolved SKU: with no color picked it
// shows ALL colors (every variant's photos) + the video; picking a color narrows to that color's photos (the
// UNION across sizes) + the video. This applies ONLY to products with a real "Cor" axis (colorAxisId); a size-only
// product keeps the S5/S6 behaviour (the gallery follows the resolved SKU's media). Below the buybox: the star
// aggregate (over the neutral rating channel), the discreet CEP box, and the info slots.
'use client';

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { defaultSku } from '@forgecommerce/storefront-kit/sku';
import { parseSkuParam, skuSearch } from '@forgecommerce/storefront-kit/sku-url';
import { HOST_BASE, type StoreBase } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BuyboxRating } from '@/components/BuyboxRating';
import { Gallery } from '@/components/Gallery';
import { CepBox } from '@/components/pdp/CepBox';
import {
  type BackorderMap,
  defaultSelection,
  resolveSku,
  type Selected,
  SkuSelector,
  selectionForSku,
} from '@/components/SkuSelector';
import { mediaAllColors, mediaForColorValue, orderGalleryItems } from '@/lib/gallery';
import { withStoreParam } from '@/lib/store-param';
import { colorAxisId } from '@/lib/variant-axes';
import styles from './template.module.css';

// The correction must land before paint (no flash of the default variant), but useLayoutEffect is a no-op —
// and a warning — on the server renderer. Same effect, picked per environment.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function PdpGallerySelector({
  product,
  store,
  base = HOST_BASE,
  belowBuybox,
  optimized = false,
  freeShippingThreshold,
  maxInstallments,
  initialCep,
  initialSku,
  availability,
}: {
  product: ProductDoc;
  store?: string;
  /** MULTISTORE M1-β — the store prefix of the current request (mirrors `store`'s optionality; see PdpTemplate). */
  base?: StoreBase;
  /** Server-rendered nodes for the info column below the buybox (slots + document links). */
  belowBuybox?: ReactNode;
  /** PRE-S7-STOREFRONT-DEBT — the server's answer to "can the media door serve these images?", passed straight
   * through to the gallery (computing it here made the PDP hydrate into a mismatch). Defaults to the unoptimized
   * render, so an SSR snapshot test gets the safe path. */
  optimized?: boolean;
  /** S7 — store chrome (cardChrome), threaded so the buybox shows the "Frete grátis" tag + "ou Nx" line. */
  freeShippingThreshold?: number | null;
  maxInstallments?: number | null;
  /** S7 — the CEP already persisted on the cart (read.cart), so the box re-opens with it. */
  initialCep?: string | null;
  /** ★ QA16 — the `?sku=` the REQUEST carried (a code, or a raw id), resolved server-side so the served HTML is
   * already the named variant. Absent → the default sku, which is what the cacheable twin and every preview
   * render. An unknown code is ignored (the default sku answers), never a 404: the param is UI state. */
  initialSku?: string;
  /** STK-1 — sku_id → available units, threaded to the SkuSelector for the sold-out state. PERF-B: normally
   * NOT passed — this component fetches it on mount (see below). A host that already holds the numbers (the
   * preview gallery's fixtures) passes them and no fetch happens. */
  availability?: Record<string, number>;
}) {
  // The variant the URL named, if it named one the catalog carries. Computed once — it is the SERVER's answer,
  // and re-deriving it on the client would let a stale prop fight `replaceState`.
  const linked = initialSku ? selectionForSku(product.skus, initialSku) : null;
  const [selected, setSelected] = useState<Selected>(
    () => linked ?? defaultSelection(product.skus),
  );
  // Whether the shopper has explicitly picked a color yet (distinct from the default SKU's color): until they
  // do, the gallery shows ALL colors — the prototype's initial state. A URL that NAMES a variant is such a
  // pick (same rule the mount effect below applies to the client-side read of the same param).
  const [colorPicked, setColorPicked] = useState(
    () => linked !== null && colorAxisId(product) !== null,
  );
  const sku = useMemo(() => resolveSku(product.skus, selected), [product.skus, selected]);
  const colorOptionId = useMemo(() => colorAxisId(product), [product]);

  // STK-1 stock, fetched CLIENT-SIDE (PERF-B). read.availability is deliberately uncached — stock moves — and
  // an uncached fetch inside the render is precisely what stopped Next from caching the PDP's HTML at all. So
  // the page is cached and the number is asked for per visit, from /api/availability. First paint carries no
  // sold-out state (exactly the pre-STK-1 behaviour, and what a failed fetch leaves), then the selector marks
  // the sold-out variants a beat later. A host that already has the numbers passes them and skips this.
  const [fetched, setFetched] = useState<Record<string, number> | undefined>(undefined);
  // ★ SF-BACKORDER-NAO-RENDERIZA — the promise rides the SAME response as the number (see the route). It is
  // fetched here and never passed in: a host that hands us fixtures is describing a shelf, not a policy.
  const [backorder, setBackorder] = useState<BackorderMap | undefined>(undefined);
  useEffect(() => {
    if (availability) return;
    let alive = true;
    const ids = product.skus.map((s) => s.id).join(',');
    if (!ids) return;
    // ★★ MS-M1α — the store travels WITH the question. Without it the route resolved the Host's store, so a
    // PDP opened under `/s/<store>` asked about stock in a different store entirely (and got it — MT5-A1).
    fetch(withStoreParam(`/api/availability?skus=${encodeURIComponent(ids)}`))
      .then((res) => (res.ok ? res.json() : { availability: {} }))
      .then((body: { availability?: Record<string, number>; backorder?: BackorderMap }) => {
        if (!alive) return;
        setFetched(body.availability ?? {});
        setBackorder(body.backorder ?? {});
      })
      .catch(() => {
        /* no stock wiring — the buybox behaves as it did before STK-1 */
      });
    return () => {
      alive = false;
    };
  }, [availability, product.skus]);
  const stock = availability ?? fetched;

  // Read the deep-link once, on mount: `?sku=<code>` → that variant's option tuple. A deep-link that names a
  // specific variant IS an explicit color pick (the gallery should open on that color).
  useBeforePaint(() => {
    const param = parseSkuParam(window.location.search);
    const fromLink = param ? selectionForSku(product.skus, param) : null;
    if (fromLink) {
      setSelected(fromLink);
      if (colorOptionId) setColorPicked(true);
    }
  }, [product.skus, colorOptionId]);

  // Write it back on every choice, so the URL in the address bar is always the link worth sharing.
  const choose = (next: Selected, optionId: string) => {
    // ANY click on the COLOR axis flips the gallery into the filtered state — including a click on the colour
    // the default SKU already carries. "The value changed" is not a synonym for "the shopper chose": the first
    // swatch IS the default, so picking it changes no value, and gating on the change left it unselectable.
    if (optionId === colorOptionId) setColorPicked(true);
    setSelected(next);
    const chosen = resolveSku(product.skus, next);
    const { pathname, search, hash } = window.location;
    window.history.replaceState(
      null,
      '',
      `${pathname}${skuSearch(search, chosen?.code ?? null)}${hash}`,
    );
  };

  // The gallery source:
  //   • color product, a color picked → the UNION of that color's images (across sizes);
  //   • color product, none picked yet → ALL colors (every variant's images);
  //   • no color axis (size-only) → the resolved SKU's own images (the S5/S6 behaviour).
  // In every case `orderGalleryItems` lifts the cover, appends the product's videos, and falls back to the
  // product's media (then the default SKU's) when the chosen source is empty.
  const colorValueId = colorOptionId ? (selected[colorOptionId] ?? null) : null;
  const gallerySource = colorOptionId
    ? colorPicked
      ? mediaForColorValue(product.skus, colorOptionId, colorValueId)
      : mediaAllColors(product.skus)
    : (sku?.media ?? []);
  const galleryMedia = orderGalleryItems(
    gallerySource,
    product.media,
    defaultSku(product)?.media ?? [],
  );

  // Re-key the gallery per source so the stage resets to the cover when the color (or the resolved SKU) changes.
  const galleryKey = colorOptionId
    ? colorPicked
      ? `color:${colorValueId ?? 'none'}`
      : 'all-colors'
    : sku?.media?.length
      ? sku.id
      : 'product';

  return (
    <div className={styles.layout}>
      <Gallery key={galleryKey} media={galleryMedia} alt={product.title} optimized={optimized} />
      <div className={styles.info}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {product.title}
            {sku?.name ? (
              <>
                {' - '}
                <span className={styles.variantName} data-testid="variant-name">
                  {sku.name}
                </span>
              </>
            ) : null}
          </h1>
          <BuyboxRating />
        </div>
        {product.description ? <p className={styles.description}>{product.description}</p> : null}
        <SkuSelector
          product={product}
          store={store}
          base={base}
          selected={selected}
          onSelect={choose}
          colorPicked={colorOptionId ? colorPicked : true}
          freeShippingThreshold={freeShippingThreshold}
          maxInstallments={maxInstallments}
          availability={stock}
          backorder={backorder}
        />
        {/* ★ QA9 · A5 — no `extraDays` prop any more: the box asks the kernel about THIS sku and the kernel
            answers the promise, extension included. The `backorder` map above is still what the SELECTOR
            renders as "Sob encomenda", which is a different sentence about the same fact. */}
        {store ? <CepBox store={store} initialCep={initialCep} skuId={sku?.id} /> : null}
        {belowBuybox}
      </div>
    </div>
  );
}

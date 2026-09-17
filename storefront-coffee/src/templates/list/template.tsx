// The list (category) template (structure, yellow zone): breadcrumb + heading, the above-shelf slot, then the
// listing body (filter sidebar + sort + chips + shelf, or a not-blank empty-state), then pagination. Filters
// and sort ride the URL (GET-first, no JS). Presentational pieces are theme (green).

import { MediaImage } from '@forgeco/storefront-kit/MediaImage';
import { altOf, mediaSrc } from '@forgeco/storefront-kit/media/src';
import type { CategoryDoc, Facets, ProductDoc } from '@forgeco/storefront-kit/read-client';
import type { StoreBase, StorePath } from '@forgeco/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { IdentityPriceOverlay } from '@/components/IdentityPriceOverlay';
import { Markdown } from '@/components/Markdown';
import { ProductListing } from '@/components/ProductListing';
import type { FilterState, SortKey } from '@/lib/filters/filter-url';
import type { SwatchImages } from '@/lib/filters/plp';
import { Slot } from '@/lib/slots/Slot';
import styles from './template.module.css';

// A category list has no query, so relevance is dropped (it would fall back to newest anyway).
const CATEGORY_SORTS: readonly SortKey[] = ['newest', 'price_asc', 'price_desc', 'name'];

export function ListTemplate({
  title,
  base,
  crumbs,
  products,
  page,
  total,
  basePath,
  facets,
  state,
  category,
  brand,
  description: descriptionProp,
  belowShelf,
  aboveShelf,
  footerBanner,
  renderCard,
  swatchImages,
}: {
  title: string;
  /** MULTISTORE M1-β — the store prefix of the current request (the breadcrumb + the fallback card). NOTE the
   * division of labour with `basePath`: that one is the list's OWN path and arrives ALREADY store-scoped, so
   * every filter/sort/"Carregar mais" link inherits the store from it. */
  base: StoreBase;
  crumbs: Crumb[];
  products: ProductDoc[];
  /** The current UI page = how many 20-item loads have happened (S7-SF-PLP accumulation). */
  page: number;
  total: number;
  basePath: StorePath;
  facets: Facets | undefined;
  state: FilterState;
  /** RICH (S2): the category's rich content (banner + description). Null/absent → the header renders bare (the
   * current PLP), so a category with no rich content is a zero-regression pass. */
  category?: CategoryDoc | null;
  /** PRE-S7-STOREFRONT-DEBT: the brand this list belongs to (the `/b/<slug>` route). `logo_url` is absolute,
   * already resolved by the read port (S6-IMAGES) — the theme never joins a media ref itself. Absent logo →
   * absent header: a brand with no logo renders the page it renders today. */
  brand?: { name: string; logo_url?: string } | null;
  /** COLL — a description for a list whose header is NOT a category's rich content. The category path already
   * carries one inside `category`; a collection has its own text and no `CategoryDoc` to hide it in. Passing a
   * fake category object would be the template lying about what it received, so the field is its own — and
   * `category.description` still wins when both are present (a category page is unchanged, byte for byte). */
  description?: string | null;
  /** The fill for the `list.below_shelf` slot — an <ExtensionOutlet> the page mounts (async), kept out of this
   * synchronous template so its renderToString tests stay untouched (the home pattern). */
  belowShelf?: ReactNode;
  /** The fill for `list.above_shelf` (S6-COMPOSE-FIX). The slot was declared and rendered EMPTY — Compose
   * offered it, and a block dropped there simply never appeared. Same pattern as `belowShelf`. */
  aboveShelf?: ReactNode;
  /** The fill for `list.footer_banner` (S7-SF-PLP) — the thin bottom banner strip (HANDOVER §5), a Compose slot
   * the demo fills with a banner instance. Same async-outlet pattern as `belowShelf`. */
  footerBanner?: ReactNode;
  /** Inject the theme's card WITH store chrome (S7-SF-PLP) — read once by the page via cardChrome. */
  renderCard?: (product: ProductDoc) => ReactNode;
  /** axisNameLower -> value -> photo url, for the color swatches (S7-SF-PLP). */
  swatchImages?: SwatchImages;
}) {
  const banner = category?.banner;
  const bannerSrc = mediaSrc(banner ?? undefined);
  const description = category?.description ?? descriptionProp;
  return (
    <main className={styles.list}>
      {crumbs.length > 0 ? <Breadcrumb crumbs={crumbs} current={title} base={base} /> : null}
      {banner?.url ? (
        // S6-IMAGES — routed through MediaImage (so it gets the alt fallback + the broken-image degrade), but
        // in the plain-<img> mode: the banner has no known box (it renders at its natural ratio, `height:auto`),
        // and next/image needs one. Giving it an invented aspect-ratio would crop somebody's banner — the box
        // arrives with BANNERS-V3 (w/h per media), and the optimizer comes with it.
        <MediaImage
          src={bannerSrc.url}
          alt={altOf(banner, title)}
          className={styles.banner}
          placeholderClassName={styles.banner}
        />
      ) : null}
      {brand?.logo_url ? (
        // The brand's logo, same mode as the banner above: a logo has an arbitrary ratio, so no box is stated
        // (plain <img>) and the CSS contains it (`object-fit: contain` — a logo is never cropped). No logo → no
        // element: the brand page degrades to the heading it has always had. A url that fails to load degrades
        // to MediaImage's placeholder — never a broken image.
        <MediaImage
          src={brand.logo_url}
          alt={brand.name}
          className={styles.brandLogo}
          placeholderClassName={styles.brandLogoPlaceholder}
        />
      ) : null}
      {description ? (
        <div className={styles.description}>
          <Markdown>{description}</Markdown>
        </div>
      ) : null}
      {/* CUST-CLUSTER wave 4 — renders nothing; fills the price anchors for a signed-in shopper. */}
      <IdentityPriceOverlay />
      <Slot name="list.above_shelf">{aboveShelf}</Slot>
      <ProductListing
        base={base}
        title={title}
        products={products}
        page={page}
        total={total}
        basePath={basePath}
        facets={facets}
        state={state}
        sortAvailable={CATEGORY_SORTS}
        renderCard={renderCard}
        swatchImages={swatchImages}
        empty={
          <EmptyState
            title="Nada por aqui"
            message="Não há produtos nesta categoria com esses filtros."
          />
        }
      />
      <Slot name="list.below_shelf">{belowShelf}</Slot>
      <Slot name="list.footer_banner">{footerBanner}</Slot>
    </main>
  );
}

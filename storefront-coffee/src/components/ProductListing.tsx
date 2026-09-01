// ProductListing (SEARCH-6 → S7-SF-PLP) — the shared PLP/search body: the filter sidebar (a FilterDrawer on
// mobile) + a toolbar (sort + active chips) + the shelf + "carregar mais", or an empty state. Both the category
// list and the search page wrap it with their own header. Everything is GET (works without JS); load-more
// preserves the active filters by building its base path through filter-url, and the theme's ONE card is
// injected via renderCard (so the PLP cards carry the same store chrome — "Frete grátis" / "ou Nx" — as the
// shelves; see cardChrome).
//
// O1-A — an EMPTY result keeps the filter rail whenever a filter is active, so the shopper who filtered down to
// zero always has the way back (see the rule at the empty branch below).

import { plural } from '@forgecommerce/storefront-kit/plural';
import type { Facets, ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import type { StoreBase, StorePath } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { FilterDrawer } from '@/components/FilterDrawer';
import { ActiveChips, Filters, SortControl } from '@/components/Filters';
import { LoadMore } from '@/components/LoadMore';
import { Shelf } from '@/components/Shelf';
import {
  activeChips,
  buildFilterUrl,
  type FilterState,
  type SortKey,
} from '@/lib/filters/filter-url';
import { plpWindow, type SwatchImages } from '@/lib/filters/plp';
import styles from './ProductListing.module.css';

export function ProductListing({
  products,
  page,
  total,
  basePath,
  base,
  facets,
  state,
  extra,
  sortAvailable,
  empty,
  renderCard,
  swatchImages,
  title,
}: {
  products: ProductDoc[];
  /** The `?page=` of the request = how many 20-item loads have happened (S7-SF-PLP accumulation). Resolved
   * against `total` into the rendered window (QA20/B11), so an absurd value is harmless here too. */
  page: number;
  total: number;
  /** The path without query (e.g. `/search` or `/roupas`). */
  /** The list's own path, ALREADY store-scoped by the caller (`storeHref(base, '/tenis')`) — every filter,
   * sort and "Carregar mais" link is built from it, so scoping it once scopes all of them. */
  basePath: StorePath;
  /** MULTISTORE M1-β — the store prefix, for the fallback card the shelf renders when none is injected. */
  base: StoreBase;
  facets: Facets | undefined;
  state: FilterState;
  /** Non-filter params to keep on every link (e.g. `{ q }` on search). */
  extra?: Record<string, string>;
  sortAvailable?: readonly SortKey[];
  empty: ReactNode;
  /** Inject the theme's card WITH store chrome (S7-SF-PLP). Absent → the plain card. */
  renderCard?: (product: ProductDoc) => ReactNode;
  /** axisNameLower -> value -> photo url, for the color swatches (S7-SF-PLP). */
  swatchImages?: SwatchImages;
  /** The page heading (S7-SF-PLP-FIDELITY): rendered on the head row's LEFT with a "{total} produtos" count,
   * the sort strip on the RIGHT (the design source's title/sort row). Absent → a bare right-aligned sort. */
  title?: string;
}) {
  // Load-more base must carry the active filters + extra so paging never drops them.
  const loadMoreBase = buildFilterUrl(basePath, state, extra);
  // QA20/B11 — the SAME pure resolution the fetch used (plp.ts accumulateList), applied to the same `page` and
  // `total`: the shelf holds the window's items, so the counter and the next-page link have to speak about the
  // window too. Derived here, once, rather than threaded through four page components.
  const win = plpWindow(page, total);
  const filterCount = activeChips(state).length;

  // The heading (brand/category/search title + count) — rendered on the empty page too, so the shopper never
  // loses the context of where they are (a brand page with 0 products must still say which brand). `title`
  // absent (bare tests) => no head row at all.
  const heading = title ? (
    <div className={styles.head} data-with-title="">
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.count} data-testid="result-count">
          {plural(total, 'produto', 'produtos')}
        </span>
      </div>
    </div>
  ) : null;

  // The filter rail: inline on desktop, the "Filtrar (N)" trigger + slide-in drawer on mobile (FilterDrawer's
  // CSS switches between them). ONE definition, so the emptied page and the populated one offer the same rail.
  const filterRail = (
    <aside className={styles.sidebar}>
      <FilterDrawer count={filterCount}>
        <Filters
          facets={facets}
          state={state}
          basePath={basePath}
          extra={extra}
          swatchImages={swatchImages}
        />
      </FilterDrawer>
    </aside>
  );

  // O1-A — an emptied PLP must never trap the shopper. The empty state used to replace the WHOLE body, sidebar
  // included, and the sidebar is where the FilterDrawer lives: on mobile the drawer is the ONLY filter affordance
  // (its trigger is the mobile chrome; desktop shows the panel inline), so filtering down to zero deleted the
  // very control that undoes the filter which emptied the page. The filter itself survived — it rides the URL —
  // and only the way back was gone.
  //
  // So the rule is: the way back renders exactly when there is something to go back FROM. No active filter (a
  // genuinely empty category) => the full-width message it has always been, which is why the sidebar was dropped
  // here in the first place: reserving a 236px column for facets an empty catalog cannot offer pushed the message
  // off to the right. An active filter => the ordinary frame minus the shelf, so the trigger, the panel and the
  // chips all survive and any of them takes the shopper back.
  if (products.length === 0) {
    if (filterCount === 0) {
      return (
        <div className={styles.plp} data-empty="">
          {heading}
          {empty}
        </div>
      );
    }
    return (
      <div className={styles.plp} data-empty="">
        {heading}
        <div className={styles.layout}>
          {filterRail}
          <div className={styles.main}>
            <ActiveChips state={state} basePath={basePath} extra={extra} />
            {empty}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.plp}>
      {/* The head row spans the FULL width ABOVE the sidebar+results grid (design source §1): title + "{N}
          produtos" on the left, the sort strip on the right. On mobile it stacks (CSS). `title` absent (bare
          tests) → sort only, right-aligned. */}
      <div className={styles.head} data-with-title={title ? '' : undefined}>
        {title ? (
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.count} data-testid="result-count">
              {plural(total, 'produto', 'produtos')}
            </span>
          </div>
        ) : null}
        <SortControl state={state} basePath={basePath} extra={extra} available={sortAvailable} />
      </div>
      <div className={styles.layout}>
        {filterRail}
        {/* Past the early return above, this branch always has products — the empty page is rendered there. */}
        <div className={styles.main}>
          <ActiveChips state={state} basePath={basePath} extra={extra} />
          <Shelf products={products} base={base} renderCard={renderCard} />
          <LoadMore
            page={win.lastPage}
            from={win.from}
            shown={products.length}
            total={total}
            basePath={loadMoreBase}
          />
        </div>
      </div>
    </div>
  );
}

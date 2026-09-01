// Search template (structure, yellow zone): the visual consumer of read.search. A VIEW — all the search
// intelligence (tsvector PT, unaccent, trgm, synonyms, filters, sort, the published-only JOIN) lives in the
// port; this renders what it returns. Three states: results (Filters + Shelf + "Carregar mais"), no match (empty
// state WITH suggestions — categories + newest), and empty query (a neutral prompt). GET-first: filters/sort
// ride the URL and work without JS. A curated redirect is handled by the page (navigates before render).
//
// S6-FIXPACK — there is NO search box in the page body: the header's is the one and only search input (two
// boxes on the same screen was noise, and they drifted out of sync).

import type { CategoryMap, Facets, ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { ProductListing } from '@/components/ProductListing';
import { SearchSuggestions } from '@/components/SearchSuggestions';
import type { FilterState } from '@/lib/filters/filter-url';
import type { SwatchImages } from '@/lib/filters/plp';
import styles from './template.module.css';

export function SearchTemplate({
  q,
  base,
  products,
  page,
  total,
  facets,
  state,
  catmap,
  suggestions,
  renderCard,
  swatchImages,
}: {
  q: string;
  /** MULTISTORE M1-β — the store prefix of the current request. */
  base: StoreBase;
  products: ProductDoc[];
  /** The current UI page = how many 20-item loads have happened (S7-SF-PLP accumulation). */
  page: number;
  total: number;
  facets: Facets | undefined;
  state: FilterState;
  catmap: CategoryMap;
  suggestions: ProductDoc[];
  /** Inject the theme's card WITH store chrome (S7-SF-PLP). */
  renderCard?: (product: ProductDoc) => ReactNode;
  /** axisNameLower -> value -> photo url, for the color swatches (S7-SF-PLP). */
  swatchImages?: SwatchImages;
}) {
  const trimmed = q.trim();
  const extra = { q };

  // No term AND no results — a bare /search with nothing to show → the neutral prompt (not an error). A term with
  // no match, or a facet-only URL (SEARCH-ALL), falls through to the listing (which renders its own empty state).
  if (trimmed === '' && products.length === 0) {
    return (
      <main className={styles.search}>
        <EmptyState title="Buscar produtos" message="Digite um termo para buscar no catálogo." />
      </main>
    );
  }

  return (
    <main className={styles.search}>
      <ProductListing
        title={trimmed === '' ? 'Todos os produtos' : `Resultados para “${trimmed}”`}
        products={products}
        page={page}
        total={total}
        base={base}
        basePath={storeHref(base, '/search')}
        facets={facets}
        state={state}
        extra={extra}
        renderCard={renderCard}
        swatchImages={swatchImages}
        empty={
          <SearchSuggestions
            title="Nada encontrado"
            message={`Nada para “${trimmed}”.`}
            catmap={catmap}
            products={suggestions}
            base={base}
          />
        }
      />
    </main>
  );
}

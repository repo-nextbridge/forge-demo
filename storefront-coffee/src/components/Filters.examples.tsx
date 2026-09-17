// Catalog example for the PLP/search filter chrome (/ui-storefront/filters) — the facet sidebar dressed to the
// design source (S7-SF-PLP-FIDELITY): the Cor solid-hue swatches, the Tamanho text grid, the Preço slider island,
// the Marca checkbox list and the collapsible custom-field groups. It also shows the two siblings exported from the
// same file: the SortControl strip and the ActiveChips row. Inline fixtures only — no data port is touched.
'use client';

import type { Facets } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import type { FilterState } from '@/lib/filters/filter-url';
import type { SwatchImages } from '@/lib/filters/plp';
import { ActiveChips, Filters, SortControl } from './Filters';

/** A 1×1 colored square as a data URI — a stand-in swatch photo so the sidebar renders offline. */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

const COVERS = ['%23e7e9ec', '%23d9dde1', '%23c7cdd4', '%23eceef1', '%23dfe3e7'];

const FACETS: Facets = {
  options: [
    {
      name: 'Cor',
      values: [
        { value: 'Branco', count: 19 },
        { value: 'Preto', count: 23 },
        { value: 'Cinza', count: 11 },
        { value: 'Azul', count: 9 },
        { value: 'Verde', count: 5 },
        { value: 'Vermelho', count: 6 },
        { value: 'Rosa', count: 3 },
        { value: 'Bege', count: 3 },
      ],
    },
    {
      name: 'Tamanho',
      values: ['37', '38', '39', '40', '41', '42', '43', '44'].map((value) => ({
        value,
        count: 12,
      })),
    },
  ],
  price: { min: 20000, max: 100000 },
  brands: [
    { slug: 'adibas', name: 'Adibas', count: 9 },
    { slug: 'asixx', name: 'Asixx', count: 3 },
    { slug: 'mike', name: 'Mike', count: 9 },
    { slug: 'nova-balance', name: 'Nova Balance', count: 4 },
    { slug: 'pumba', name: 'Pumba', count: 5 },
  ],
  custom_fields: [
    {
      key: 'Amortecimento',
      values: [
        { value: 'Alto', count: 7 },
        { value: 'Baixo', count: 8 },
        { value: 'Médio', count: 14 },
      ],
    },
    {
      key: 'Fechamento',
      values: [
        { value: 'Cadarço', count: 41 },
        { value: 'Elástico', count: 1 },
        { value: 'Velcro', count: 3 },
      ],
    },
  ],
};

const SWATCH_IMAGES: SwatchImages = {
  cor: Object.fromEntries(
    ['Branco', 'Preto', 'Cinza', 'Azul', 'Verde', 'Vermelho', 'Rosa', 'Bege'].map((v, i) => [
      v,
      square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
    ]),
  ),
};

const CLEAN: FilterState = { options: {}, cf: {} };
const ACTIVE: FilterState = {
  options: { cor: ['Preto'] },
  cf: { Amortecimento: 'Alto' },
  brand: 'mike',
  priceMin: 30000,
  priceMax: 80000,
};

export function FiltersExamples() {
  return (
    <div style={{ display: 'grid', gap: 32, maxWidth: 320, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Sidebar: no active filters</p>
        <Filters
          facets={FACETS}
          state={CLEAN}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
          swatchImages={SWATCH_IMAGES}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          Sidebar: with active filters (shows “Limpar filtros”)
        </p>
        <Filters
          facets={FACETS}
          state={ACTIVE}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
          swatchImages={SWATCH_IMAGES}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>SortControl: the underlined sort tabs</p>
        <SortControl
          state={ACTIVE}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          ActiveChips: the removable chips row above the shelf
        </p>
        <ActiveChips
          state={ACTIVE}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
        />
      </div>
    </div>
  );
}

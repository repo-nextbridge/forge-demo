// Catalog example for the price facet slider (/ui-storefront/price-slider) — the dual square-thumb price range
// (S7-SF-PLP, "Preço slider até R$ 1.000+"). Under SSR/renderToString the island is inert (no router) and falls to
// its honest no-JS GET-form baseline; on a live page it swaps in the two overlaid range thumbs with the "R$ X até
// R$ Y+" readout below. Both states are dressed here with the same {min,max} price bounds. Inline fixtures only.
'use client';

import { HOST_BASE, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { FilterState } from '@/lib/filters/filter-url';
import { PriceSlider } from './PriceSlider';

const EMPTY: FilterState = { options: {}, cf: {} };
const BOUNDED: FilterState = { options: {}, cf: {}, priceMin: 30000, priceMax: 80000 };

export function PriceSliderExamples() {
  return (
    <div style={{ display: 'grid', gap: 32, maxWidth: 280, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Full range: no price filter applied</p>
        <PriceSlider
          min={20000}
          max={100000}
          state={EMPTY}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Bounded: R$ 300 até R$ 800</p>
        <PriceSlider
          min={20000}
          max={100000}
          state={BOUNDED}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
        />
      </div>
    </div>
  );
}

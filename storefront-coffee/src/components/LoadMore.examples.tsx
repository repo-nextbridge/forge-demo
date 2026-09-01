// Catalog example for the PLP's load-more (/ui-storefront/load-more) — the "Mostrando X de Y produtos" counter plus
// the "Carregar mais produtos" GET link that replaces numbered pagination (S7-SF-PLP). Shown across its meaningful
// states: more to load, everything shown (button hidden), a SLID window (QA20/B11: the shelf holds a slice, so the
// counter names it and the way back appears), and empty (renders nothing). Server-rendered, no data port.

import { HOST_BASE, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { LoadMore } from './LoadMore';

export function LoadMoreExamples() {
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>More to load: counter + button</p>
        <LoadMore
          page={1}
          from={1}
          shown={20}
          total={64}
          basePath={storeHref(HOST_BASE, '/search?q=tenis')}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          Everything shown: counter only, button hidden
        </p>
        <LoadMore
          page={2}
          from={1}
          shown={24}
          total={24}
          basePath={storeHref(HOST_BASE, '/roupas')}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          Past the per-request window: the slice is named, plus the way back to the top
        </p>
        <LoadMore
          page={8}
          from={61}
          shown={100}
          total={653}
          basePath={storeHref(HOST_BASE, '/tenis')}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>No results: renders nothing (total = 0)</p>
        <LoadMore
          page={1}
          from={1}
          shown={0}
          total={0}
          basePath={storeHref(HOST_BASE, '/search?q=xyz')}
        />
      </div>
    </div>
  );
}

// Catalog example for BuyButton (/ui-storefront/buy-button) — the PDP "Comprar" that adds the resolved SKU to the
// cookie cart (Server Action) and navigates to the one-page checkout, disabling itself while the add is in flight.
// Rendered with a stub store+sku; the click path is inert in the offline preview (no route/DB). BuyButton reads
// `useRouter()` unguarded, so the example mounts a stub app-router context (the real gallery's Next router would
// otherwise navigate away on click) — this also keeps the SSR render-guard happy.
'use client';

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { BuyButton } from './BuyButton';

const stubRouter: AppRouterInstance = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};

export function BuyButtonExamples() {
  return (
    <AppRouterContext.Provider value={stubRouter}>
      <div style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Adiciona ao carrinho e vai para o checkout</p>
        <BuyButton base={HOST_BASE} store="demo" skuId="sku_speed_elite_preto_40" />
      </div>
    </AppRouterContext.Provider>
  );
}

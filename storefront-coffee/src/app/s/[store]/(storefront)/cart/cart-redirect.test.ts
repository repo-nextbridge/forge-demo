// ★ QA-CESTA E1 — `/cart` answers, and it answers with the cart the shopper is looking for.
//
// The route existed only as a 404 (QA-S3 OBS-1 on Staging). The assertion is the TARGET, not merely that
// something happened: a redirect to the home page would also stop the 404 and would still lose the buyer.

import { HOST_BASE, pathScopedBase } from '@forgeco/storefront-kit/store-route';
import { expect, test, vi } from 'vitest';

const redirected: string[] = [];

// The route goes through the house helper (`storeRedirect`), so the mock sits at `next/navigation` — where
// the helper itself calls — rather than at the helper. That way the STORE SCOPING the helper applies is
// under test too, instead of being stubbed away.
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirected.push(to);
    // Next's `redirect` throws to unwind the render; the real one is what the route relies on.
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  permanentRedirect: (to: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${to}`);
  },
}));

vi.mock('@forgeco/storefront-kit/store-route.server', () => ({
  // The header-resolved case: the shopper is on the store's own host, so the base is clean.
  requestStoreBase: async () => HOST_BASE,
}));

async function run(store: string): Promise<string> {
  redirected.length = 0;
  const { default: CartPage } = await import('./page');
  await expect(CartPage({ params: Promise.resolve({ store }) })).rejects.toThrow(/NEXT_REDIRECT/);
  const target = redirected[0];
  if (!target) throw new Error('the route redirected nowhere');
  return target;
}

test('★ /cart sends the shopper to the checkout, where this storefront keeps the editable cart', async () => {
  expect(await run('demo')).toBe('/checkout');
});

test('★ …and it is the STORE’s checkout under path-based routing, never another store’s', async () => {
  // The money bug this storefront's `storeHref`/`requestStoreBase` pair exists to prevent: a clean `/checkout`
  // emitted from a path-scoped page resolves the next request against whatever store the Host names.
  vi.doMock('@forgeco/storefront-kit/store-route.server', () => ({
    requestStoreBase: async (store: string) => pathScopedBase(store),
  }));
  vi.resetModules();
  expect(await run('outlet')).toBe('/s/outlet/checkout');
});

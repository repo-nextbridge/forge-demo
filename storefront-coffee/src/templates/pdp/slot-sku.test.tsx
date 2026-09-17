// ★ SUB-S2 — WHICH VARIANT A PDP BLOCK IS TALKING ABOUT, and why the page has to say.
//
// A block below the buybox that adds to the cart needs a SKU, and it has none of the page's context: it gets
// the handle (so it can re-read the catalog) and nothing about the shopper's choice. `?sku=` is the page's own
// answer — the URL the variant selector writes and the one worth sharing — and the outlet already has a prop
// for exactly this shape of fact (`query`, "a block is not a page, so it has no searchParams of its own").
//
// ⚠️ THE EDGE-CACHED TWIN CANNOT READ A QUERY AT ALL, so `sku` is simply absent there and a block falls back to
// the default variant — the one that page's own buybox is showing. That is why this asserts the ABSENCE too:
// passing `{ sku: undefined }` would hand every block a key whose value is a lie.

import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

const outlets: { name: string; query?: Record<string, string> }[] = [];
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({
  ExtensionOutlet: (props: { name: string; query?: Record<string, string> }) => {
    outlets.push({ name: props.name, query: props.query });
    return null;
  },
}));
vi.mock('@/lib/cart-actions', () => ({ addManyToCartAction: async () => {} }));
vi.mock('@forgeco/storefront-kit/config', () => ({
  readClient: () => ({ categories: async () => ({}) }),
}));
vi.mock('@/lib/cardChrome', () => ({
  cardChrome: async () => ({ freeShippingThreshold: null, maxInstallments: 1 }),
}));
vi.mock('@/lib/productStructuredData', () => ({ productStructuredData: async () => undefined }));
vi.mock('@/lib/seo/store-origin', () => ({ storeOrigin: () => null }));
vi.mock('@/components/IdentityPriceOverlay', () => ({ IdentityPriceOverlay: () => null }));
// The template itself is not what is under test — the props the view builds for its outlets are.
vi.mock('./template', () => ({
  PdpTemplate: (props: {
    belowGallery: ReactNode;
    belowBuybox: ReactNode;
    belowCrossSell: ReactNode;
  }) => (
    <>
      {props.belowGallery}
      {props.belowBuybox}
      {props.belowCrossSell}
    </>
  ),
}));

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { PdpView } from './PdpView';

const PRODUCT = {
  product_id: 'prod_1',
  handle: 'cafe',
  title: 'Café',
  media: [],
  categories: [],
  skus: [{ id: 'sku_1', code: 'CAFE-250', amount: 4990, media: [], option_values: [] }],
} as never;

async function outletQueries(sku?: string): Promise<(Record<string, string> | undefined)[]> {
  outlets.length = 0;
  const ui = await PdpView({ store: 'demo', base: HOST_BASE, product: PRODUCT, sku });
  render(ui as React.ReactElement);
  expect(outlets.map((o) => o.name)).toEqual([
    'pdp.below_gallery',
    'pdp.below_buybox',
    'pdp.below_cross_sell',
  ]);
  return outlets.map((o) => o.query);
}

test('★ every PDP slot is told the variant the page was asked for', async () => {
  expect(await outletQueries('CAFE-500')).toEqual([
    { sku: 'CAFE-500' },
    { sku: 'CAFE-500' },
    { sku: 'CAFE-500' },
  ]);
});

test('★ with no `?sku=` the blocks are told NOTHING, never an empty key', async () => {
  expect(await outletQueries(undefined)).toEqual([undefined, undefined, undefined]);
});

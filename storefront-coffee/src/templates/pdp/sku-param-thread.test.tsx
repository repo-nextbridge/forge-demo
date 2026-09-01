// ★★ QA16 / S2A-4 — THE `?sku=` OF THE REQUEST REACHES THE TEMPLATE, from the route file down.
//
// The no-JS fix has two halves (see nojs-variant.e2e.test.tsx for the other): the swatches submit `?sku=<code>`,
// and the SERVER answers with that variant. The second half is a chain of four hops —
//
//     route(searchParams) → CatalogView → PdpView → PdpTemplate
//
// — and every one of them is an OPTIONAL prop, which typecheck cannot hold: a hop that quietly stops forwarding
// compiles, renders, and puts the shopper back on the default variant with no error anywhere. So the chain is
// walked here for real. Nothing is rendered: each async Server Component is invoked exactly as the framework
// invokes it and the element it returns is read, the same technique the order-detail page test uses.

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { beforeEach, expect, test, vi } from 'vitest';
import { makeProduct } from '@/test/fixtures';

const { resolveCatchAll, productByHandle } = vi.hoisted(() => ({
  resolveCatchAll: vi.fn(),
  productByHandle: vi.fn(),
}));

// The catalog decision and the reads are somebody else's proof (lib/catch-all.test.ts); this file is about the
// parameter's journey, so the port is a stub and the template is a spy.
vi.mock('@/lib/catch-all', () => ({ resolveCatchAll }));
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({ productByHandle, categories: async () => ({}) }),
}));
vi.mock('@/lib/cardChrome', () => ({
  cardChrome: async () => ({ freeShippingThreshold: null, maxInstallments: null }),
}));
vi.mock('@/lib/productStructuredData', () => ({ productStructuredData: async () => undefined }));
vi.mock('@/lib/seo/store-origin', () => ({ storeOrigin: () => null }));
vi.mock('@forgecommerce/storefront-kit/store-route.server', () => ({
  requestStoreBase: async () => '',
}));
vi.mock('@/lib/cart-actions', () => ({
  addManyToCartAction: async () => {},
  addToCartThenCheckoutAction: async () => {},
}));

// The PDP view also emits the JSON-LD graphs and mounts the identity overlay. Neither is on the parameter's
// path, and walking into a client component means calling a hook outside a renderer — so they are stubbed out.
vi.mock('@/components/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/components/IdentityPriceOverlay', () => ({ IdentityPriceOverlay: () => null }));

/** The spy at the end of the chain: whatever the template is handed, captured. */
const templateProps = vi.fn();
vi.mock('./template', () => ({
  PdpTemplate: (props: Record<string, unknown>) => {
    templateProps(props);
    return null;
  },
}));

import CatalogPage from '@/app/s/[store]/(storefront)/[...catpath]/page';
import ProductAliasPage from '@/app/s/[store]/(storefront)/p/[handle]/page';

/** Invoke async Server Components level by level, exactly as the framework does, descending through fragments
 * and children until the spied template has been reached. Nothing is rendered to HTML: this walks the element
 * tree the routes return, which is precisely where a prop goes missing. */
async function walk(node: unknown): Promise<void> {
  if (Array.isArray(node)) {
    for (const child of node) await walk(child);
    return;
  }
  if (!node || typeof node !== 'object' || !('type' in node)) return;
  const el = node as { type: unknown; props: Record<string, unknown> };
  if (typeof el.type === 'function') {
    await walk(await (el.type as (p: unknown) => unknown)(el.props));
    return;
  }
  // A fragment (or a host element): keep going through its children.
  await walk(el.props?.children);
}

/** An UNCATEGORIZED product: `/p/<handle>` is then its own canonical, so the alias route renders instead of
 * redirecting, and the catch-all's canonical check is satisfied by the path we pass it. */
function uncategorized(): ProductDoc {
  return makeProduct({ categories: [] });
}

beforeEach(() => {
  templateProps.mockClear();
  resolveCatchAll.mockResolvedValue({ kind: 'product', product: uncategorized() });
  productByHandle.mockResolvedValue(uncategorized());
});

test('★★ the catch-all route hands `?sku=` all the way to the PDP template', async () => {
  const element = await CatalogPage({
    params: Promise.resolve({ store: 'demo', catpath: ['p', 'tenis-esportivo'] }),
    searchParams: Promise.resolve({ sku: 'TEN-40' }),
  });
  await walk(element);

  expect(templateProps).toHaveBeenCalledTimes(1);
  expect(templateProps.mock.calls[0]?.[0]).toMatchObject({ initialSku: 'TEN-40' });
});

test('★★ the /p/<handle> alias too — an uncategorized product has no other PDP', async () => {
  const element = await ProductAliasPage({
    params: Promise.resolve({ store: 'demo', handle: 'tenis-esportivo' }),
    searchParams: Promise.resolve({ sku: 'TEN-39' }),
  });
  await walk(element);

  expect(templateProps.mock.calls[0]?.[0]).toMatchObject({ initialSku: 'TEN-39' });
});

test('★ no `?sku=` → the template is told nothing, and renders the default variant as it always did', async () => {
  const element = await CatalogPage({
    params: Promise.resolve({ store: 'demo', catpath: ['p', 'tenis-esportivo'] }),
    searchParams: Promise.resolve({}),
  });
  await walk(element);

  expect(templateProps.mock.calls[0]?.[0]).toMatchObject({ initialSku: undefined });
});

test('★ a repeated param takes the first, and a blank one is an absence (never an empty deep link)', async () => {
  await walk(
    await CatalogPage({
      params: Promise.resolve({ store: 'demo', catpath: ['p', 'tenis-esportivo'] }),
      searchParams: Promise.resolve({ sku: ['TEN-40', 'TEN-39'] }),
    }),
  );
  expect(templateProps.mock.calls[0]?.[0]).toMatchObject({ initialSku: 'TEN-40' });

  templateProps.mockClear();
  await walk(
    await CatalogPage({
      params: Promise.resolve({ store: 'demo', catpath: ['p', 'tenis-esportivo'] }),
      searchParams: Promise.resolve({ sku: '' }),
    }),
  );
  expect(templateProps.mock.calls[0]?.[0]).toMatchObject({ initialSku: undefined });
});

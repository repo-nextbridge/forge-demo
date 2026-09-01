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

// ★★ D2-C1 — THIS ARM CHANGED SUBJECT BECAUSE THE SHOP DID, and the old assertion is kept in the sentence
// below rather than deleted quietly.
//
// It used to assert that `/p/<handle>` threads `?sku=` down to the reference PDP template. That route now
// renders THIS SHOP'S product page (`PdpCoffeeView`), which has no swatch grid and no PLP behind it —
// nothing in this storefront mints a URL naming a SKU — so honouring the parameter would be answering a
// question nobody asks. The catch-all arm above still proves the chain for the reference template, which is
// still what a CATEGORIZED product renders.
//
// ⚠️ AND IT COSTS SOMETHING REAL, NAMED HERE SO IT IS NOT DISCOVERED LATER: the reference PDP's variant
// picker works with JavaScript OFF (the swatches submit `?sku=` and the SERVER answers with that variant —
// `nojs-variant.e2e.test.tsx` is the other half). This shop's buy box is a client component and holds its
// selection in React state, so with JS off the page renders and reads correctly and CANNOT BE BOUGHT FROM.
// That is a deliberate trade of the design (a two-axis picker, a mode switch and a stepper in one panel),
// not an oversight — and it is a card, not a silence.
test('★★ the /p/<handle> alias renders THIS shop`s page for an uncategorized product', async () => {
  const element = await ProductAliasPage({
    params: Promise.resolve({ store: 'demo', handle: 'tenis-esportivo' }),
    searchParams: Promise.resolve({ sku: 'TEN-39' }),
  });

  // The route must resolve the product and return a page rather than 404 — the property this arm has always
  // protected. It is NOT walked: the coffee page's buy box is a client component, and invoking one the way
  // the framework invokes a Server Component is what this walker cannot do (`useState` of a null dispatcher).
  expect(element).toBeTruthy();
  expect(productByHandle).toHaveBeenCalledWith('demo', 'tenis-esportivo');
  // And the reference template is NOT what answered: this route stopped being its host.
  expect(templateProps).not.toHaveBeenCalled();
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

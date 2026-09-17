// ★★ WHICH PRODUCT PAGE EACH ROUTE ANSWERS WITH — and why `?sku=` is no longer threaded anywhere in this shop.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS FILE USED TO PROVE, KEPT IN WORDS RATHER THAN DELETED QUIETLY. It walked the `?sku=` deep link
// down four hops — `route(searchParams) → CatalogView → PdpView → PdpTemplate` — because every hop is an
// OPTIONAL prop, which typecheck cannot hold: a hop that stops forwarding compiles, renders, and puts the
// shopper back on the default variant with no error anywhere.
//
// ★ WHY IT STOPPED BEING TRUE (2026-09-02). The reference template was never what this shop meant to show.
// `p/[handle]` rendered `PdpCoffeeView` but 308s to the canonical CATEGORY path whenever a product has a
// primary category — and every coffee here does — so the catch-all answered every real visit, and it
// rendered `PdpView`. Measured on the bench before the fix: all six products, 308, and ZERO `coffee_`
// classes in the HTML. `PdpCoffee`, `CoffeeBuyBox` and the whole `coffee.module.css` shipped inside the
// image and drew nothing; what the shopper saw was the reference PDP wearing the theme's colours.
//
// So BOTH product entries in BOTH trees now render this shop's page, and the `?sku=` chain has no host left
// here. It is not broken — it is unused, for the reason `p/[handle]` already stated: this buy box opens on
// the merchant's starred SKU, has no swatch grid and no PLP behind it, so nothing in this storefront mints a
// URL naming a SKU. The reference chain is still proven where it still lives — `PdpView`'s own tests
// (`slot-sku.test.tsx`) — and the DESIGN COST is unchanged and still named below.
//
// ⚠️ THE COST, NAMED HERE SO IT IS NOT DISCOVERED LATER: the reference PDP's variant picker works with
// JavaScript OFF (swatches submit `?sku=` and the SERVER answers with that variant — `nojs-variant.e2e` is
// the other half). This shop's buy box is a client component holding its selection in React state, so with
// JS off the page renders and reads correctly and CANNOT BE BOUGHT FROM. A deliberate trade of the design
// (a two-axis picker, a mode switch and a stepper in one panel), and a card — not a silence.
//
// Nothing is rendered here: each async Server Component is invoked exactly as the framework invokes it and
// the element it returns is read, the same technique the order-detail page test uses. The coffee page is NOT
// walked into — its buy box is a client component, and invoking one this way is a `useState` on a null
// dispatcher.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { beforeEach, expect, test, vi } from 'vitest';
import { makeProduct } from '@/test/fixtures';

const { resolveCatchAll, productByHandle } = vi.hoisted(() => ({
  resolveCatchAll: vi.fn(),
  productByHandle: vi.fn(),
}));

// The catalog decision and the reads are somebody else's proof (lib/catch-all.test.ts); this file is about the
// parameter's journey, so the port is a stub and the template is a spy.
vi.mock('@/lib/catch-all', () => ({ resolveCatchAll }));
vi.mock('@forgeco/storefront-kit/config', () => ({
  readClient: () => ({ productByHandle, categories: async () => ({}) }),
}));
vi.mock('@/lib/cardChrome', () => ({
  cardChrome: async () => ({ freeShippingThreshold: null, maxInstallments: null }),
}));
vi.mock('@/lib/productStructuredData', () => ({ productStructuredData: async () => undefined }));
vi.mock('@/lib/seo/store-origin', () => ({ storeOrigin: () => null }));
vi.mock('@forgeco/storefront-kit/store-route.server', () => ({
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

/** Invoke ONE level: the element a route returned, whose type is the next async Server Component. Stopping
 * after one step is what makes these arms possible — the coffee page's buy box is a client component, and
 * `walk`ing into one is a `useState` on a null dispatcher. */
async function step(node: unknown): Promise<{ type: unknown; props: Record<string, unknown> }> {
  const el = node as { type: (p: unknown) => unknown; props: Record<string, unknown> };
  return (await el.type(el.props)) as { type: unknown; props: Record<string, unknown> };
}

/** The name of the component an element will render — the question these arms actually ask. */
const nameOf = (el: { type: unknown }) => (el.type as { name?: string })?.name;

test('★★ the catch-all product branch renders THIS shop`s page, not the reference one', async () => {
  const rendered = await step(
    await CatalogPage({
      params: Promise.resolve({ store: 'demo', catpath: ['p', 'tenis-esportivo'] }),
      searchParams: Promise.resolve({ sku: 'TEN-40' }),
    }),
  );

  // The POSITIVE: the branch ran, the port was asked, and the element names this shop's page.
  expect(resolveCatchAll).toHaveBeenCalledTimes(1);
  expect(nameOf(rendered)).toBe('PdpCoffeeView');
  // And the NEGATIVE it is paired with — the reference template was never handed anything. Alone this would
  // also be true of a route that returned null or threw, which is why it never stands by itself.
  expect(templateProps).not.toHaveBeenCalled();
});

// ★ THE TWO ARMS THAT LIVED HERE PROVED THE `?sku=` PARSING RULE — a repeated parameter takes the first, a
// blank one is an absence — by reading what arrived at the reference template. They are gone with the chain
// they walked: this route has no reader for the parameter any more, so an assertion about how it is parsed
// would be asserting over a value nothing consumes, and would go on passing after the rule itself broke.
//
// The rule still exists and still matters — it lives in `@forgeco/storefront-kit/sku-url`, and it is
// proven where the reference storefront still honours it. Keeping a copy here would be a test that survives
// its own subject.
test('★★ and no shape of `?sku=` can put the reference template back', async () => {
  for (const searchParams of [{}, { sku: 'TEN-40' }, { sku: ['TEN-40', 'TEN-39'] }, { sku: '' }]) {
    templateProps.mockClear();
    const rendered = await step(
      await CatalogPage({
        params: Promise.resolve({ store: 'demo', catpath: ['p', 'tenis-esportivo'] }),
        searchParams: Promise.resolve(searchParams),
      }),
    );
    expect(nameOf(rendered)).toBe('PdpCoffeeView');
    expect(templateProps).not.toHaveBeenCalled();
  }
});

test('★★ the /p/<handle> alias renders THIS shop`s page for an uncategorized product', async () => {
  const element = await ProductAliasPage({
    params: Promise.resolve({ store: 'demo', handle: 'tenis-esportivo' }),
    searchParams: Promise.resolve({ sku: 'TEN-39' }),
  });

  expect(nameOf(element as { type: unknown })).toBe('PdpCoffeeView');
  expect(productByHandle).toHaveBeenCalledWith('demo', 'tenis-esportivo');
  expect(templateProps).not.toHaveBeenCalled();
});

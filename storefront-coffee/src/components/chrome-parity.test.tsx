// ★★ P2 · ACC1-3 + ACC1-4 — THE VITRINE'S HALF OF ONE STORE'S CHROME, PROVEN BY RENDERING.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHY THERE ARE TWO FILES AND NOT ONE. The same test exists in `apps/checkout`
// (`src/app/s/[store]/(account)/chrome-parity.test.tsx`) and the two are deliberately not one file: the
// deployables are two BUILDS and neither may import the other (there is a guard), so nothing can render both
// halves in one process. What makes them a PAIR is not that they look alike — it is that both assert against
// the SAME EXPORTED SOURCE in `@forgecommerce/storefront-kit`. A literal copied into both would pass while the
// two stores diverged, which is the exact class of defect the acceptance pass found:
//
//   · the header on `/account/login` had NO CART while every page here had one (ACC1-3);
//   · the search asked "O que você procura?" here and "Buscar produtos" there (ACC1-4).
//
// So every expectation below is a VALUE IMPORTED FROM THE KIT. Change the kit and both files follow; change
// one front and only that front goes red, naming it.
//
// ⚠️ pk15/D2 — AND IN THIS FORK "THE VITRINE" IS THE INHERITED COMPONENT, NOT A PAGE. `StorefrontChrome` is
// mounted by no layout here since pk14/D5 (see its header); this file therefore judges the fork's COPY of
// the reference chrome, which is what a re-fork starts from and what `chrome-identity.test.tsx` uses as its
// control. Nothing about the shop the visitor opens is asserted here — that is `components/coffee/`.

import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { SEARCH_PROMPT } from '@forgecommerce/storefront-kit/subtemplates';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

vi.mock('@forgecommerce/storefront-kit/payment-badges', () => ({
  paymentBadges: async () => ['Pix'],
}));
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({
  ExtensionOutlet: ({ name }: { name: string }) => <i data-outlet={name} />,
}));
// ONLY THE CONTEXT is stubbed, and only because of a shape React cannot render: the minicart provider is a
// client component and an async server component (the kit chrome) sits UNDER it, which
// `renderToStaticMarkup` cannot resolve. The TRIGGER itself is the real one — a marker component here would
// make the cart assertion below circular, which is the whole failure mode this file exists to catch.
vi.mock('@/components/minicart/MinicartProvider', () => ({
  MinicartProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useMinicart: () => ({ ...EMPTY_CART_CONTEXT }),
  useOptionalMinicart: () => undefined,
}));
vi.mock('@/lib/cart-actions', () => ({
  addToCartAction: async () => undefined,
  cartSummaryAction: async () => null,
  chooseGiftAction: async () => undefined,
  removeLineAction: async () => undefined,
  updateLineAction: async () => undefined,
}));

/** An empty cart, from the kit's own constant — the state a first-time visitor's chrome renders in. */
const EMPTY_CART_CONTEXT = {
  snapshot: EMPTY_SNAPSHOT,
  open: false,
  openDrawer: () => {},
  close: () => {},
  add: async () => {},
  update: async () => {},
  remove: async () => {},
  chooseGift: async () => {},
  refresh: async () => {},
};

const { StorefrontChrome } = await import('./StorefrontChrome');
const { HOST_BASE } = await import('@forgecommerce/storefront-kit/store-route');

/** Resolve the async server-component levels the framework would, then render.
 *
 * It DESCENDS through `children` instead of unwrapping only the root, because the vitrine's chrome nests an
 * async server component (the kit chrome) under a sync client one (the minicart context). A sync component is
 * never called here — that is React's job, and calling one would run its hooks outside a renderer. */
async function resolveTree(node: unknown): Promise<unknown> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function') {
    const out = (element.type as (p: unknown) => unknown)(element.props);
    if (typeof (out as { then?: unknown })?.then === 'function') return resolveTree(await out);
  }
  const children = element.props?.children;
  if (children === undefined) return element;
  return cloneElement(element, undefined, (await resolveTree(children)) as ReactNode);
}

async function renderResolved(node: ReactNode): Promise<string> {
  return renderToStaticMarkup((await resolveTree(node)) as never);
}

const chrome = async () =>
  renderResolved(
    await StorefrontChrome({
      store: 'sto_1',
      base: HOST_BASE,
      children: <main data-testid="page" />,
    }),
  );

test('the vitrine renders the kit chrome (a parity assertion over an empty render proves nothing)', async () => {
  const html = await chrome();
  expect(html).toContain('data-testid="page"');
  expect(html).toContain('data-testid="site-header"');
  expect(html).toContain('data-testid="site-footer"');
});

test('★ the header offers a CART — the affordance the checkout half was missing', async () => {
  // This front hands in its own LIVE trigger, so that is what must be there — and asserting the specific
  // form is the point: `/(placeholder|trigger)/` would have gone green on a chrome that had silently fallen
  // back, which is a weaker claim than the one the defect calls for. The checkout's file asserts the OTHER
  // form of the same slot: it hands in nothing, so it owes the shopper the static placeholder.
  const html = await chrome();
  const actions = html.slice(html.indexOf('data-testid="site-header"'));
  expect(actions, 'the vitrine stopped rendering its live cart in the header').toContain(
    'data-testid="minicart-trigger"',
  );
});

test('★ the header asks the KIT’s one search question, not a literal of its own', async () => {
  const html = await chrome();
  // ⚠️ THE ATTRIBUTE, NOT THE PAGE. `toContain(SEARCH_PROMPT)` was green under sabotage: the same words sat
  // in the box's aria-label while the visible placeholder asked something else, so the assertion was reading
  // a THIRD copy of the string. What a shopper is asked is the placeholder.
  expect(html).toContain(`placeholder="${SEARCH_PROMPT}"`);
  expect(html).toContain(`aria-label="${SEARCH_PROMPT}"`);
});

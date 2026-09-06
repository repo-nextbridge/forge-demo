// ★★ pk14/D5 — ONE SHOP, ONE CHROME, PROVEN BY RENDERING BOTH TREES.
//
// ── WHAT WAS MEASURED, AND WHY NO GREEN SUITE SAW IT ─────────────────────────────────────────────────────
//
// This fork served two identities out of one deployable. `s/[store]/(storefront)/layout.tsx` mounted the
// shop's own <CoffeeChrome>; `c/[store]/layout.tsx` — the EDGE-CACHEABLE twin, the tree the middleware sends
// the home, the clean PLP and the PDP to — mounted <StorefrontChrome>, the reference vitrine's. Which header
// a shopper got was decided by the edge, not by the shop. Nothing was red: both layouts compiled, both
// mounted A chrome, and every existing test renders ONE component at a time, so no assertion in this repo
// ever had both answers in front of it. That is the whole reason this file renders the LAYOUTS.
//
// ⚠️ AND IT IS NOT A TEST ABOUT THE ROOT ROUTE, even though the card that started it says so. `app/page.tsx`
// is the reference's landing stub and unreachable here — see `middleware.test.ts`, which asserts that `/` is
// rewritten into one of these two trees or to `/404` and never answered by it. The fork's real root, and the
// thing a shopper on a store's OWN HOST opens, is the cacheable tree below.
//
// ── THE NEGATIVE HALF IS NOT DECORATION ─────────────────────────────────────────────────────────────────
//
// "Both trees render the café header" is satisfiable by a chrome that renders nothing at all, so each
// assertion has a CONTROL that must hold at the same time: the reference chrome is rendered here too, and it
// must still carry the marker the trees must NOT carry. A day when `site-header` stops being the reference's
// marker turns the negative assertion into a tautology, and this file goes red instead of silent.

import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

const STORE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';

// The port. Both layouts ask it whether the store exists and is on the street, and `s/[store]` also asks who
// fills the gate slot. Nobody does — this fork registers no gate implementation.
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({
    storeFlags: async () => ({
      name: 'forge.co',
      status: 'active',
      masked_checkout_enabled: false,
      guest_checkout_enabled: true,
      timezone: 'America/Sao_Paulo',
    }),
    extensions: async () => [],
  }),
}));
// The dynamic tree reads the request's store prefix. Path-scoped is the interesting one: it is the base under
// which a bare `/checkout` would leave the shop.
vi.mock('@forgecommerce/storefront-kit/store-route.server', () => ({
  requestStoreBase: async () => HOST_BASE,
}));
// Server Actions bound by the chrome. Not the subject, and they must not reach a port from a suite.
vi.mock('@/lib/cart-actions', () => ({
  addToCartAction: async () => undefined,
  cartSummaryAction: async () => null,
  chooseGiftAction: async () => undefined,
  removeLineAction: async () => undefined,
  updateLineAction: async () => undefined,
}));
vi.mock('@forgecommerce/storefront-kit/payment-badges', () => ({ paymentBadges: async () => ['Pix'] }));
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({
  ExtensionOutlet: ({ name }: { name: string }) => <i data-outlet={name} />,
}));
// ONLY THE CONTEXT is stubbed, and only because React cannot render an async server component (the reference
// chrome) underneath a client one. Every header this file judges is the real component.
vi.mock('@/components/minicart/MinicartProvider', () => ({
  MinicartProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useMinicart: () => ({
    snapshot: EMPTY_SNAPSHOT,
    open: false,
    openDrawer: () => {},
    close: () => {},
    add: async () => {},
    update: async () => {},
    remove: async () => {},
    chooseGift: async () => {},
    refresh: async () => {},
  }),
  useOptionalMinicart: () => undefined,
}));

/** Resolve the async server-component levels the framework would, then render. */
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

async function render(node: ReactNode): Promise<string> {
  return renderToStaticMarkup((await resolveTree(node)) as never);
}

/** The two trees a store URL can be served by, rendered exactly as the app mounts them. */
const TREES = [
  {
    name: 'c/[store] — the EDGE-CACHEABLE tree (home, clean PLP, PDP; the one a store on its own host lands in)',
    load: () => import('@/app/c/[store]/layout'),
  },
  {
    name: 's/[store]/(storefront) — the DYNAMIC tree',
    load: () => import('@/app/s/[store]/(storefront)/layout'),
  },
] as const;

async function tree(entry: (typeof TREES)[number]): Promise<string> {
  const { default: Layout } = await entry.load();
  return render(
    await Layout({
      params: Promise.resolve({ store: STORE }),
      children: <div data-testid="page" />,
    }),
  );
}

/** The reference vitrine's chrome, rendered as the CONTROL — it is what these trees must not look like. */
async function referenceChrome(): Promise<string> {
  const { StorefrontChrome } = await import('@/components/StorefrontChrome');
  return render(
    await StorefrontChrome({ store: STORE, base: HOST_BASE, children: <div data-testid="page" /> }),
  );
}

/** The shop's own header, in the shopper's terms: its wordmark and the sentence only it says. */
const COFFEE_MARKS = ['alt="forge.co"', 'Torra da semana'];
/** The reference chrome's own marker — asserted against the CONTROL below, never assumed. */
const REFERENCE_MARK = 'data-testid="site-header"';

test('⛔ THE CONTROL — the reference chrome still carries the marker the trees are judged against', async () => {
  const html = await referenceChrome();
  expect(
    html,
    `${REFERENCE_MARK} is no longer what the reference chrome renders, so every "must not contain" below ` +
      'has quietly become true of everything. Re-derive the marker before trusting the greens.',
  ).toContain(REFERENCE_MARK);
  for (const mark of COFFEE_MARKS) {
    expect(html, `"${mark}" is not the SHOP's marker — the reference chrome renders it too`).not.toContain(
      mark,
    );
  }
});

for (const entry of TREES) {
  test(`★★ ${entry.name} wears the SHOP's chrome`, async () => {
    const html = await tree(entry);
    expect(html, 'the layout stopped rendering the page at all').toContain('data-testid="page"');
    for (const mark of COFFEE_MARKS) {
      expect(
        html,
        `this tree does not render the shop's own header (missing ${mark}). A deployable whose two trees ` +
          'wear different chrome serves two identities for one store, chosen by the EDGE: the same URL, the ' +
          "café's body inside the reference vitrine's menu and logo.",
      ).toContain(mark);
    }
    expect(
      html,
      'this tree is wearing the REFERENCE vitrine\'s chrome. That is the hybrid: the fork owns its front, ' +
        'and a store on its own host opens exactly this tree.',
    ).not.toContain(REFERENCE_MARK);
  });
}

test('★ and the keyboard shortcut survived the adoption — it is the first focusable thing in both trees', async () => {
  // The reference chrome had one and this shop's did not, so moving the cacheable tree over would have
  // removed the last skip link in the deployable. Asserted where it can regress, not where it was written.
  const { MAIN_CONTENT_ID } = await import('@forgecommerce/storefront-kit/SkipLink');
  for (const entry of TREES) {
    const html = await tree(entry);
    const first = html.search(/<(a\s[^>]*href=|button|input|select|textarea)/);
    expect(first, `${entry.name}: nothing focusable at all`).toBeGreaterThan(-1);
    expect(html.slice(first, first + 200), `${entry.name}: the skip link is not first`).toContain(
      'data-testid="skip-link"',
    );
    expect(html, `${entry.name}: the skip link jumps at nothing`).toContain(`id="${MAIN_CONTENT_ID}"`);
  }
});

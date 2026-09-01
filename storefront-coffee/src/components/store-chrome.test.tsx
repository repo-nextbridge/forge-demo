// ★★ M4 — THE STORE'S OWN CHROME ON THE VITRINE, PROVEN BY RENDERING THIS DEPLOYABLE'S CHROME.
//
// The kit's `store-chrome.symmetry.test.tsx` proves the MECHANISM (three states, both regions, no seam when
// emptied). The checkout has a sibling of this file that proves ITS half asks for the content and hands it
// over. This is the vitrine's, and it is the half that did not exist: P2 wired the checkout and left the
// vitrine deliberately unwired, so a merchant who wrote their header got it on the funnel and not on the
// shelf — with every test in both packages green, because no test ever asked the vitrine.
//
// ⚠️ THE ASSERTION IS ON WHAT THE SHOPPER GETS, NOT ON THE PROP. `expect(props.chrome).toBeDefined()` would
// pass on a chrome that read the content and rendered it nowhere, which is exactly the shape the acceptance
// pass found twice (a fallback that existed and could never be reached; a slot filled in one build only).
// So the port is stubbed, the real component tree is resolved, and the HTML is read.

import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

const storeFlags = vi.fn();

// The PORT, stubbed at the kit's own edge — the same seam the checkout's sibling uses, so both fronts are
// measured against the same shape of answer rather than against two hand-written fixtures.
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({ storeFlags, paymentMethodsCached: async () => null }),
}));
vi.mock('@forgecommerce/storefront-kit/payment-badges', () => ({
  paymentBadges: async () => ['Pix'],
}));
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({
  ExtensionOutlet: ({ name }: { name: string }) => <i data-outlet={name} />,
}));
// Only the minicart CONTEXT is stubbed, and only for a shape React cannot render: a client component with an
// async server component under it. See `chrome-parity.test.tsx` for the full reasoning.
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
vi.mock('@/lib/cart-actions', () => ({
  addToCartAction: async () => undefined,
  cartSummaryAction: async () => null,
  chooseGiftAction: async () => undefined,
  removeLineAction: async () => undefined,
  updateLineAction: async () => undefined,
}));

const { StorefrontChrome } = await import('./StorefrontChrome');
const { HOST_BASE } = await import('@forgecommerce/storefront-kit/store-route');

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

beforeEach(() => {
  vi.clearAllMocks();
  storeFlags.mockResolvedValue(null);
});

/** ⚠️ A DIFFERENT STORE ID PER CASE. `storeChromeContent` is `cache()`d, and outside React's request scope
 * that memo is per-module — one id reused across cases would answer the second case from the first. */
let n = 0;
async function shelf(chrome?: Record<string, string>): Promise<string> {
  n += 1;
  const store = `sto_vitrine_${n}`;
  storeFlags.mockImplementation(async (asked: string) =>
    asked === store ? { name: 'Loja', timezone: 'UTC', ...(chrome ? { chrome } : {}) } : null,
  );
  const tree = await StorefrontChrome({
    store,
    base: HOST_BASE,
    children: <main data-testid="page" />,
  });
  return renderToStaticMarkup((await resolveTree(tree)) as never);
}

test('a store that wrote NOTHING gets the reference vitrine chrome (the good state is not empty)', async () => {
  const html = await shelf();
  expect(html).toContain('data-testid="page"');
  expect(html).toContain('data-testid="site-header"');
  expect(html).toContain('data-testid="site-footer"');
  expect(html).not.toContain('data-store-chrome');
});

test('★★ a store that WROTE something gets it ON THE SHELF — in both regions, replacing ours', async () => {
  // The defect this closes, stated as the merchant meets it: they write one sentence into their store and
  // it appears on the checkout and not on the vitrine, so the header changes halfway through a visit.
  const html = await shelf({
    header: 'Atendimento 9h às 18h',
    footer: 'Loja Exemplo LTDA · CNPJ 00.000.000/0001-00',
  });
  expect(html, 'the vitrine ignored the header the merchant wrote').toContain(
    'Atendimento 9h às 18h',
  );
  expect(html, 'the vitrine ignored the footer the merchant wrote').toContain('Loja Exemplo LTDA');
  expect(html).toContain('data-store-chrome="header"');
  expect(html).toContain('data-store-chrome="footer"');
  expect(html, 'the store’s chrome must REPLACE ours, not sit above it').not.toContain(
    'data-testid="site-header"',
  );
  expect(html).toContain('data-testid="page"'); // and the shelf still renders
});

test('★★ a store that EMPTIED a region gets nothing there — no wrapper, no band, no seam', async () => {
  const html = await shelf({ header: '', footer: '   ' });
  expect(html, 'an emptied region left an element behind').not.toContain('data-store-chrome');
  expect(html, 'an emptied header fell back to ours instead of rendering nothing').not.toContain(
    'data-testid="site-header"',
  );
  expect(html, 'an emptied footer fell back to ours instead of rendering nothing').not.toContain(
    'data-testid="site-footer"',
  );
  expect(html).toContain('data-testid="page"');
});

test('★ one region emptied does not take the other with it', async () => {
  const html = await shelf({ footer: '' });
  expect(html, 'the header was never written, so it is still ours').toContain(
    'data-testid="site-header"',
  );
  expect(html, 'the emptied footer left an element behind').not.toContain(
    'data-testid="site-footer"',
  );
  expect(html).not.toContain('data-store-chrome');
});

test('★ a port that fails costs the merchant nothing — the reference chrome still renders', async () => {
  // A store must never lose its header because a read failed; the kit degrades to "nothing written".
  storeFlags.mockRejectedValue(new Error('port down'));
  const html = await shelf();
  expect(html).toContain('data-testid="site-header"');
  expect(html).toContain('data-testid="site-footer"');
});

// ★ slot filled AND DISCOVERED: the outlet asks the port which extension fills a slot (read.extensions),
// then renders that extension's block from the static registry. We mock the port (installed vs empty) and
// the block's catalog fetch, and assert the SERVED HTML: installed → the block's products appear; empty →
// null. Crucially, nothing in the storefront was edited to teach it about `shelves` — discovery
// is by registry + runtime install, not a hardcoded branch.

import type { InstalledExtension } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { resolveBlock } from './registry';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
let storeFlagsMock: () => Promise<{ timezone: string } | null> = async () => ({
  timezone: 'America/Sao_Paulo',
});
vi.mock('@forgeco/storefront-kit/config', () => ({
  // Q3-HYDRATION: the outlet resolves the STORE's clock for the blocks it renders (see ExtensionOutlet.tsx),
  // so the stub answers `store_flags` too. `storeFlagsMock` is a variable so a case can make the read degrade.
  readClient: () => ({ extensions: () => extensionsMock(), storeFlags: () => storeFlagsMock() }),
}));

// The outlet returns the discovered block as an element of an ASYNC Server Component (`<Block/>`). The legacy
// renderToString cannot await it, so we resolve the server-component levels (exactly what the framework does)
// before rendering — this exercises the REAL registry + REAL block, only the HTTP is stubbed. Some registry
// entries wrap the block (e.g. shelves injects the theme ProductCard), so we resolve function components until a
// host element remains.
async function renderResolved(node: ReactNode): Promise<string> {
  let cur = node;
  while (cur && typeof cur === 'object' && 'type' in cur && typeof cur.type === 'function') {
    const el = cur as { type: (p: unknown) => ReactNode | Promise<ReactNode>; props: unknown };
    cur = (await el.type(el.props)) as ReactNode;
  }
  return renderToString(cur);
}

function stubCatalog(items: { product_id: string; title: string; handle: string }[]) {
  globalThis.fetch = vi.fn(
    async () => new Response(JSON.stringify({ items }), { status: 200 }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
  extensionsMock.mockReset();
  storeFlagsMock = async () => ({ timezone: 'America/Sao_Paulo' });
  process.env.TZ = ORIGINAL_TZ;
});

/** ⚠️ THE BENCH'S OWN CLOCK IS A TRAP, AND IT CAUGHT THIS FILE. This machine runs in America/Sao_Paulo — the
 * same zone the specimen store uses — so a test asserting "29 de jul." passes whether the date came from the
 * STORE's clock or from the ambient one, and it would have gone green against the unfixed code. The two clock
 * cases below therefore put the PROCESS in a THIRD zone: Asia/Tokyo names a different day from both the store
 * and UTC for the instants used, so each of the three possible sources produces a different answer and the
 * assertion can only be satisfied by the right one. */
const ORIGINAL_TZ = process.env.TZ;
const A_THIRD_ZONE = 'Asia/Tokyo';

/**
 * ★ E (PACK 5) — THE SPECIMEN BLOCK HAS TO BE IN THIS IMAGE. `shelves` is on the composition list now, so an
 * instance whose list drops it has no block to resolve: the outlet correctly renders nothing, and this test
 * would report "the outlet did not render the block" about an app that is simply not here. Asking the registry
 * is the same question the outlet asks, so the condition cannot drift from what would actually render.
 */
const shelfTest = resolveBlock('shelves', 'shelf') ? test : test.skip;
// ★ F2 — and the same for `reviews`, which joined the list in this slice. Same condition, asked the same way:
// the registry, which is the question the outlet itself asks.
const reviewsTest = resolveBlock('reviews', 'reviews') ? test : test.skip;

shelfTest(
  'an installed extension whose slot matches → its block is rendered into the slot',
  async () => {
    extensionsMock.mockResolvedValue([
      {
        extension_id: 'shelves',
        hooks: [
          {
            component: 'shelf',
            target: 'storefront:home.below_shelf',
            position: 0,
            config: { source: 'category', source_category: 'roupas' },
          },
        ],
      },
    ]);
    stubCatalog([{ product_id: 'prod_1', title: 'Tênis Esportivo', handle: 'tenis' }]);

    const { ExtensionOutlet } = await import('./ExtensionOutlet');
    const html = await renderResolved(
      await ExtensionOutlet({ name: 'home.below_shelf', store: 'acme', storeBase: HOST_BASE }),
    );

    expect(html).toContain('ext-shelf'); // the shelf block's testid → it actually rendered
    expect(html).toContain('Tênis Esportivo'); // catalog content read through the port (theme ProductCard)
    expect(html).toContain('/p/tenis'); // link to the PDP
  },
);

reviewsTest(
  'a PDP slot passes productId through → the reviews block lists that product (data port)',
  async () => {
    // EXT-2: the PDP outlet is product-scoped. read.extensions says reviews fills pdp.below_gallery; the
    // reviews block reads the product's reviews from the data port (here stubbed). The storefront was not
    // edited to know about `reviews` — discovery + the productId context do the work.
    extensionsMock.mockResolvedValue([
      {
        extension_id: 'reviews',
        hooks: [{ component: 'reviews', target: 'storefront:pdp.below_gallery', position: 0 }],
      },
    ]);
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          {
            id: 'rec_1',
            product_id: 'prod_9',
            rating: 5,
            body: 'Excelente',
            author: 'Ana',
            created_at: '',
          },
        ]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const { ExtensionOutlet } = await import('./ExtensionOutlet');
    const html = await renderResolved(
      await ExtensionOutlet({
        name: 'pdp.below_gallery',
        store: 'acme',
        storeBase: HOST_BASE,
        productId: 'prod_9',
      }),
    );

    expect(html).toContain('ext-reviews'); // the reviews block rendered into the PDP slot
    expect(html).toContain('Excelente'); // the product's review, read through the data port
    expect(html).toContain('Ana');
  },
);

// ★★ Q3-HYDRATION — THE CLOCK REACHES THE BLOCK, END TO END. The date a block prints has to be the STORE's,
// or the server and the shopper's browser disagree about the day and React discards the tree (#418, measured
// on every staging PDP). The chain has four links — outlet reads `store_flags`, generated registry forwards
// the prop, block hands it down, section formats with it — and this asserts the whole chain by its OUTPUT,
// with an instant that is on one day in UTC and the day before in the store's zone.
reviewsTest("★★ the outlet hands blocks the STORE's clock, not the container's", async () => {
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'reviews',
      hooks: [{ component: 'reviews', target: 'storefront:pdp.below_gallery', position: 0 }],
    },
  ]);
  storeFlagsMock = async () => ({ timezone: 'America/Sao_Paulo' });
  // The instant names three different days in the three candidate zones: the 30th in UTC, the 29th in the
  // store's zone, the 30th (09:29, mid-morning) in Tokyo. Only the store's clock can produce the assertion.
  process.env.TZ = A_THIRD_ZONE;
  globalThis.fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify([
          {
            id: 'rec_1',
            product_id: 'prod_9',
            rating: 5,
            body: 'Excelente',
            author: 'Ana',
            // 29 minutes past midnight UTC on the 30th — the evening of the 29th in São Paulo.
            created_at: '2026-07-30T00:29:52.832Z',
          },
        ]),
        { status: 200 },
      ),
  ) as unknown as typeof fetch;

  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = await renderResolved(
    await ExtensionOutlet({
      name: 'pdp.below_gallery',
      store: 'acme',
      storeBase: HOST_BASE,
      productId: 'prod_9',
    }),
  );

  expect(html).toContain('29 de jul. de 2026');
  expect(html).not.toContain('30 de jul. de 2026');
});

// ★ And when the read does NOT answer, the block still gets a DECLARED zone rather than the container's. UTC
// is the documented degraded answer (`lib/datetime.ts`): visibly wrong-but-stated beats accidentally right on
// one machine and wrong on the next. What must never happen is the ambient clock coming back.
reviewsTest('★ a degraded store_flags read degrades to UTC, not to the ambient clock', async () => {
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'reviews',
      hooks: [{ component: 'reviews', target: 'storefront:pdp.below_gallery', position: 0 }],
    },
  ]);
  storeFlagsMock = async () => null;
  // Late evening UTC: the 30th in UTC, ALREADY THE 31st in Tokyo. So "30 de jul." can only have come from the
  // declared UTC fallback — the ambient clock would have said the 31st.
  process.env.TZ = A_THIRD_ZONE;
  globalThis.fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify([
          {
            id: 'rec_1',
            product_id: 'prod_9',
            rating: 5,
            body: 'Excelente',
            author: 'Ana',
            created_at: '2026-07-30T23:30:00.000Z',
          },
        ]),
        { status: 200 },
      ),
  ) as unknown as typeof fetch;

  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = await renderResolved(
    await ExtensionOutlet({
      name: 'pdp.below_gallery',
      store: 'acme',
      storeBase: HOST_BASE,
      productId: 'prod_9',
    }),
  );

  expect(html).toContain('30 de jul. de 2026');
  expect(html).not.toContain('31 de jul. de 2026');
});

test('no extension installed for the store → the outlet renders nothing (slot stays empty)', async () => {
  extensionsMock.mockResolvedValue([]);
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = renderToString(
    await ExtensionOutlet({ name: 'home.below_shelf', store: 'acme', storeBase: HOST_BASE }),
  );
  expect(html).toBe('');
});

test('an install that fills a DIFFERENT slot is ignored for this outlet', async () => {
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'shelves',
      hooks: [{ component: 'shelf', target: 'storefront:home.hero', position: 0 }],
    },
  ]);
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = renderToString(
    await ExtensionOutlet({ name: 'home.below_shelf', store: 'acme', storeBase: HOST_BASE }),
  );
  expect(html).toBe('');
});

test('an admin-target hook is ignored by the storefront (the surface prefix separates the two)', async () => {
  // The cross-surface generalization must not leak admin presences into the storefront: a hook whose target
  // is `admin:home.below_shelf` shares the slot name but not the surface, so the storefront outlet skips it.
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'shelves',
      hooks: [{ component: 'shelf', target: 'admin:home.below_shelf', position: 0 }],
    },
  ]);
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = renderToString(
    await ExtensionOutlet({ name: 'home.below_shelf', store: 'acme', storeBase: HOST_BASE }),
  );
  expect(html).toBe('');
});

test('port down (extensions() returns null) → the outlet degrades to null, never throws', async () => {
  extensionsMock.mockResolvedValue(null);
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = renderToString(
    await ExtensionOutlet({ name: 'home.below_shelf', store: 'acme', storeBase: HOST_BASE }),
  );
  expect(html).toBe('');
});

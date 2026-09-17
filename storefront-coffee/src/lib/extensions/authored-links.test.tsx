// MULTISTORE / S2-B item 2 — THE LINKS AN APP EMITS, PROVEN UNDER `/s/<store>`.
//
// THE DEFECT, as the QA re-run measured it: a banner whose target the operator typed as `/categoria/x` was
// rendered verbatim. On a store served from its own domain that is right; on a store reached through
// `/s/<id>` — which is how a store with no DNS of its own is reached, and how BOTH extra staging stores were
// reached — the prefix is gone, the next request resolves the store from the HOST, and the shopper silently
// changes store on a click. M1-β closed this for the ~120 links the STOREFRONT builds; these escaped because
// they are not built by the storefront at all: one is typed by a human into Compose, and the other is built by
// the APP (`seeAllHref`), outside the sweep either way.
//
// ★★ THE TEST IS RUN AT THE SEAM, NOT ON THE HELPER. `authoredHref` having the right arithmetic proves nothing
// if the outlet never hands it over or a block never calls it — which is exactly the state the QA found. So
// this drives the REAL ExtensionOutlet over the REAL registry and the REAL blocks (only the HTTP is stubbed),
// and reads the HREF THAT WAS SERVED. Same harness as ExtensionOutlet.test.tsx.
//
// ★★ AND IT IS RUN WITH A PATH-SCOPED STORE, DELIBERATELY. A store on its own domain has NO prefix to lose, so
// the identical assertions pass there against the broken code — the "test on the root store" that the brief
// names as passing by accident. Every prefix case below uses `pathScopedBase('sto_outlet')`; the HOST_BASE
// cases are here to prove the fix does not invent a prefix where none is owed.

import type { InstalledExtension } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE, pathScopedBase } from '@forgeco/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { resolveBlock } from './registry';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
const storeFlagsMock: () => Promise<{ timezone: string } | null> = async () => ({
  timezone: 'America/Sao_Paulo',
});
vi.mock('@forgeco/storefront-kit/config', () => ({
  // Q3-HYDRATION: the outlet resolves the STORE's clock for the blocks it renders (see ExtensionOutlet.tsx),
  // so the stub answers `store_flags` too. `storeFlagsMock` is a variable so a case can make the read degrade.
  readClient: () => ({ extensions: () => extensionsMock(), storeFlags: () => storeFlagsMock() }),
}));

/** Resolve the async Server Component levels the framework would, then render — see ExtensionOutlet.test.tsx. */
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
});

const STORE = 'sto_outlet';
const SCOPED = pathScopedBase(STORE);

/**
 * ★ E (PACK 5) — THE SUITE GRADES AN APP'S ANCHORS, so it can only run where the image CARRIES the app.
 *
 * `banners` and `shelves` are on the composition list now: their entries are generated, and an instance whose
 * list drops one has no block to resolve — the outlet renders nothing and every `expect(hrefs).toContain(…)`
 * below fails while describing the wrong thing ("the link left the store" when the truth is "the app is not
 * here"). Asking the registry is the same question the outlet asks, so this cannot drift from what would
 * actually render.
 */
const blockTest = (extensionId: string, component: string) =>
  resolveBlock(extensionId, component) ? test : test.skip;
const bannerTest = blockTest('banners', 'banner');
const shelfTest = blockTest('shelves', 'shelf');

/** Every `href` the served HTML carries, in order. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] as string);
}

function install(extension_id: string, component: string, config: Record<string, unknown>) {
  extensionsMock.mockResolvedValue([
    { extension_id, hooks: [{ component, target: 'storefront:home.hero', position: 0, config }] },
  ]);
}

const BANNER_CONFIG = {
  style: 'mosaic',
  media: [
    {
      asset_id: 'ast_hero',
      asset_id_kind: 'image',
      asset_id_url: 'https://cdn.example.test/hero.png',
      link: '/categoria/tenis',
    },
  ],
};

/** A brand shelf with a promo banner: `banner_link` is TYPED by the operator, "Ver todos" is BUILT by the app
 * (`seeAllHref` → `/b/atlas`). Both are anchors this block emits, and both used to leave the store. */
const SHELF_CONFIG = {
  title: 'Novidades',
  source: 'brand',
  source_brand: 'atlas',
  banner_asset_url: 'https://cdn.example.test/promo.png',
  banner_link: '/promo-inverno',
};

async function renderSlot(base: ReturnType<typeof pathScopedBase>): Promise<string> {
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  return renderResolved(
    await ExtensionOutlet({ name: 'home.hero', store: STORE, storeBase: base }),
  );
}

bannerTest(
  '★ a banner link TYPED by the operator keeps the store — under /s/<store>, where it was being lost',
  async () => {
    install('banners', 'banner', BANNER_CONFIG);
    const html = await renderSlot(SCOPED);

    expect(hrefs(html)).toContain(`/s/${STORE}/categoria/tenis`);
    // And the bare path is gone — a page carrying both would still hand the shopper the wrong one.
    expect(hrefs(html)).not.toContain('/categoria/tenis');
  },
);

bannerTest(
  'the same banner on the store’s OWN domain keeps the clean path — no prefix is invented',
  async () => {
    install('banners', 'banner', BANNER_CONFIG);
    const html = await renderSlot(HOST_BASE);

    expect(hrefs(html)).toContain('/categoria/tenis');
    expect(html).not.toContain('/s/');
  },
);

shelfTest(
  '★ a shelf keeps the store in BOTH its anchors — the typed promo link and the app-built "Ver todos"',
  async () => {
    install('shelves', 'shelf', SHELF_CONFIG);
    stubCatalog([{ product_id: 'prod_1', title: 'Tênis Esportivo', handle: 'tenis' }]);
    const html = await renderSlot(SCOPED);

    const found = hrefs(html);
    expect(found).toContain(`/s/${STORE}/promo-inverno`); // typed by the operator
    expect(found).toContain(`/s/${STORE}/b/atlas`); // built by the app (seeAllHref)
    expect(found).not.toContain('/promo-inverno');
    expect(found).not.toContain('/b/atlas');
  },
);

bannerTest(
  'an operator link to ANOTHER SITE is left exactly as typed — placing a URL is not rewriting one',
  async () => {
    install('banners', 'banner', {
      ...BANNER_CONFIG,
      media: [{ ...BANNER_CONFIG.media[0], link: 'https://instagram.com/marca' }],
    });
    const html = await renderSlot(SCOPED);

    expect(hrefs(html)).toContain('https://instagram.com/marca');
  },
);

bannerTest(
  'a protocol-relative link (//host/…) is NOT prefixed — the leading slash is a false friend',
  async () => {
    // `//outra.com/x` is another site wearing a path's clothes. Prefixing it would mint `/s/<store>//outra.com/x`
    // — a dead in-store URL — so the placement step leaves it alone and it reaches the block's own scheme check
    // as written.
    //
    // ★ AND THE SCHEME CHECK NOW DROPS IT (PACK-E). This test used to assert the link came out RENDERED, which
    // was true of the day it was written: `isSafeHref` waved `//host` through because it starts with `/`, while
    // its own doc promised "only http(s) and site-relative URLs". The claim THIS test makes is about the
    // PREFIXER — "the placement step must not mangle it" — and that claim is now satisfied more strongly than
    // before: there is no anchor to mangle. Both halves are asserted below, so a future change that started
    // prefixing it again would still be caught.
    install('banners', 'banner', {
      ...BANNER_CONFIG,
      media: [{ ...BANNER_CONFIG.media[0], link: '//outra.com/x' }],
    });
    const html = await renderSlot(SCOPED);

    // The prefixer's own claim: it never mints an in-store URL out of another site's address.
    expect(html).not.toContain(`/s/${STORE}//outra.com`);
    // …and the backstop's: the off-site link the operator wrote as a path does not become a link at all — the
    // image renders unwrapped, exactly as it does for `javascript:` in the test below.
    expect(hrefs(html)).not.toContain('//outra.com/x');
    expect(html).not.toContain('outra.com');
  },
);

bannerTest(
  'an unsafe link is still dropped — the scheme check stays the backstop, ahead of any placement',
  async () => {
    install('banners', 'banner', {
      ...BANNER_CONFIG,
      // biome-ignore lint/suspicious/noExplicitAny: the stored value is operator input, junk included
      media: [{ ...BANNER_CONFIG.media[0], link: 'javascript:alert(1)' as any }],
    });
    const html = await renderSlot(SCOPED);

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a'); // no link at all: the image renders unwrapped
  },
);

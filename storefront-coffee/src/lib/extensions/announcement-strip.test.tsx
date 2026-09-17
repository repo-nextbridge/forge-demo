// ★★ S4-BANNER-STRIP, END TO END OVER THE REAL SEAM: the REAL outlet, the REAL generated block registry and
// the REAL `banners/announcement` block, with only the HTTP port stubbed. Three stores, the three states the
// DoD names, decided by nothing but what each store has placed.
//
// This is the half the kit's `announcement-cede.test.tsx` cannot reach: there the outlet is a stand-in (an
// async Server Component cannot be rendered by `renderToString` inside a sync tree), so it proves the
// variant's WIRING. Here the outlet is the real one and the decision it makes — fill or fallback — is the
// thing under test, with the block that a merchant's copy actually flows through.
//
// ⚠️ THE FALLBACK IS A SENTINEL, not the kit's `AnnouncementBar`. What the outlet owes its caller is "render
// what I gave you when nothing is placed"; WHICH element the header gives it is the variant's decision and is
// asserted there, against the real component. A test that imported the bar here would be asserting the same
// fact twice and calling the second one end-to-end.

import type { InstalledExtension } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { resolveBlock } from './registry';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
vi.mock('@forgeco/storefront-kit/config', () => ({
  readClient: () => ({
    extensions: () => extensionsMock(),
    storeFlags: async () => ({ timezone: 'America/Sao_Paulo' }),
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  extensionsMock.mockReset();
});

const SLOT = 'header.announcement';
/** The theme's own band, stood in for. See the header of this file for why it is not the real component. */
const THEME_DEFAULT = <i data-testid="theme-default-strip" />;

/** One store's composition: the `announcement` block placed in the top band with this config. */
const placed = (config: Record<string, unknown>): InstalledExtension[] => [
  {
    extension_id: 'banners',
    hooks: [
      {
        component: 'announcement',
        target: `storefront:${SLOT}`,
        position: 0,
        placement_id: 'hp_strip',
        config,
      },
    ],
  },
];

/** What the header's announcement slot renders for a store, through the real outlet. */
async function bandOf(store: string): Promise<string> {
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const node = await ExtensionOutlet({
    name: SLOT,
    store,
    storeBase: HOST_BASE,
    fallback: THEME_DEFAULT,
  });
  // `null` is the outlet rendering NOTHING; an element that itself renders nothing (a placed strip with no
  // text) is a different fact and still goes through the renderer, which returns the empty string for it.
  return node === null ? '' : renderToStaticMarkup(node as ReactElement);
}

// ★ The specimen block has to be in THIS image — the same question the outlet itself asks. Without it this
// file would report "the strip did not render" about an app that is simply not on the composition list.
const stripTest = resolveBlock('banners', 'announcement') ? test : test.skip;

stripTest(
  '★ loja A — a placed strip with the store’s own copy IS the band, and the default is gone',
  async () => {
    extensionsMock.mockResolvedValue(placed({ text: 'Retire na loja em 2h' }));
    const html = await bandOf('loja_a');
    expect(html).toContain('data-testid="ext-banners-announcement"');
    expect(html).toContain('Retire na loja em 2h');
    expect(
      html,
      'the theme default rendered UNDER the store’s own strip — two bands',
    ).not.toContain('theme-default-strip');
  },
);

stripTest(
  '★ loja B — nothing placed ⇒ the theme’s own strip is what the band renders',
  async () => {
    extensionsMock.mockResolvedValue([]);
    const html = await bandOf('loja_b');
    expect(html).toContain('data-testid="theme-default-strip"');
    expect(html).not.toContain('ext-banners-announcement');
  },
);

stripTest(
  '★ …and a store with OTHER apps installed, none in this slot, is still "nothing placed"',
  async () => {
    extensionsMock.mockResolvedValue([
      {
        extension_id: 'shelves',
        hooks: [{ component: 'shelf', target: 'storefront:home.hero', position: 0 }],
      },
    ]);
    expect(await bandOf('loja_b2')).toContain('data-testid="theme-default-strip"');
  },
);

stripTest(
  '★★ loja C — a block placed and BLANK renders NO band at all, and the default does NOT come back',
  async () => {
    // The decision, said out loud: the operator placed the strip and cleared its text. Reviving the factory
    // sentence there would put words they deleted back on their storefront.
    extensionsMock.mockResolvedValue(placed({}));
    const html = await bandOf('loja_c');
    expect(html).toBe('');
  },
);

stripTest(
  '★ the schedule — a window that has not opened shows no band (and no default underneath it)',
  async () => {
    extensionsMock.mockResolvedValue(
      placed({ text: 'Black Friday começa quinta', starts_at: '2099-11-01T00:00:00Z' }),
    );
    expect(await bandOf('loja_d')).toBe('');
  },
);

stripTest(
  '★ a degraded port does not blank the band — the store’s header keeps its strip',
  async () => {
    extensionsMock.mockResolvedValue(null);
    expect(await bandOf('loja_e')).toContain('data-testid="theme-default-strip"');
  },
);

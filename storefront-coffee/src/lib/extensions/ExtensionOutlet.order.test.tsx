// COMPOSE — the outlet renders ALL hooks resolved to a slot, ORDERED by position (no longer a single
// first-match). We mock the block registry with trivial marker components (this test is about ordering, not
// a block's data fetch — that is covered in ExtensionOutlet.test.tsx) and assert the rendered order follows
// `position`, with a stable tiebreak on extension_id+component.

import type { InstalledExtension } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
const storeFlagsMock: () => Promise<{ timezone: string } | null> = async () => ({
  timezone: 'America/Sao_Paulo',
});
vi.mock('@forgeco/storefront-kit/config', () => ({
  // Q3-HYDRATION: the outlet resolves the STORE's clock for the blocks it renders (see ExtensionOutlet.tsx),
  // so the stub answers `store_flags` too. `storeFlagsMock` is a variable so a case can make the read degrade.
  readClient: () => ({ extensions: () => extensionsMock(), storeFlags: () => storeFlagsMock() }),
}));

// A marker block per (extension, component): renders <span data-ext="…" data-cmp="…" /> so the HTML order is
// observable and no network is touched.
vi.mock('./registry', () => ({
  resolveBlock: (extensionId: string, component: string) =>
    function Marker() {
      return <span data-ext={extensionId} data-cmp={component} />;
    },
}));

afterEach(() => {
  extensionsMock.mockReset();
});

function order(html: string): string[] {
  return [...html.matchAll(/data-ext="([^"]+)"/g)].map((m) => m[1] ?? '');
}

test('two blocks in the same slot render in position order (reorder changes the order)', async () => {
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'reviews',
      hooks: [{ component: 'reviews', target: 'storefront:pdp.below_gallery', position: 1 }],
    },
    {
      extension_id: 'recommendations',
      hooks: [{ component: 'related', target: 'storefront:pdp.below_gallery', position: 0 }],
    },
  ]);
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = renderToString(
    await ExtensionOutlet({ name: 'pdp.below_gallery', store: 'acme', storeBase: HOST_BASE }),
  );
  // position 0 (recommendations) before position 1 (reviews) — the order the operator arranged.
  expect(order(html)).toEqual(['recommendations', 'reviews']);
});

test('equal positions fall back to a stable tiebreak (extension_id then component)', async () => {
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'reviews',
      hooks: [{ component: 'reviews', target: 'storefront:pdp.below_gallery', position: 0 }],
    },
    {
      extension_id: 'recommendations',
      hooks: [{ component: 'related', target: 'storefront:pdp.below_gallery', position: 0 }],
    },
  ]);
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  const html = renderToString(
    await ExtensionOutlet({ name: 'pdp.below_gallery', store: 'acme', storeBase: HOST_BASE }),
  );
  expect(order(html)).toEqual(['recommendations', 'reviews']); // 'recommendations' < 'reviews'
});

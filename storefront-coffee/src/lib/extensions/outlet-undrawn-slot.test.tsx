// ★★ A PLACEMENT ON A SLOT THIS FRONT DOES NOT HAVE IS RECORDED, through the café's REAL outlet.
//
// The product's CS-1 (v0.3.3) gave the kit's outlet a `publishedSlots` option, and this fork passes the catalog
// `GET /api/slots` serves (`lib/slots/published.ts`). Before it, a block placed on a slot no outlet of the café
// mounts vanished with nothing in the log — MZ-9 found ten such chrome slots in this fork by reading code.
//
// The fixture renders ONE slot nobody filled (`pdp.below_buybox`, so the outlet's own component check has
// nothing to say) and declares, for the same store:
//   · a placement on a slot no front publishes      → the one gap, naming app, component, slot and placement;
//   · a placement on this fork's own slot           → not a gap;
//   · a placement on the checkout's slot (sibling)  → not a gap: the café's hostname also serves the release's
//                                                     checkout, and `checkout.bottom` is where this box places
//                                                     the demo ribbon on the café (`seed/demo-setup.json`);
//   · the gate                                      → not a gap here: it is not a declared slot by design;
//   · an `admin:` placement                         → not a front's to draw.

import {
  __resetCompositionGaps,
  compositionGaps,
} from '@forgeco/storefront-kit/extensions/composition-gap';
import type { InstalledExtension } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { publishedStorefrontSlots } from '../slots/published';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
vi.mock('@forgeco/storefront-kit/config', () => ({
  readClient: () => ({
    extensions: () => extensionsMock(),
    storeFlags: async () => ({ timezone: 'America/Sao_Paulo' }),
  }),
}));

const MISSING = 'storefront:nowhere.at_all';

const DECLARED: InstalledExtension[] = [
  {
    extension_id: 'acme-widget',
    hooks: [
      { component: 'stamp', target: MISSING, position: 0, placement_id: 'plc_gone' },
      { component: 'stamp', target: 'storefront:home.hero', position: 0, placement_id: 'plc_ok' },
      {
        component: 'stamp',
        target: 'storefront:checkout.bottom',
        position: 0,
        placement_id: 'plc_co',
      },
      { component: 'door', target: 'storefront:gate', position: 0, placement_id: 'plc_gate' },
      {
        component: 'panel',
        target: 'admin:admin.header.start',
        position: 0,
        placement_id: 'plc_adm',
      },
    ],
  },
];

let errors: string[];

beforeEach(() => {
  __resetCompositionGaps();
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  extensionsMock.mockReset();
  __resetCompositionGaps();
});

async function renderSlot(store = 'sto_1'): Promise<void> {
  const { ExtensionOutlet } = await import('./ExtensionOutlet');
  await ExtensionOutlet({ name: 'pdp.below_buybox', store, storeBase: HOST_BASE });
}

test('the fixture is honest: the slots it calls drawn ARE published, the missing one is not', () => {
  const published = new Set(publishedStorefrontSlots().map((s) => s.target));
  expect(published.has('storefront:home.hero')).toBe(true);
  expect(published.has('storefront:pdp.below_buybox')).toBe(true);
  expect(published.has('storefront:checkout.bottom')).toBe(true);
  expect(published.has(MISSING)).toBe(false);
});

test('★★ a placement on a slot this front does not publish is RECORDED, naming the four facts', async () => {
  extensionsMock.mockResolvedValue(DECLARED);
  await renderSlot();

  expect(compositionGaps(), 'the placement on a slot this front lacks left no trace').toEqual([
    {
      target: MISSING,
      extensionId: 'acme-widget',
      component: 'stamp',
      placementId: 'plc_gone',
      reason: 'slot',
    },
  ]);
  expect(errors).toHaveLength(1);
  const line = errors[0] ?? '';
  for (const fact of [MISSING, 'acme-widget.stamp', 'plc_gone', 'HAS NO SUCH SLOT']) {
    expect(line).toContain(fact);
  }
});

test('the same gap is said ONCE however many outlets render, and the page renders the same', async () => {
  extensionsMock.mockResolvedValue(DECLARED);
  await renderSlot();
  await renderSlot();
  await renderSlot('sto_2');
  expect(compositionGaps()).toHaveLength(1);
  expect(errors).toHaveLength(1);
});

test('a store whose placements are all on drawn slots records nothing', async () => {
  extensionsMock.mockResolvedValue([
    {
      extension_id: 'acme-widget',
      hooks: (DECLARED[0]?.hooks ?? []).filter((h) => h.target !== MISSING),
    },
  ]);
  await renderSlot();
  expect(compositionGaps()).toEqual([]);
});

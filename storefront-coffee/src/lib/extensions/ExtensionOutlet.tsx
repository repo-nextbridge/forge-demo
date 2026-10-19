// The STOREFRONT's <ExtensionOutlet>: the kit's mechanism, this app's generated block registry.
//
// The discovery, the ordering and every prop a block receives live in
// `@forgeco/storefront-kit/extensions` — the checkout deployable builds its own outlet from the same
// factory. What cannot be shared is the RESOLVER: `./generated/registry` is written per consumer by
// `pnpm codegen` from `extensions/composition.base.json`, and a shared package holding one app's map would be
// deciding the other app's composition. So the map is handed in here, once, and the ~40 call sites of this
// app keep importing a local `ExtensionOutlet`.

import { createExtensionOutlet } from '@forgeco/storefront-kit/extensions';
import { resolveBlock } from './registry';

// ⏭ MZ-9 — FOR THE NEXT CUT, NOT THIS ONE. The product's CS-1 (#668) gave `createExtensionOutlet` a
// `publishedSlots` option: given the set `GET /api/slots` publishes, every render also records the store's
// placements aimed at a slot no outlet of this front will ever be asked about. The kit this fork installs,
// `@forgeco/storefront-kit` 0.3.2, predates it — measured 2026-10-19: no `publishedSlots` anywhere in its
// installed copy, while the product's main has it (`packages/storefront-kit/src/extensions/ExtensionOutlet.tsx`).
// Not vendored on purpose. On adopting a kit that has it, pass `/api/slots`'s own union, so the check and the
// catalogue cannot disagree:
//   publishedSlots: () => new Set(publishSlots('storefront', slotRegistry(), SIBLING_SLOTS).map((s) => s.slot))
export const ExtensionOutlet = createExtensionOutlet({ resolveBlock });

export type {
  AccountSlotContext,
  OrderSlotContext,
  SlotQuery,
} from '@forgeco/storefront-kit/extensions';
export { slotQuery } from '@forgeco/storefront-kit/extensions';

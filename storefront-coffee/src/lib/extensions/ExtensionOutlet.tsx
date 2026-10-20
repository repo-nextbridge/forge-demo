// The STOREFRONT's <ExtensionOutlet>: the kit's mechanism, this app's generated block registry.
//
// The discovery, the ordering and every prop a block receives live in
// `@forgeco/storefront-kit/extensions` — the checkout deployable builds its own outlet from the same
// factory. What cannot be shared is the RESOLVER: `./generated/registry` is written per consumer by
// `pnpm codegen` from `extensions/composition.base.json`, and a shared package holding one app's map would be
// deciding the other app's composition. So the map is handed in here, once, and the ~40 call sites of this
// app keep importing a local `ExtensionOutlet`.

import { createExtensionOutlet } from '@forgeco/storefront-kit/extensions';
import { publishedStorefrontSlots } from '@/lib/slots/published';
import { resolveBlock } from './registry';

// ★★ MZ-9 → v0.3.3 — `publishedSlots` is the SAME catalog `GET /api/slots` serves (own ∪ siblings,
// `lib/slots/published.ts`), so a placement this front records as aimed at a slot it does not have is exactly
// one the admin's Compose badges «não desenha aqui» for this store. The kit learned the option in 0.3.3 (CS-1);
// absent, a block placed on a slot no outlet of this fork mounts vanished with nothing in the log — the
// defect MZ-9 found by hand in this fork's chrome. `./outlet-undrawn-slot.test.tsx` goes red without it.
export const ExtensionOutlet = createExtensionOutlet({
  resolveBlock,
  publishedSlots: () => new Set(publishedStorefrontSlots().map((s) => s.slot)),
});

export type {
  AccountSlotContext,
  OrderSlotContext,
  SlotQuery,
} from '@forgeco/storefront-kit/extensions';
export { slotQuery } from '@forgeco/storefront-kit/extensions';

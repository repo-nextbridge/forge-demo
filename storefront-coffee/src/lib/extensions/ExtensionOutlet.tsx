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

export const ExtensionOutlet = createExtensionOutlet({ resolveBlock });

export type {
  AccountSlotContext,
  OrderSlotContext,
  SlotQuery,
} from '@forgeco/storefront-kit/extensions';
export { slotQuery } from '@forgeco/storefront-kit/extensions';

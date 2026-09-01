// The block registry — the FRONT side of the extension system. It aggregates the renderable blocks of the
// AVAILABLE extensions (the directory), the same way TEMPLATE_MANIFESTS aggregates slot manifests and
// kernelCommands aggregates command sets.
//
// ★ A1 (ONDA 3) — ADDING A BLOCK IS NO LONGER "ONE IMPORT + ONE ENTRY HERE". An app that is on
// `extensions/composition.base.json` gets its entry GENERATED (./generated/registry.tsx, one static import
// per block), and the theme values a block wants injected come from ./injections. What is left below is the
// hand-welded remainder, which A2 empties app by app. Writing a new entry here by hand for a LISTED app is a
// red build.
//
// ★ E (PACK 5) — `banners`, `leads` and `shelves` left this file for the list, and the shelf's bespoke closure
// left with them: what that closure did (read the store's card chrome + the batch ratings, then hand the
// theme's card in) is exactly `injectRenderCard`, which the app now ASKS for by name in its own package.json.
//
// ★★ F2 — AND `reviews`, THE LAST ONE, IS GONE: THE REMAINDER IS EMPTY. It was not held here by its block —
// that block was composable all along — but by the OTHER thing it gave the storefront, a library function
// `cardRatings` imported by name. With the contribution point built (`../card-annotations/contract`) there was
// nothing left holding it, and the map below is `{}`. It is kept, with `resolveBlock` still two lookups, for
// exactly as long as an INSTANCE may still hand-weld a block of its own; the day that is refused too,
// `resolveBlock` is `resolveComposedBlock` and this file is a type declaration.
//
// WHICH extensions are INSTALLED (per tenant) is discovered at runtime via read.extensions —
// never hardcoded. The storefront imports only the block (a React component), never the manifest (which
// would pull @forgecommerce/contracts, forbidden here): slot -> block comes from read.extensions at runtime.

import type { BlockComponent } from '@forgecommerce/storefront-kit/extensions/registry';
import { resolveComposedBlock } from './generated/registry';

// The GENERATED registry imports `BlockComponent` from `'../registry'` — this module is its stable address,
// whatever else moves. Re-exported rather than redeclared: one contract, in the kit, for both deployables.
export type { BlockComponent } from '@forgecommerce/storefront-kit/extensions/registry';

// ★ CHECKOUT-APP (K1) — the block CONTRACT moved to the kit (both deployables render the same blocks); what
// stayed is this app's own answer to "which component is `<extension>.<block>` here": the generated registry
// plus the hand-welded remainder below.

/** extension_id -> block_id -> component, for the apps NOT yet on the composition list. Every block that SHOWS
 * PRODUCTS gets the theme's card INJECTED (`renderCard`): the card stays 100% the theme's while the extension
 * imports nothing from the storefront (dependency inversion — no cycle), and the theme keeps exactly ONE
 * product card. The same inversion, for the composed apps, is `./injections` — the recommendations blocks
 * (related's card, bought-together's whole <BundlePair>) moved there when they became generated entries. */
const BLOCK_REGISTRY: Record<string, Record<string, BlockComponent>> = {};

/** The COMPOSED blocks first (generated from `extensions/composition.base.json`), then
 * the hand-welded remainder above. Two maps and one lookup on purpose: A2 empties the second by moving apps
 * into the list, and the day it is empty this function is `resolveComposedBlock`. */
export function resolveBlock(extensionId: string, blockId: string): BlockComponent | undefined {
  return resolveComposedBlock(extensionId, blockId) ?? BLOCK_REGISTRY[extensionId]?.[blockId];
}

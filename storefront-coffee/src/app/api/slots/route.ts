// GET /api/slots — the theme PUBLISHES the storefront surface's known slots (COMPOSE). The admin "Composição"
// area reads this server-side to offer a "move to slot" dropdown of REAL, discovered slots (never a hardcode).
// Slots are a THEME concept (yellow zone): the kernel validates a target's SHAPE, never a slot's existence,
// so the source of truth is the theme's own slot registry — not the port. A slot added to a template's
// manifest (e.g. the MINICART's header slots) appears here automatically, with zero edit to this route.
//
// ★★ CHECKOUT-APP (C4) — ONE DOOR, TWO REGISTRIES, AND THAT IS WHY THIS FILE IS NOT JUST `slotRegistry()`.
//
// `storefront:` is what the KERNEL calls the surface, and the cut did not create a second one: it split the
// PROCESS. `checkout.*`, `order.*` and `account.*` are discovered by `apps/checkout` now. Publishing only this
// app's registry would have returned 200 with a dropdown that is short by three templates — no error, no log,
// nothing on the merchant's screen except options that stopped existing. So this route answers for the whole
// surface: its own registry UNIONED with every sibling consumer's (`publishSlots`, in the kit).
//
// ⚠️ The sibling arrives as GENERATED DATA, never an import: `apps/storefront` importing `apps/checkout` would
// bundle the other deployable into this one. `pnpm codegen` writes `lib/slots/generated/sibling-slots.ts` from
// the manifests that process aggregates, and the drift-check makes it incapable of disagreeing with them.
//
// The response prefixes each slot with the `storefront:` surface, so a value drops straight into a hook
// `target` (the grammar the kernel/admin validate). Public read (slot names are not a secret — they are
// implied by the rendered page) and cheap; the admin proxies it, so no CORS concern.

import { publishSlots } from '@forgeco/storefront-kit/slots/registry';
import { NextResponse } from 'next/server';
import { SIBLING_SLOTS } from '@/lib/slots/generated/sibling-slots';
import { slotRegistry } from '@/templates/registry';

export function GET(): NextResponse {
  // Order = declaration order (own registry first, then each sibling's, both preserving manifest + slot array
  // order). The Compose editor shows slots in the order the theme declares them — never re-alphabetized.
  return NextResponse.json({
    surface: 'storefront',
    slots: publishSlots('storefront', slotRegistry(), SIBLING_SLOTS),
  });
}

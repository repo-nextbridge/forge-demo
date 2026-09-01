// THE DEMO GATE, ON THE COUNTER'S HOST — one import and one entry, written by hand, and this is why.
//
// ★★ THE KIT'S OWN GATE REGISTRY IS EMPTY, AND IT IS EMPTY EVERYWHERE. `@forgecommerce/storefront-kit`'s
// `gate/registry.tsx` ships `const GATE_REGISTRY = {}` and says so in its header: a gate is ONE instance's
// decision, never the platform's, so the reference storefront ships the slot working and the map empty. What
// fills it for this box's storefront and checkout is the FLEET OVEN: `bin/build-local.sh` stages
// `composition.json`'s `instanceApps` into the build context and the oven composes them into the product
// images, writing the wiring from the app's own `forge.wiring` block.
//
// The totem does not go through that oven. It is a fork, built by `bin/build-totem.sh` like the coffee
// vitrine — so if this file did not exist, the counter's host would be the ONE host of this instance with no
// gate on it, while every other one is covered. That is precisely what the brief refuses: "o host do totem é
// tão protegido quanto os outros".
//
// ⚠️ THE ENTRY IS NOT INVENTED — IT IS COPIED FROM THE APP'S OWN DECLARATION. `apps/demo-gate/package.json`
// carries `forge.wiring.gate.interstitial` = `./block/entry` × `GateInterstitial` and `…ribbon` = the same
// module × `GateRibbonEntry`. That is the same declaration the oven reads. `registry.test.ts` compares the
// two, so the day the gate renames an export, this file fails a test instead of rendering nothing — which is
// the exact failure mode the gate had upstream before Forge P1 (installed, filling its slot in the data, and
// showing no screen at all).
//
// The two props are the whole write side and neither is optional: `dismiss` sets the slot's dismissal cookie
// (the "enter" button posts it, and the SAME url then renders the real content — no redirect), `reopen`
// clears it.

import { GateInterstitial, GateRibbonEntry } from '@forge/ext-demo-gate/block/entry';
import type { ReactNode } from 'react';

/** What a gate implementation gives the slot. Mirrors the kit's `GateImplementation`. */
export type GateImplementation = {
  Interstitial: (props: {
    store: string;
    dismiss: () => Promise<void>;
  }) => ReactNode | Promise<ReactNode>;
  Ribbon?: (props: { store: string; reopen: () => Promise<void> }) => ReactNode | Promise<ReactNode>;
};

/** extension_id (as the kernel knows it) -> what this build renders for it. */
export const GATE_REGISTRY: Record<string, GateImplementation> = {
  'demo-gate': {
    Interstitial: GateInterstitial,
    Ribbon: GateRibbonEntry,
  },
};

export function resolveGate(extensionId: string): GateImplementation | undefined {
  return GATE_REGISTRY[extensionId];
}

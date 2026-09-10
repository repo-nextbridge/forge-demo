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
// vitrine — so without this file the counter's host would have no gate on it at all. That is precisely what
// the brief refuses: "o host do totem é tão protegido quanto os outros".
//
// ⛔⛔ AND THE SENTENCE THAT USED TO FOLLOW — *"while every other one is covered"* — WAS FALSE, MEASURED
// 2026-09-11 (pk31/§2). The coffee vitrine is the other fork, built by `bin/build-coffee.sh` outside the same
// oven, and it has no file like this one: `storefront-coffee/src/app/s/[store]/layout.tsx:22` resolves the gate
// through `@forgecommerce/storefront-kit/gate/registry`, whose map is `{}` BY DESIGN and held empty by the
// kit's own guard, and `storefront-coffee/src/lib/extensions/generated/registry.tsx` is the product's
// composition (no gate in it). So that host finds the app filling the slot, resolves no implementation, and
// degrades to "no gate" in silence — the exact failure this file was written to avoid, one fork to the left.
// ⇒ It is NOT fixed here: the repair is the coffee fork's own registry plus its dependency and build staging,
// which is a slice of its own. Naming it is what stops the next reader believing the old sentence.
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

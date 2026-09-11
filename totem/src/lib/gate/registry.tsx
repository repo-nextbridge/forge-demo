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
// oven, and it has no file like this one: `storefront-coffee/src/app/s/[store]/layout.tsx` resolves the gate
// through `@forgecommerce/storefront-kit/gate/registry`, whose map is `{}` BY DESIGN and held empty by the
// kit's own guard, and `storefront-coffee/src/lib/extensions/generated/registry.tsx` is a 2026-09-01 cut of the
// product's composition with no gate in it. So that host finds the app filling the slot and resolves no
// implementation.
//
// ⚠️ WHAT FOLLOWED *THAT* HAS NOW ROTTED TOO, AND IT IS CORRECTED RATHER THAN REMOVED, because the correction
// is the whole news. It used to end «and degrades to "no gate" in silence — the exact failure this file was
// written to avoid». THE SILENCE IS GONE: pk32 made `storefront:gate` a STRUCTURAL target, so a front that
// cannot draw what fills it REFUSES THE PAGE, visibly (`CompositionGapNotice`), and the café's layout mounts
// that branch today. A shop nobody can open is a better answer than a front door nobody put up — and it is
// still not a gate.
//
// ★★★ SO pk33 SPENT THE DIFFERENCE THE WAY HE ASKED (11/09: *"o fork é do cliente, 100% liberdade"*): the app
// is installed for BOTH tenants at birth, and `seed/coffee.mjs::dropGateOnTheCafe` REMOVES the placement from
// the café alone. The counter — this file — keeps its gate and draws it. ⇒ the café is now gateless BY
// DECLARATION rather than by accident: the port, the admin and the screen agree, and nobody meets a refusal
// screen where a coffee shop should be. The reason lives where a reader will trip over it: the declared
// divergence `{ fork: 'storefront-coffee', app: 'demo-gate' }` at the top of `bin/front-app-reach.guard.mjs`,
// printed on every run, RED the day it stops matching a finding.
// ⇒ The real repair is still owed and still somebody else's: the café's own registry plus its dependency and
// build staging, which needs the fork to be able to regenerate a GENERATED surface. Naming it is what stops the
// next reader believing either of the two sentences this paragraph has already outlived.
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

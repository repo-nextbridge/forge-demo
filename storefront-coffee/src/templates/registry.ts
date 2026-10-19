// The VITRINE's templates — the front analogue of `kernelCommands()` listing the command-group modules.
//
// ★ CHECKOUT-APP (C1) — `checkoutManifest`, `orderManifest` and `accountManifest` are NOT here any more.
// Their templates moved to `apps/checkout`, which aggregates them in its own `templates/registry.ts`. Two
// deployables, two registries, one discovery — and the header/footer manifests appear in BOTH, because both
// wear the same chrome and a block dropped in `header.end` has to render on either side of the host.
// ⚠️ That is the REFERENCE vitrine's reasoning. This fork does not wear the kit's chrome (MZ-9, below).

// Adding a SLOT to an existing template needs no edit here (the manifest declares it, discovery finds
// it). Adding a whole new TEMPLATE registers it once here, exactly as a new command group is added to
// kernelCommands(). The slot SET is never a hardcoded enum — it is discovered from these manifests.

import {
  type DiscoveredSlot,
  discoverSlots,
  mountSlotRegistry,
  type TemplateManifest,
} from '@forgeco/storefront-kit/slots/registry';
import { footerManifest } from '@forgeco/storefront-kit/subtemplates/footer/template.manifest';
import { headerManifest } from '@forgeco/storefront-kit/subtemplates/header/template.manifest';
// Import the subtemplate manifests from their manifest modules directly (pure data), NOT via
// subtemplates/registry.ts — that barrel also pulls in the variant components, which import <Slot>, which
// imports this file: going through it would form a module cycle (TDZ at load).
import { coffeeChromeManifest } from '@/components/coffee/coffee-chrome.manifest';
import { minicartManifest } from '@/components/minicart/minicart.manifest';
import { homeManifest } from './home/template.manifest';
import { listManifest } from './list/template.manifest';
import { pdpManifest } from './pdp/template.manifest';
import { searchManifest } from './search/template.manifest';

export const TEMPLATE_MANIFESTS: readonly TemplateManifest[] = [
  pdpManifest,
  listManifest,
  homeManifest,
  searchManifest,
  coffeeChromeManifest,
  minicartManifest,
];

/**
 * ★★ MZ-9 — THE KIT'S CHROME, KNOWN BUT NOT PUBLISHED. This fork's pages wear <CoffeeChrome>, which draws ONE
 * of the kit chrome's eleven slots, so `TEMPLATE_MANIFESTS` above carries `coffeeChromeManifest` and not these
 * two (see that manifest for the measurement). But kit chrome components ARE still rendered by this app — the
 * `/ui-storefront` gallery shows the kit's header and footer, and `components/StorefrontChrome.tsx` is the
 * control `chrome-identity.test.tsx` judges against — and the kit's <Slot> refuses, in dev, a name the MOUNTED
 * registry does not know. Measured with these two dropped from the mount: `catalog-examples.test.tsx` red on
 * `<Slot name="header.announcement"> is not declared in any template manifest`, and the control with it.
 *
 * So the two questions get two answers: <Slot> asks "is this a real slot name?" (these manifests say yes) and
 * `GET /api/slots` asks "does this store's page draw it?" (only `slotRegistry()` answers that). Publishing
 * these again is the defect; `CoffeeChrome.slots.guard.test.ts` holds the published half to what <CoffeeChrome>
 * mounts.
 */
export const KIT_CHROME_MANIFESTS: readonly TemplateManifest[] = [headerManifest, footerManifest];

/** The discovered slot registry for the storefront (all template manifests aggregated) — what is PUBLISHED. */
export function slotRegistry(): Map<string, DiscoveredSlot> {
  return discoverSlots(TEMPLATE_MANIFESTS);
}

/** Every slot name a <Slot> rendered by this app may carry: the published registry, with the kit's chrome in
 *  place of this fork's subset of it (the same template, so one of the two, never both). */
export function knownSlotRegistry(): Map<string, DiscoveredSlot> {
  return discoverSlots([
    ...TEMPLATE_MANIFESTS.filter((m) => m !== coffeeChromeManifest),
    ...KIT_CHROME_MANIFESTS,
  ]);
}

// ★ CHECKOUT-APP (K1) — the kit's <Slot> asks for the registry instead of importing this app. This is where
// the vitrine answers. A module-scope side-effect on purpose: the aggregation above IS the answer, and any
// later call site would be a second place that could forget.
mountSlotRegistry(knownSlotRegistry);

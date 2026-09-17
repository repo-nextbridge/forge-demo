// The VITRINE's templates — the front analogue of `kernelCommands()` listing the command-group modules.
//
// ★ CHECKOUT-APP (C1) — `checkoutManifest`, `orderManifest` and `accountManifest` are NOT here any more.
// Their templates moved to `apps/checkout`, which aggregates them in its own `templates/registry.ts`. Two
// deployables, two registries, one discovery — and the header/footer manifests appear in BOTH, because both
// wear the same chrome and a block dropped in `header.end` has to render on either side of the host.

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
  headerManifest,
  footerManifest,
  minicartManifest,
];

/** The discovered slot registry for the storefront (all template manifests aggregated). */
export function slotRegistry(): Map<string, DiscoveredSlot> {
  return discoverSlots(TEMPLATE_MANIFESTS);
}

// ★ CHECKOUT-APP (K1) — the kit's <Slot> asks for the registry instead of importing this app. This is where
// the vitrine answers. A module-scope side-effect on purpose: the aggregation above IS the answer, and any
// later call site would be a second place that could forget.
mountSlotRegistry(slotRegistry);

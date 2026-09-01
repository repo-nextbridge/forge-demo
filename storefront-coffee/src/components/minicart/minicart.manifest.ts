// The MINICART composition's slot declarations. The minicart drawer is theme code (yellow zone), NOT an
// app — but its two enrichment spaces are declared here so `discoverSlots()` (templates/registry.ts) finds
// them, exactly like the header/footer subtemplates. V1: both are empty/default and degrade invisibly; a
// promo (free-shipping bar, PROMO/v0.3) or a cross-sell (REC) app fills them later by discovery/placement
// (COMPOSE reads this same aggregated list). Adding a slot here needs no edit to any central enum.

import type { TemplateManifest } from '@forgecommerce/storefront-kit/slots/registry';

export const minicartManifest: TemplateManifest = {
  template: 'minicart',
  slots: [
    {
      name: 'minicart.top',
      description: 'Top of the cart drawer (e.g. a free-shipping progress bar). Empty in V1.',
    },
    {
      name: 'minicart.below_items',
      description: 'Below the drawer line items, above the total (e.g. a cross-sell). Empty in V1.',
    },
  ],
};

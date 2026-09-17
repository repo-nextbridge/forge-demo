// The PDP template's slot declarations. Adding an entry here makes the slot DISCOVERED (it appears in
// discoverSlots()) with no edit to the registry or any central enum — the yellow-zone way to extend.
// V1 slots are empty/default; ADM-1 fills them.

import type { TemplateManifest } from '@forgeco/storefront-kit/slots/registry';

export const pdpManifest: TemplateManifest = {
  template: 'pdp',
  // Body areas, in render order after the gallery/buybox hero: reviews land in below_gallery, the cross-sell
  // "compre junto" in below_buybox, then the "you may also like" shelf in below_cross_sell — the description
  // tabs render LAST, below all three. (S7 order fix.)
  slots: [
    {
      name: 'pdp.below_gallery',
      description: 'Below the product gallery (e.g. the reviews section).',
    },
    {
      name: 'pdp.below_buybox',
      description: 'Below the buybox, first body area (e.g. the cross-sell "buy together").',
    },
    {
      name: 'pdp.below_cross_sell',
      description:
        'Below the cross-sell, last body area before the tabs (e.g. the "related" shelf).',
    },
  ],
};

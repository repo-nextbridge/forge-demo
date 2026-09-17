// The list (category) template's slot declarations. Same rule as the PDP manifest: declare here, the
// system discovers; V1 empty/default, ADM-1 fills.

import type { TemplateManifest } from '@forgeco/storefront-kit/slots/registry';

export const listManifest: TemplateManifest = {
  template: 'list',
  slots: [
    { name: 'list.above_shelf', description: 'Above the product shelf (e.g. a campaign banner).' },
    { name: 'list.below_shelf', description: 'Below the product shelf (e.g. curated shelves).' },
    // S7-SF-PLP — the thin bottom banner strip (HANDOVER §5). The demo fills it with a banner instance.
    {
      name: 'list.footer_banner',
      description: 'A thin banner strip below the listing (bottom of the page).',
    },
  ],
};

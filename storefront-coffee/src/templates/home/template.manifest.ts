// The home template's slot declarations. Declared here, discovered by the registry. The home is composed
// ENTIRELY from these (S6-FIXPACK: no hardcoded hero, no default shelf) — an empty composition is an empty
// home. The slot NAMES are stable: saved compositions target them (never rename, only add).

import type { TemplateManifest } from '@forgeco/storefront-kit/slots/registry';

export const homeManifest: TemplateManifest = {
  template: 'home',
  slots: [
    {
      name: 'home.hero',
      description: 'Top of the home page (e.g. a configurable hero/banner app).',
    },
    {
      name: 'home.banner_strip',
      description: 'A horizontal strip below the hero (e.g. a banners app faixa).',
    },
    {
      name: 'home.below_shelf',
      description: 'The bottom of the home page (e.g. curated/featured product shelves).',
    },
    {
      name: 'home.below_categories',
      description:
        'Below the "Compre por categoria" section (spread a block after the category tiles).',
    },
    {
      name: 'home.below_brands',
      description: 'Below the "Marcas" section (the last drop target on the home page).',
    },
  ],
};

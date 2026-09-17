// The search template's slot declarations. V1 declares none — search is the substance page, not a slot
// showcase. The manifest is registered so a future slot (e.g. `search.above_results` for a facet/banner
// app) is added here with zero edit to lib/slots/registry.ts, exactly like the other templates.

import type { TemplateManifest } from '@forgeco/storefront-kit/slots/registry';

export const searchManifest: TemplateManifest = {
  template: 'search',
  slots: [],
};

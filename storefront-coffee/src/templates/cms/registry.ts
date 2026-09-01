// The CMS template registry — maps a page's `template_key` to the theme component that renders it. This is
// the CMS analogue of the kernel command registry: adding a template is registering it here once. It is the
// ONE place the theme dispatches a template by a runtime string key (the catalog templates are statically
// imported by their routes; a CMS page's template is data-driven, so it needs this lookup).
//
// Unknown key policy (DoD): fall back to the default template + a dev warning, NEVER a 500. A page whose
// template_key does not resolve still renders (institutionally), so a bad/renamed key degrades gracefully.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { About } from './About';
import { Contact } from './Contact';
import { Faq } from './Faq';
import { InstitutionalDefault } from './InstitutionalDefault';
import { Privacy } from './Privacy';
import { Returns } from './Returns';
import { Shipping } from './Shipping';
import { Terms } from './Terms';

export type PageTemplate = (props: { page: PageDoc }) => React.ReactElement;

export const DEFAULT_TEMPLATE_KEY = 'institutional-default';

const REGISTRY: Record<string, PageTemplate> = {
  'institutional-default': InstitutionalDefault,
  faq: Faq,
  contact: Contact,
  about: About,
  returns: Returns,
  shipping: Shipping,
  privacy: Privacy,
  terms: Terms,
};

/** Resolve a template_key to its component. Unknown → the default template + `fallback: true` (and a warn),
 * so the caller can render it and, if it wants, signal the degradation — never throw. */
export function resolvePageTemplate(key: string): { template: PageTemplate; fallback: boolean } {
  const found = REGISTRY[key];
  if (found) return { template: found, fallback: false };
  console.warn(`[cms] unknown template_key "${key}", falling back to "${DEFAULT_TEMPLATE_KEY}"`);
  return { template: InstitutionalDefault, fallback: true };
}

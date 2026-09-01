// Catalog example for the PDP body (/ui-storefront/pdp-showcase) — the breadcrumb + gallery + buybox (variant
// picker, qty, add-to-cart) + CEP + tabs, composed with fixtures so the whole page's fidelity is reviewable and
// its live behaviours are drivable offline (no route/DB). The reviews, "compre junto" and related shelf are
// extension outlets, verified on Staging.

import { PdpShowcase } from './PdpShowcase';

export function PdpShowcaseExamples() {
  return <PdpShowcase />;
}

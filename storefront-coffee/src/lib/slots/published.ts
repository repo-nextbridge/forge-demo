// ★★ THE STOREFRONT SURFACE'S PUBLISHED SLOT CATALOG, computed in ONE place for its two readers — the shape the
// reference storefront took in v0.3.3 (CS-1, `apps/storefront/src/lib/slots/published.ts`):
//   · `GET /api/slots` serves it to the admin's Compose (the palette of the store this front serves);
//   · the extension outlet checks every placement against it and records the ones aimed at a slot this front
//     does not have (`noteUndrawnSlots` in the kit).
// One function so the two can never disagree: a slot Compose offers is a slot this front will not call a gap,
// and a gap this front records is a slot Compose marks as not drawn here.

import { type PublishedSlot, publishSlots } from '@forgeco/storefront-kit/slots/registry';
import { SIBLING_SLOTS } from '@/lib/slots/generated/sibling-slots';
import { slotRegistry } from '@/templates/registry';

/** Own registry first, then each sibling's, both in declaration order (see `publishSlots`). */
export function publishedStorefrontSlots(): PublishedSlot[] {
  return publishSlots('storefront', slotRegistry(), SIBLING_SLOTS);
}

// THE SCREEN'S ART, IMPORTED — one entry per face the box declares, keyed by the key everything else is
// written against.
//
// ★★★ WHY A MAP AND NOT A PATH BUILT FROM THE FACE. The first version of this screen wrote
// `` `./art/card-${face.store ?? 'store'}.webp` `` at render time, and that one line carried two defects that
// no test in this app could see:
//
//   1. ⛔ A STRING IS INVISIBLE TO THE BUNDLER. Next emits an asset because something IMPORTED it; a template
//      literal is just text. None of the six files reached any of the four images — measured by grepping the
//      baked `.next` of all four fronts and finding zero — and the browser would have asked for
//      `./art/card-outlet.webp` relative to whatever storefront page the gate was covering. Four broken
//      images on the demo's front door, on a screen whose whole job is to look considered.
//   2. ⛔ AND TWO OF THE FOUR NAMED A FILE THAT DOES NOT EXIST. The store handles this box declares are
//      `forge | outlet | cafe | balcao`; the art is named for what each shop IS — `store | outlet | cafe |
//      totem`. Two of them happen to coincide, which is the worst possible number: enough for the line to
//      look right to a reader, not enough for it to work.
//
// So the relationship between a face and its art is DECLARED, once, here — and `art.test.ts` holds this map
// against `faces.generated.ts` in both directions, so a face added without art and art left behind by a face
// that went away are each red, by name.
//
// ⚠️ The values are `StaticImageData`, not strings: `.src` is the `/_next/static/media/…` URL the bundler
// emits, hashed, cacheable, and correct from any page the gate covers. See `../global.d.ts` for the shape and
// why it is declared rather than `any`.

import adminCafe from './art/admin-dashboard-cafe.webp';
import adminShoes from './art/admin-dashboard.webp';
import cardCafe from './art/card-cafe.webp';
import cardOutlet from './art/card-outlet.webp';
import cardStore from './art/card-store.webp';
import cardTotem from './art/card-totem.webp';

export type Art = { src: string; width: number; height: number };

/** One picture per SHOP, by `<tenant>/<handle>`. */
export const CARD_ART: Readonly<Record<string, Art>> = {
  'forgeco/forge': cardStore,
  'forgeco/outlet': cardOutlet,
  'forgecafe/cafe': cardCafe,
  'forgecafe/balcao': cardTotem,
};

/** One screenshot per TENANT's admin, by tenant id. */
export const ADMIN_ART: Readonly<Record<string, Art>> = {
  forgeco: adminShoes,
  forgecafe: adminCafe,
};

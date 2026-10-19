// ★★ MZ-9 — THE CHROME SLOTS THIS FORK DECLARES ARE THE ONES <CoffeeChrome> DRAWS, AND NO OTHER.
//
// ⛔ THE DEFECT, MEASURED 2026-10-19 (found by the product's CS-1, #668). `templates/registry.ts` aggregated the
// kit's `headerManifest` and `footerManifest` — eleven slots — while both trees of this deployable wear
// <CoffeeChrome>, which draws exactly ONE of them (`footer.end`). The kit's own chrome, the one that does mount
// the eleven, is mounted by no layout here (`components/StorefrontChrome.tsx` says so at its head). So this
// fork's registry, and with it `GET /api/slots`, declared ten chrome slots no page of the vitrine draws, and
// Compose — which asks the store's own front since #668 — offered them as drop targets.
//
// ★ SO THE FORK DECLARES ITS OWN CHROME, the way it declares its own templates. The template name stays
// `footer` on purpose: `publishSlots` unions this registry with the checkout's (`SIBLING_SLOTS`), and the same
// slot name under two template names is refused there ("names are global"). The description is the kit's,
// read rather than copied, so the label Compose shows does not drift from the one the checkout publishes.
//
// ⚠️ WHAT THIS DOES NOT CHANGE: the route still publishes `header.*`/`footer.*` through `SIBLING_SLOTS` — the
// checkout we host wears the kit's chrome and draws them on `/checkout*` of this same hostname. A block placed
// in `header.end` on the café reaches the checkout pages and not the shelf; that half is generated from the
// release (`pnpm codegen` in the product) and is not this fork's to edit.
//
// To publish another chrome slot: mount it in <CoffeeChrome> AND name it here. `CoffeeChrome.slots.guard.test.ts`
// is red for either half alone.
import type { TemplateManifest } from '@forgeco/storefront-kit/slots/registry';
import { footerManifest } from '@forgeco/storefront-kit/subtemplates/footer/template.manifest';

export const COFFEE_CHROME_SLOTS = ['footer.end'] as const;

export const coffeeChromeManifest: TemplateManifest = {
  template: footerManifest.template,
  slots: footerManifest.slots.filter((s) =>
    (COFFEE_CHROME_SLOTS as readonly string[]).includes(s.name),
  ),
};

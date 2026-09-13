// ★★ THE APPS' OWN STOREFRONT BLOCKS, as `read.extension_composition` answers them for a store where the
// install has just run — the fixture the verifier's suite builds every fake box's composition out of.
//
// `extension.install` materializes every hook the manifest declares (`seedDefaultPlacements`), so these rows
// are the KERNEL's work and not a seed's — which is exactly why no section of the verifier looked at them
// until pk31/3e, and why counting them by hand produced the wrong answer about `confirmation_note`.
//
// ⚠️ IT IS HAND-WRITTEN AND MUST STAY THAT WAY, for the reason `bin/verify-seed.test.mjs` states about its
// other fixtures: the manifests are files of the Forge monorepo, and a suite that derived this list would
// pass on one developer's disk and SKIP on another's. The `verify-seed` suite must grade on every machine.
//
// ⛔ AND A HAND-WRITTEN LIST APODRECE CALADA, which is why it moved out of the suite and into its own file
// on 2026-09-12: `bin/app-blocks.guard.mjs` grades it against the manifests OF THE PINNED RELEASE, and that
// guard is allowed to say NOT CHECKED because it is the only thing it grades. That is the whole division of
// labour — the suite keeps a fixture that always runs, the guard keeps the fixture honest when a Forge clone
// is within reach.
//
// ⛔ pk34/D3 — THE DEFECT THAT BOUGHT THE GUARD. The owner moved `my_subscriptions` from `account.top` to
// `account.bottom` on 2026-09-11 (the manifest, in the product). Nothing in this repository noticed: the
// line below went on asserting the old place, GREEN, and a test that passes while describing a world that no
// longer exists is worse than no test — it is the defect this arc is named after, a signal that does not
// know it cannot know.
//
// ⛔ THE ADMIN HOOKS ARE DELIBERATELY ABSENT. `subscriptions/latest_subscriptions` is an `admin:` hook,
// seeded ONCE PER TENANT with a null store, and mistaking it for a store block is the whole defect pk31/3e
// was written after. The guard grades that omission as a rule rather than trusting this sentence.

/** `[extension_id, component, target]`, in the manifest's own order. */
export const APP_BLOCKS = [
  ['subscriptions', 'plan_picker', 'storefront:pdp.below_buybox'],
  ['subscriptions', 'cart_plans', 'storefront:checkout.summary'],
  // ★ `account.bottom` since 2026-09-11, and the row on a bench is born there rather than moved there: the
  // owner changed the MANIFEST ("eu movi o bloco de minhas assinaturas para account.bottom, acho que faz
  // mais sentido"), so a box born after that commit places it at the bottom and a box born before keeps the
  // row it has — `default_placement_seed` remembers the offer and no migration rewrites a merchant's
  // arrangement. ⛔ Do not hand-edit this line to match a bench: it follows the pinned manifest, and
  // `bin/app-blocks.guard.mjs` is what says so.
  ['subscriptions', 'my_subscriptions', 'storefront:account.bottom'],
  ['subscriptions', 'confirmation_note', 'storefront:checkout.confirmation'],
  ['reviews', 'reviews', 'storefront:pdp.below_gallery'],
  ['reviews', 'order_review', 'storefront:order.below_items'],
  // `recommendations` is here for a second reason beyond being real: the "unplaced default" test of the
  // verifier's suite stages `recommendations/related` with a null placement in ONE store, and 3e's verdict is
  // per TENANT — so the sibling store holding it LIVE is what makes that staging a statement about the
  // Outlet's window instead of an accusation about the app. Drop these two lines and that test goes red for
  // the right rule.
  ['recommendations', 'related', 'storefront:pdp.below_cross_sell'],
  ['recommendations', 'bought-together', 'storefront:pdp.below_buybox'],
];

/** The apps this fixture speaks for, derived from it — never a second list beside it. */
export const APP_BLOCK_APPS = [...new Set(APP_BLOCKS.map(([app]) => app))];

/** The prefix a target must carry to be a block a SHOPPER can see. Everything else is the operator's face. */
export const STOREFRONT = 'storefront:';

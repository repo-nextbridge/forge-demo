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
// ⛔ AND A HAND-WRITTEN LIST ROTS IN SILENCE, which is why it moved out of the suite and into its own file
// on 2026-09-12: `bin/app-blocks.guard.mjs` grades it against the manifests OF THE PINNED RELEASE, and that
// guard is allowed to say NOT CHECKED because it is the only thing it grades. That is the whole division of
// labour — the suite keeps a fixture that always runs, the guard keeps the fixture honest when a Forge clone
// is within reach.
//
// ⛔ pk34/D3 — THE DEFECT THAT BOUGHT THE GUARD. `my_subscriptions` moved from `account.top` to
// `account.bottom` on 2026-09-11 (the manifest, in the product). Nothing in this repository noticed: the
// line below went on asserting the old place, GREEN, and a test that passes while describing a world that no
// longer exists is worse than no test — it is the defect this arc is named after, a signal that does not
// know it cannot know.
//
// ⛔ THE ADMIN HOOKS ARE DELIBERATELY ABSENT FROM `APP_BLOCKS`. `subscriptions/latest_subscriptions` is an
// `admin:` hook, seeded ONCE PER TENANT with a null store, and mistaking it for a store block is the whole
// defect pk31/3e was written after. The guard grades that omission as a rule rather than trusting this
// sentence. The operator's board is a SECOND fixture, below, and it is graded by the same guard.

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

// ── ★★ THE OPERATOR'S BOARD (pk35/D6) ──────────────────────────────────────────────────────────────────────
//
// ⛔ THE DEFECT, AND IT IS THE ONE ABOVE WEARING ANOTHER HAT. pk34/D3 derived the STORE placements against the
// manifests of the pinned release and left this list behind, typed into `bin/verify-seed.test.mjs` under a
// comment that described it as the seven the dataset declares, in the order they were arranged in — a
// sentence nothing could check. Seven names about a screen in another repository, in a file that never opens
// that repository.
// A widget renamed, dropped or added upstream and this list goes on describing a home nobody has, GREEN.
//
// ⇒ IT MOVED HERE FOR EXACTLY THE REASON `APP_BLOCKS` DID: the suite needs a fixture that runs on every
// machine, and `bin/app-blocks.guard.mjs` needs something it can grade against the release when a clone is
// within reach. Same division of labour, one more list.
//
// ★★★ AND IT IS GRADED AGAINST TWO DECLARATIONS, NOT ONE (pk36/D2, 2026-09-14) — because there are two, and
// the guard used to know only the older of them:
//
//   the MANIFEST (`extensions/admin-dashboard/manifest.ts`) is the PRODUCT's default — what a board opens on
//   when nobody said anything;
//   `<forge.lock → dataset.source>/storefront.json` → `admin_widgets` is the INSTANCE's arrangement, applied
//   AT BIRTH by `seed/widgets.mjs` through `composition.reorder`, and it is the list THIS list is a copy of —
//   `bin/verify-seed.test.mjs` stages it as the mounted dataset;
//   and Compose is the MERCHANT's last word, which ⛔ neither of the two ever rewrites.
//
// Until pk36/D2 the guard compared only against the manifest. The two are byte-identical at the pinned
// commit, so it passed BY COINCIDENCE: a reorder of the dataset alone would have left this list asserting the
// manifest's order, GREEN, about every board born from that dataset. The guard now grades against the DATASET
// when the dataset declares and against the MANIFESTS when it does not — and it prints which one answered.
//
// ★★ AND THE ORDER IS PART OF THE CLAIM, WHICH IS NOT AN ASSUMPTION — both declarations say so. The manifest
// says it in prose (`extensions/admin-dashboard/manifest.ts`, AJ4): *"THIS ARRAY'S ORDER IS THE HOME'S
// ORDER"*, because `seedDefaultPlacements` walks the hooks in array order giving each
// `position = max(position) + 1`. The dataset says it by construction: `composition.reorder` writes
// `position` in the order it is handed the placements. A set comparison would go green on a board shuffled
// upstream, which is the one thing the pk30/§11 section of the verifier is about.

/** The slot the admin home's mosaic fills. An `admin:` target — never a shopper's. ⛔ RE-EXPORTED, not
 *  re-typed: the string that matters is the one `seed/widgets.mjs` hands `composition.reorder` on the real
 *  box, and a second copy of it here could go on grading a slot the seeder had stopped writing to. */
export { ADMIN_WIDGETS_SLOT as ADMIN_SLOT } from '../seed/widgets.mjs';

/** The board, as `<app>/<component>` names in the order a fresh install opens on. */
export const ADMIN_WIDGETS = [
  'admin-dashboard/revenue',
  'admin-dashboard/recent_orders',
  'admin-dashboard/shipping',
  'admin-dashboard/order_status',
  'admin-dashboard/stores_sales',
  'admin-dashboard/promos',
  'admin-dashboard/stock',
];

/** The apps this board speaks for, derived from it — never a second list beside it. ⚠️ It is deliberately
 *  NOT every app that declares a widget: `subscriptions` declares one at the same slot and is NOT on the
 *  board above, which is what makes it the intruder the verifier's sabotage stages. */
export const ADMIN_WIDGET_APPS = [...new Set(ADMIN_WIDGETS.map((name) => name.split('/')[0]))];

// A22 — THE CHECKOUT POSTURE OF A STORE, as two functions, because both decisions are wrong in silence.
//
// `bin/seed-box.mjs` runs on import (it validates the environment and then seeds), so nothing can import it to
// check its reasoning. The two rules that decide whether this box's postures actually LAND therefore live
// here, where a test can drive them — the same argument `seed/media.mjs` makes about its own pair.
//
// ── ★★ WHAT A POSTURE IS ────────────────────────────────────────────────────────────────────────────────
//
// `guest_checkout_enabled` and `masked_checkout_enabled` are two columns of `store` and ONE decision: how much
// a shop asks of somebody who has not logged in. Measured on the bench of 2026-09-04, every store of this box
// answered it the same way by accident (guest on everywhere, masked wherever a seeder happened to turn it on),
// which demonstrates nothing at all. The demo's value here is the CONTRAST — three stores of the same product
// answering it three different ways is the proof, with no slide, that the answer belongs to the merchant.
//
// ⚠️ AN UNDECLARED FLAG IS NOT `false`. `undefined` means "this box has no opinion" and the column keeps
// whatever it has. That is what lets one store's posture be owned here and its sibling's by somebody else.

/** The two columns a posture is made of. Order is the order they are logged in. */
export const CHECKOUT_FLAGS = ['guest_checkout_enabled', 'masked_checkout_enabled'];

/**
 * WHAT HAS TO BE WRITTEN, given what the box DECLARES and what the store CURRENTLY IS.
 *
 * IDEMPOTENT BY VALUE: a flag that already matches produces no key, so a converged box spends no command and
 * no audit row. An empty object means "nothing to do", which the caller must be able to tell apart from
 * "nothing declared" — both are `{}` here on purpose, because the write is the same either way: none.
 *
 * @param declared the store entry from `seed/box.json`
 * @param actual   the row `read.internal.stores` answered for that handle
 */
export function checkoutFlagPatch(declared, actual) {
  const patch = {};
  for (const flag of CHECKOUT_FLAGS) {
    if (declared?.[flag] === undefined) continue;
    if (actual?.[flag] === declared[flag]) continue;
    patch[flag] = declared[flag];
  }
  return patch;
}

/**
 * ⛔ THE DECLARATION THAT WOULD BE OVERWRITTEN IN SILENCE — the worst shape of all, because the file would say
 * one thing and the box would show another with nothing failing anywhere.
 *
 * ★ MEASURED, 2026-09-04, and the measurement is the whole rule. `configureStore`
 * (apps/api/src/seed-storefront.ts) re-asserts `masked_checkout_enabled: true` AND `guest_checkout_enabled:
 * true` on every run of the dataset one-shot — but on ONE store, `ctx.storeId`, which is the tenant's
 * BOOTSTRAP store. On the bench: `forge` came out masked=t/guest=t and its sibling `outlet` masked=f/guest=t,
 * i.e. the column defaults. Two facts follow, and they point in opposite directions:
 *
 *   · the SIBLING stores of a dataset tenant are genuinely unowned, so this box may state their posture;
 *   · the BOOTSTRAP store is the one-shot's, and step 9 speaks AFTER step 6.
 *
 * A tenant the dataset is NOT about runs no step 9 at all, so nothing there is anybody else's.
 *
 * @returns the offending store entries — empty when the declaration is safe.
 */
export function bootstrapFlagConflicts(spec) {
  if (spec?.dataset !== true) return [];
  return (spec.stores ?? []).filter(
    (store) => store.bootstrap === true && CHECKOUT_FLAGS.some((flag) => store[flag] !== undefined),
  );
}

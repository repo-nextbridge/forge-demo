// ★★ IS THIS STORE SERVED BY A VITRINE? THE PORT ANSWERS. THIS FILE IS THE ONLY PLACE THAT READS THE ANSWER.
//
// ── WHY IT EXISTS: THIS BOX HELD A SECOND TRUTH ABOUT A STORE, AND NOTHING SYNCHRONISED THE TWO ──────────
//
// Until pk21 `seed/box.json` carried a HAND-WRITTEN `servable: false` on the counter, with a paragraph
// explaining that the totem is a whole-host app and there is no vitrine page to warm. Every word of that
// paragraph was true. The problem was that the KERNEL ALREADY PUBLISHES THE FACT, and had done since pk9:
//
//   `read.internal.stores[].storefront_enabled`   (packages/core/src/read/internal-capabilities.ts:796)
//   `read.store_flags.storefront_enabled`         (packages/core/src/read/store-flags-capabilities.ts:185)
//
// both derived from the store's own `status` column by `storefrontIsEnabled`
// (packages/core/src/commands/store.ts:163) — `status !== 'private'`. So this box declared, by hand, a fact
// the answer it was already reading contained. TWO TRUTHS ABOUT ONE STORE, and nothing to make them agree:
// flip the store to `private` through the port and the file would still say what it said; take the flag out
// of the file and the box would warm a store the vitrine 404s. That is why the warming step and the doors
// step each had to learn the counter BY NAME — the port was telling them and they were reading a copy.
//
// ⇒ SERVABILITY IS NOW DERIVED, AND THE DECLARATION NO LONGER STATES IT. A store created tomorrow, in any
// tenant, is classified with no edit here and no edit in `seed/box.json`.
//
// ── ★★ `=== false`, NEVER `!row.storefront_enabled`, AND THE DIFFERENCE IS A WHOLE BOX ───────────────────
//
// ABSENCE OF THE FIELD MEANS THE STORE IS ON THE STREET. It is the product's own rule, written in the
// product's own consumer of the same fact — `apps/storefront/src/app/sitemap.ts:35` reads
// `?.storefront_enabled === false` for exactly this reason: a front pinned to a kernel OLDER than the
// capability gets `undefined` back, and a truthiness test would then declare EVERY store of that box
// unservable and quietly warm nothing, open no door, and sign a green over it. The falsy branch is the
// dangerous one, so the true value is the one that has to be named.
//
// ── WHAT A SKIP OWES THE READER ─────────────────────────────────────────────────────────────────────────
//
// A store simply ABSENT from a report is indistinguishable from one that failed, and this repository has
// already paid for that silence more than once. So this file does not answer a boolean: it answers the
// boolean AND the sentence, and every caller prints the sentence next to the store's name. The reason is now
// the PORT's rather than a paragraph in a file, which is the point — it cannot go stale against the box.

/**
 * The one field, named once. Callers that need to talk about it (a test fixture, an error message) use this
 * rather than spelling it again — a second spelling is how the two truths started.
 */
export const STOREFRONT_ENABLED = 'storefront_enabled';

/**
 * Does this store have a public page a vitrine serves?
 *
 * @param {{ handle?: string, id?: string, storefront_enabled?: boolean }} row a row of `read.internal.stores`
 * @returns {{ servable: boolean, reason: string | null }} `reason` is non-null exactly when it is NOT
 *   servable, and it is what the caller prints beside the store's name.
 */
export function servability(row) {
  if (row?.[STOREFRONT_ENABLED] === false) {
    return {
      servable: false,
      reason:
        `the PORT says this store has no public page (\`${STOREFRONT_ENABLED}: false\` on ` +
        '`read.internal.stores`, derived from its `status`), so the vitrine answers 404 for it and there is ' +
        'no page to warm and no door to open. ⚠️ THE STORE IS NOT OFF: its catalogue, prices, stock, cart ' +
        'and orders are unchanged through the port, which is how a counter terminal or a totem keeps selling ' +
        'for it. To put it back on the street, `tenant.store.update` with `status: "active"` — never an edit ' +
        'here or in seed/box.json, which declare nothing about servability on purpose',
    };
  }
  return { servable: true, reason: null };
}

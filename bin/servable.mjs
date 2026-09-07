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
// (packages/core/src/commands/store.ts — `status !== 'private'`; ⚠️ this line used to cite `:163` and the
// function has been at `:83` in every commit this box has ever pinned, which is why the citation is a NAME
// now: a line number in another repository rots without anybody here touching a file). So this box declared,
// by hand, a fact the answer it was already reading contained. TWO TRUTHS ABOUT ONE STORE, and nothing to make them agree:
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

// ── ★★ pk22 — AND THE OTHER DIRECTION: THE BOX SAYS IT, THROUGH THE PORT ────────────────────────────────
//
// Everything above READS the port's answer. This half WRITES the fact that produces it, and it lives in the
// same file for the reason the file exists: one truth about one store. `seed/box.json` declares the word,
// `bin/seed-box.mjs` is only the hand, and `tenant.store.update` is the only way it is ever written —
// never SQL, never a column touched behind the port (AGENTS.md, boundary 1).
//
// ⚠️ THE PORT NEVER ANSWERS THE WORD. `read.internal.stores` publishes the DERIVED boolean and drops
// `status` on the floor (`internal-capabilities.ts`: `return res.rows.map(({ status, ...row }) => …)`), so
// idempotency here cannot compare word to word. It compares the boolean the declaration DERIVES to the
// boolean the port ANSWERED — which is the kernel's own rule (`storefrontIsEnabled`, `status !== 'private'`,
// packages/core/src/commands/store.ts) spelled once, right here, and nowhere else in this repository.

/** The store is on the street: it has a public page and the reference vitrine serves it. */
export const ON_THE_STREET = 'active';
/** The store has no public page. Its catalogue, prices, stock, cart and orders are UNCHANGED — see the
 *  reason `servability()` prints, and the kernel's own «`private` IS NOT `archived`» paragraph. */
export const OFF_THE_STREET = 'private';
/** The whole of the kernel's vocabulary for `store.status`. A word outside it is refused at the port
 *  (`z.enum`), so refusing it HERE is only the difference between a named failure and an HTTP 400 four
 *  functions later. */
export const STORE_STATUSES = [ON_THE_STREET, OFF_THE_STREET];

/**
 * WHAT HAS TO BE WRITTEN so the box says what `seed/box.json` declares, given the row the port answered.
 *
 * ⚠️ AN UNDECLARED STATUS IS NOT `active` — it is "this box has no opinion", exactly like `checkoutFlagPatch`
 * treats an undeclared flag, and it produces no command. That is what lets three stores say nothing and one
 * store say something, without the file having to state the default for everybody.
 *
 * ⛔ AND AN UNKNOWN WORD THROWS RATHER THAN DOING NOTHING. `{"status": "Private"}` derives «on the street»,
 * matches a store that is on the street, and produces an EMPTY patch: a typo that reads as a decision and
 * seeds a counter onto the street with nothing failing anywhere. That is the silent shape this repository
 * keeps paying for, so it is named here instead.
 *
 * @param declared the store entry from `seed/box.json`
 * @param actual   the row `read.internal.stores` answered for that handle — or `undefined` for a store that
 *   does not exist yet, which is the CREATE. The absent-field rule answers that correctly on its own: a
 *   store the port has said nothing about is on the street, and so is a store about to be born (the column
 *   default is `active`, tenant/0002). So the create gets the word exactly when the box declares `private`.
 * @returns `{}` (nothing to do) or `{ status }` — the input of one `tenant.store.create`/`.update`.
 */
export function statusPatch(declared, actual) {
  const wanted = declared?.status;
  if (wanted === undefined) return {};
  if (!STORE_STATUSES.includes(wanted)) {
    throw new Error(
      `seed/box.json declares status "${wanted}" for store "${declared?.handle ?? '?'}", which is not a ` +
        `store status. The kernel knows exactly ${STORE_STATUSES.map((s) => `"${s}"`).join(' and ')} ` +
        '(`STORE_STATUSES`, packages/core/src/commands/store.ts) and refuses anything else at the port. ' +
        'Left unchecked this would derive "on the street", match a store that already is, and write ' +
        'NOTHING — a typo that reads as a decision.',
    );
  }
  // The declaration's own derivation, and it is the kernel's rule: anything that is not `private` is a store
  // with a public page. Compared against the port's answer through `servability()`, so this file has ONE
  // reading of the fact and one writing of it.
  const declaredOnTheStreet = wanted !== OFF_THE_STREET;
  if (servability(actual).servable === declaredOnTheStreet) return {};
  return { status: wanted };
}

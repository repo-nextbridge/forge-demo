// WHICH STORE THIS IMAGE IS THE FORK OF — asked by the CMS template registry, and answered in one place.
//
// ── ⛔ THE TRAP THIS FILE EXISTS FOR: A STORE ID CANNOT BE WRITTEN DOWN HERE ──────────────────────────────
//
// This front is a FORK, so it MAY name a store of its own — the reference vitrine may not (an entry in its
// overlay would be one customer's data inside every instance's image). But "may" is not "can": the café's
// store id is a fresh ULID minted by `provision-ref` on every `bash bin/box-up.sh`, so a `sto_…` typed into
// a source file is correct exactly until the next birth and then matches nothing, in silence.
//
// That is not a hypothesis. `caddy/extra/coffee.local.caddy` shipped with a hand-written id from a bench
// that no longer existed; the rule matched nothing, every café request fell through to the VANILLA
// storefront, and the page still looked right because the theme is resolved from the store's own row.
// It fooled two people. `bin/box-up.sh` step 3c closed it by GENERATING the rule from the id it had just
// provisioned, and `FORGE_TOTEM_STORE_ID` (step 6) is the same technique's first consumer.
//
// ⇒ THIS IS THAT MECHANISM'S THIRD CONSUMER, and deliberately not a fourth mechanism. Step 3c resolves the
// café's store and now also writes `FORGE_COFFEE_STORE_ID` into `.env`; `compose.override.yml` hands it to
// this container; this module reads it. `bin/coffee-store-id.guard.mjs` grades all three legs at once,
// because any one of them missing is silent: the overlay would simply reach no store and the café would
// serve the shared body, which is what it served before the axis existed.
//
// ── WHY IT DEGRADES INSTEAD OF THROWING, WHICH IS THE OPPOSITE OF `totem/src/lib/store.ts` ────────────────
//
// The totem refuses to boot without its store, and it is right to: a till pointed at no store is the wrong
// shop, not a smaller one. Here the store comes from the REQUEST (the `/s/<store>` segment the edge routes),
// and this variable selects only WHOSE version of an institutional template renders. An absent one costs the
// café its own `Sobre`; it does not cost anybody a page. Taking the whole vitrine down over a paragraph
// would be trading a visible defect for an outage.
//
// So the loss is made audible instead — once per process, on the first resolution — and the RED lives in
// `bin/coffee-store-id.guard.mjs`, where a rotted wiring is caught before it reaches a bench.

/** The prefix every store id carries. A handle (`cafe`) pasted into the slot is the mistake this catches. */
const STORE_ID_PREFIX = 'sto_';

/**
 * The sentinel `.env.example` ships and `bin/box-up.sh` overwrites once the store exists.
 *
 * ⚠️ IT STARTS WITH `sto_`, so a prefix check alone grades it VALID — and that is the whole reason it is
 * named here. A box that copied `.env.example` and has not been born yet would otherwise key the overlay on
 * a string no store will ever have, and the symptom would be indistinguishable from a missing variable.
 * The sentinel is not this file's invention: `bin/box-up.sh` already reads it as "no store yet" for the
 * counter, and `.env.example` explains why an EMPTY value cannot be used in its place.
 */
export const PENDING_STORE_SENTINEL = 'sto_PENDING_SEED';

/** The variable `bin/box-up.sh` (step 3c) writes and `compose.override.yml` delivers. */
export const OWN_STORE_ENV = 'FORGE_COFFEE_STORE_ID';

/**
 * The store THIS image is the fork of, or `undefined` when the wiring did not arrive.
 *
 * @param env narrow on purpose — typing it as `NodeJS.ProcessEnv` drags in Next's augmentation (which makes
 *            `NODE_ENV` required), so every fixture would have to carry a variable this code never reads.
 */
export function ownStoreId(env: Record<string, string | undefined> = process.env): string | undefined {
  const id = env[OWN_STORE_ENV]?.trim();
  if (!id) return undefined;
  if (id === PENDING_STORE_SENTINEL) return undefined;
  if (!id.startsWith(STORE_ID_PREFIX)) return undefined;
  return id;
}

/**
 * Why the id was refused, in a sentence a person can act on — `undefined` when it was accepted.
 *
 * ★ SPLIT FROM THE RESOLVER RATHER THAN THROWN, because the two callers want different things: rendering
 * wants a value or nothing, and a warning wants the reason. Returning the reason separately keeps
 * `ownStoreId` total and keeps the sentence out of the render path.
 */
export function ownStoreProblem(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env[OWN_STORE_ENV]?.trim();
  if (!raw)
    return (
      `${OWN_STORE_ENV} is not set, so this fork's per-store CMS overlay reaches NO store and every ` +
      'institutional page falls back to the body shared with the reference vitrine. It is written into ' +
      '.env by bin/box-up.sh (step 3c) and delivered by compose.override.yml.'
    );
  if (raw === PENDING_STORE_SENTINEL)
    return (
      `${OWN_STORE_ENV} is still "${PENDING_STORE_SENTINEL}" — the sentinel .env.example ships. This box ` +
      'has not been born yet (or step 3c did not run), so no store id exists to key the overlay on.'
    );
  if (!raw.startsWith(STORE_ID_PREFIX))
    return (
      `${OWN_STORE_ENV} is "${raw}", which is not a store ID — it must start with "${STORE_ID_PREFIX}". ` +
      'The read port takes a store ID and refuses a handle, a display name or a hostname.'
    );
  return undefined;
}

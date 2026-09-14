// WHICH STORE THIS IMAGE IS THE FORK OF — asked by the EDGE and by the CMS template registry, answered here.
//
// ── ⛔ THE TRAP THIS FILE EXISTS FOR: A STORE ID CANNOT BE WRITTEN DOWN HERE ──────────────────────────────
//
// This front is a FORK, so it MAY name a store of its own — the reference vitrine may not (an entry in its
// overlay would be one customer's data inside every instance's image). But "may" is not "can": the café's
// store id is a fresh ULID minted by `provision-ref` on every `bash bin/box-up.sh`, so a `sto_…` typed into
// a source file is correct exactly until the next birth and then matches nothing, in silence.
//
// That is not a hypothesis. The café's edge rule (`caddy/extra-local/coffee.caddy`) shipped with a
// hand-written id from a bench that no longer existed; it matched nothing, every café request fell through
// to the VANILLA storefront, and the page still looked right — the theme is resolved from the store's row.
// It fooled two people. `bin/box-up.sh` step 3c closed it by GENERATING the rule from the id it had just
// provisioned, and `FORGE_TOTEM_STORE_ID` (step 6) is the same technique's first consumer.
//
// ⇒ THIS IS THAT MECHANISM'S THIRD CONSUMER, and deliberately not a fourth mechanism. Step 3c resolves the
// café's store and now also writes `FORGE_COFFEE_STORE_ID` into `.env`; `compose.override.yml` hands it to
// this container; this module reads it. `bin/coffee-store-id.guard.mjs` grades all three legs at once,
// because any one of them missing is silent: the overlay would simply reach no store and the café would
// serve the shared body, which is what it served before the axis existed.
//
// ── ★★ pk27/D1 — AND SINCE THEN IT ALSO ANSWERS "WHOSE SHOP IS THIS ADDRESS?" ─────────────────────────────
//
// `src/middleware.ts` asks this module BEFORE it asks the host. The rule pk27/D1 fixed: the fork IS the
// store's vitrine, so `/` on this image is that store's home and no request it receives belongs to another
// shop. Measured on the bench before that line, this container's own `FORGE_STORE_HOSTS` mapped every
// hostname of the box to the SHOE shop, and a hostname of the café's own resolved to nothing at all — the
// café store claims no authority in the kernel directory, because `read.store.by_host` gives one store per
// authority and the box's ROOT store is the one that claims it (`bin/store-host.mjs`).
//
// ── WHY IT DEGRADES INSTEAD OF THROWING, WHICH IS THE OPPOSITE OF `totem/src/lib/store.ts` ────────────────
//
// The totem refuses to boot without its store, and it is right to: a till pointed at no store is the wrong
// shop, not a smaller one. Here every answer this module gives has a WORSE but working substitute: the edge
// falls back to resolving the request host, exactly as it did before it asked; the CMS overlay falls back to
// the body shared with the reference vitrine. An absent variable costs the café its own address and its own
// `Sobre`; it does not cost anybody a page. Taking the whole vitrine down over a variable `bin/box-up.sh`
// writes at step 3c would be trading a visible defect for an outage. So the loss is made AUDIBLE instead —
// once per process, on the first resolution — and the RED lives in `bin/coffee-store-id.guard.mjs`, where a
// rotted wiring is caught before it reaches a bench.

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
      `${OWN_STORE_ENV} is not set, so this fork does not know which shop it is: its clean addresses fall ` +
      'back to resolving the request HOST (another store, or none at all) and its per-store CMS overlay ' +
      'reaches NO store, so every institutional page falls back to the body shared with the reference ' +
      'vitrine. It is written into .env by bin/box-up.sh (step 3c) and delivered by compose.override.yml.'
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

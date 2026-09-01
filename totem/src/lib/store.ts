// WHICH STORE THIS TOTEM SERVES — one question, one answer, one place to change it.
//
// ★★ THE ENVIRONMENT CARRIES BOTH THE HANDLE AND THE ID, AND THAT IS NOT REDUNDANCY. It is the shape the
// public port forces, and the measurement is worth writing down because the frozen contract for this wave
// originally named only the handle:
//
//     GET /v1/read/products?store=cafe
//     → 404  "the `store` param takes a store ID (`sto_…`), not a store handle, a display name or a hostname"
//
// The public read face has exactly ONE capability that PRODUCES a store id — `read.store.by_host` (host →
// store_id). The only capability that returns a `handle` is `read.stores`, and it lives on the INTERNAL face
// (`/v1/read/internal/*`), which is gated by the admin service token. There is no `store.by_handle`.
//
// So the three honest options were: give this app a tenant-wide credential; publish a `host` on the counter's
// store and resolve like every other front; or state the intent in a name a human reads and the answer in an
// id the process uses. The third is what this file is (tech lead, 2026-09-01). The first was refused on
// purpose — no other front on this box holds a service token, and a kiosk would be a poor place to start.
//
// `FORGE_TOTEM_STORE_HANDLE` is therefore DECLARATION: it is what the README, the compose file and a human
// on the bench read, and it is what makes the id below checkable by a person. `FORGE_TOTEM_STORE_ID` is USE.
//
// ⚠️ THE TWO CANNOT BE CROSS-CHECKED FROM HERE, and pretending otherwise would be the worst of both worlds.
// Verifying that `sto_…` really is the store called `balcao` needs the internal face this app deliberately
// cannot reach. What this module CAN refuse — and does — is a missing or malformed answer, which is the
// failure that actually happens (a copy-paste into the wrong .env).

/** The prefix every store id carries. A handle pasted into the id slot is the mistake this catches. */
const STORE_ID_PREFIX = 'sto_';

export type TotemStore = {
  /** The id every read and every command is scoped by. */
  id: string;
  /** The handle a human uses to recognise the store. Never sent to the port — see the header. */
  handle: string;
};

/**
 * The store this totem serves, from the environment. Throws rather than degrades: a counter pointed at no
 * store — or at another store — is not a screen with a smaller feature set, it is the wrong shop.
 */
export function resolveTotemStore(
  // A narrow shape on purpose: this function reads exactly two variables, and typing the parameter as
  // `NodeJS.ProcessEnv` would drag in Next's own augmentation of it (which makes `NODE_ENV` required, so
  // every test fixture would have to carry a variable this code never looks at).
  env: Record<string, string | undefined> = process.env,
): TotemStore {
  const id = env.FORGE_TOTEM_STORE_ID?.trim();
  const handle = env.FORGE_TOTEM_STORE_HANDLE?.trim();

  if (!id)
    throw new Error(
      'FORGE_TOTEM_STORE_ID is not set. The totem serves one store and resolves it from the environment; ' +
        'the public read port takes a store ID (`sto_…`), never a handle. See src/lib/store.ts.',
    );
  if (!id.startsWith(STORE_ID_PREFIX))
    throw new Error(
      `FORGE_TOTEM_STORE_ID is "${id}", which is not a store ID — it must start with "${STORE_ID_PREFIX}". ` +
        'A handle (e.g. "balcao") belongs in FORGE_TOTEM_STORE_HANDLE, which is the human-readable half.',
    );
  if (!handle)
    throw new Error(
      'FORGE_TOTEM_STORE_HANDLE is not set. It is what a human reads to know WHICH store this id is, and ' +
        'the id alone is not reviewable. See src/lib/store.ts.',
    );

  return { id, handle };
}

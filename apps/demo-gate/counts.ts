// DEMO-GATE — THE ONE QUESTION THE FIRST SCREEN ASKS THE PORT: how big is each shop this box publishes.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────
//
// The 10/09 layout writes each shop's size into its own sentence — `design-base/gate.dc.html:52` says "Uma
// loja completa com 2 777 produtos" and `:61` says "55 produtos do mesmo catálogo". Those were TYPED, and a
// number typed into a screen is a claim that stops being true the first time anybody seeds the box: this
// demo is reborn from zero on a schedule, and the catalogue it is reborn with is a dataset that changes.
// ⇒ the sentence keeps its shape and the number comes from the port, every time, or it does not appear.
//
// ── ⛔ WHAT IT DELIBERATELY DOES NOT ASK, AND THE REASON IS A MEASUREMENT ─────────────────────────────────
//
// The design's first sentence carries TWO numbers — products "→ 44 399 SKUs". The public read face answers
// the first in one row (`product_paths` returns a `total` computed by a `count(*)`) and has NO answer at all
// for the second: no capability on that face returns a SKU total, so the only way to compute one is to walk
// the whole catalogue and sum each product's variants — 28 pages of 100 for a shop this size, on the FIRST
// screen a visitor meets, per front, and a partial walk would print a number that is simply wrong.
//
// That cost is not hypothetical here: the anonymous read face carries a shared per-store budget, and this box
// has already measured a single human browsing it into refusals. A gate that spent 28 reads to decorate a
// sentence would be spending the shop's budget on itself. ⇒ the screen prints the number the port answers,
// and says nothing where it has nothing to say. The SKU half of that sentence is a capability question for
// the product, not a loop to hide in a gate.
//
// ── HOW A FACE BECOMES A STORE ID ────────────────────────────────────────────────────────────────────────
//
// `seed/box.json` declares a HOSTNAME per shop, never an id — ids are fresh ULIDs minted at every birth, so
// an id written down anywhere is wrong by the next morning. The port turns one into the other:
// `read.store.by_host` is the same hop the storefront's own middleware makes. Where the visitor is STANDING
// on a declared face, the slot already handed the gate that store's id and no hop is needed — and that is
// also the one case that works before a box has been promoted to its published hostnames.
//
// ── ⛔ AND THE FAILURE MODE IS DECIDED HERE, NOT LEFT TO CHANCE ───────────────────────────────────────────
//
// Every way this can fail — the address is not claimed yet (a bench, a box before promotion), the port
// refuses, the request times out, the read base is not wired — yields `null` for that face and only that
// face. `null` is NOT zero: the copy has a second, complete sentence for it (`HubFaceStrings.blurb`), so the
// screen never prints "0 produtos" and never prints the number it was told last time. Nothing here throws:
// the gate is the door to the demo, and a door that 500s because a count was unavailable is worse than a
// door with no number on it.

import { GATE_FACES, type GateFace } from './faces.generated';
import { sameHost } from './host';

/** Face key → how many products that shop publishes, or `null` when the port could not say. */
export type ShopCounts = Record<string, number | null>;

/** How long an answer is reused. The same 5 minutes the reference storefront gives a catalogue read: this is
 *  a shop-window figure, not a stock level, and re-asking it per visitor would put the gate on the hot path
 *  of the very budget it is describing. */
export const COUNTS_REVALIDATE_SECONDS = 300;

/** A ceiling on the wait, not on the work. The gate renders with no number rather than late. */
export const COUNTS_TIMEOUT_MS = 1500;

/** Where the kernel answers `GET /v1/read/*`, as the front this app is composed into was wired. Unset means
 *  this process has no port to ask — the screen then draws its no-number sentences, rather than guessing a
 *  port number and reporting a connection refused as a fact about the shop. */
function readBaseUrl(): string | undefined {
  const base = process.env.FORGE_READ_BASE_URL;
  return base ? base.replace(/\/+$/, '') : undefined;
}

/** One public read, or `undefined`. Never throws, never retries: a first screen has no time for either. */
async function ask(
  base: string,
  capability: string,
  params: Record<string, string>,
): Promise<unknown | undefined> {
  const url = `${base}/v1/read/${capability}?${new URLSearchParams(params).toString()}`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(COUNTS_TIMEOUT_MS),
      // `next.revalidate` is Next's Data Cache, which is what makes this one question per front per window
      // instead of one per visitor. Asserted as a plain RequestInit because this package compiles against
      // node's fetch types; the field is read by the runtime the app is composed into.
      next: { revalidate: COUNTS_REVALIDATE_SECONDS },
    } as RequestInit);
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

/** The store id the kernel's directory has claimed for a hostname, or `undefined` while it has claimed none. */
async function storeIdOf(base: string, host: string): Promise<string | undefined> {
  const body = await ask(base, 'store.by_host', { host });
  const id = (body as { store_id?: unknown } | undefined)?.store_id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/** How many products a store publishes. `product_paths` is the cheapest row in the face that carries a total
 *  — one handle per row, and `limit=1` fetches one of them for a `total` counted over all of them. */
async function publishedProducts(base: string, store: string): Promise<number | null> {
  const body = await ask(base, 'product_paths', { store, limit: '1' });
  const total = (body as { total?: unknown } | undefined)?.total;
  return typeof total === 'number' && Number.isFinite(total) ? total : null;
}

/**
 * Ask the port how big each declared shop is. One entry per shop face, always — a face the port could not
 * answer for is present and `null`, never missing, so a reader of this map cannot mistake "not asked" for
 * "no products".
 *
 * `here` is the hostname the browser asked for and `store` the id the slot handed the gate for it; together
 * they let the face the visitor is standing on skip the directory hop, which is also what makes the number
 * appear on a box that has not been promoted to its published hostnames yet.
 */
export async function readShopCounts(
  opts: { here?: string; store?: string } = {},
  faces: readonly GateFace[] = GATE_FACES,
): Promise<ShopCounts> {
  const shops = faces.filter((face) => face.kind === 'shop');
  const base = readBaseUrl();
  if (!base) return Object.fromEntries(shops.map((face) => [face.key, null]));
  const answers = await Promise.all(
    shops.map(async (face) => {
      const standingHere = opts.store && sameHost(face.host, opts.here) ? opts.store : undefined;
      const store = standingHere ?? (face.host ? await storeIdOf(base, face.host) : undefined);
      return [face.key, store ? await publishedProducts(base, store) : null] as const;
    }),
  );
  return Object.fromEntries(answers);
}

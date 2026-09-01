// MS-M1α — the EXPLICIT store context, as it travels between the browser and the routes the middleware does
// not rewrite. Isomorphic and dependency-free on purpose: a client component and a route handler have to agree
// on the same two strings, and a helper that dragged `lib/config` in could not be imported from a 'use client'
// module.
//
// ── THE MECHANISM THIS EXISTS TO CLOSE (measured 2026-08-13, multi-tenant test in Staging) ────────────────
// The storefront answers "which store is this?" in three ways that DISAGREE:
//   · the `/s/<store>` prefix — the pages the middleware rewrites. Isolates correctly, per tenant and per
//     publication.
//   · the request `Host` — everything the middleware's `matcher` EXCLUDES (`/api/*`, `/feeds/*`, robots,
//     sitemap). Those requests never carry the prefix, so they resolved a store of their own and IGNORED the
//     one the shopper was browsing.
//   · the session — `my-prices`, `account`. Scoped by the token's tenant, blind to the path.
// On a deployment where one Host serves N tenants (a shared bench, Staging, any `/s/`-addressed store without
// DNS of its own), the second mechanism is the leak: `/api/categories` served the HOST's tenant categories to
// a shopper standing inside another tenant's storefront.
//
// The fix is one line of shape, and it already existed in exactly one place — `/api/suggest` read `?store=`
// before falling back to the Host, and it was the only one of its class that isolated. This module is that
// line, extracted, so the rule has ONE place to be wrong instead of N.
//
// ⚠️ EXPLICIT IS NOT A PRIVILEGE. `?store=` names a PUBLIC store id, and every read behind it is the same
// anonymous catalog read the `/s/<store>` prefix already serves to anyone who types it. It changes WHICH
// store answers, never WHAT the caller is allowed to see: the kernel resolves store → tenant → schema and
// applies publication itself. A caller naming another store gets that store's public shelf, exactly as if it
// had asked over that store's own hostname.

/** The query parameter that carries an explicit store context. One spelling, everywhere. */
export const STORE_PARAM = 'store';

/** The store id of a path-scoped URL (`/s/<store>/…`), or undefined on a clean host-based URL. */
export function storeFromPathname(pathname: string): string | undefined {
  return pathname.match(/^\/s\/([^/]+)/)?.[1];
}

/**
 * The store the BROWSER is currently standing in, read off its own address bar — undefined on a clean
 * host-based URL (production with DNS per store, and the edge-cached `/c/<store>` tree, whose rewrite the
 * browser never sees). Undefined is not a failure: it means "the Host already is the answer".
 */
export function currentStore(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return storeFromPathname(window.location.pathname);
}

/**
 * Append the browser's current store context to a same-origin API path, when there is one to append.
 *
 * A fragment fetching `/api/…` from inside `/s/<store>/` MUST say which store it is standing in — that fetch
 * carries no prefix and the Host would answer for a different store. This is the call site half of the fix;
 * `resolveRequestStore` (server) is the other half.
 */
export function withStoreParam(path: string, store = currentStore()): string {
  if (!store) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${STORE_PARAM}=${encodeURIComponent(store)}`;
}

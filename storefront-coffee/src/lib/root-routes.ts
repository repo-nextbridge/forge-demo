// ★ PK2-POST — THE URLS THAT BELONG TO NEITHER TREE, and the third answer the middleware has to be able to give.
//
// PERF-B taught the edge to choose between two STORE-SCOPED trees: `/c/<store>/…` (cacheable) and
// `/s/<store>/…` (dynamic). Both are trees of pages under a store, and the choice was framed as if every
// request belonged to one of them. Some do not. The storefront also serves a handful of URLs from a
// ROOT-LEVEL route handler — `app/<path>/route.ts`, outside `s/` and `c/` — and there are exactly two kinds:
//
//   · an APP's public route (`forge.wiring.publicRoutes`), written by the composition. `/apps/reviews/submit`
//     is the app's own POST endpoint; `/feeds/google.xml` is the catalog feed a Merchant account fetches.
//     The paths come from the generated list next door, so adding an app to the composition is enough.
//   · a PLATFORM file that a domain must answer at its bare host, by somebody else's specification. Apple
//     fetches `/.well-known/apple-developer-domain-association.txt` at the host before it will trust Sign in
//     with Apple, and RFC 8615 is what says the whole prefix is host-level and never per-store.
//
// ⚠️ REWRITING ONE IS NOT A CACHE MISS, IT IS A 404. The file is not under `/s/<store>` either, so BOTH trees
// answer a rewritten root route with their catch-all: measured on this tree (2026-08-27), `GET
// /apps/reviews/submit` came back the storefront's 404 shell and `POST` came back 500, because Next reads a
// POST at a page as a Server Action submission. The app endpoint had never been reachable from outside.
//
// ⚠️ AND IT IS WHY THE MATCHER MUST STOP BEING THE MECHANISM. `feeds/` worked only because its name had been
// written into `middleware.ts`'s matcher by hand — one app's URL, spelled out in the kernel, that any rename
// would have silently broken. This module is the positive rule that replaces it: the paths are DERIVED (the
// composition writes them) and the prefix is a specification, so nothing here dies at a rename.

import { APP_PUBLIC_ROUTE_PATHS } from './extensions/generated/public-routes';

/** Prefixes whose whole subtree is host-level by somebody else's specification, never store-scoped. Kept as a
 * PREFIX and not a filename: `.well-known` is a registry (RFC 8615), so the next file to land there is
 * host-level for the same reason this one is, and would otherwise arrive broken. */
export const PLATFORM_ROOT_ROUTE_PREFIXES = ['/.well-known/'];

/** Is this path served by a root-level route handler — i.e. by a file that exists in NEITHER store tree, and
 * that the middleware must therefore hand to Next exactly as it arrived? */
export function isRootRoutePath(pathname: string): boolean {
  if (PLATFORM_ROOT_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return APP_PUBLIC_ROUTE_PATHS.includes(pathname);
}

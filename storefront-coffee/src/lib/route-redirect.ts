// DECISIONS — asking the kernel whether it knows a path, before the router decides it is a 404.
//
// WHY THIS RUNS IN THE MIDDLEWARE, and not in the catch-all page where the 404 is actually detected:
// the answer has to be a **301**, and a Server Component cannot set a response status. Next's
// `permanentRedirect()` emits 308, and 308 is not what an SEO audit tool reports back to a brand that is
// counting on "301". A literal 301 on the FIRST response can only come from the middleware, which is the
// only place that runs before routing. Everything below exists to make that affordable.
//
// The cost of asking early is one port call per navigation, so it is spent as rarely as possible:
//   • only for document navigations — never assets, never `_next`, never the API routes;
//   • only for paths that could plausibly be content — platform routes are excluded by prefix;
//   • answers are cached, MISSES INCLUDED, which is what actually matters: the overwhelmingly common
//     answer is "no redirect", and caching it is what keeps a live store from paying per page view;
//   • the kernel short-circuits on its side too — a tenant with no decision installed answers null
//     without spawning any decision work at all.
//
// The failure posture mirrors store-directory.ts: a port that is down must never break navigation. No
// answer means no redirect, which is exactly the behaviour the storefront had before this existed.

import { readBaseUrl } from '@forgeco/storefront-kit/config';

/** A hit is stable — an operator edits redirects on human timescales. */
export const REDIRECT_POSITIVE_TTL_MS = 60_000;
/** A miss is the common case, and caching it is the whole reason this is affordable. Shorter, so a
 * redirect added in the admin starts working within a minute rather than needing a restart. */
export const REDIRECT_NEGATIVE_TTL_MS = 30_000;
/** A crawler walking a large catalogue must not be able to grow this without bound. */
const MAX_ENTRIES = 5_000;

/**
 * ★★ QA · RODADA 2 (R2D-3) — HOW LONG A HIT MAY OUTLIVE ITS TTL WHEN THE PORT CANNOT ANSWER, AND WHY THAT
 * NUMBER HAD TO EXIST AT ALL.
 *
 * The `catch` below is stale-on-error and that is right: a port blip must not turn navigation into an error
 * page. What was wrong is that it had NO CEILING. An entry sits in the map after it expires (nothing deletes
 * it), and every request past expiry went to `ask`, threw, and was answered from that same expired entry —
 * so for as long as the port kept failing, a redirect the operator had DELETED kept being served, with the
 * server's own TTL doing nothing about it. Not bounded by anything: forever is a value this could take.
 *
 * ⚠️ THIS IS A SECOND HOLDER, NOT THE ONE THE QA MEASURED, AND THE DIFFERENCE IS STATED SO NOBODY READS A
 * REPRODUCTION HERE. Staging answered 301 on a deleted path for ≥20 min across ~80 polls; the numbers in
 * this file (60 s server, 60 s client) cannot add up to that, and no cache was found between them (the edge
 * proxies without a cache; the kernel's `route_resolve` memoizes nothing). What CAN reach 20 min is this
 * branch, and a plausible trigger now exists in the tree: the anonymous face is capped face-wide (CAP-ANON),
 * and a 429 is a `!res.ok`, which is a throw, which is this branch.
 *
 * The ceiling is the negative TTL, deliberately: past its own window a hit degrades to what a MISS is worth,
 * so the whole promise stays two numbers the merchant can be told rather than three.
 */
export const REDIRECT_STALE_GRACE_MS = REDIRECT_NEGATIVE_TTL_MS;

/**
 * ★ QA · FA2 (P3C-5) — WHAT A CLIENT MAY HOLD THE 301 FOR, AND WHY THE ANSWER MUST NOT BE "NOTHING SAID".
 *
 * A redirect deleted in the admin was still answering 301 fourteen minutes later on Staging, while the
 * ficha's confirmation promised "the old URL goes back to a 404". The cache above cannot do that — a hit
 * expires after REDIRECT_POSITIVE_TTL_MS. What did was the RESPONSE: the 301 went out carrying `location`
 * and nothing else, and a permanent redirect with no `Cache-Control` is the most cacheable answer in HTTP.
 * Browsers and CDNs keep it, and the request that would have asked again never reaches this process, so the
 * server's TTL has nothing to expire.
 *
 * So the header is the client's half of the same window the TTL is the server's half of, and it is DERIVED
 * from that constant rather than chosen: the operator's promise is "within about two of these", and two
 * numbers that can drift apart cannot be promised together. `must-revalidate` forbids serving it stale
 * past the window, which is the whole point of naming one.
 */
export function redirectCacheControl(): string {
  return `public, max-age=${Math.floor(REDIRECT_POSITIVE_TTL_MS / 1000)}, must-revalidate`;
}

type Entry = { to: string | undefined; expiresAt: number };

const cache = new Map<string, Entry>();

/** Test seam: drop everything memoized. Never called in production. */
export function __resetRouteRedirectCache(): void {
  cache.clear();
}

/**
 * Paths the storefront owns outright. Asking the kernel about them would be pure waste: they are matched
 * by literal Next routes before any catch-all, so they can never be the 404 a redirect would rescue.
 */
const PLATFORM_PREFIXES = [
  '/_next/',
  '/api/',
  '/s/',
  '/checkout',
  '/search',
  '/account',
  '/cart',
  '/ui-storefront',
];

/** Anything with a file extension is an asset request, not a page a shopper navigated to. */
const ASSET_LIKE = /\.[a-z0-9]{2,5}$/i;

/** Is this path worth asking about at all? Cheap, synchronous, and it rejects the vast majority. */
export function isResolvableRoute(pathname: string): boolean {
  if (!pathname.startsWith('/')) return false;
  if (pathname === '/') return false; // the home page is never a legacy URL
  if (ASSET_LIKE.test(pathname)) return false;
  return !PLATFORM_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Ask the kernel. Returns the target path, or undefined for "nobody knows this one" — which is the
 * answer for a tenant with no Redirects app installed, and therefore the answer almost every store gives.
 */
export async function lookupRouteRedirect(
  store: string,
  pathname: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> {
  if (!isResolvableRoute(pathname)) return undefined;

  const key = `${store}\u0000${pathname}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.to;

  try {
    const to = await ask(store, pathname, fetchImpl);
    remember(key, to);
    return to;
  } catch {
    // Stale-on-error, then silence. A port blip must not turn navigation into an error page — and a
    // missing redirect degrades to the 404 the shopper would have got anyway.
    //
    // ★ R2D-3 — AND THE STALENESS IS BOUNDED. Past the grace window the entry is DROPPED rather than served
    // again, so a port that stays down cannot keep publishing a redirect the operator deleted. Deleting it
    // matters as much as not returning it: an entry left in the map is one the next request would read.
    if (cached && cached.expiresAt + REDIRECT_STALE_GRACE_MS > Date.now()) return cached.to;
    cache.delete(key);
    return undefined;
  }
}

function remember(key: string, to: string | undefined): void {
  // Plain FIFO eviction: the entries are interchangeable and an LRU's bookkeeping would cost more than
  // the occasional re-ask it saves.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, {
    to,
    expiresAt: Date.now() + (to ? REDIRECT_POSITIVE_TTL_MS : REDIRECT_NEGATIVE_TTL_MS),
  });
}

/** One port call. `null` is a real answer ("no redirect"); a non-OK response is a failure to be caught
 * above, so a broken port is never mistaken for "no redirect exists". */
async function ask(
  store: string,
  pathname: string,
  fetchImpl: typeof fetch,
): Promise<string | undefined> {
  const url = new URL('/v1/read/route_resolve', readBaseUrl());
  url.searchParams.set('store', store);
  url.searchParams.set('path', pathname);

  const res = await fetchImpl(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`route_resolve failed: ${res.status}`);

  const body = (await res.json()) as { to?: unknown } | null;
  const to = body?.to;
  // Only a same-origin absolute path is honoured, and this layer is the one that would actually emit the
  // redirect, so it checks for itself.
  //
  // ⚠️ THE SENTENCE HERE USED TO SAY "the kernel and the app both check this already", AND IT WAS FALSE ON
  // BOTH COUNTS (QA · FA2). The kernel's answer schema is `{ to: string }` — any string. The Redirects app
  // refused an off-site target in its CSV parser and in neither of its two forms, so the admin confirmed
  // "Redirect created" for `https://blog…` while this line quietly dropped it and the URL kept 404ing. The
  // app refuses it on all three doors now; this check is the layer that made the damage a 404 instead of an
  // open redirect, and it stays the last word regardless of what any app decides.
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return undefined;
  return to;
}

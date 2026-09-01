// The edge step: resolve the request host -> store, then REWRITE the clean public URL (`/p/<handle>`,
// `/<category-path>`) to an internal store-scoped path (`/s/<store>/...`). This keeps URLs clean for the
// crawler while giving Next an ISR cache key that includes the store (so the same handle on two hosts
// caches independently). Unknown host -> rewrite to /404 (clean not-found). The middleware never touches
// a DB: host->store is read through the PORT (MS-STORE: `read.store.by_host`, cached in-process, with a
// local-dev env override), store->tenant stays inside the port.
//
// This is ASYNC since MS-STORE: the routing answer became DATA instead of a boot-time env constant, which is
// exactly what lets a store created in the admin serve immediately, without restarting this process (and, in
// a shared pod, without restarting the neighbouring stores with it).
//
// ★ PK2-POST — and one request in the set belongs to NEITHER tree. A root-level route handler (an app's
// public route, a `.well-known` file) is not under `/s/` or `/c/`, so rewriting it into either hands the
// request to a catch-all page that has never heard of it; those paths are passed through untouched. The
// tree decision also reads the METHOD now: `/c/` is a tree of pages, and a POST rewritten into it was
// answered by Next as a Server Action submission — a 500 where a write should have happened.
//
// PERF-B — it now also chooses WHICH OF TWO TREES serves the request. Next decides "cacheable or dynamic"
// per ROUTE FILE, at build time, and it cannot be conditional at runtime; but "is this request cacheable?"
// is a per-request question (a filtered PLP is not, the same PLP clean is). So the answer is expressed as a
// path: catalog requests that read nothing per-visitor are rewritten into `/c/<store>/…`, the tree built
// with `revalidate` + `generateStaticParams` (Next then serves them from its full route cache and stamps
// `s-maxage` + `stale-while-revalidate`, which is what puts the HTML on a CDN); everything else keeps going
// to `/s/<store>/…`, the tree that reads cookies/searchParams and that Next stamps `private, no-store`.
// The two trees render the SAME views (lib/catalog-view.tsx, the shared chrome) — they differ only in what
// they are allowed to read. `lib/edge-cache.ts` holds the rule; nothing about it is per-customer.

import { resolveStoreForHost } from '@forgecommerce/storefront-kit/config';
import { cachedPathFor, isCacheableRequest } from '@forgecommerce/storefront-kit/edge-cache';
import { storeHasGate } from '@forgecommerce/storefront-kit/gate/directory';
import { type NextRequest, NextResponse } from 'next/server';
import { isRootRoutePath } from './lib/root-routes';
import { isResolvableRoute, lookupRouteRedirect, redirectCacheControl } from './lib/route-redirect';

export const config = {
  // Skip Next internals, the revalidate API, static assets, and the /ui-storefront dev/preview gallery
  // (a noindex reference route, NOT a store surface); everything else routes by host.
  //
  // ★ `icon.png` AND `apple-icon.png` JOIN `favicon.ico` HERE (FIX-5, OPS-MIUDEZAS). They are root-level
  // file-convention assets, not store surfaces, so host->store routing must not touch them: without the
  // exclusion this rewrites `/icon.svg` to `/s/<store>/icon.svg`, which does not exist, and the tab icon
  // becomes a 404 on every store — the same shape as the `/favicon.ico` 404 this pass came to close.
  //
  // ★ PK2-POST — `feeds/` USED TO BE ON THIS LINE, and taking it off is the point. It was here for a real
  // reason (`/feeds/google.xml` is a public file served by its own root-level route handler, and rewriting it
  // to `/s/<store>/feeds/google.xml` 404s the feed a merchant pointed their Merchant account at) — but it was
  // ONE APP'S URL, spelled out by hand in the kernel. The next app's route got no such line and shipped
  // unreachable. The rule now lives where it can be derived (`lib/root-routes.ts`, fed by the composition),
  // and the middleware short-circuits those paths itself, before it costs anything.
  // ★★ D2-C1 — `assets/` IS THE OWNER'S OWN FILES, AND IT IS A PREFIX ON PURPOSE.
  //
  // Everything else on this line is one of Next's file-convention assets, emitted from `app/`. `public/` was
  // covered by nothing, so a fork owner who dropped his logo in it met the failure this comment describes
  // three lines up, one directory over: `/logo.png` was rewritten to `/s/<store>/logo.png`, which does not
  // exist, and the asset 404'd on every store. Nothing said so — the file was right there in the image.
  //
  // ⚠️ A PREFIX, NEVER A LIST OF FILENAMES, and the difference is the whole reason this line is safe to
  // leave alone: a prefix does not rot the way a filename rots. `assets/*` covers whatever anybody puts
  // there, today and in two years; a list covers what somebody remembered to add, and the entry nobody adds
  // is a 404 with a green build behind it. If you are here to "tighten" this into an enumeration, that is
  // the mechanism you would be reintroducing.
  //
  // The trailing slash is doing work: only the SUBTREE leaves store routing, so a category literally called
  // `assets` still resolves at `/assets`. What the owner owns is `/assets/...`.
  matcher: [
    '/((?!_next/|api/|assets/|ui-storefront|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)',
  ],
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  // Already store-scoped (defensive) — checked BEFORE resolving, since resolving now costs a (cached) port
  // call and this path has nothing to resolve.
  if (url.pathname.startsWith('/s/')) return NextResponse.next();

  // ★ PK2-POST — the THIRD answer: some URLs are served by a root-level route handler and live in neither
  // tree, so the only correct thing to do with one is nothing. It is checked here, before the host is
  // resolved, because it costs a set lookup and rewriting one of these is not a slower answer but a 404.
  if (isRootRoutePath(url.pathname)) return NextResponse.next();

  const store = await resolveStoreForHost(req.headers.get('host'));
  if (!store) return NextResponse.rewrite(new URL('/404', req.url)); // unknown host → clean not-found

  // DECISIONS — before routing, ask the kernel whether anything knows this path (a legacy URL that should
  // move rather than 404). It happens HERE, and not in the catch-all page where the 404 is detected,
  // because only the middleware can emit a literal 301: a Server Component cannot set a status, and
  // Next's permanentRedirect() is a 308. `lookupRouteRedirect` caches misses, so the common answer —
  // "no redirect" — costs nothing after the first request for a path.
  if (isResolvableRoute(url.pathname)) {
    const to = await lookupRouteRedirect(store, url.pathname);
    if (to && to !== url.pathname) {
      const target = new URL(to, req.url);
      target.search = url.search; // a campaign's ?utm_* must survive the move
      // ★ QA · FA2 (P3C-5) — THE 301 SAYS HOW LONG IT IS GOOD FOR. It used to go out with `location` and
      // nothing else, and a permanent redirect with no cache policy is kept by browsers and CDNs for as
      // long as they like: a redirect deleted in the admin was measured still answering 301 fourteen
      // minutes later, because the request never came back to be answered differently. The value is
      // derived from the lookup's own positive TTL, so the window a merchant is promised is one number
      // and not two. See lib/route-redirect.ts.
      return NextResponse.redirect(target, {
        status: 301,
        headers: { 'cache-control': redirectCacheControl() },
      });
    }
  }

  // PERF-B — the edge cache decision. The request line first (method, path, query — cheap, no I/O); only then
  // the one store-level fact that can veto it: a store with a gate installed is by-possession on EVERY route
  // (the layout reads the dismissal cookie), so it stays on the dynamic tree. The lookup is cached in-process
  // and only happens for requests that already passed the request-line rule — a POST never pays for it.
  if (
    isCacheableRequest(req.method, url.pathname, url.searchParams) &&
    !(await storeHasGate(store))
  ) {
    const cached = new URL(cachedPathFor(store, url.pathname), req.url);
    cached.search = url.search; // tracking params survive the rewrite (they are not read, only forwarded)
    return NextResponse.rewrite(cached);
  }

  const rewritten = new URL(`/s/${store}${url.pathname}`, req.url);
  rewritten.search = url.search;
  // Carry the resolved store on a request header so a store-scoped `not-found.tsx` (which App Router does NOT
  // hand route params) can still fetch its category chips (S7-SF-CLOSE 404). Additive — the pages read params.
  const headers = new Headers(req.headers);
  headers.set('x-forge-store', store);
  return NextResponse.rewrite(rewritten, { request: { headers } });
}

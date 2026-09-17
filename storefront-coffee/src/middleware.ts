// The edge step: decide WHICH STORE this request is for, then REWRITE the clean public URL (`/p/<handle>`,
// `/<category-path>`) to an internal store-scoped path (`/s/<store>/...`). This keeps URLs clean for the
// crawler while giving Next an ISR cache key that includes the store. No store for the request -> rewrite to
// /404 (clean not-found). The middleware never touches a DB: host->store is read through the PORT (MS-STORE:
// `read.store.by_host`, cached in-process, with a local-dev env override), store->tenant stays inside the port.
//
// ★★ pk27/D1 — AND IN THIS FORK THE FIRST QUESTION IS NOT THE HOST. This deployable is ONE shop's vitrine, so
// the store it serves is the store it is the fork of (`lib/own-store.ts`), and host resolution is what answers
// only on a box where that variable never arrived. See the block around the resolution below for what was
// measured; the rule itself is proven in `src/root-is-own-shop.test.ts`.
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

import { resolveStoreForHost } from '@forgeco/storefront-kit/config';
import {
  cachedPathFor,
  isCacheableRequest,
  isServerActionSubmission,
  SERVER_ACTION_HEADER,
} from '@forgeco/storefront-kit/edge-cache';
import { storeHasGate } from '@forgeco/storefront-kit/gate/directory';
import { type NextRequest, NextResponse } from 'next/server';
import { ownStoreId } from './lib/own-store';
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
  // covered by nothing, so a fork owner who dropped their logo in it met the failure this comment describes
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

  // ★★ pk27/D1 — THE STORE THIS IMAGE IS THE FORK OF WINS, AND THAT IS THE DIFFERENCE BETWEEN A FORK AND A
  // CUT OF A MULTI-STORE VITRINE.
  //
  // The reference serves every store from one deployable, so asking the HOST which one is the only answer it
  // can give. This deployable is one shop's — it carries that shop's chrome, its theme and its institutional
  // pages — so there is no request it can receive that belongs to another store, and the host is not the
  // question. Measured on the bench 2026-09-09, before this line: `FORGE_STORE_HOSTS` inside this very
  // container maps EVERY hostname of the box (`localhost`, `127.0.0.1`, this machine's name, its tailnet
  // name) to the
  // SHOE shop, so `/` here was the shoe shop's home wearing the café's header; and a request arriving at a
  // hostname of the café's own — the production shape — answered the clean 404 below, because
  // `read.store.by_host` gives ONE store per authority and the box's ROOT store is the one that claims it
  // (bin/store-host.mjs). Wrong shop when the host resolves, no shop when it does not.
  //
  // ⚠️ IT IS NOT A FALLBACK. A fallback ("host first, own store when that fails") leaves exactly the bench
  // case broken, because there the host DOES resolve — to somebody else.
  //
  // ★ AND IT IS THE MECHANISM THAT ALREADY EXISTS, not a fourth one: `FORGE_COFFEE_STORE_ID`, written into
  // `.env` by `bin/box-up.sh` (step 3c) from the id provisioning had just minted, delivered by
  // `compose.override.yml`, graded end to end by `bin/coffee-store-id.guard.mjs`. `ownStoreId()` degrades to
  // `undefined` on a box that has not been born, and the host answer below is then exactly what it was.
  const store = ownStoreId() ?? (await resolveStoreForHost(req.headers.get('host')));
  if (!store) return NextResponse.rewrite(new URL('/404', req.url)); // no shop for this request → not-found

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
  //
  // ★★ V04-ACTION-TREE — A SERVER ACTION IS ANSWERED BY ITS OWN DOCUMENT'S TREE, and this fork was one
  // version behind that: the kit's `isCacheableRequest` grew a fourth argument with NO DEFAULT precisely so
  // no caller could keep the old answer by accident, and `bin/fork-typecheck.guard.mjs` refused this
  // directory until it was answered here too. Without it the café's first *adicionar* on a domain-addressed
  // store lands in the dynamic tree while its document came from the cacheable one, Next REPLACES the
  // subtree, and every piece of client state under the shop's chrome is rebuilt — the drawer opening,
  // dying with the tree and being reopened is only the visible part.
  //
  // The Server Action fact is read HERE and passed in, so the rule stays a pure function over facts and the
  // middleware stays the only thing that touches a request object.
  if (
    isCacheableRequest(
      req.method,
      url.pathname,
      url.searchParams,
      isServerActionSubmission(req.method, req.headers.get(SERVER_ACTION_HEADER)),
    ) &&
    !(await storeHasGate(store))
  ) {
    const cached = new URL(cachedPathFor(store, url.pathname), req.url);
    cached.search = url.search; // tracking params survive the rewrite (they are not read, only forwarded)
    return NextResponse.rewrite(cached);
  }

  const rewritten = new URL(`/s/${store}${url.pathname}`, req.url);
  rewritten.search = url.search;
  // Carry the resolved store on a request header, the signal the kit reads to tell a HOST-rewritten request
  // from one that asked for `/s/<store>/…` itself (`storefront-kit/store-route.server`, and the command and
  // customer clients behind the app routes). Additive — the pages read params.
  const headers = new Headers(req.headers);
  headers.set('x-forge-store', store);
  return NextResponse.rewrite(rewritten, { request: { headers } });
}

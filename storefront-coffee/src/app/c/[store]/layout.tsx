// The EDGE-CACHEABLE tree (PERF-B). `/c/<store>/…` is an INTERNAL path: the middleware rewrites catalog
// requests into it when nothing about them is per-visitor (no meaningful query, and the store has no gate),
// so the public URL never changes. A request that literally asks for `/c/...` is rewritten like any other
// path and lands nowhere — this tree is unreachable from outside.
//
// WHY IT IS A SEPARATE TREE AND NOT A FLAG. Next decides "cacheable or dynamic" per route FILE at build
// time; it cannot be conditional at runtime. And it must be conditional: the same PLP is cacheable clean and
// uncacheable filtered, and a store with a GATE reads a dismissal cookie on every route (`s/[store]/layout`),
// which on a cacheable route is a 500 rather than a degrade. Hence two trees — and, deliberately, ONE
// implementation: the pages mount the same views the dynamic tree does, under the same chrome.
//
// ── ★★ pk14/D5 — AND "THE SAME CHROME" IS WHAT THIS FILE HAD STOPPED BEING ───────────────────────────────
//
// This layout mounted <StorefrontChrome> — the REFERENCE vitrine's header and footer, inherited with the cut
// — while its twin `s/[store]/(storefront)/layout.tsx` mounted the shop's own <CoffeeChrome>. One deployable,
// one store, two identities, chosen by which TREE the edge picked. Measured 2026-09-05 in this repository, in
// source, and it is exactly the hybrid the bench showed when `/` was routed to this container on 01/09: the
// café's own home body (`templates/home/HomeCoffee`, mounted by both trees) inside the reference vitrine's
// menu and logo.
//
// ⚠️ AND IT WAS NEVER ABOUT THE ROOT ROUTE. `src/app/page.tsx` is byte-identical to the reference's landing
// stub and NO REQUEST REACHES IT: the middleware matches `/`, resolves the host and rewrites it — to `/404`
// when no store answers for that host, and otherwise into one of these two trees (`middleware.ts`, and the
// test beside it that asserts exactly this). So the fork's real root is HERE, and it is here for every clean
// catalogue URL as well: the home, the unfiltered PLP and the PDP are precisely the requests the edge sends
// to this tree. On the bench that stayed invisible because one origin serves three stores and the café is
// reached by `/s/<store>/…`, which is path-scoped and therefore always dynamic; a store with its OWN HOST —
// which is what production is — lands here on every page.
//
// ⇒ the chrome is <CoffeeChrome>, the same object the dynamic twin mounts. `bin/fork-chrome-drift.guard.mjs`
// is the rule (the two trees wear ONE chrome, and a tree the reference gives a chrome may not lose it); this
// is the code.
//
// This tree sits OUTSIDE `s/[store]/layout.tsx` on purpose: that layout owns the gate machinery, and nothing
// that reads a cookie may sit above a cacheable page. A gated store is simply never routed here.

import {
  REACHED_AT_THE_STORES_OWN_ADDRESS,
  requirePublicStorefront,
  requireStore,
} from '@forgeco/storefront-kit/require-store.server';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { storeThemeStyle } from '@forgeco/storefront-kit/theme/store-theme';
import type { ReactNode } from 'react';
import { CoffeeChrome } from '@/components/coffee/CoffeeChrome';

export default async function CachedStoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;

  // ★★ pk9/P1 — ★ THE OTHER TWIN THAT GETS FORGOTTEN, and the one a `/s/`-only fix would leave open. The
  // middleware resolves a HOST to a store and routes a clean catalogue request here; it never asks whether
  // that store is on the street. So a store with no public page and a public URL would keep serving its
  // home, PLP and PDP from this cached tree while the dynamic tree already answered 404 — the fast pages
  // lying and the slow ones telling the truth. `requireStore` is what hands the flags over; the store here
  // always exists (the middleware resolved it), so its own 404 is a floor and never the point.
  //
  // ── ★★ pk22/D3 — AND THE FORK ADOPTS THE ANSWER pk21/P1 ADDED, RATHER THAN REFUSING IT ─────────────────
  //
  // `requirePublicStorefront` became async and grew a SECOND, MANDATORY argument in the reference — the
  // address to send a shopper to when the store is off our street but open somewhere else — and the reason
  // it has no default is that a front must DECIDE. `bin/store-mount-drift.guard.mjs` put the decision here.
  //
  // ★ IT IS ADOPTED, AND THE MEASUREMENT IS THIS FORK'S OWN MIDDLEWARE, NOT AN APPEAL TO THE PRODUCT. The
  // alternative — a cut that keeps serving a store the port says has no public page — is the very defect the
  // reference just closed, repeated one house along, and a fork is a cut of the reference and not a second
  // policy (AGENTS.md rule #4). Nothing in the café's front makes that store any more public than it is.
  //
  // ★★ AND THE CONSTANT IS A FACT ABOUT THIS TREE HERE TOO, verified rather than copied: `middleware.ts`
  // resolves the request's Host to a store (`resolveStoreForHost`, line 86) and only then rewrites a clean
  // catalogue request into `/c/<store>/…` (line 138). So a request that reaches this layout was ALREADY
  // addressed to the store's own routing host — the address a redirect would aim at is the one we are
  // standing on, and sending the visitor there is a loop. `headers()` here would also be a runtime 500, for
  // the reason `not-found.tsx` next door spells out: this tree's boundary and pages are a static shell, and
  // one dynamic API in it takes the whole tree down. The constant is both the only legal answer and the
  // right one — nowhere to send this visitor, 404 exactly as before.
  //
  // ⚠️ THE `await` IS LOAD-BEARING, and it was not needed until this slice. `requirePublicStorefront` now
  // refuses by THROWING inside an async function; unawaited, that throw lands in a floating promise and this
  // layout renders the store anyway — a 200 with an unhandled rejection in the log. Proven in
  // `src/private-store.tree-split.test.tsx`, which asserts that nothing is rendered, not merely that the
  // refusal was called.
  await requirePublicStorefront(await requireStore(store), REACHED_AT_THE_STORES_OWN_ADDRESS);

  // MS-M2 — ★ THE TWIN THAT GETS FORGOTTEN. This is the tree that serves the CACHED HTML, so a theme wired
  // only into `s/[store]` would vanish on exactly the pages that are fast — home, PDP, PLP clean — and appear
  // on the slow ones, which reads as a flicker between palettes rather than as a missing feature. The read is
  // ISR-cached and the route cache is already keyed by this path's store, so nothing about the caching changes.
  // ★ D2-E2 — the empty prefix is the VITRINE'S OWN FACT, not a placeholder: this deployable answers the
  // edge's fall-through, so its asset URLs are the bare ones. The checkout, which shares the host, passes
  // `/_checkout` instead. See `storeThemeStyle` for why the parameter has no default.
  const theme = await storeThemeStyle(store, '');
  // MULTISTORE M1-β — HOST_BASE is a FACT here, not a default: this tree is unreachable except through the
  // middleware's host rewrite, so its public URL is always the clean one. Asking (headers()) would turn every
  // cached page into a runtime 500; the tree's own precondition answers instead.
  return (
    <>
      {theme}
      <CoffeeChrome store={store} base={HOST_BASE}>
        {children}
      </CoffeeChrome>
    </>
  );
}

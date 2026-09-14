// DoD 1, at the edge where it is actually observable: the status code.
//
// This test exists because the obvious implementation is wrong in a way nothing else catches. Putting the
// redirect in the catch-all page — where the 404 is detected, and where it would have been cheaper —
// means calling `permanentRedirect()`, which emits **308**. Every functional assertion would still pass:
// the browser follows it, the shopper lands on the right page, a test asserting "it redirected" is green.
// What breaks is the thing the feature is for — the brand's SEO audit reports 308, not the 301 its report
// and its agency are looking for. So the assertion here is `expect(res.status).toBe(301)`.

import { afterEach, expect, test, vi } from 'vitest';

const { resolveStoreForHost, lookupRouteRedirect, storeHasGate } = vi.hoisted(() => ({
  resolveStoreForHost: vi.fn(async () => 'demo' as string | undefined),
  lookupRouteRedirect: vi.fn(async () => undefined as string | undefined),
  storeHasGate: vi.fn(async () => false),
}));

vi.mock('@forgecommerce/storefront-kit/config', () => ({ resolveStoreForHost }));
vi.mock('@forgecommerce/storefront-kit/gate/directory', () => ({ storeHasGate }));
vi.mock('./lib/route-redirect', async () => {
  // The real predicate is kept: which paths are even asked about is part of the behaviour under test.
  const actual =
    await vi.importActual<typeof import('./lib/route-redirect')>('./lib/route-redirect');
  return { ...actual, lookupRouteRedirect };
});

const { middleware, config } = await import('./middleware');
const { NextRequest } = await import('next/server');

const request = (path: string, host = 'loja.example') =>
  new NextRequest(new URL(path, `https://${host}`), { headers: { host } });

afterEach(() => {
  vi.clearAllMocks();
  resolveStoreForHost.mockResolvedValue('demo');
  lookupRouteRedirect.mockResolvedValue(undefined);
  storeHasGate.mockResolvedValue(false);
});

/** Which tree served it: `/c/…` is the edge-cacheable one, `/s/…` the dynamic one. */
const treeOf = (res: Response) => res.headers.get('x-middleware-rewrite') ?? '';

test('a known legacy URL answers 301 — not 308 — on the FIRST response', async () => {
  lookupRouteRedirect.mockResolvedValue('/promocoes');

  const res = await middleware(request('/promo'));

  expect(res.status).toBe(301);
  expect(res.headers.get('location')).toBe('https://loja.example/promocoes');
});

test('an unknown path is not redirected: it routes on and 404s exactly as before', async () => {
  const res = await middleware(request('/never-existed'));

  expect(res.status).not.toBe(301);
  // The normal store-scoped rewrite, untouched in substance: since PERF-B a clean path resolves through the
  // edge-cacheable tree, which serves the same catch-all decision and the same 404.
  //
  // SF-404-STUCK — this comment used to end with "…and whose cached 404 is dropped by the same `store:<id>`
  // invalidation the moment that path becomes a real page". Half of that is measured to be true and half was
  // wishful: the invalidation DOES drop it (scripts/edge-cache-proof.mjs, cases 12d/12e), but nothing drops it
  // "the moment" the path becomes real — only someone POSTING that tag does. The TTL never will: a stale 404
  // regenerates its body and keeps its 404 status forever (case 12b). Publishing through the admin posts the
  // tag; publishing through the port without the admin does not. See docs/operations/performance.md, trap 3.
  expect(res.headers.get('x-middleware-rewrite')).toContain('/c/demo/never-existed');
});

test('the query string survives the move — a campaign link keeps its attribution', async () => {
  lookupRouteRedirect.mockResolvedValue('/promocoes');

  const res = await middleware(request('/promo?utm_source=news&utm_campaign=black'));

  expect(res.status).toBe(301);
  expect(res.headers.get('location')).toBe(
    'https://loja.example/promocoes?utm_source=news&utm_campaign=black',
  );
});

test('a redirect pointing at the request itself is ignored (it would loop forever)', async () => {
  lookupRouteRedirect.mockResolvedValue('/promo');

  const res = await middleware(request('/promo'));

  expect(res.status).not.toBe(301);
});

test('platform routes and assets are never asked about', async () => {
  for (const path of ['/checkout', '/api/slots', '/logo.svg']) {
    await middleware(request(path));
  }
  expect(lookupRouteRedirect).not.toHaveBeenCalled();
});

test('an unknown HOST still 404s — the redirect lookup never runs without a store', async () => {
  resolveStoreForHost.mockResolvedValue(undefined);

  const res = await middleware(request('/promo', 'quem-sabe.example'));

  expect(res.headers.get('x-middleware-rewrite')).toContain('/404');
  expect(lookupRouteRedirect).not.toHaveBeenCalled();
});

// ── PERF-B: the middleware also picks the TREE ────────────────────────────────────────────────────────────
// Next fixes cacheability per route file at build time, so "is this request cacheable?" — a per-request
// question — is answered by rewriting into one of two trees that render the same views.

test('a clean catalog URL is routed to the edge-cacheable tree', async () => {
  for (const path of ['/', '/tenis', '/tenis/nike-air', '/p/nike-air', '/sobre']) {
    expect(treeOf(await middleware(request(path))), path).toContain('/c/demo');
  }
});

test('a campaign link keeps the cacheable tree — tracking params change nothing on the page', async () => {
  const res = await middleware(request('/tenis?utm_source=ig&gclid=abc'));
  expect(treeOf(res)).toContain('/c/demo/tenis');
  // and the attribution survives the rewrite
  expect(treeOf(res)).toContain('utm_source=ig');
});

test('a filtered or paginated URL goes to the DYNAMIC tree (a cached page would answer page 1)', async () => {
  for (const path of ['/tenis?page=2', '/tenis?option.cor=preto', '/search?q=tenis']) {
    expect(treeOf(await middleware(request(path))), path).toContain('/s/demo');
  }
});

test('by-possession routes are never routed to the cacheable tree', async () => {
  for (const path of ['/checkout', '/account', '/account/orders/ord_1', '/cart']) {
    expect(treeOf(await middleware(request(path))), path).toContain('/s/demo');
  }
});

test('a store with a GATE installed is served entirely from the dynamic tree', async () => {
  storeHasGate.mockResolvedValue(true);
  // The gate reads the dismissal cookie on EVERY route (s/[store]/layout.tsx); a cookie read on a route the
  // build marked cacheable is a 500, not a degrade. So the whole store stays dynamic while a gate is on.
  expect(treeOf(await middleware(request('/')))).toContain('/s/demo');
  expect(treeOf(await middleware(request('/tenis/nike-air')))).toContain('/s/demo');
});

test('the gate lookup is only paid for requests that could be cacheable', async () => {
  await middleware(request('/checkout'));
  expect(storeHasGate).not.toHaveBeenCalled();
  await middleware(request('/tenis'));
  expect(storeHasGate).toHaveBeenCalledWith('demo');
});

// ── The root-level file-convention assets, and the matcher that must keep letting them through ──────────────
//
// These are files Next serves from `app/`, not store surfaces: `/favicon.ico`, `/icon.png`, `/apple-icon.png`.
// The host->store rewrite must not touch them, or every store serves a 404 where its tab icon should be — and
// nothing anywhere goes red, because a missing favicon is not an error to anybody but a human looking at a tab.
//
// ★ IT IS PINNED TO THE FILES ON DISK, not to a written list. The pairing broke exactly once already: the
// storefront shipped `icon.svg` while the matcher was later asked to exclude a different name, and the two
// drifted silently. Reading the directory means renaming the asset (svg → png, as the Forge mark landing here
// did) can never again leave the matcher pointing at a file that is gone.
test('★ every root-level icon asset is excluded from the host rewrite', async () => {
  const { readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const appDir = join(import.meta.dirname, 'app');
  const assets = readdirSync(appDir).filter((f) =>
    /^(favicon\.ico|icon\.[a-z0-9]+|apple-icon\.[a-z0-9]+)$/.test(f),
  );

  // The fixture would pass vacuously against an empty directory, which is the one way this test could lie.
  expect(
    assets.length,
    'no root-level icon asset found — the fixture, not the matcher, is broken',
  ).toBeGreaterThan(0);

  // The matcher IS a regex source, so it is used as one — anchored, exactly as Next anchors it. Rewriting it
  // by hand (stripping the leading slash, re-balancing parens) is how this assertion silently tested nothing.
  const pattern = config.matcher[0] as string;
  const matches = new RegExp(`^${pattern}$`);
  for (const asset of assets) {
    expect(
      matches.test(`/${asset}`),
      `/${asset} is NOT excluded from the matcher — it would be rewritten to /s/<store>/${asset} and 404 on every store`,
    ).toBe(false);
  }
});

// ★★ D2-C1 — THE STOREFRONT'S OWN ASSET DIRECTORY, and why this assertion is here and not only in the packed guard.
//
// `public/assets/` is where whoever owns this storefront puts a logo. Next serves it at `/assets/<name>`, and
// without an exclusion the host->store rewrite turns that into `/s/<store>/assets/<name>`, which is not a page:
// the file 404s while sitting in the image. Same shape as the favicon case above, one directory over — and
// invisible for the same reason, since nothing goes red when a logo does not load.
//
// It is asserted HERE, in a test that TRAVELS with the cut, because the end-to-end proof (a real file, fetched
// from a running container, `packed-surface.guard.test.ts`) runs only in the release job — and because the
// claim is about THIS storefront, which is exactly as true in a fork as it is here. The pairing with the
// surface registry's `ownerAssets` is that guard's job; this one is the fast red.
test('★ the /assets subtree (`ownerAssets`) is excluded from the host rewrite', () => {
  const matches = new RegExp(`^${config.matcher[0] as string}$`);
  for (const path of ['/assets/logo.png', '/assets/brand/mark.svg']) {
    expect(
      matches.test(path),
      `${path} is NOT excluded from the matcher — it would be rewritten to /s/<store>${path} and 404, with ` +
        'the file present in the image the whole time',
    ).toBe(false);
  }
  // ⚠️ THE PREFIX IS `assets/` WITH THE SLASH, and this is the half that says so. A store may legitimately
  // have a category called `assets`; only its SUBTREE belongs to the storefront's own files, and a bare `/assets` must
  // still route. Widening the exclusion to `assets` would take that address away silently.
  expect(
    matches.test('/assets'),
    '/assets was excluded too — the exclusion is meant to be the subtree, not the bare path, which a store ' +
      'may use as a category',
  ).toBe(true);
});

// ── PK2-POST: the two trees are for PAGES, and some URLs are served by neither ─────────────────────────────

test('a POST is never routed into the cacheable tree — that tree has no route handlers in it', async () => {
  for (const path of ['/', '/tenis', '/tenis/nike-air', '/sobre']) {
    // The control: the very same URL under GET IS cacheable, so this cannot pass because the path was
    // uncacheable for some other reason, nor go on passing the day the method stops being read.
    expect(treeOf(await middleware(request(path))), `GET ${path}`).toContain('/c/demo');
    const res = await middleware(
      new NextRequest(new URL(path, 'https://loja.example'), {
        method: 'POST',
        headers: { host: 'loja.example' },
      }),
    );
    expect(treeOf(res), `POST ${path}`).toContain('/s/demo');
  }
});

test('the gate lookup is not paid for a write — the method rules the tree out before any I/O', async () => {
  await middleware(
    new NextRequest(new URL('/tenis', 'https://loja.example'), {
      method: 'POST',
      headers: { host: 'loja.example' },
    }),
  );
  expect(storeHasGate).not.toHaveBeenCalled();
});

// ★ THE ROUTING CONTRACT THIS PASS CAME TO CLOSE, PINNED TO THE FILES ON DISK.
//
// A handful of URLs are served by a ROOT-LEVEL route handler — `app/<path>/route.ts`, outside `s/` and `c/`.
// Two kinds live there and both are load-bearing: the public routes the composition WRITES for an app
// (`forge.wiring.publicRoutes` — an app's own POST endpoint, the Google feed) and the platform files a
// client's domain has to answer at its bare host (Apple's domain association). They are not store-scoped, so
// they exist in NEITHER tree, and a middleware that rewrites them hands the request to a catch-all page that
// has never heard of them: measured, `POST /apps/reviews/submit` came back 500 ("Failed to find Server
// Action") and `GET` came back the storefront's 404 shell.
//
// It is derived from the DIRECTORY and never from a written list, which is the whole point: the reviews
// endpoint arrived with `pnpm codegen` and nothing had to be told about it, so nothing was — while `feeds/`
// survived only because somebody had put its name in the matcher by hand. A rule that enumerates names dies
// at the first app; this one goes red the day an app declares a route the middleware would eat.
test('★ every root-level route handler reaches Next untouched, on GET and on POST', async () => {
  const { readdirSync } = await import('node:fs');
  const { join, relative, sep } = await import('node:path');
  const appDir = join(import.meta.dirname, 'app');
  /** The trees Next serves through a store, plus the API prefix the matcher already excludes wholesale. */
  const STORE_TREES = new Set(['s', 'c', 'api']);

  const paths: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/^route\.tsx?$/.test(entry.name)) {
        const segments = relative(appDir, dir).split(sep);
        // A dynamic segment cannot be turned back into one URL, and none of the root handlers has one.
        if (STORE_TREES.has(segments[0] as string) || segments.some((s) => s.startsWith('[')))
          continue;
        paths.push(`/${segments.join('/')}`);
      }
    }
  };
  walk(appDir);

  // The fixture would pass vacuously against a tree with no root handlers — the one way this could lie.
  expect(
    paths.length,
    'no root-level route handler found — the fixture, not the middleware, is broken',
  ).toBeGreaterThan(0);

  // Every offender is collected before asserting: a loop that expects inside itself stops at the first one,
  // and "which URLs of this instance are unreachable" is the whole answer — reporting a third of it would
  // send somebody to fix one path and rediscover the other two.
  const matches = new RegExp(`^${config.matcher[0] as string}$`);
  const offenders: string[] = [];
  for (const path of paths) {
    for (const method of ['GET', 'POST']) {
      if (!matches.test(path)) continue; // the matcher keeps it away from us entirely: it already arrives
      const res = await middleware(
        new NextRequest(new URL(path, 'https://loja.example'), {
          method,
          headers: { host: 'loja.example' },
        }),
      );
      const rewrite = res.headers.get('x-middleware-rewrite');
      if (rewrite) offenders.push(`${method} ${path} → ${new URL(rewrite).pathname}`);
    }
  }
  expect(
    offenders,
    'these URLs are served by a root-level route handler, and the middleware rewrote them into a tree where that file does not exist',
  ).toEqual([]);
});

// ── ★★ pk14/D5 — WHAT ANSWERS `/`, AND WHY `app/page.tsx` IS NOT IT ────────────────────────────────────────
//
// The card that opened this slice (`FORK-RAIZ-SEM-CHROME`) reads: *"o `app/page.tsx` da raiz herdou o layout
// do corte"* — routing `/` at this container gives the café's body inside the reference vitrine's chrome.
// The symptom was real and the file named for it is not: `src/app/page.tsx` here is BYTE-IDENTICAL to the
// reference's landing stub ("Forge · Storefront-base"), it renders no shop and no chrome at all, and nothing
// can reach it. The matcher below matches `/`, the middleware resolves the host, and every outcome is a
// rewrite. So the fork's root is a STORE TREE, and which chrome `/` wears is decided in the layout of that
// tree — which is where the fix went (`app/c/[store]/layout.tsx`, and `chrome-identity.test.tsx` proves it
// for both trees).
//
// This test is what stops that from having to be re-derived by reading three files, and it is the one that
// goes red the day somebody exempts `/` from the matcher and quietly puts the platform's landing stub back
// on a merchant's front door.
test('★★ `/` is never answered by the root landing stub — it is always rewritten into a store tree', async () => {
  const matches = new RegExp(`^${config.matcher[0] as string}$`);
  expect(matches.test('/'), '`/` is excluded from the matcher: the bare landing stub now answers the shop’s front door').toBe(true);

  // No rewrite header AT ALL is the failure this test is about: it means Next served `/` as it arrived, and
  // what sits there is the landing stub. Said in words, because a bare `null` reads as a broken assertion.
  const STUB = '(no rewrite — Next answered `/` itself, which is app/page.tsx, the landing stub)';
  const routed = async () => (await middleware(request('/'))).headers.get('x-middleware-rewrite') ?? STUB;

  // The ordinary case: a host that resolves. Clean, no query, no gate → the edge-cacheable tree.
  expect(await routed(), 'a resolvable host must land in a store tree').toContain('/c/demo');

  // The same URL on a store with a gate: still a store tree, the dynamic one.
  storeHasGate.mockResolvedValue(true);
  expect(await routed(), 'a gated store must land in the dynamic tree').toContain('/s/demo/');
  storeHasGate.mockResolvedValue(false);

  // And an unknown host gets the store-LESS 404, not the stub either.
  resolveStoreForHost.mockResolvedValue(undefined);
  expect(await routed(), 'an unknown host must get the store-less 404').toContain('/404');
});

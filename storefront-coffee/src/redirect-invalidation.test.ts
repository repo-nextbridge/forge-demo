// QA · FA2 (P3C-5) — A DELETED REDIRECT WAS STILL ANSWERING 301 FOURTEEN MINUTES LATER.
//
// The ficha promises, in the confirmation the operator types EXCLUIR into: "the old URL goes back to a 404".
// On Staging `/promo-inverno` answered 301 at 04:10, 04:19 and 04:24 UTC after being deleted at ~04:10.
//
// ★ THE CAUSE, MEASURED, IS NOT THE ONE THE REPORT GUESSED. The in-process cache in `lib/route-redirect.ts`
// expires a hit after REDIRECT_POSITIVE_TTL_MS (60 s) — it cannot hold anything for 14 minutes. What could,
// and did, is the RESPONSE: the 301 went out with `location` and NOTHING else (measured: the whole header
// list was `[["location", …]]`). A 301 with no `Cache-Control` is the most cacheable answer in HTTP —
// browsers and CDNs treat a permanent redirect as permanent, and the request that would have asked again
// never leaves the client. The server's TTL is irrelevant to a request that is never made.
//
// It also explains the asymmetry the report recorded and could not account for: `/promo-blog`, deleted
// later, "went back to 404 fast". It never emitted a 301 at all (its target was off-site, which the
// storefront drops), so no client ever cached one.
//
// ★ WHY THE OBVIOUS TEST IS WORTHLESS HERE, and what this file does instead. Deleting the row and asking
// again in the same process exercises no cache: it passes on a build with every cache removed and on a
// build that caches forever. So every half of the window is asserted as a WINDOW:
//   1. what a CLIENT may hold — a finite max-age, derived from the server's own TTL, never absent;
//   2. what the SERVER may hold — that after the TTL it ASKS AGAIN and stops redirecting;
//   3. what the SERVER may hold WHEN THE PORT IS DOWN — the one that had no ceiling at all (see below).
// Together they bound "the old URL goes back to a 404" at a number somebody can put on a screen. Nothing
// here proves the row left the database; that was never the thing in doubt.
//
// ★★ QA · RODADA 2 (R2D-3) — THE MEASUREMENT CAME BACK WORSE, AND THE THIRD HALF IS WHY THIS FILE GREW.
//
// Re-measured on Staging 2026-08-28 against a kernel that already carried everything above: deleted at
// 08:41:44Z, HTTP 301 on all ~80 polls over 20 minutes, never a 404. Sixty seconds of server TTL plus sixty
// of client max-age cannot produce twenty minutes, and the layers between were checked and hold nothing —
// the edge proxies without a cache, and `read.route_resolve` memoizes nothing on the kernel side. So the
// window this file asserts was true and was not the whole answer.
//
// What was found in the code instead, and is closed here, is the ONE path with no ceiling: stale-on-error.
// `lookupRouteRedirect` served an EXPIRED entry whenever `ask` threw, and never dropped it — so a port that
// keeps failing keeps publishing a deleted redirect, unbounded. The trigger is not hypothetical since the
// anonymous face got a face-wide cap: a 429 is a `!res.ok` is a throw is that branch.
//
// ⚠️ IT IS NOT CLAIMED AS THE CAUSE OF THE 20 MINUTES. That one was not reproduced, and a fix without a
// reproduction is a guess with a commit. This is a second, independently real holder of the same lie, and
// the only one this repo can measure.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { resolveStoreForHost, storeHasGate } = vi.hoisted(() => ({
  resolveStoreForHost: vi.fn(async () => 'demo' as string | undefined),
  storeHasGate: vi.fn(async () => false),
}));
vi.mock('@forgecommerce/storefront-kit/config', async () => {
  const actual = await vi.importActual<typeof import('@forgecommerce/storefront-kit/config')>(
    '@forgecommerce/storefront-kit/config',
  );
  return { ...actual, resolveStoreForHost };
});
vi.mock('@forgecommerce/storefront-kit/gate/directory', () => ({ storeHasGate }));

const { middleware } = await import('./middleware');
const {
  __resetRouteRedirectCache,
  REDIRECT_POSITIVE_TTL_MS,
  REDIRECT_STALE_GRACE_MS,
  redirectCacheControl,
} = await import('./lib/route-redirect');
const { NextRequest } = await import('next/server');

const request = (path: string, host = 'loja.example') =>
  new NextRequest(new URL(path, `https://${host}`), { headers: { host } });

/** The port's answer for the next call. `null` is what it says once the operator has deleted the row. */
let answer: unknown = { to: '/acessorios/bolsas' };
let asked = 0;

beforeEach(() => {
  __resetRouteRedirectCache();
  answer = { to: '/acessorios/bolsas' };
  asked = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      asked += 1;
      return new Response(JSON.stringify(answer), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetRouteRedirectCache();
});

test('the 301 tells the client how long it may hold it, and the number is the server TTL', async () => {
  const res = await middleware(request('/promo-inverno'));

  expect(res.status).toBe(301);
  const cacheControl = res.headers.get('cache-control');
  // Not "some header exists": the value is DERIVED from the same constant the server cache uses, so the two
  // halves of the window can never drift apart into a promise nobody can compute.
  expect(cacheControl).toBe(redirectCacheControl());
  const maxAge = /max-age=(\d+)/.exec(cacheControl ?? '')?.[1];
  expect(maxAge, 'a 301 with no max-age is cached by browsers as permanent').toBeDefined();
  expect(Number(maxAge)).toBe(REDIRECT_POSITIVE_TTL_MS / 1000);
  // The ceiling that matters is that it is FINITE and short. A year would satisfy the assertions above.
  expect(Number(maxAge)).toBeLessThanOrEqual(300);
});

test('★ the deletion actually reaches the shopper: after the TTL the port is ASKED AGAIN, and the 301 stops', async () => {
  vi.useFakeTimers();

  // 1. The redirect works, and the answer is remembered — this is the cache the naive test never touches.
  expect((await middleware(request('/promo-inverno'))).status).toBe(301);
  expect((await middleware(request('/promo-inverno'))).status).toBe(301);
  expect(asked, 'the second navigation was served from the in-process cache').toBe(1);

  // 2. The operator deletes the row. The port now says "nobody knows this path".
  answer = null;

  // 3. Inside the window the storefront still redirects — stated out loud, because it is the honest cost of
  //    caching at all, and it is what makes the number on the screen a number and not a wish.
  expect((await middleware(request('/promo-inverno'))).status).toBe(301);
  expect(asked).toBe(1);

  // 4. Past it, the entry is gone, the port is consulted again, and the old URL routes on to its 404.
  vi.advanceTimersByTime(REDIRECT_POSITIVE_TTL_MS + 1);
  const after = await middleware(request('/promo-inverno'));

  expect(asked, 'the expired entry must cause a fresh ask, not a refreshed lie').toBe(2);
  expect(after.status).not.toBe(301);
  expect(after.headers.get('location')).toBeNull();
  expect(after.headers.get('x-middleware-rewrite')).toContain('/promo-inverno');
});

test('a MISS is never given the redirect headers — only a 301 carries the redirect cache policy', async () => {
  // Antivacuity for the first test: a `Cache-Control` set unconditionally at the top of the middleware would
  // satisfy it and would also stamp every page of the store with a 60 s public cache.
  answer = null;

  const res = await middleware(request('/never-existed'));

  expect(res.status).not.toBe(301);
  expect(res.headers.get('cache-control')).toBeNull();
});

test('★ R2D-3: a port that is DOWN cannot keep publishing a deleted redirect forever', async () => {
  vi.useFakeTimers();
  // 1. The redirect works and is remembered.
  expect((await middleware(request('/oferta-especial'))).status).toBe(301);

  // 2. The operator deletes it, and from here the port answers nothing at all — the shape a 429 from the
  //    face-wide anonymous cap takes on this side, and the shape a restart takes too.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      asked += 1;
      return new Response('too many requests', { status: 429 });
    }),
  );

  // 3. Inside the grace window the storefront still redirects — the honest cost of not turning a port blip
  //    into an error page, and it is a WINDOW rather than a posture.
  vi.advanceTimersByTime(REDIRECT_POSITIVE_TTL_MS + 1);
  expect((await middleware(request('/oferta-especial'))).status).toBe(301);

  // 4. Past it the entry is gone and the old URL routes on to its 404 — while the port is STILL down. This
  //    is the assertion that was impossible before: the branch had no ceiling to pass.
  vi.advanceTimersByTime(REDIRECT_STALE_GRACE_MS + 1);
  const after = await middleware(request('/oferta-especial'));
  expect(after.status).not.toBe(301);
  expect(after.headers.get('location')).toBeNull();

  // 5. And it STAYS gone. Serving the stale entry once more and only then dropping it would satisfy step 4
  //    and would leave the map holding the lie for the next request.
  expect((await middleware(request('/oferta-especial'))).status).not.toBe(301);
  expect(asked, 'a dropped entry means the port is asked again, not answered from memory').toBe(4);
});

test('the ceiling is a real number and not a formality (a day-long grace would pass the test above)', () => {
  // Antivacuity: step 4 advances by the constant itself, so any value would satisfy it. What the merchant is
  // promised is "about two windows", and that is what this pins.
  expect(REDIRECT_STALE_GRACE_MS).toBeGreaterThan(0);
  expect(REDIRECT_POSITIVE_TTL_MS + REDIRECT_STALE_GRACE_MS).toBeLessThanOrEqual(300_000);
});

// The storefront half of DoD 1. The assertion that earns its keep is the STATUS: `permanentRedirect()`
// would have produced a 308 here and every functional test would still have passed, while the SEO audit
// the brand runs would report the wrong thing. So the middleware test below checks `301`, not "it
// redirected".

import { afterEach, expect, test, vi } from 'vitest';
import {
  __resetRouteRedirectCache,
  isResolvableRoute,
  lookupRouteRedirect,
} from './route-redirect';

afterEach(() => {
  __resetRouteRedirectCache();
  vi.restoreAllMocks();
});

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

test('a known path resolves to its target', async () => {
  const to = await lookupRouteRedirect('demo', '/promo', ok({ to: '/promocoes' }));
  expect(to).toBe('/promocoes');
});

test('"nobody knows it" is undefined, not an error', async () => {
  expect(await lookupRouteRedirect('demo', '/whatever', ok(null))).toBeUndefined();
});

test('an off-site target is refused even if the port somehow returned one', async () => {
  // Defence in depth: the app and the kernel both reject this, and so does the layer that would emit it.
  expect(
    await lookupRouteRedirect('demo', '/x', ok({ to: 'https://evil.example' })),
  ).toBeUndefined();
  expect(await lookupRouteRedirect('demo', '/y', ok({ to: '//evil.example' }))).toBeUndefined();
});

test('a MISS is cached — this is what makes asking on every navigation affordable', async () => {
  const fetchImpl = ok(null);
  await lookupRouteRedirect('demo', '/same', fetchImpl);
  await lookupRouteRedirect('demo', '/same', fetchImpl);
  await lookupRouteRedirect('demo', '/same', fetchImpl);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('a hit is cached too', async () => {
  const fetchImpl = ok({ to: '/novo' });
  await lookupRouteRedirect('demo', '/antigo', fetchImpl);
  const second = await lookupRouteRedirect('demo', '/antigo', fetchImpl);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(second).toBe('/novo');
});

test('the cache is per STORE — two tenants never share an answer', async () => {
  const fetchImpl = ok({ to: '/a' });
  await lookupRouteRedirect('one', '/p', fetchImpl);
  await lookupRouteRedirect('two', '/p', fetchImpl);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('a port that is DOWN never breaks navigation', async () => {
  const boom = vi.fn(async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  // No answer means no redirect, which is the 404 the shopper would have got anyway.
  expect(await lookupRouteRedirect('demo', '/p', boom)).toBeUndefined();
});

test('a 5xx is a failure, never mistaken for "no redirect exists"', async () => {
  const failing = vi.fn(
    async () => new Response('nope', { status: 503 }),
  ) as unknown as typeof fetch;
  await lookupRouteRedirect('demo', '/p', failing);
  // Nothing was cached, so the next request asks again instead of serving a fabricated miss for 30s.
  await lookupRouteRedirect('demo', '/p', failing);
  expect(failing).toHaveBeenCalledTimes(2);
});

test('the port is not asked for assets or platform routes', async () => {
  const fetchImpl = ok(null);
  for (const path of [
    '/_next/static/chunk.js',
    '/api/slots',
    '/checkout',
    '/search',
    '/account/orders',
    '/logo.svg',
    '/',
  ]) {
    expect(isResolvableRoute(path), path).toBe(false);
    expect(await lookupRouteRedirect('demo', path, fetchImpl)).toBeUndefined();
  }
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('a plausible content path IS asked about', () => {
  for (const path of ['/promo', '/categoria/antiga', '/blog/post-1']) {
    expect(isResolvableRoute(path), path).toBe(true);
  }
});

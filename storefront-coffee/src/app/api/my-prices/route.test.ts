// CUST-CLUSTER wave 4 — the overlay's route, which is where three of decision 7's promises are kept or broken.
//
// Every assertion is on the RESPONSE (its status, its headers, whether the port was called), not on markup:
// the COLL wave shipped two guards that passed against a fraud because they only checked that a name appeared
// in the HTML. What matters here is not what the page looks like — it is what leaves the server.

import { beforeEach, expect, test, vi } from 'vitest';

const { readCustomerSession, myPrices } = vi.hoisted(() => ({
  readCustomerSession: vi.fn(),
  myPrices: vi.fn(),
}));
vi.mock('@forgeco/storefront-kit/session', () => ({ readCustomerSession }));
vi.mock('@forgeco/storefront-kit/kernel-write-clients', () => ({
  customerClient: () => ({ myPrices }),
}));

import { GET } from './route';

// ★★ pk14/D3 — THE STORE RIDES ALONG, and this file learned it a release late, exactly like the route did.
// pk6/M5 made the overlay's port call store-scoped and the fix reached `route.ts:70` through the OVEN; the
// test that was supposed to describe the route stayed on the old URL, so four of its cases were reading the
// 204 the route now returns for a request no store claims — a fixture asserting the absence of the feature
// it was written for. It was red from that day until 2026-09-05, when `bin/fork-suite.guard.mjs` ran this
// suite for the first time. The store arrives the way a fragment fetched from inside `/s/<store>/` sends it:
// EXPLICITLY, on the query (`lib/store-context.ts` — the Host is only the fallback).
const call = (skus: string) =>
  GET(new Request(`https://loja.test/api/my-prices?skus=${skus}&store=acme`));

beforeEach(() => {
  vi.clearAllMocks();
  readCustomerSession.mockResolvedValue('cst_tok');
  myPrices.mockResolvedValue({ sku_a: { amount: 7000, was: 9000, label: 'Member price' } });
});

// ── The cache contract ──────────────────────────────────────────────────────────────────────────────────

test('★★ the response is PRIVATE — a shared cache holding it would serve one shopper’s prices to another', () => {
  // Decision 7 in one header. `private` keeps it in the USER's browser and out of every proxy and CDN, which
  // is also what guarantees segmentation never enters a cache key: an un-shareable response has no key to
  // enter. This is the single line whose loss would be invisible in every screenshot and catastrophic in
  // production, which is why it is asserted rather than trusted.
  return call('sku_a').then((res) => {
    // ⚠️ NOT `?? ''`. A response that lost the header ENTIRELY is the very catastrophe this test names, and
    // an empty string satisfies both negative assertions below. The header is required to exist first.
    const cc = res.headers.get('cache-control');
    expect(cc, 'the overlay carries no cache-control header at all').not.toBeNull();
    expect(cc).toContain('private');
    expect(cc).toContain('max-age=60');
    expect(cc, 'the overlay became cacheable by a shared cache').not.toContain('public');
    expect(cc).not.toContain('s-maxage');
  });
});

test('the error path is private too — a 400 must not be shareable either', async () => {
  const res = await call(Array.from({ length: 99 }, (_, i) => `s${i}`).join(','));
  expect(res.status).toBe(400);
  expect(res.headers.get('cache-control')).toContain('private');
});

// ── The anonymous visit ─────────────────────────────────────────────────────────────────────────────────

test('★ an anonymous visit costs 204 and NEVER reaches the port', async () => {
  readCustomerSession.mockResolvedValue(undefined);
  const res = await call('sku_a,sku_b');
  expect(res.status).toBe(204);
  expect(
    myPrices,
    'the overlay called the port for a visitor with no session',
  ).not.toHaveBeenCalled();
});

test('★ pk14/D3 — a signed-in ask that names NO store is 204 too, and never reaches the port', async () => {
  // The branch the four stale cases above were accidentally exercising, now asserted on purpose. A member
  // price is scoped to a shop (pk6/M5), so an overlay with no shop to compare against has no true answer:
  // the page keeps its anonymous price, which is right for everyone. `loja.test` resolves to no store here,
  // and no `?store=` names one.
  const res = await GET(new Request('https://loja.test/api/my-prices?skus=sku_a'));
  expect(res.status).toBe(204);
  expect(myPrices, 'the overlay called the port without knowing which store').not.toHaveBeenCalled();
});

// ── The ceiling ─────────────────────────────────────────────────────────────────────────────────────────

test('★ over the ceiling is a REFUSAL, never a truncated answer', async () => {
  const res = await call(Array.from({ length: 60 }, (_, i) => `s${i}`).join(','));
  expect(res.status).toBe(400);
  expect(myPrices).not.toHaveBeenCalled();
  // The message carries the number, so a caller learns the limit instead of guessing it.
  expect(JSON.stringify(await res.json())).toContain('48');
});

test('exactly at the ceiling is allowed', async () => {
  const res = await call(Array.from({ length: 48 }, (_, i) => `s${i}`).join(','));
  expect(res.status).toBe(200);
  expect(myPrices).toHaveBeenCalledTimes(1);
});

// ── What the body carries ───────────────────────────────────────────────────────────────────────────────

test('★★ the body carries the PROMOTION’s label — and no segment, because there is no field for one', async () => {
  const body = (await (await call('sku_a')).json()) as Record<string, { label: string }>;
  expect(body.sku_a?.label).toBe('Member price');
  expect(JSON.stringify(body).toLowerCase()).not.toContain('cluster');
});

test('a port failure leaves the page on its anonymous price rather than erroring at the shopper', async () => {
  myPrices.mockRejectedValue(new Error('port down'));
  const res = await call('sku_a');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({});
});

test('an empty ask is an empty answer, with no port call', async () => {
  const res = await call('');
  expect(res.status).toBe(200);
  expect(myPrices).not.toHaveBeenCalled();
});

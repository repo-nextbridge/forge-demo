// SF-SUGGEST-429 — the autocomplete proxy's TRANSLATION of what the port answered.
//
// The defect this file pins: the route had no catch, so ANY non-200/404 the port returned became an exception
// in the handler and Next turned it into a 500. The kernel caps this read at 60 req/min per IP and answers
// 429; the shopper's browser was told the store had broken. A 429 is not a failure, it is an instruction —
// and it has to survive the trip through the storefront to be one.
//
// Every assertion is on the RESPONSE (status + headers), never on markup: what matters here is what leaves
// the server. And the boundary is asserted in BOTH directions — the 429 is translated, and a 500 stays a 500;
// a route that repassed everything would be a proxy, which is a different (and worse) thing than this.

import { beforeEach, expect, test, vi } from 'vitest';

const { suggest, resolveStoreForHost } = vi.hoisted(() => ({
  suggest: vi.fn(),
  resolveStoreForHost: vi.fn(),
}));
vi.mock('@forgeco/storefront-kit/config', () => ({
  readClient: () => ({ suggest }),
  resolveStoreForHost,
}));

import { ReadPortError } from '@forgeco/storefront-kit/read-client';
import { GET } from './route';

const RESULT = { products: [{ handle: 'tenis-x', title: 'Tênis X' }], categories: [] };

/** The route reads `req.nextUrl`, so the request has to be a NextRequest — the plain Request the sibling
 * my-prices test uses is not enough here. */
async function call(qs: string) {
  const { NextRequest } = await import('next/server');
  return GET(
    new NextRequest(`https://loja.test/api/suggest${qs}`, { headers: { host: 'loja.test' } }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  suggest.mockResolvedValue(RESULT);
  resolveStoreForHost.mockResolvedValue('str_1');
});

// ── the card: the limit stops being a 500 ───────────────────────────────────────────────────────────────

test('★★ the kernel’s 429 leaves the storefront as a 429 — never as a 500', async () => {
  suggest.mockRejectedValue(new ReadPortError('suggest', 429, '60'));
  const res = await call('?q=tenis');
  expect(res.status).toBe(429);
  expect((await res.json()).error?.kind).toBe('rate_limited');
});

test('★ the kernel’s Retry-After is carried through — the browser learns WHEN, not just that it failed', async () => {
  suggest.mockRejectedValue(new ReadPortError('suggest', 429, '60'));
  expect((await call('?q=tenis')).headers.get('retry-after')).toBe('60');
});

test('a 429 with no Retry-After carries none — the route never invents a number the kernel did not give', async () => {
  suggest.mockRejectedValue(new ReadPortError('suggest', 429, null));
  const res = await call('?q=tenis');
  expect(res.status).toBe(429);
  expect(res.headers.get('retry-after')).toBeNull();
});

test('★ the 429 is never cacheable — a shared cache holding it would serve ONE ip’s limit to everybody', async () => {
  suggest.mockRejectedValue(new ReadPortError('suggest', 429, '60'));
  expect((await call('?q=tenis')).headers.get('cache-control')).toContain('no-store');
});

// ── the boundary: only the 429 is translated ────────────────────────────────────────────────────────────

test('★★ a 500 from the port stays a 500 — this route is a translator, not a proxy', async () => {
  suggest.mockRejectedValue(new ReadPortError('suggest', 500, null));
  await expect(call('?q=tenis')).rejects.toThrow(ReadPortError);
});

test('a non-port failure is not swallowed either', async () => {
  suggest.mockRejectedValue(new TypeError('fetch failed'));
  await expect(call('?q=tenis')).rejects.toThrow(TypeError);
});

// ── the paths that were already right, pinned so the try/catch did not change them ──────────────────────

test('a normal answer is a 200 carrying the port’s payload', async () => {
  const res = await call('?q=tenis');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(RESULT);
});

test('a blank q is an empty answer, with no port call', async () => {
  const res = await call('?q=%20%20');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ products: [], categories: [] });
  expect(suggest).not.toHaveBeenCalled();
});

test('an unknown store is an empty answer, with no port call', async () => {
  resolveStoreForHost.mockResolvedValue(undefined);
  const res = await call('?q=tenis');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ products: [], categories: [] });
  expect(suggest).not.toHaveBeenCalled();
});

test('a 404 from the port (the read-client’s null) is an empty answer, not an error', async () => {
  suggest.mockResolvedValue(null);
  const res = await call('?q=tenis');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ products: [], categories: [] });
});

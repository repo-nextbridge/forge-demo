// S6-IMAGES — the image door end to end: what it refuses to fetch, what it does when it has no base, and what
// it sends back on a hit. The guard itself is unit-tested in lib/media/key.test.ts; this proves the ROUTE wires
// it in front of the fetch (a guard nobody calls is not a guard).

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from './[...key]/route';

const BASE = 'https://cdn.test/media';

/** The route reads the base from the env at request time (per-instance runtime config, never build-time). */
function withBase(base: string | undefined) {
  if (base === undefined) delete process.env.FORGE_MEDIA_BASE_URL;
  else process.env.FORGE_MEDIA_BASE_URL = base;
}

function call(segments: string[]): Promise<Response> {
  return GET(new Request('http://storefront.test/api/media/x'), {
    params: Promise.resolve({ key: segments }),
  });
}

const originalBase = process.env.FORGE_MEDIA_BASE_URL;
beforeEach(() => {
  vi.restoreAllMocks();
  withBase(BASE);
});
afterEach(() => {
  withBase(originalBase);
});

test('a hostile key is refused with 400 and NO fetch is attempted (the SSRF door stays shut)', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  for (const key of [
    ['..', '..', 'etc', 'passwd'],
    ['%2e%2e%2fetc'],
    ['http://169.254.169.254/latest/meta-data'],
    ['', '', 'evil.test'],
  ]) {
    const res = await call(key);
    expect(res.status).toBe(400);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('no media base configured → 404, and again NO fetch (never a blind request)', async () => {
  withBase(undefined);
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const res = await call(['ten_a', 'obj.png']);
  expect(res.status).toBe(404);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('a valid key is fetched against the SERVER base and streamed back, cached hard', async () => {
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response('BYTES', { status: 200, headers: { 'content-type': 'image/png' } }),
    );
  const res = await call(['ten_a', 'obj.png']);

  expect(fetchSpy).toHaveBeenCalledWith(`${BASE}/ten_a/obj.png`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/png');
  // The provider_key is minted per upload and its bytes never change — the master is immutable by construction.
  expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(await res.text()).toBe('BYTES');
});

test('an object missing from the bucket is a 404, not a 500', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }));
  const res = await call(['ten_a', 'gone.png']);
  expect(res.status).toBe(404);
});

test('an unreachable bucket degrades to 502 (the image falls back to the placeholder, the page lives)', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
  const res = await call(['ten_a', 'obj.png']);
  expect(res.status).toBe(502);
});

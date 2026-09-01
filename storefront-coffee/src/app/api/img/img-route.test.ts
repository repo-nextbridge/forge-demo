// PERF-C — the derivative door end to end: what it refuses before touching anything, what it asks the optimizer
// for, and the two headers that decide whether a CDN can be wrong (`cache-control` present, `Vary` absent).

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from './[...spec]/route';

const BASE = 'https://cdn.test/media';
const KEY = ['ten_a', '01J-photo.jpg'];

function call(spec: string[]): Promise<Response> {
  return GET(new Request('http://storefront.test/api/img/x'), {
    params: Promise.resolve({ spec }),
  });
}

const originalBase = process.env.FORGE_MEDIA_BASE_URL;
const originalOrigin = process.env.FORGE_INTERNAL_ORIGIN;
beforeEach(() => {
  vi.restoreAllMocks();
  process.env.FORGE_MEDIA_BASE_URL = BASE;
  process.env.FORGE_INTERNAL_ORIGIN = 'http://127.0.0.1:3000';
});
afterEach(() => {
  if (originalBase === undefined) delete process.env.FORGE_MEDIA_BASE_URL;
  else process.env.FORGE_MEDIA_BASE_URL = originalBase;
  if (originalOrigin === undefined) delete process.env.FORGE_INTERNAL_ORIGIN;
  else process.env.FORGE_INTERNAL_ORIGIN = originalOrigin;
});

function ok(contentType: string): Response {
  return new Response('BYTES', { status: 200, headers: { 'content-type': contentType } });
}

test('the lane in the URL decides the Accept we send — the browser never gets a vote', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok('image/webp'));
  await call(['webp', '640', ...KEY]);
  expect(fetchSpy).toHaveBeenCalledWith(
    'http://127.0.0.1:3000/_next/image?url=%2Fapi%2Fmedia%2Ften_a%2F01J-photo.jpg&w=640&q=75',
    { headers: { accept: 'image/webp' } },
  );

  fetchSpy.mockClear();
  await call(['orig', '640', ...KEY]);
  // No wildcard: `image/*` would match image/webp and the optimizer would transcode, making the URL a lie.
  const accept = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
  expect(accept.accept).not.toContain('webp');
  expect(accept.accept).not.toContain('*');
});

test('a derivative is cached hard and carries NO Vary — the whole reason this route exists', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    // The optimizer answers with its own Vary; it must not survive into ours.
    new Response('BYTES', {
      status: 200,
      headers: { 'content-type': 'image/webp', vary: 'Accept' },
    }),
  );
  const res = await call(['webp', '640', ...KEY]);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/webp');
  expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  // Measured on a real `next start`: the framework appends its own router `Vary` (RSC, Next-Router-*) to every
  // route-handler response, and that is harmless — an image request never carries those headers. What must never
  // come back is `Accept`, because that is the axis a CDN ignoring `Vary` gets wrong.
  expect(
    res.headers.get('vary'),
    'varying on Accept is the Cloudflare bug walking back in',
  ).toBeNull();
});

test('an off-ladder width or an unknown format is refused BEFORE any fetch (no transform farm)', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  for (const spec of [
    ['webp', '641', ...KEY], // not on the ladder
    ['webp', '0640', ...KEY], // not the URL we mint → not a second cache key for the same image
    ['webp', '-1', ...KEY],
    ['webp', 'abc', ...KEY],
    ['avif', '640', ...KEY], // a lane we do not serve
    ['webp'], // no key at all
  ]) {
    expect((await call(spec)).status, spec.join('/')).toBe(400);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('the SSRF guard of /api/media guards this door too (a KEY, never an address)', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  for (const key of [
    ['..', '..', 'etc', 'passwd'],
    ['%2e%2e%2fetc'],
    ['http://169.254.169.254/latest/meta-data'],
  ]) {
    expect((await call(['webp', '640', ...key])).status).toBe(400);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('no media base configured → 404, and no blind request', async () => {
  delete process.env.FORGE_MEDIA_BASE_URL;
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  expect((await call(['webp', '640', ...KEY])).status).toBe(404);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('the optimizer refusing or being unreachable degrades, never 500s', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 400 }));
  expect((await call(['webp', '640', ...KEY])).status).toBe(404);

  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
  expect((await call(['webp', '640', ...KEY])).status).toBe(502);
});

// ── F4 — the optimizer's refusal stops being anonymous ─────────────────────────────────────────────────────

test('★ the optimizer refusing says WHY in the log — a bare 404 sends a human hunting for a key that exists', async () => {
  // Every failure of the optimizer collapses into the same public 404 (and must: this response may not tell an
  // anonymous caller whether the object is in the bucket). That is precisely why the cause has to survive
  // somewhere else — the refusal carries a real message, and it was being thrown away.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response("The requested resource isn't a valid image.", { status: 400 }),
  );

  const res = await call(['webp', '640', ...KEY]);
  expect(res.status).toBe(404);

  const said = warn.mock.calls.map((entry) => entry.join(' ')).join('\n');
  expect(said, 'the derivative door swallowed the optimizer refusal whole').toContain(
    'ten_a/01J-photo.jpg',
  );
  expect(said, 'the status the optimizer answered with is not in the log').toContain('400');
  expect(said, 'the reason the optimizer gave is not in the log').toContain('valid image');
});

test('a derivative that WORKS says nothing (the log has to stay readable to be read)', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok('image/webp'));
  expect((await call(['webp', '640', ...KEY])).status).toBe(200);
  expect(warn).not.toHaveBeenCalled();
});

// PERF-C — the derivative door: `/api/img/<format>/<width>/<provider_key…>`.
//
// ONE URL, ONE FORMAT. Everything that decides the bytes is in the PATH, so the answer never depends on the
// request headers and this response carries NO `Vary`. That is the whole point: `/_next/image` negotiates on
// `Accept` and answers `Vary: Accept`, Cloudflare Free ignores `Vary`, and the first variant cached for a URL is
// then served to everyone (measured on the demo: JPEG 12.3 KB delivered where a 7.7 KB webp existed). Here the
// two variants ARE two URLs and the browser picks between them in the `<picture>` — a CDN that ignores `Vary`
// can no longer be wrong, because there is nothing left for it to ignore.
//
// HOW THE BYTES ARE MADE. We delegate the transform to the Next optimizer, called on the LOOPBACK with the
// `Accept` we choose — the negotiation moves from the browser (where a CDN can poison it) to us (where the URL
// decides it). We inherit the optimizer's on-disk cache, its sharp, its timeouts and its limits instead of
// re-implementing them, and the storefront gains no new dependency. The loopback hop only happens on a MISS.
//
// 127.0.0.1 AND NOT THE REQUEST'S HOST, deliberately: behind a CDN the public host would send this fetch back
// OUT through the edge and in again. `FORGE_INTERNAL_ORIGIN` overrides it for an instance whose server is not on
// the loopback address.
//
// NOT AN OPEN PROXY, AND NOT A TRANSFORM FARM. The only caller input is the opaque `provider_key` — validated by
// the same `normalizeProviderKey` that guards `/api/media` (a KEY, never an address) — plus a format and a width
// that must both be members of closed allow-lists. An unbounded width would let anyone mint unbounded cache
// entries and unbounded CPU on a small box; off-ladder is a 400 before any fetch.

import { isImageFormat } from '@forgecommerce/storefront-kit/media/driver';
import { mediaProxyPath, normalizeProviderKey } from '@forgecommerce/storefront-kit/media/key';
import { isAllowedWidth } from '@forgecommerce/storefront-kit/media/widths';
import { acceptFor } from '@/lib/derivative-accept';

/** The quality every derivative is built at. Kept OUT of the URL on purpose — one more free dimension is one
 * more way to multiply cache keys and origin work. 75 is the Next default the storefront already shipped. */
const QUALITY = 75;

/** Where this very process listens. Never the public host — see the header. */
function internalOrigin(): string {
  return process.env.FORGE_INTERNAL_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spec: string[] }> },
): Promise<Response> {
  const { spec } = await params;
  // <format>/<width>/<key…> — a key is at least one segment.
  if (spec.length < 3) return new Response('invalid derivative', { status: 400 });

  const [format, rawWidth, ...keySegments] = spec;
  if (format === undefined || !isImageFormat(format)) {
    return new Response('unsupported format', { status: 400 });
  }

  // Parsed, then checked against the ladder: `0640` and `640.0` are not the URL we mint, so they are not a
  // second cache key for the same image either.
  const width = Number(rawWidth);
  if (String(width) !== rawWidth || !isAllowedWidth(width)) {
    return new Response('unsupported width', { status: 400 });
  }

  const providerKey = normalizeProviderKey(keySegments);
  if (providerKey === null) return new Response('invalid media key', { status: 400 });

  // No media base → the master door itself serves nothing, so neither can a derivative of it (honest 404, never
  // a blind request).
  if (!process.env.FORGE_MEDIA_BASE_URL) {
    return new Response('media base not configured', { status: 404 });
  }

  const optimizer = `${internalOrigin()}/_next/image?url=${encodeURIComponent(
    mediaProxyPath(providerKey),
  )}&w=${width}&q=${QUALITY}`;

  let upstream: Response;
  try {
    upstream = await fetch(optimizer, { headers: { accept: acceptFor(format, providerKey) } });
  } catch {
    return new Response('derivative unavailable', { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    // F4 — the public answer stays a flat 404 for EVERY refusal, deliberately: it may not tell an anonymous
    // caller whether the object is in the bucket, so it cannot distinguish "no such master" from "master found,
    // optimizer would not take it". Which is exactly why the reason has to survive somewhere a human can read
    // it — without this line, a real optimizer message ("The requested resource isn't a valid image.", a
    // timeout, a width it rejected) was discarded and whoever came to debug saw a 404 and went looking for a
    // key that is present and fine.
    console.warn(
      `[img] the optimizer refused the ${format}/${width} derivative of "${providerKey}" with ` +
        `${upstream.status}: ${(await upstream.text().catch(() => '')).slice(0, 200).trim() || '(no body)'}`,
    );
    return new Response('derivative not found', { status: 404 });
  }

  // Headers are BUILT, never copied: the optimizer's own `Vary: Accept` must not survive into this response —
  // this URL means one format, always.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      // The master is immutable by construction (a changed image mints a new provider_key) and every derivative
      // parameter is in the path, so this address can never mean different bytes tomorrow.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

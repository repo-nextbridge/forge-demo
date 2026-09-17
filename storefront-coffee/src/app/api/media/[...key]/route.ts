// S6-IMAGES — the same-origin door to the media MASTER, so `next/image` can derive from it on demand.
//
// WHY IT EXISTS. The master is the contract (never compressed, never pre-derived on upload); the derivatives
// (webp/avif, responsive widths) are produced ON DEMAND at serving time by the Next optimizer. The optimizer
// only fetches a REMOTE host if that host is in `images.remotePatterns` — and `output: standalone` freezes the
// config into the build, while the media base (FORGE_MEDIA_BASE_URL) is per-instance RUNTIME config. A
// build-time allowlist would tie one Docker image to one bucket and break the fleet ("code goes down, one image
// serves N instances"). Serving the master under our OWN origin sidesteps that entirely: to the optimizer this
// is a local image, so there is nothing to allowlist and `next.config.mjs` needs no `images` block at all.
//
// WHY IT IS NOT AN OPEN PROXY. The only caller input is the catalog's opaque `provider_key` — a KEY, not an
// address. The base is read from the server env and joined here; the browser can never point the fetch at a
// host of its choosing. `normalizeProviderKey` rejects traversal/scheme/authority/control bytes BEFORE any
// fetch happens (see lib/media/key.ts).
//
// NOTE: this is the ONE place in the storefront that joins base+key. The addresses the storefront RENDERS
// (og:image, JSON-LD, the zoom) still come from the kernel's read-time `url` — the kernel remains the only
// thing that mints a public media address.
//
// F4 — WHAT THIS DOOR SAYS THE BYTES ARE. A bucket that never had a type set on the object serves it as
// `application/octet-stream` (or with no header at all), and this route used to pass that straight through.
// `MediaImage`'s unoptimized branch renders this URL as an `<img src>` with no optimizer in between, so that
// placeholder reaches the browser and the image survives only because browsers sniff `<img>` bytes themselves.
// The head of the stream is peeked and the type derived from it instead — see lib/master-content-type.ts for
// the measurement and for why the KEY's extension is the wrong signal once the bytes are in hand.
//
// THE BYTES WIN OVER THE HEADER, and the reason is the SISTER DOOR: `/api/img` hands this same object to the
// Next optimizer, which resolves it as `detectContentType(buffer) || header` — sniff first. A door here that
// preferred the header would type the master differently from its own derivative whenever a bucket states the
// wrong type, for one key, on one page. Two doors disagreeing about one object is a defect with an appointment.
// The bucket's claim is not thrown away: it answers for every format the detector has no signature for.
//
// AND WHEN EVEN THE BYTES DO NOT SAY: the object still streams (it degrades, it does not break the page) and
// the reason goes to the LOG, not to the response. A public answer that distinguished "no such key" from "key
// found, bytes unidentifiable" would tell an anonymous caller which keys exist in the bucket; a human debugging
// a broken thumbnail otherwise has nothing at all to go on, and goes looking for a key that is present and
// fine. So: same response, and the cause survives where an operator can read it.

import { joinMediaBase, normalizeProviderKey } from '@forgeco/storefront-kit/media/key';
import { masterContentType, SNIFF_BYTES, UNKNOWN_CONTENT_TYPE } from '@/lib/master-content-type';

/** The bucket/CDN base the kernel also resolves against. Unset → this route serves nothing (honest 404). */
function mediaBase(): string | undefined {
  return process.env.FORGE_MEDIA_BASE_URL || undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await params;
  const providerKey = normalizeProviderKey(key);
  if (providerKey === null) return new Response('invalid media key', { status: 400 });

  const base = mediaBase();
  if (!base) return new Response('media base not configured', { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(joinMediaBase(base, providerKey));
  } catch {
    return new Response('media unavailable', { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response('media not found', { status: 404 });

  const { head, body } = await peekHead(upstream.body);
  const contentType = masterContentType(upstream.headers.get('content-type'), head);
  if (contentType === UNKNOWN_CONTENT_TYPE) {
    console.warn(
      `[media] the bucket sent no usable content-type for "${providerKey}" and its first ${head.length} ` +
        'byte(s) match no image format the kernel accepts, so it is being served as ' +
        `${UNKNOWN_CONTENT_TYPE}. The object EXISTS: this is not a missing key. Either set the type on the ` +
        'object in the bucket, or check what was actually uploaded under that key.',
    );
  }

  // The provider_key is minted per upload (ULID-prefixed) and its bytes never change — the master is immutable
  // by construction, so it is safe to cache hard. The optimizer's own cache sits in front of this.
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * Read just enough of the stream to identify the image, and hand back BOTH the head and a stream that still
 * starts at byte zero. The master is never buffered: what was read is re-enqueued and the rest is pulled
 * through as the client consumes it, so a 40 MB master still costs one chunk of memory here.
 */
async function peekHead(
  stream: ReadableStream<Uint8Array>,
): Promise<{ head: Uint8Array; body: ReadableStream<Uint8Array> }> {
  const reader = stream.getReader();
  const read: Uint8Array[] = [];
  let size = 0;
  let ended = false;
  // A signature can straddle chunk boundaries, so this loops on the BYTE COUNT and stops on the stream — never
  // on the first chunk, which a proxy is free to make one byte long.
  while (size < SNIFF_BYTES) {
    const next = await reader.read();
    if (next.done) {
      ended = true;
      break;
    }
    read.push(next.value);
    size += next.value.length;
  }

  const head = new Uint8Array(Math.min(size, SNIFF_BYTES));
  let written = 0;
  for (const chunk of read) {
    if (written >= head.length) break;
    const take = chunk.subarray(0, head.length - written);
    head.set(take, written);
    written += take.length;
  }

  return {
    head,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of read) controller.enqueue(chunk);
        if (ended) controller.close();
      },
      async pull(controller) {
        const next = await reader.read();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    }),
  };
}

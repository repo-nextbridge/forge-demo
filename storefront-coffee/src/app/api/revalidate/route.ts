// On-demand revalidation hook (secret-guarded) — the mechanism that lets the event→projection cycle close the
// loop: the admin (and, in production, a relay consumer / connector) calls this with the tags that changed and
// the storefront drops what depended on them.
//
// PERF-B — WHAT IT INVALIDATES GREW. It always dropped the read-cache entries carrying the tag; now that the
// catalog's HTML is edge-cached, `revalidateTag` drops the RENDERED PAGES too — Next invalidates the full
// route cache entry of any route whose fetches carried the tag, which is what makes "invalidation by event is
// the authority, the TTL is only a backstop" (PERF decision 2) true of the HTML and not just of the data.
// Proven end to end in scripts/edge-cache-proof.mjs: price changes → cached page keeps showing the old one →
// this hook → next visit shows the new one.
//
// It also asks the EDGE to drop the same tags, through a driver (lib/edge-purge.ts) whose default is `none`:
// the origin is always purged, and a CDN in front converges on the TTL unless the instance registered a
// driver that can tell it sooner.
//
// POST /api/revalidate?tag=<tag>[&tag=<tag>…]   with header  x-revalidate-secret: <FORGE_REVALIDATE_SECRET>
// `tag` may repeat, so one event that touches several tags is one call — and a single `tag` is exactly the
// call the admin has always made.

import { revalidateSecret } from '@forgecommerce/storefront-kit/config';
import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { purgeEdge } from '@/lib/edge-purge';

/** A crafted call must not be able to sweep the whole cache in one request. */
const MAX_TAGS = 50;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = revalidateSecret();
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const tags = req.nextUrl.searchParams
    .getAll('tag')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);
  if (tags.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing tag' }, { status: 400 });
  }
  for (const tag of tags) revalidateTag(tag);
  const edge = await purgeEdge(tags);
  // `revalidated` stays a plain list; the admin reads only `ok`, and a caller that sent one tag gets one back.
  return NextResponse.json({ ok: true, revalidated: tags, edge });
}

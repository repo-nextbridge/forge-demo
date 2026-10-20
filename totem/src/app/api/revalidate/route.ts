// ★★ POS-DEMO-PURGE (2026-10-20) — THE COUNTER'S INVALIDATION HOOK, the café's route minus the edge.
//
// WHY THE TOTEM NEEDS ONE, MEASURED. Since v0.3.3 (VC-1, #45) the totem's data cache lives on a VOLUME
// (`totem_cache`, compose.override.yml) and survives a deploy, and its reads ARE cached: every read of the
// kit's `createReadClient` asks for `next: { revalidate, tags }` (storefront-kit 0.3.3, `src/read-client.ts`
// `read()`), and `force-dynamic` on the page does not undo that (see `next.config.mjs`). With no route here the
// kernel could not reach it, so a price changed in the admin reached the counter only when the read's TTL ran
// out — up to an hour. The kernel now lists this service among its purge targets (FORGE_STOREFRONT_URL in
// compose.override.yml) and `bin/purge-targets.guard.mjs` holds the two together.
//
// POST /api/revalidate?tag=<tag>[&tag=<tag>…]   with header  x-revalidate-secret: <FORGE_REVALIDATE_SECRET>
//
// THE CONTRACT IS THE CAFÉ'S (`storefront-coffee/src/app/api/revalidate/route.ts`), because the caller is the
// same kernel posting the same call to every target: the secret is enforced and never open by default, every
// tag sent is dropped in one call, a call is capped at 50 tags, and a tag this process never cached is a no-op
// that still answers 200 — the kernel posts EVERY event of EVERY tenant here, so most tags it sends are of
// shops this counter does not serve, and answering them with an error would fill the kernel's log with
// failures that are not failures.
//
// ⚠️ NO EDGE DRIVER, unlike the café: the counter's host is served by Caddy straight to this process, with no
// CDN in front, so the origin is the whole cache. A totem put behind a CDN would need the café's `purgeEdge`.

import { revalidateSecret } from '@forgeco/storefront-kit/config';
import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
  return NextResponse.json({ ok: true, revalidated: tags });
}

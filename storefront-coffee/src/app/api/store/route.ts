// GET /api/store — which store did the port CONFIRM for this request, for the error boundaries whose links
// have to point somewhere.
//
// It exists for the same reason /api/account/status does. The store-scoped 404 used to read the
// `x-forge-store` request header the middleware sets — and `headers()` in `not-found.tsx` made EVERY page of
// the (storefront) group dynamic at runtime, because Next renders the not-found boundary as part of the
// route's static shell (a trivial page in the group answered "Page changed from static to dynamic at
// runtime, reason: headers"). A route handler is dynamic by nature and outside any page's render, so the
// header read is free here and costs the catalog nothing.
//
// ★★ MS-M1α — THE STORE IS THE CALLER'S, AND ONLY THEN THE HOST'S. This route used to resolve the store from
// the request Host alone, and the 2026-08-13 multi-tenant test measured the consequence: on a deployment where
// one Host serves N tenants, a fragment fetched from inside `/s/<store-of-tenant-B>` was answered for TENANT
// A — the fetch carries no `/s/` prefix, so the Host answered for whoever owns the hostname. The callers now
// say which store they are standing in and this reads it through the class's one helper. Unknown store → a
// null answer, never a guess.
//
// ── ★ WHY A BOUNDARY CANNOT ANSWER THIS FOR ITSELF ────────────────────────────────────────────────────────
// Placing a path in an address space is the RENDERER's job (`storeHref`), and the base is a fact about the
// request the browser is making. What a boundary cannot know on its own is whether the id in its address bar
// is a store that EXISTS — `/s/<anything>/x` reaches it, because the group's layout renders the chrome for
// whatever id the URL carries and does not check it. A 404 whose "Voltar à loja" points into a store nobody
// has is one dead page turned into two. So this answers with the store the port actually RESOLVED, and `null`
// when the read did not land.
//
// ⚠️ IT ANSWERS WITH A STORE AND NOTHING ELSE, AND THAT IS THE POINT OF ITS NAME. It used to hand back a chip
// row of top-level categories for the 404 to offer as a way out; this shop wants no browsable category links
// in its chrome or on its error pages, so the row and the two reads behind it (`read.categories` filtered by
// `read.category_paths`) went with it. A route that answered with a shelf again would be re-growing that row
// through another door.
//
// ★ THE PROBE IS `read.store_flags`, WHICH IS THE CHEAPEST THING THAT CAN SAY "THIS STORE EXISTS": one
// store-scoped, ISR-cached row that answers null for an id nobody owns. The category map it replaced was a
// TENANT-wide document read for its truthiness alone.

import { readClient } from '@forgecommerce/storefront-kit/config';
import { NextResponse } from 'next/server';
import { resolveRequestStore } from '@/lib/store-context';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const named = await resolveRequestStore(req);
  if (!named) return NextResponse.json({ store: null });

  const flags = await readClient()
    .storeFlags(named)
    .catch(() => null);
  return NextResponse.json({ store: flags ? named : null });
}
